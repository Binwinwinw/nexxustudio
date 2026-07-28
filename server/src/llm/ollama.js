/* server/src/llm/ollama.js */
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { looksLooping } from "../agent/utils/qualityGuards.js";
import turnTelemetry from "../agent/telemetry/turnTelemetry.js";
import thermalTelemetry from "../agent/telemetry/thermalTelemetry.js";
import { MODEL_CONFIG } from "../config/models.js";

dotenv.config();

class OllamaClient {
  constructor() {
    let rawHost = process.env.OLLAMA_HOST || "http://localhost:11434";
    rawHost = rawHost.trim();

    if (!rawHost.startsWith("http")) {
      rawHost = `http://${rawHost}`;
    }

    if (rawHost.includes("0.0.0.0")) {
      rawHost = rawHost.replace("0.0.0.0", "127.0.0.1");
    }

    this.host = rawHost;
    this.streamController = null;
    this.activeModels = new Set();
    this.currentChatModel = null;
    this.thermalStates = new Map(); // model -> { state: 'HOT'|'WARM'|'COLD', lastUsed: timestamp, loadTime: ms }
    this.queueDepths = new Map(); // model -> number
    this.heartbeatInterval = null;
    this.modelWeights = this.loadModelWeights();
    this.lastPanicTime = 0;
    this.lastRestrictedTime = 0;
    this.currentGovernanceMode = "CRUISE";
    this.vramLimit = parseFloat(process.env.OLLAMA_VRAM_LIMIT_GB) || 24;

    // --- VRAM GOVERNANCE POLICY (V4.1) ---
    this.VRAM_THRESHOLDS = {
      HIGH: 0.9, // Enter PANIC / Start Eviction
      LOW: 0.82, // Exit PANIC / Recovery
      RESTRICTED: 0.75,
    };
    this.COOLDOWN_MS = 45000; // 45s stabilization window

    this.detectVRAMCapacity();
    this.isStreaming = false;

    console.log(`[Ollama] System initialized with host: ${this.host}`);
    this.startHeartbeat();
  }

  async detectVRAMCapacity() {
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(
        "nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits",
      );
      const totalMb = parseInt(stdout.trim());
      if (!isNaN(totalMb)) {
        this.vramLimit = parseFloat((totalMb / 1024).toFixed(2));
        console.log(
          `[Ollama][Hardware] Detected VRAM Capacity: ${this.vramLimit}GB`,
        );
      }
    } catch (err) {
      console.warn(
        `[Ollama][Hardware] VRAM detection failed, using fallback: ${this.vramLimit}GB`,
      );
    }
  }

  loadModelWeights() {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const configPath = path.resolve(
        __dirname,
        "../../config/warmup.matrix.json",
      );
      const config = fs.readJsonSync(configPath);
      const weights = {};
      Object.values(config.tiers).forEach((tier) => {
        tier.models.forEach((m) => {
          weights[m.id] = {
            base: m.vram_gb || 4,
            priority: m.priority || 3,
            context_overhead: m.context_gb_per_8k || 1,
          };
        });
      });
      return weights;
    } catch (err) {
      console.warn("[Ollama] Failed to load model weights, using defaults.");
      return {};
    }
  }

  async calculateVRAMPressure() {
    // Neural Metrics Cache (Anti-Thrashing v4.2)
    if (this._vramCache && Date.now() - this._vramCache.time < 2000) {
      return this._vramCache.value;
    }

    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(
        "nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits",
      );
      const usedMb = parseInt(stdout.trim());
      if (!isNaN(usedMb)) {
        const val = parseFloat((usedMb / 1024).toFixed(2));
        this._vramCache = { value: val, time: Date.now() };
        return val;
      }
    } catch (e) {
      // Fallback to estimate
      let total = 0;
      this.activeModels.forEach((model) => {
        const w = this.modelWeights[model] || { base: 4, context_overhead: 1 };
        total += w.base;
        total += w.context_overhead;
      });
      return total;
    }
    return 0;
  }

  startHeartbeat() {
    if (this.heartbeatInterval) return;

    // Heartbeat every 10 minutes (Sovereign Residency V3.2.1)
    this.heartbeatInterval = setInterval(
      async () => {
        // 🛡️ STREAM LOCK : On ne fait pas de maintenance si un flux est actif
        if (this.isStreaming) return;

        // 1. Core Residency
        const coreModel = MODEL_CONFIG.TIER_1.model;
        try {
          if (this.activeModels.has(coreModel)) {
            console.log(
              `[Ollama][HEARTBEAT] Refreshing residency for ${coreModel}...`,
            );
            await this.chat([{ role: "user", content: "Ping" }], coreModel, {
              num_predict: 1,
              keep_alive: "-1",
            });
          }
        } catch (err) {
          console.warn("[Ollama][HEARTBEAT] Core refresh failed:", err.message);
        }

        // 2. Panic Drain Check (V4.1)
        const pressureGb = await this.calculateVRAMPressure();
        const vramLimit = this.vramLimit;
        if (pressureGb > vramLimit * this.VRAM_THRESHOLDS.HIGH) {
          if (
            pressureGb !== this.lastPressureLog ||
            this.heartbeatCount % 6 === 0
          ) {
            console.warn(
              `[Ollama][PANIC_DRAIN] VRAM Pressure critical (${pressureGb}/${vramLimit}GB). Triggering selective LRU drain...`,
            );
            this.lastPressureLog = pressureGb;
          }
          thermalTelemetry.recordPanic(true);
          await this.panicDrain();
          thermalTelemetry.recordPanic(false);
        }
        this.heartbeatCount = (this.heartbeatCount || 0) + 1;
      },
      10 * 60 * 1000,
    );
  }

  async panicDrain() {
    // Version "Sélective" : on ne décharge que les spécialistes (priorité 3) les moins récents
    const targets = await Promise.all(
      [...this.activeModels]
        .filter((m) => {
          const w = this.modelWeights[m];
          return w && w.priority === 3;
        })
        .map(async (m) => {
          const state = await this.getThermalState(m);
          const thermalData = this.thermalStates.get(m) || { lastUsed: 0 };
          return { model: m, lastUsed: thermalData.lastUsed, state };
        }),
    );

    targets.sort((a, b) => a.lastUsed - b.lastUsed);

    // On n'en décharge qu'un ou deux au lieu de tout vider d'un coup
    const toUnload = targets.slice(0, 2);
    for (const item of toUnload) {
      await this.unloadModel(item.model);
    }
  }

  stopAll() {
    if (this.streamController) {
      console.log(
        "[Ollama] 🛑 ABORT SIGNAL RECEIVED. Stopping current stream...",
      );
      this.streamController.abort();
      this.streamController = null;
    }
  }

  shouldAbortStream(accumulatedText = "", model = "") {
    const text = accumulatedText.toLowerCase();
    if (!text.trim()) return false;

    // HOTFIX 4: Soften for VOX
    const isVox = model.toLowerCase().includes("vox");
    const threshold = isVox ? 120 : 80;

    // Utilisation de la garde unifiée NEXXUS
    if (text.length > threshold && looksLooping(text)) return true;

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 120) {
      const a = words.slice(-80, -40).join(" ");
      const b = words.slice(-40).join(" ");
      if (a && b && a === b) return true;
    }

    return false;
  }

  buildChatOptions(options = {}, defaults = {}) {
    const modelName = options.model || defaults.model || "";
    const isHeavy =
      modelName.includes("14b") ||
      modelName.includes("27b") ||
      modelName.includes("30b") ||
      modelName.includes("33b");

    return {
      num_ctx: options.num_ctx ?? defaults.num_ctx ?? 8192,
      temperature: options.temperature ?? defaults.temperature ?? 0.45,
      repeat_penalty: options.repeat_penalty ?? defaults.repeat_penalty ?? 1.2,
      top_p: options.top_p ?? defaults.top_p ?? 0.9,
      stop: options.stop ?? defaults.stop ?? ["</action>", "[READY]"],
      keep_alive: this.calculateKeepAlive(modelName, options.keep_alive),
      ...options,
    };
  }

  calculateKeepAlive(modelName, override) {
    if (override !== undefined) return override;

    const name = modelName.toLowerCase();
    const tier1Chat = MODEL_CONFIG.TIER_1.model.toLowerCase();
    if (name === tier1Chat || name.includes("nomic-embed"))
      return "-1"; // Permanent
    if (name.includes("14b") || name.includes("deepseek-r1")) return "15m"; // Strategic
    if (name.includes("vox") || name.includes("vl") || name.includes("coder") || name.includes("gemma4"))
      return "5m"; // Specialists

    return "10m"; // Default
  }

  async getThermalState(modelName) {
    const active = this.activeModels.has(modelName);
    const queue = this.queueDepths.get(modelName) || 0;

    // 1. SATURATION (Immédiat)
    if (queue > 3) return "SATURATED";

    // 2. GOVERNANCE MODES (With Hysteresis V4.1)
    const pressureGb = await this.calculateVRAMPressure();
    const vramLimit = this.vramLimit;
    const ratio = pressureGb / vramLimit;
    const now = Date.now();

    // Logic: Enter mode at HIGH, exit only at LOW or after COOLDOWN if ratio is safe
    const isWorsening = ratio > this.VRAM_THRESHOLDS.HIGH;
    const isRecovering = ratio < this.VRAM_THRESHOLDS.LOW;
    const inCooldown = now - this.lastPanicTime < this.COOLDOWN_MS;

    if (
      isWorsening ||
      (this.currentGovernanceMode === "PANIC" && !isRecovering)
    ) {
      if (isWorsening && this.currentGovernanceMode !== "PANIC")
        this.lastPanicTime = now;
      this.currentGovernanceMode = "PANIC";
      if (queue > 0) return "SATURATED";
    } else if (
      ratio > this.VRAM_THRESHOLDS.RESTRICTED ||
      (this.currentGovernanceMode === "RESTRICTED" && !isRecovering)
    ) {
      if (
        ratio > this.VRAM_THRESHOLDS.RESTRICTED &&
        this.currentGovernanceMode !== "RESTRICTED"
      )
        this.lastRestrictedTime = now;
      this.currentGovernanceMode = "RESTRICTED";
    } else {
      this.currentGovernanceMode = "CRUISE";
    }

    if (!active) return "COLD";

    const state = this.thermalStates.get(modelName);
    if (!state) return "WARM";

    const idleTime = now - state.lastUsed;
    if (idleTime < 60000) return "HOT"; // Moins d'une minute d'inactivité
    return "WARM";
  }

  /**
   * Sync-style inference but PROTECTED by the output guardrails (V2.2.3)
   * Uses streaming internally to detect loops during "hidden" reasoning.
   */
  async chatSafe(messages, model = "ornith:9b", options = {}) {
    let fullText = "";
    try {
      await this.chatStream(
        messages,
        (token) => {
          fullText += token;
        },
        model,
        options,
      );
      return fullText;
    } catch (err) {
      console.warn(`[Ollama] chatSafe failure on ${model}:`, err.message);
      return fullText; // Return what we got
    }
  }

  async chat(messages, model = "ornith:9b", options = {}) {
    const controller = new AbortController();
    this.queueDepths.set(model, (this.queueDepths.get(model) || 0) + 1);
    this.isStreaming = true;

    try {
      const chatOptions = this.buildChatOptions(options);

      console.log(
        `[Ollama] 🧠 Sync inference on ${model} (ctx:${chatOptions.num_ctx})...`,
      );

      const response = await axios.post(
        `${this.host}/api/chat`,
        {
          model,
          messages,
          stream: false,
          options: chatOptions,
        },
        {
          timeout: 0,
          signal: controller.signal,
        },
      );

      // SYNC STATE ON SUCCESS (v3.11.11)
      this.currentChatModel = model;
      this.activeModels.add(model);
      this.thermalStates.set(model, {
        ...this.thermalStates.get(model),
        lastUsed: Date.now(),
      });

      const msg = response.data?.message || {};
      const content = msg.content || "";
      const reasoning =
        msg.reasoning_content || msg.thinking || msg.thought || "";

      if (reasoning) {
        return `<think>${reasoning}</think>\n${content}`;
      }
      return content;
    } catch (error) {
      if (
        error.code === "ERR_CANCELED" ||
        error.__CANCEL__ ||
        error.name === "AbortError"
      ) {
        console.log(`[Ollama] 🛑 Sync inference on ${model} cancelled.`);
        return "";
      }

      {
        const detail =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;
        console.error("[Ollama] Chat Error:", detail);
        if (detail && detail !== error.message) {
          const enriched = new Error(detail);
          enriched.status = error.response?.status;
          enriched.cause = error;
          throw enriched;
        }
        throw error;
      }
    } finally {
      this.isStreaming = false; // Unlock maintenance
      this.queueDepths.set(
        model,
        Math.max(0, (this.queueDepths.get(model) || 1) - 1),
      );
    }
  }

  async chatStream(
    messages,
    onToken,
    model = "ornith:9b",
    options = {},
    keepAlive = 1800,
  ) {
    this.isStreaming = true; // Lock maintenance
    const controller = new AbortController();
    this.streamController = controller;
    const requestStart = Date.now();
    this.queueDepths.set(model, (this.queueDepths.get(model) || 0) + 1);

    try {
      const chatOptions = this.buildChatOptions(options);

      console.log(
        `[Ollama] 🧠 Streaming ${model} (ctx:${chatOptions.num_ctx}, temp:${chatOptions.temperature}, rp:${chatOptions.repeat_penalty})...`,
      );

      const response = await axios.post(
        `${this.host}/api/chat`,
        {
          model,
          messages,
          stream: true,
          keep_alive: keepAlive,
          options: chatOptions,
        },
        {
          responseType: "stream",
          timeout: 0,
          signal: controller.signal,
        },
      );

      // SYNC STATE ON SUCCESS (v3.11.11)
      this.currentChatModel = model;
      this.activeModels.add(model);
      this.thermalStates.set(model, {
        ...this.thermalStates.get(model),
        lastUsed: Date.now(),
      });

      return new Promise((resolve, reject) => {
        const decoder = new TextDecoder();
        let buffer = "";
        let tokensReceived = 0;
        let settled = false;
        let accumulatedText = "";
        let firstDataLogged = false;
        let firstTokenLogged = false;

        const finish = (payload) => {
          if (settled) return;
          settled = true;
          this.streamController = null;
          resolve(payload);
        };

        const fail = (err) => {
          if (settled) return;
          settled = true;
          this.streamController = null;
          reject(err);
        };

        response.data.on("data", (chunk) => {
          if (!firstDataLogged) {
            console.log(
              `[Ollama] 📡 Data transmission established for ${model}`,
            );
            firstDataLogged = true;
          }

          // DEBUG: Log raw buffer length
          // console.log(`[Ollama] ⚙️ Chunk received (${chunk.length} bytes)`);

          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const json = JSON.parse(line);
              const content = json.message?.content || "";
              const reasoning =
                json.message?.reasoning_content ||
                json.message?.thinking ||
                json.message?.thought ||
                "";
              const token = content || reasoning;

              if (token) {
                if (!firstTokenLogged) {
                  const ttft = Date.now() - requestStart;
                  console.log(
                    `[Ollama] 🗣️ Token stream started (TTFT: ${ttft}ms)`,
                  );
                  turnTelemetry.setMetric("ttft", ttft);
                  firstTokenLogged = true;
                }

                tokensReceived++;

                // Support Universel de Raisonnement (V2.5.7)
                const isReasoningField = !!(
                  json.message?.reasoning_content ||
                  json.message?.thinking ||
                  json.message?.thought
                );

                let finalToken = token;
                if (isReasoningField && !accumulatedText.includes("<think>")) {
                  finalToken = `<think>${token}`;
                } else if (
                  !isReasoningField &&
                  accumulatedText.includes("<think>") &&
                  !accumulatedText.includes("</think>")
                ) {
                  finalToken = `</think>${token}`;
                }

                accumulatedText += finalToken;
                onToken(finalToken);

                if (this.shouldAbortStream(accumulatedText, model)) {
                  console.warn(
                    `[Ollama] 🔁 Safeguard: Repetition pattern detected in [${model}], aborting stream.`,
                  );
                  controller.abort();
                  return;
                }
              }

              if (json.done) {
                if (
                  accumulatedText.includes("<think>") &&
                  !accumulatedText.includes("</think>")
                ) {
                  const closeTag = "</think>";
                  accumulatedText += closeTag;
                  onToken(closeTag);
                }

                const totalDuration = Date.now() - requestStart;
                const ttft = turnTelemetry.metrics.ttft || 0;
                const generationDuration = totalDuration - ttft;
                const tps =
                  generationDuration > 0
                    ? tokensReceived / (generationDuration / 1000)
                    : 0;

                console.log(
                  `[Ollama] ✅ Stream done (${tokensReceived} tokens, TPS: ${tps.toFixed(2)})`,
                );

                turnTelemetry.setMetric("tps", parseFloat(tps.toFixed(2)));
                turnTelemetry.setMetric("totalTokens", tokensReceived);

                finish(json);
                return;
              }
            } catch {
              // Ligne incomplète ou bruit JSONL, on ignore.
            }
          }
        });

        response.data.on("end", () => {
          if (buffer.trim()) {
            try {
              const json = JSON.parse(buffer);
              if (json.message?.content) {
                onToken(json.message.content);
              }
              finish(json.done ? json : { done: true, tail: json });
              return;
            } catch {
              finish({ done: true });
              return;
            }
          }

          finish({ done: true });
        });

        response.data.on("error", (err) => {
          if (
            err.code === "ERR_CANCELED" ||
            err.message === "aborted" ||
            err.name === "AbortError"
          ) {
            console.log(`[Ollama] 🛑 Stream for ${model} cleanly aborted.`);
            finish({ done: true, aborted: true });
          } else {
            fail(err);
          }
        });
      }).finally(() => {
        this.isStreaming = false; // Unlock maintenance
        this.queueDepths.set(
          model,
          Math.max(0, (this.queueDepths.get(model) || 1) - 1),
        );
      });
    } catch (error) {
      this.isStreaming = false; // Unlock maintenance
      this.streamController = null;

      if (
        error.code === "ERR_CANCELED" ||
        error.__CANCEL__ ||
        error.name === "AbortError"
      ) {
        console.log(`[Ollama] 🛑 Stream for ${model} intentionally cancelled.`);
        return { done: true, aborted: true };
      }

      {
        const detail =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;
        console.error("[Ollama] Chat Error:", detail);
        if (detail && detail !== error.message) {
          const enriched = new Error(detail);
          enriched.status = error.response?.status;
          enriched.cause = error;
          throw enriched;
        }
        throw error;
      }
    }
  }

  async ensureModel(modelName, onLog = null) {
    // 1. STATE_HIT : Le client sait déjà que c'est le modèle courant
    if (this.currentChatModel === modelName) {
      const msg = `🎯 [Ollama][STATE_HIT] Modèle [${modelName}] déjà actif.`;
      console.log(msg);
      if (onLog) onLog(msg);
      return true;
    }

    // 2. GPU_HIT : Le modèle est chargé mais n'était pas le "dernier utilisé"
    if (this.activeModels.has(modelName)) {
      const msg = `⚡ [Ollama][GPU_HIT] Switch vers [${modelName}] (résident VRAM).`;
      console.log(msg);
      this.currentChatModel = modelName;
      thermalTelemetry.recordEvent(modelName, "hit");
      if (onLog) onLog(msg);
      return true;
    }

    // 3. POLICY_EVICTION : Si on dépasse la limite (modèles ou VRAM)
    const multiLoadedLimit =
      parseInt(process.env.OLLAMA_MAX_LOADED_MODELS) || 2;
    const vramSoftLimit = this.vramLimit * this.VRAM_THRESHOLDS.HIGH;
    const stickyModels = [MODEL_CONFIG.TIER_1.model, "nomic-embed-text:latest"];

    let currentPressure = await this.calculateVRAMPressure();
    const modelMeta = this.modelWeights[modelName] || {
      base: 4,
      context_overhead: 1,
      priority: 3,
    };
    const newModelWeight = modelMeta.base + modelMeta.context_overhead;

    while (
      this.activeModels.size >= multiLoadedLimit ||
      currentPressure + newModelWeight > vramSoftLimit
    ) {
      // Priorité d'éjection : le plus froid d'abord
      const candidatesRaw = [...this.activeModels].filter(
        (m) => !stickyModels.includes(m),
      );

      // Pre-fetch thermal states because sort cannot be async
      const candidates = await Promise.all(
        candidatesRaw.map(async (m) => {
          const state = await this.getThermalState(m);
          const w = this.modelWeights[m]?.priority || 3;
          return { name: m, priority: w, state };
        }),
      );

      candidates.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority; // On éjecte les priorités 3 d'abord
        const order = { COLD: 0, WARM: 1, HOT: 2, SATURATED: 3 };
        return (order[a.state] || 0) - (order[b.state] || 0);
      });

      if (candidates.length > 0) {
        const modelToPurge = candidates[0].name;
        const reason =
          this.activeModels.size >= multiLoadedLimit
            ? "COUNT_LIMIT"
            : "VRAM_PRESSURE";

        // SOVEREIGN PROTECTION (V3.3.3)
        const meta = this.modelWeights[modelToPurge];
        if (meta && meta.priority === 1) {
          console.error(
            `[Ollama][SOVEREIGN_VIOLATION] Attempting to evict Priority 1 model: ${modelToPurge}! Blocking.`,
          );
          break;
        }

        const msg = `🔄 [Ollama][THERMAL_EVICTION] Éjection de [${modelToPurge}] (${reason}) pour libérer la place...`;
        console.log(msg);
        thermalTelemetry.recordEvent(modelToPurge, "eviction");
        if (onLog) onLog(msg);
        await this.unloadModel(modelToPurge);
        currentPressure = await this.calculateVRAMPressure();
      } else {
        break; // Impossible d'éjecter plus (stickies uniquement)
      }
    }

    // 4. RELOAD : Chargement physique
    const startLoad = Date.now();
    const msg = `💾 [Ollama][RELOAD] Chargement physique de [${modelName}] en VRAM...`;
    console.log(msg);
    if (onLog) onLog(msg);

    this.activeModels.add(modelName);
    this.currentChatModel = modelName;
    const loadTime = Date.now() - startLoad;
    this.thermalStates.set(modelName, {
      state: "WARM",
      lastUsed: Date.now(),
      loadTime,
    });
    thermalTelemetry.recordEvent(modelName, "reload", { loadTime });
    return true;
  }

  async unloadModel(modelName) {
    try {
      console.log(`[Ollama] 🧹 Purging model from memory: ${modelName}`);
      await axios.post(`${this.host}/api/chat`, {
        model: modelName,
        messages: [],
        keep_alive: 0,
      });
      this.activeModels.delete(modelName);
      if (this.currentChatModel === modelName) this.currentChatModel = null;
      return true;
    } catch (error) {
      console.error(
        `[Ollama] Failed to unload model ${modelName}:`,
        error.message,
      );
      return false;
    }
  }

  async getEmbedding(text, model = "nomic-embed-text") {
    try {
      const response = await axios.post(`${this.host}/api/embeddings`, {
        model,
        prompt: text,
        keep_alive: "5m",
      });
      return response.data.embedding;
    } catch (error) {
      console.error(`[Ollama] Embedding Error (${model}):`, error.message);
      throw error;
    }
  }
}

export default new OllamaClient();

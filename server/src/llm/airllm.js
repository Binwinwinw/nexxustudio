import axios from "axios";
import dotenv from "dotenv";
import { looksLooping } from "../agent/utils/qualityGuards.js";

dotenv.config();

export const NEXXUS_MODELS = [
  "ornith:9b",
  "qwen3.5:9b",
  "qwen2.5-coder:7b",
  "deepseek-r1:7b",
  "gemma4:e2b",
  "gemma4:e4b",
  "gemma4:latest",
  "gemma4:26b",
  "gemma4:31b",
  "mistral-nemo:latest",
  "nemotron3:33b",
  "granite4.1:30b",
  "zephyr:latest",
  "qwen3-vl:4b",
  "qwen3-vl:8b",
];

function isAirLLMEnabled() {
  return process.env.USE_AIRLLM === "true";
}

const AIRLLM_HOST = String(
  process.env.AIRLLM_HOST || "http://127.0.0.1:11436",
).trim();

let activeController = null;

function normalizeModelName(modelName) {
  return String(modelName || "").toLowerCase();
}

function isSupportedModel(modelName) {
  const norm = normalizeModelName(modelName);
  return NEXXUS_MODELS.some((m) => m.toLowerCase() === norm);
}

function assertAirLLMEnabled(modelName) {
  if (!isAirLLMEnabled()) {
    throw new Error(
      "AirLLM is disabled. Set USE_AIRLLM=true to enable the heavy model streaming path.",
    );
  }
  if (!isSupportedModel(modelName)) {
    throw new Error(
      `AirLLM does not support the requested model: ${modelName}`,
    );
  }
}

function buildChatOptions(options = {}, defaults = {}) {
  return {
    num_ctx: options.num_ctx ?? defaults.num_ctx ?? 4096,
    temperature: options.temperature ?? defaults.temperature ?? 0.45,
    repeat_penalty: options.repeat_penalty ?? defaults.repeat_penalty ?? 1.2,
    top_p: options.top_p ?? defaults.top_p ?? 0.9,
    stop: options.stop ?? defaults.stop ?? ["<action>", "[READY]"],
    ...options,
  };
}

function shouldAbortStream(accumulatedText = "") {
  const text = accumulatedText.toLowerCase();
  if (!text.trim()) return false;
  if (text.length > 5000) return true;
  if (text.length > 120 && looksLooping(text)) return true;
  return false;
}

export async function ensureModel(modelName, onLog = null) {
  assertAirLLMEnabled(modelName);
  const msg = `🧠 [AirLLM] Optimisation active : chargement de ${modelName}...`;
  console.log(`[AirLLM] ${msg}`);
  if (onLog) onLog(msg);
  return true;
}

export async function chat(messages, modelName, options = {}) {
  assertAirLLMEnabled(modelName);
  const chatOptions = buildChatOptions(options);

  try {
    const response = await axios.post(
      `${AIRLLM_HOST}/api/chat`,
      {
        model: modelName,
        messages,
        stream: false,
        options: chatOptions,
      },
      {
        timeout: 0,
      },
    );

    const msg = response.data?.message || {};
    const content = msg.content || "";
    const reasoning =
      msg.reasoning_content || msg.thinking || msg.thought || "";

    if (reasoning) {
      return `<think>${reasoning}</think>\n${content}`;
    }

    return content;
  } catch (error) {
    if (error.code !== "ECONNREFUSED") {
      console.error(`[AirLLM] Chat Error: ${error.message}`);
    }
    throw error;
  }
}

export async function chatStream(
  messages,
  onToken,
  modelName,
  options = {},
  keepAlive = 1800,
) {
  assertAirLLMEnabled(modelName);
  const controller = new AbortController();
  activeController = controller;
  const chatOptions = buildChatOptions(options);

  try {
    const response = await axios.post(
      `${AIRLLM_HOST}/api/chat`,
      {
        model: modelName,
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

    return await new Promise((resolve, reject) => {
      const decoder = new TextDecoder();
      let buffer = "";
      let settled = false;
      let accumulatedText = "";
      let firstDataLogged = false;
      let firstTokenLogged = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      response.data.on("data", (chunk) => {
        if (!firstDataLogged) {
          console.log(
            `[AirLLM] 📡 Data transmission established for ${modelName}`,
          );
          firstDataLogged = true;
        }

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            const token =
              json.message?.content ||
              json.message?.reasoning_content ||
              json.message?.thinking ||
              json.message?.thought ||
              "";

            if (!token) {
              if (json.done) {
                finish(json);
              }
              continue;
            }

            if (!firstTokenLogged) {
              console.log("[AirLLM] 🗣️ Token stream started");
              firstTokenLogged = true;
            }

            accumulatedText += token;
            onToken(token);

            if (shouldAbortStream(accumulatedText)) {
              console.warn(
                `[AirLLM] 🔁 Safeguard: repetition or runaway output detected for ${modelName}, aborting stream.`,
              );
              controller.abort();
              return;
            }
          } catch {
            // Ignore parse failures on partial JSON chunks.
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
          console.log(`[AirLLM] 🛑 Stream for ${modelName} aborted.`);
          finish({ done: true, aborted: true });
        } else {
          fail(err);
        }
      });
    });
  } catch (error) {
    activeController = null;

    if (
      error.code === "ERR_CANCELED" ||
      error.__CANCEL__ ||
      error.name === "AbortError"
    ) {
      console.log(`[AirLLM] 🛑 Stream for ${modelName} cleanly cancelled.`);
      return { done: true, aborted: true };
    }

    if (error.code !== "ECONNREFUSED") {
      console.error(`[AirLLM] Chat Error: ${error.message}`);
    }
    throw error;
  } finally {
    activeController = null;
  }
}

export function stopAll() {
  if (activeController) {
    console.log(
      "[AirLLM] 🛑 ABORT SIGNAL RECEIVED. Stopping current stream...",
    );
    activeController.abort();
    activeController = null;
  }
}

export async function unloadModel(modelName) {
  assertAirLLMEnabled(modelName);
  const normalized = normalizeModelName(modelName);
  if (!isSupportedModel(normalized)) {
    return false;
  }

  try {
    if (AIRLLM_HOST) {
      await axios.post(`${AIRLLM_HOST}/api/chat`, {
        model: modelName,
        messages: [],
        keep_alive: 0,
      });
    }
  } catch (error) {
    console.warn(
      `[AirLLM] Unable to unload model ${modelName}: ${error.message}`,
    );
  }

  console.log(`[AirLLM] Unloading model from AirLLM cache: ${modelName}`);
  return true;
}

export async function getEmbedding(text) {
  if (!isAirLLMEnabled()) {
    throw new Error("AirLLM embedding is disabled.");
  }
  try {
    const response = await axios.post(`${AIRLLM_HOST}/api/embeddings`, {
      model: "nomic-embed-text",
      prompt: text,
      keep_alive: "5m",
    });
    return response.data.embedding;
  } catch (error) {
    console.error("[AirLLM] Embedding Error:", error.message);
    return null;
  }
}

export async function checkHealth() {
  if (!isAirLLMEnabled()) return false;
  try {
    // Simple heartbeat check
    await axios.get(`${AIRLLM_HOST}/api/tags`, { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

export default {
  ensureModel,
  chat,
  chatStream,
  unloadModel,
  getEmbedding,
  checkHealth,
};

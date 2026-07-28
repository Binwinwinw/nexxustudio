import ollama from "./ollama.js";
import airllm from "./airllm.js";
import {
  canUseAirLLM,
  supportsAirLLMModel,
  getPreferredHeavyModel as getPreferredHeavyModelFromProbe,
} from "./hardwareProbe.js";

export function isHeavyStreamingModel(modelName) {
  // Now logically equivalent to any model supported by AirLLM optimization
  return supportsAirLLMModel(modelName);
}

let airllmOnline = null;

async function isAirLLMOnline() {
  if (airllmOnline !== null) return airllmOnline;
  airllmOnline = await airllm.checkHealth();
  return airllmOnline;
}

const smartAirLLMProxy = {
  ensureModel: async (model, onLog) => {
    try {
      if (!(await isAirLLMOnline())) {
        throw { code: "ECONNREFUSED" };
      }
      return await airllm.ensureModel(model, onLog);
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        const msg = `ℹ️ [LLM] AirLLM non détecté sur 11436. Utilisation de l'inférence standard (Ollama).`;
        if (airllmOnline === null || airllmOnline === true) {
           console.info(msg);
           airllmOnline = false;
        }
        if (onLog) onLog(msg);
        return await ollama.ensureModel(model, onLog);
      }
      throw err;
    }
  },
  chat: async (messages, model, options) => {
    try {
      if (!(await isAirLLMOnline())) {
        throw { code: "ECONNREFUSED" };
      }
      return await airllm.chat(messages, model, options);
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        return await ollama.chat(messages, model, options);
      }
      throw err;
    }
  },
  chatStream: async (messages, onToken, model, options, keepAlive) => {
    try {
      if (!(await isAirLLMOnline())) {
        throw { code: "ECONNREFUSED" };
      }
      return await airllm.chatStream(
        messages,
        onToken,
        model,
        options,
        keepAlive,
      );
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        return await ollama.chatStream(
          messages,
          onToken,
          model,
          options,
          keepAlive,
        );
      }
      throw err;
    }
  },
  stopAll: () => {
    airllm.stopAll();
    ollama.stopAll();
  },
};

export function getClientForModel(modelName) {
  const normalized = String(modelName || "").toLowerCase();
  if (canUseAirLLM(normalized)) {
    return smartAirLLMProxy;
  }
  return ollama;
}

export function getClientName(modelName) {
  const normalized = String(modelName || "").toLowerCase();
  if (canUseAirLLM(normalized)) {
    return "airllm";
  }
  return "ollama";
}

export function getPreferredHeavyModel() {
  return getPreferredHeavyModelFromProbe();
}

export const OPTIMIZED_MODELS = [
  "gemma4:26b",
  "gemma4:31b",
  "nemotron3:33b",
  "granite4.1:30b",
];

// `nomic-embed-text:latest` remains reserved for embeddings and is not part of the streaming chat candidate set.

export function isAirLLMEnabled() {
  return process.env.USE_AIRLLM === "true";
}

export function getPreferredHeavyModel() {
  const requested = String(process.env.MAX_HEAVY_MODEL || "").toLowerCase();
  if (OPTIMIZED_MODELS.includes(requested)) {
    return requested;
  }
  return "granite4.1:30b"; // Default heavy
}

export function supportsAirLLMModel(modelName) {
  return OPTIMIZED_MODELS.includes(String(modelName || "").toLowerCase());
}

export function canUseAirLLM(modelName) {
  return isAirLLMEnabled() && supportsAirLLMModel(modelName);
}

export function probeGPUCapabilities() {
  return {
    airllmEnabled: isAirLLMEnabled(),
    preferredModel: getPreferredHeavyModel(),
  };
}

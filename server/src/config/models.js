/**
 * Configuration modèles Ollama — tiers warm-up La Citadelle (local-first).
 * Doctrine réactive : Tier 1 au boot, Tier 2 désactivé (reasoner = Tier 1), Tier 3 lazy.
 */
import process from 'node:process';

export const BOOT_PROFILES = Object.freeze(['reactive', 'fast', 'aggressive']);

export const MODEL_CONFIG = Object.freeze({
  TIER_1: Object.freeze({
    model: 'ornith:9b',
    embeddings: 'nomic-embed-text:latest',
    loadAtBoot: true,
    vram_gb: 7.8,
    alternatives: Object.freeze({
      fast: 'qwen3.5:9b',
      multimodal: 'qwen3.5:9b',
    }),
  }),

  TIER_2: Object.freeze({
    enabled: false,
    model: null,
    loadAtBoot: false,
    loadStrategy: 'disabled',
    vram_gb: 0,
    priming_estimate_ms: 0,
    alternatives: Object.freeze({
      heavy: 'deepseek-r1:14b',
    }),
  }),

  TIER_3_EXPERTS: Object.freeze({
    coding: Object.freeze({
      model: 'qwen2.5-coder:7b',
      loadStrategy: 'lazy',
      vram_gb: 4.7,
      // Pas d'alternative 14B — hors stack 8 Go (never / purge).
      alternative: null,
    }),
    // Primaire : gemma4:12b (vision + clip). llama3.2-vision (mllama) cassé Ollama ≥0.30.
    // OCR primaire : glm-ocr:q8_0 (128K, ~1.6 Go). Fallback OCR/vision VL : ocr.fallback.
    vision: Object.freeze({
      model: 'gemma4:12b',
      loadStrategy: 'lazy',
      vram_gb: 7.6,
    }),
    ocr: Object.freeze({
      model: 'glm-ocr:q8_0',
      fallback: 'deepseek-ocr:latest',
      loadStrategy: 'lazy',
      vram_gb: 1.6,
    }),
    voice: Object.freeze({
      model: 'nexxus-vox:latest',
      loadStrategy: 'lazy',
      vram_gb: 0.5,
    }),
  }),

  MAX_CONCURRENT_EXPERTS: 2,
  MAX_VRAM_GB: 20,
});

/**
 * @param {string} [profile]
 */
export function getBootProfile(profile = process.env.OLLAMA_BOOT_PROFILE || 'reactive') {
  const normalized = String(profile || 'reactive').toLowerCase();
  if (normalized === 'fast') return 'fast';
  if (normalized === 'aggressive') return 'aggressive';
  // balanced = ancien nom — mappe vers réactif
  return 'reactive';
}

/**
 * Modèle chat Tier 1 actif selon profil boot.
 * @param {string} [profile]
 */
export function getActiveTier1ChatModel(profile = getBootProfile()) {
  if (profile === 'fast') {
    return MODEL_CONFIG.TIER_1.alternatives.fast;
  }
  return MODEL_CONFIG.TIER_1.model;
}

/**
 * Reasoner runtime = chat Tier 1 (plus de couloir Tier 2 R1).
 * @param {string} [profile]
 */
export function getReasonerModel(profile = getBootProfile()) {
  return getActiveTier1ChatModel(profile);
}

/**
 * @returns {boolean}
 */
export function isTier2Enabled() {
  return MODEL_CONFIG.TIER_2.enabled === true && Boolean(MODEL_CONFIG.TIER_2.model);
}

/**
 * Alternative Tier 1 par usage (fast, multimodal).
 * @param {'fast'|'multimodal'} [kind]
 */
export function getTier1ChatAlternative(kind = 'multimodal') {
  const alternatives = MODEL_CONFIG.TIER_1.alternatives;
  if (kind === 'fast') return alternatives.fast;
  return alternatives.multimodal || alternatives.fast;
}

/**
 * Tier 2 primé au boot — désactivé (doctrine sans Tier 2 actif).
 * @param {string} [profile]
 */
export function shouldWarmTier2AtBoot(profile = getBootProfile()) {
  void profile;
  return false;
}

/** @deprecated Utiliser shouldWarmTier2AtBoot */
export function shouldWarmTier2(profile = getBootProfile()) {
  return shouldWarmTier2AtBoot(profile);
}

/**
 * @param {string} modelName
 */
export function isTier2Model(modelName = '') {
  void modelName;
  return false;
}

/**
 * Liste des experts Tier 3 (lazy).
 */
export function listTier3ExpertModels() {
  return Object.values(MODEL_CONFIG.TIER_3_EXPERTS).map((entry) => entry.model);
}

export default MODEL_CONFIG;

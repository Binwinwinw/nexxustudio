#!/usr/bin/env node
/**
 * Smoke warmup — 15 vérifications models.js ↔ warmup.matrix.json ↔ rôles.
 * Usage : node server/scripts/smoke-warmup-matrix.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODEL_CONFIG,
  getActiveTier1ChatModel,
  getBootProfile,
  getTier1ChatAlternative,
  listTier3ExpertModels,
  getReasonerModel,
  shouldWarmTier2AtBoot,
  isTier2Enabled,
  getTier2Model,
} from '../src/config/models.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_PATH = path.resolve(__dirname, '../config/warmup.matrix.json');

const TIER3_LOG =
  'qwen2.5-coder:7b, gemma4:12b, glm-ocr:q8_0, nexxus-vox:latest';

const checks = [];
let passed = 0;

function check(id, label, ok, detail = '') {
  checks.push({ id, label, ok, detail });
  if (ok) passed += 1;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${id} — ${label}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  const matrix = JSON.parse(await fs.readFile(MATRIX_PATH, 'utf8'));
  const tier2Ids = matrix.tiers.tier2.models.map((m) => m.id);
  const tier3Ids = matrix.tiers.tier3.models.map((m) => m.id);

  console.log('=== Smoke warmup matrix (T1 qwen / T2 granite deferred) ===\n');

  check('W01', 'Tier 1 chat = qwen3.5:2b', MODEL_CONFIG.TIER_1.model === 'qwen3.5:2b');
  check('W02', 'Tier 1 embeddings = nomic', MODEL_CONFIG.TIER_1.embeddings === 'nomic-embed-text:latest');
  check('W03', 'Tier 2 granite deferred', MODEL_CONFIG.TIER_2.enabled === true && MODEL_CONFIG.TIER_2.model === 'granite4.1:8b' && MODEL_CONFIG.TIER_2.loadAtBoot === false);
  check('W04', 'Reasoner = granite4.1:8b', getReasonerModel() === 'granite4.1:8b');
  check('W05', 'Profil défaut = reactive', getBootProfile() === 'reactive');
  check('W06', 'Profil fast → qwen3.5:2b', getActiveTier1ChatModel('fast') === 'qwen3.5:2b');
  check('W07', 'Alternative multimodal → qwen3.5:9b', getTier1ChatAlternative('multimodal') === 'qwen3.5:9b');
  check('W08', 'Coding primary → qwen2.5-coder:7b', MODEL_CONFIG.TIER_3_EXPERTS.coding.model === 'qwen2.5-coder:7b');
  check('W09', 'Tier 2 warm boot off', shouldWarmTier2AtBoot('reactive') === false && shouldWarmTier2AtBoot('aggressive') === false);
  check('W10', 'Matrix tier2 = granite', tier2Ids.length === 1 && tier2Ids[0] === 'granite4.1:8b');
  check('W11', 'Matrix tier2_deferred true', matrix.doctrine.tier2_deferred === true);
  check('W12', 'T1 servi = qwen3.5:2b', getActiveTier1ChatModel() === 'qwen3.5:2b' && isTier2Enabled() && getTier2Model() === 'granite4.1:8b');
  check('W13', 'Matrix fallback coder alt null (14b hors stack)', matrix.settings.fallback.default_coder_alternative == null);
  check('W14', 'Tous experts Tier 3 dans matrix', listTier3ExpertModels().every((m) => tier3Ids.includes(m)));
  check(
    'W15',
    'Ligne TIER-3 exacte',
    listTier3ExpertModels().join(', ') === TIER3_LOG &&
      tier3Ids.includes('gemma4:12b') &&
      tier3Ids.includes('glm-ocr:q8_0') &&
      tier3Ids.includes('deepseek-ocr:latest'),
  );

  console.log(`\n=== Résultat : ${passed}/${checks.length} PASS ===`);
  if (passed !== checks.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

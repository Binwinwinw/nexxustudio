import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODEL_CONFIG,
  getActiveTier1ChatModel,
  getBootProfile,
  getTier1ChatAlternative,
  getReasonerModel,
  listTier3ExpertModels,
  shouldWarmTier2AtBoot,
  shouldWarmTier2,
  isTier2Model,
  isTier2Enabled,
} from '../src/config/models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_PATH = path.resolve(__dirname, '../config/warmup.matrix.json');

test('MODEL_CONFIG: Tier 2 désactivé (reasoner = Tier 1)', () => {
  assert.equal(MODEL_CONFIG.TIER_1.model, 'ornith:9b');
  assert.equal(MODEL_CONFIG.TIER_2.enabled, false);
  assert.equal(MODEL_CONFIG.TIER_2.model, null);
  assert.equal(MODEL_CONFIG.TIER_2.loadAtBoot, false);
});

test('getReasonerModel: aligné chat Tier 1', () => {
  assert.equal(getReasonerModel('reactive'), 'ornith:9b');
  assert.equal(getReasonerModel('fast'), 'qwen3.5:9b');
});

test('getBootProfile: défaut reactive, balanced mappé vers reactive', () => {
  assert.equal(getBootProfile(), 'reactive');
  assert.equal(getBootProfile('balanced'), 'reactive');
  assert.equal(getBootProfile('aggressive'), 'aggressive');
});

test('getActiveTier1ChatModel: profil fast bascule qwen3.5:9b (profil B)', () => {
  assert.equal(getActiveTier1ChatModel('reactive'), 'ornith:9b');
  assert.equal(getActiveTier1ChatModel('fast'), 'qwen3.5:9b');
});

test('getTier1ChatAlternative: multimodal qwen3.5:9b', () => {
  assert.equal(getTier1ChatAlternative('multimodal'), 'qwen3.5:9b');
});

test('MODEL_CONFIG profil B: coding primary qwen2.5-coder:7b (pas d’alt 14b)', () => {
  assert.equal(MODEL_CONFIG.TIER_3_EXPERTS.coding.model, 'qwen2.5-coder:7b');
  assert.equal(MODEL_CONFIG.TIER_3_EXPERTS.coding.alternative, null);
});

test('shouldWarmTier2AtBoot: toujours false (Tier 2 off)', () => {
  assert.equal(shouldWarmTier2AtBoot('reactive'), false);
  assert.equal(shouldWarmTier2AtBoot('fast'), false);
  assert.equal(shouldWarmTier2AtBoot('aggressive'), false);
  assert.equal(shouldWarmTier2('reactive'), false);
});

test('isTier2Model: toujours false', () => {
  assert.equal(isTier2Model('deepseek-r1:8b'), false);
  assert.equal(isTier2Model('ornith:9b'), false);
});

test('isTier2Enabled: false', () => {
  assert.equal(isTier2Enabled(), false);
});

test('warmup.matrix.json: tier2 vide et tier3 lazy', async () => {
  const matrix = JSON.parse(await fs.readFile(MATRIX_PATH, 'utf8'));
  const tier2Ids = matrix.tiers.tier2.models.map((m) => m.id);
  const tier3Ids = matrix.tiers.tier3.models.map((m) => m.id);

  assert.deepEqual(tier2Ids, []);
  assert.equal(matrix.doctrine.tier2_deferred, false);
  assert.equal(matrix.settings.fallback.default_reasoner, 'ornith:9b');
  assert.equal(matrix.tiers.tier3.lazy, true);

  for (const model of listTier3ExpertModels()) {
    assert.ok(tier3Ids.includes(model), `tier3 matrix missing ${model}`);
  }
});

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
  getTier2Model,
} from '../src/config/models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_PATH = path.resolve(__dirname, '../config/warmup.matrix.json');

const TIER3_LOG =
  'qwen2.5-coder:7b, gemma4:12b, glm-ocr:q8_0, nexxus-vox:latest';

test('MODEL_CONFIG: T1 qwen boot, T2 granite deferred', () => {
  assert.equal(MODEL_CONFIG.TIER_1.model, 'qwen3.5:2b');
  assert.equal(MODEL_CONFIG.TIER_2.enabled, true);
  assert.equal(MODEL_CONFIG.TIER_2.model, 'granite4.1:8b');
  assert.equal(MODEL_CONFIG.TIER_2.loadAtBoot, false);
  assert.equal(MODEL_CONFIG.TIER_2.loadStrategy, 'deferred');
});

test('getReasonerModel: T2 granite (pas T1)', () => {
  assert.equal(getReasonerModel('reactive'), 'granite4.1:8b');
  assert.equal(getReasonerModel('fast'), 'granite4.1:8b');
});

test('getBootProfile: défaut reactive, balanced mappé vers reactive', () => {
  assert.equal(getBootProfile(), 'reactive');
  assert.equal(getBootProfile('balanced'), 'reactive');
  assert.equal(getBootProfile('aggressive'), 'aggressive');
});

test('getActiveTier1ChatModel: qwen3.5:2b même en profil fast', () => {
  assert.equal(getActiveTier1ChatModel('reactive'), 'qwen3.5:2b');
  assert.equal(getActiveTier1ChatModel('fast'), 'qwen3.5:2b');
});

test('getTier1ChatAlternative: multimodal qwen3.5:9b (non servi T1)', () => {
  assert.equal(getTier1ChatAlternative('multimodal'), 'qwen3.5:9b');
});

test('MODEL_CONFIG profil B: coding primary qwen2.5-coder:7b (pas d’alt 14b)', () => {
  assert.equal(MODEL_CONFIG.TIER_3_EXPERTS.coding.model, 'qwen2.5-coder:7b');
  assert.equal(MODEL_CONFIG.TIER_3_EXPERTS.coding.alternative, null);
});

test('shouldWarmTier2AtBoot: toujours false', () => {
  assert.equal(shouldWarmTier2AtBoot('reactive'), false);
  assert.equal(shouldWarmTier2AtBoot('fast'), false);
  assert.equal(shouldWarmTier2AtBoot('aggressive'), false);
  assert.equal(shouldWarmTier2('reactive'), false);
});

test('isTier2Model: granite only', () => {
  assert.equal(isTier2Model('granite4.1:8b'), true);
  assert.equal(isTier2Model('deepseek-r1:8b'), false);
  assert.equal(isTier2Model('qwen3.5:2b'), false);
});

test('isTier2Enabled: true', () => {
  assert.equal(isTier2Enabled(), true);
  assert.equal(getTier2Model(), 'granite4.1:8b');
});

test('ligne TIER-3 exacte (listTier3ExpertModels)', () => {
  assert.equal(listTier3ExpertModels().join(', '), TIER3_LOG);
});

test('warmup.matrix.json: T2 granite deferred, T3 lazy identique', async () => {
  const matrix = JSON.parse(await fs.readFile(MATRIX_PATH, 'utf8'));
  const tier1Chat = matrix.tiers.tier1.models.find((m) => m.role === 'chat');
  const tier2Ids = matrix.tiers.tier2.models.map((m) => m.id);
  const tier3Ids = matrix.tiers.tier3.models.map((m) => m.id);

  assert.equal(tier1Chat.id, 'qwen3.5:2b');
  assert.deepEqual(tier2Ids, ['granite4.1:8b']);
  assert.equal(matrix.doctrine.tier2_deferred, true);
  assert.equal(matrix.tiers.tier2.defer_at_boot, true);
  assert.equal(matrix.settings.fallback.default_reasoner, 'granite4.1:8b');
  assert.equal(matrix.settings.fallback.default_chat, 'qwen3.5:2b');
  assert.equal(String(await fs.readFile(MATRIX_PATH, 'utf8')).includes('ornith:9b'), false);
  assert.equal(matrix.tiers.tier3.lazy, true);

  for (const model of listTier3ExpertModels()) {
    assert.ok(tier3Ids.includes(model), `tier3 matrix missing ${model}`);
  }
});

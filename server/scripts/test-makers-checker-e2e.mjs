#!/usr/bin/env node
/**
 * Smoke E2E — Makers-Checker paquet CRITICAL (sans LLM).
 * Usage: node scripts/test-makers-checker-e2e.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TelemetryObservability from '../src/ops/telemetry-observability.js';
import {
  bindTelemetryObservabilityForTests,
  resetTelemetryObservabilityBridgeForTests,
} from '../src/agent/telemetry/telemetryObservabilityBridge.js';
import {
  resetMakersCheckerForTests,
  resolvePacketType,
  runOrchestratorMakersCheckerValidation,
} from '../src/agent/verification/makersCheckerBridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'citadelle-mc-e2e-smoke-'));

const packet = {
  user_intent: 'technical_diagnostic',
  user_query: 'Analyse de marché pour X',
  mode: 'EPISTEMIC',
  evidence: [{ source: 'vault:audit', excerpt: 'Revenus +8%', relevance: 0.9 }],
  meta: {
    intent_contract_id: 'DIAGNOSTIC',
    expected_response_mode: 'CRITICAL',
    skillAccuracy: 0.9,
  },
};

const rawResponse =
  'Selon l\'audit interne, les revenus sont confirmés en hausse de 8%.';

const packetType = resolvePacketType(packet);

if (packetType !== 'CRITICAL') {
  console.error(`❌ resolvePacketType attendu CRITICAL, reçu ${packetType}`);
  process.exit(1);
}

const telemetry = await new TelemetryObservability({ persistDir: tempDir }).initialize();
bindTelemetryObservabilityForTests(telemetry);

await runOrchestratorMakersCheckerValidation(packet, rawResponse, null);

if (!packet.meta?.makers_checker) {
  console.error('❌ packet.meta.makers_checker absent');
  process.exit(1);
}

const { agentFile } = await telemetry.persist();
const metrics = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
const mcMetrics = metrics.filter((metric) => metric.agentId === 'makers-checker');

if (mcMetrics.length === 0) {
  console.error('❌ Aucune métrique makers-checker persistée');
  process.exit(1);
}

console.log('✅ Paquet CRITICAL détecté (DIAGNOSTIC)');
console.log(
  `✅ Validation orchestrator : outcome=${packet.meta.makers_checker.outcome} consensus=${packet.meta.makers_checker.consensus}`,
);
console.log(`✅ Télémétrie persistée : ${mcMetrics.length} métrique(s) makers-checker`);
console.log('✅ Smoke E2E Makers-Checker OK');

resetMakersCheckerForTests();
resetTelemetryObservabilityBridgeForTests();
fs.rmSync(tempDir, { recursive: true, force: true });

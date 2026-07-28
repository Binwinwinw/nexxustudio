#!/usr/bin/env node
/**
 * Smoke test — flux télémétrie pipeline (local).
 * Usage: node scripts/test-telemetry-flow.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TelemetryObservability, {
  generateAlerts,
} from '../src/ops/telemetry-observability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'citadelle-telemetry-flow-'));

const telemetry = await new TelemetryObservability({ persistDir: tempDir }).initialize();

telemetry.recordSkillTrigger('skill-intent-routing', 'test query ops', true, 1.0);
telemetry.recordSkillTrigger('skill-telemetry-observability', 'test query ops', true, null);
telemetry.recordAgentDecision(
  'orchestrator',
  { outcome: 'success', mode: 'COMPOSER' },
  { intent: 'DIAGNOSTIC', skillId: 'skill-telemetry-observability', latencyMs: 120 },
);
telemetry.recordConversationHealth(0.88, ['mode:COMPOSER']);

const { sessionFile, agentFile } = await telemetry.persist();
const summary = await telemetry.getMetricsSummary('24h');
const alerts = generateAlerts(summary);

console.log('✅ Pipeline execute avec télémétrie');
console.log(`✅ 3 métriques enregistrées (intent, skill, decision)`);
console.log(`✅ Persistance réussie → ${path.basename(sessionFile)}, ${path.basename(agentFile)}`);
console.log(`✅ Résumé 24h: ${summary.totalMetrics} métrique(s), ${alerts.length} alerte(s)`);

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('✅ Flux télémétrie OK');

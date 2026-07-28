import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

describe('Pipeline Telemetry Integration', () => {
  const telemetryDir = path.join(SERVER_ROOT, 'data', 'telemetry');

  before(() => {
    fs.mkdirSync(telemetryDir, { recursive: true });
  });

  it('intègre telemetry dans agentPipeline', () => {
    const pipelineCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/agentPipeline.js'),
      'utf-8',
    );
    assert.match(pipelineCode, /telemetryObservabilityBridge/);
    assert.match(pipelineCode, /flushPipelineTelemetry/);
    assert.match(pipelineCode, /capturePipelineIntentTelemetry/);
    assert.match(pipelineCode, /maybePersistTelemetry/);
  });

  it('intègre telemetry dans finalRendererAgent', () => {
    const rendererCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/agents/finalRendererAgent.js'),
      'utf-8',
    );
    assert.match(rendererCode, /recordComposerTelemetry/);
    assert.match(rendererCode, /telemetryObservabilityBridge/);
  });

  it('expose le bridge TelemetryObservability', () => {
    const bridgeCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/telemetry/telemetryObservabilityBridge.js'),
      'utf-8',
    );
    assert.match(bridgeCode, /TelemetryObservability/);
    assert.match(bridgeCode, /recordAgentDecision/);
    assert.match(bridgeCode, /recordSkillTrigger/);
    assert.match(bridgeCode, /recordError/);
    assert.match(bridgeCode, /maybePersistTelemetry/);
  });

  it('crée le répertoire de persistance', () => {
    assert.ok(fs.existsSync(telemetryDir));
  });

  it('exclut les fichiers JSON du dépôt', () => {
    const gitignore = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf-8');
    assert.match(gitignore, /server\/data\/telemetry\/\*\.json/);
  });
});

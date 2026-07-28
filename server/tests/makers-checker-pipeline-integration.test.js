import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

describe('MakersChecker Pipeline Integration', () => {
  it('intègre MakersChecker dans SovereignOrchestrator', () => {
    const orchestratorCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/orchestrator/SovereignOrchestrator.js'),
      'utf-8',
    );

    assert.match(orchestratorCode, /makersCheckerBridge/);
    assert.match(orchestratorCode, /runOrchestratorMakersCheckerValidation/);
  });

  it('intègre MakersChecker dans finalRendererAgent', () => {
    const rendererCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/agents/finalRendererAgent.js'),
      'utf-8',
    );

    assert.match(rendererCode, /makersCheckerBridge/);
    assert.match(rendererCode, /_applyMakersCheckerGate/);
    assert.match(rendererCode, /validateRendererWithMakersChecker/);
    assert.match(rendererCode, /gate\.blocked/);
  });

  it('expose les runners runtime dans makersCheckerBridge', () => {
    const bridgeCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/verification/makersCheckerBridge.js'),
      'utf-8',
    );

    assert.match(bridgeCode, /runOrchestratorMakersCheckerValidation/);
    assert.match(bridgeCode, /validateRendererWithMakersChecker/);
    assert.match(bridgeCode, /generateReport/);
    assert.match(bridgeCode, /outcome === 'blocked'/);
  });

  it('enregistre télémétrie makers-checker via le bridge', () => {
    const bridgeCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/verification/makersCheckerBridge.js'),
      'utf-8',
    );

    assert.match(bridgeCode, /recordAgentDecision\(\s*['"]makers-checker['"]/);
    assert.match(bridgeCode, /consensus/);
    assert.match(bridgeCode, /verified/);
    assert.match(bridgeCode, /MakersCheckerBlocked/);
  });

  it('fail-open par défaut (fallbackToPrimary sauf mode strict)', () => {
    const bridgeCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/verification/makersCheckerBridge.js'),
      'utf-8',
    );

    assert.match(bridgeCode, /fallbackToPrimary/);
    assert.match(bridgeCode, /MAKERS_CHECKER_STRICT/);
  });

  it('valide les paquets CRITICAL via resolvePacketType', () => {
    const bridgeCode = fs.readFileSync(
      path.join(SERVER_ROOT, 'src/agent/verification/makersCheckerBridge.js'),
      'utf-8',
    );

    assert.match(bridgeCode, /RESPONSE_MODES\.CRITICAL/);
    assert.match(bridgeCode, /return 'CRITICAL'/);
    assert.match(bridgeCode, /packetType === 'CRITICAL'/);
  });
});

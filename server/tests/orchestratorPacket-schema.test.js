import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrchestratorPacket } from '../src/agent/validators/pipelineValidators.js';

test('OrchestratorPacket schema validation: expert_task intent', () => {
  const packet = {
    user_intent: 'expert_task',
    mode: 'EPISTEMIC',
    expert_outputs: [],
    risk_level: 'low',
    budget: {
      total_budget_ms: 70000,
      elapsed_ms: 1500,
      remaining_ms: 68500,
      exhausted: false,
      expert_budget: {
        total_budget_ms: 70000,
        elapsed_ms: 1000,
        remaining_ms: 69000,
        exhausted: false
      }
    }
  };

  try {
    const validated = validateOrchestratorPacket(packet);
    assert.ok(validated, 'Packet validation should pass');
    assert.equal(validated.user_intent, 'expert_task');
    console.log('PASS - AJV successfully validated OrchestratorPacket with expert_task intent');
  } catch (err) {
    assert.fail(`Validation threw an unexpected error: ${err.message}`);
  }
});

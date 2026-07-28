import test from 'node:test';
import assert from 'node:assert/strict';
import { routerAgent } from '../src/agent/agents/routerAgent.js';

test('router agent hardening: comparative queries force verified_pipeline route', async () => {
  const queryEnvelope = {
    query_id: 'q_test_comp_123',
    user_query: 'pourrais tu faire un comparatif qui fait ressortir les points forts et les points faibles de dragon Ball contre dragon ball Super ou onepunch man'
  };

  const plan = await routerAgent.plan(queryEnvelope);
  
  assert.equal(plan.route, 'verified_pipeline');
  assert.match(plan.rationale, /Routage heuristique/i);
  
  console.log('PASS - router agent comparative query successfully forced verified_pipeline');
});

test('router agent hardening: superlative queries force verified_pipeline route', async () => {
  const queryEnvelope = {
    query_id: 'q_test_super_123',
    user_query: 'Quel est le meilleur manga de tous les temps ?'
  };

  const plan = await routerAgent.plan(queryEnvelope);
  
  assert.equal(plan.route, 'verified_pipeline');
  assert.match(plan.rationale, /Routage heuristique/i);
  
  console.log('PASS - router agent superlative query successfully forced verified_pipeline');
});

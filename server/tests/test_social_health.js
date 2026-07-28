import { classifyShortCircuitIntent } from '../src/agent/micro/classifiers/intentShortCircuit.js';

async function run() {
  const q1 = "comment ca va ?";
  const q2 = "hé bien de ton état de santé";
  
  const res1 = await classifyShortCircuitIntent(q1);
  console.log("q1:", res1);
  
  const res2 = await classifyShortCircuitIntent(q2);
  console.log("q2:", res2);
}

run().catch(console.error);

import { computeThermalScore, computeFinalScore, rrf } from '../src/agent/router/expertScorer.js';
import * as fixtures from './fixtures/expertFixtures.js';

async function runTests() {
  console.log("🧪 DÉMARRAGE DES TESTS UNITAIRES EXPERT-ROUTER v3.3.4\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.error(`❌ ${message}`);
      failed++;
    }
  }

  // --- 1. EXPERT SCORER (PURE FUNCTIONS) ---
  console.log("--- 1. ExpertScorer ---");
  
  // Test RRF
  const rrfResult = rrf(0, 0); 
  assert(rrfResult > 0.03, `RRF(0,0) should be around 0.033. Got: ${rrfResult}`);
  
  // Test Thermal Score - NORMAL mode (TIER 3)
  const coldNormal = computeThermalScore({ state: 'COLD', avgLoadTime: 15000, mode: 'CRUISE', priority: 3, pressureRatio: 0.3 });
  assert(coldNormal > 0.1 && coldNormal < 0.3, `Cold model in CRUISE should have moderate penalty. Got: ${coldNormal}`);

  // Test Thermal Score - RESTRICTED mode P3
  const coldRestrictedP3 = computeThermalScore({ state: 'COLD', avgLoadTime: 15000, mode: 'RESTRICTED', priority: 3, pressureRatio: 0.8 });
  assert(coldRestrictedP3 === -1.0, `P3 Cold in RESTRICTED should be -1.0. Got: ${coldRestrictedP3}`);

  // Test Thermal Score - PANIC mode P1 protection
  const p1Panic = computeThermalScore({ state: 'COLD', avgLoadTime: 15000, mode: 'PANIC', priority: 1, pressureRatio: 0.9 });
  assert(p1Panic === 0.15, `P1 in PANIC should be protected (0.15). Got: ${p1Panic}`);

  // --- 2. EXPERT GOVERNOR (INTEGRATION LOGIC) ---
  console.log("\n--- 2. ExpertGovernor (Logic Check) ---");
  
  const finalScore = computeFinalScore({ competence: 0.9, thermalScore: 1.0, queueDepth: 0, state: 'HOT' });
  assert(Math.abs(finalScore - 0.96) < 0.01, `Final score calculation for ideal HOT expert should be 0.96. Got: ${finalScore}`);

  const busyScore = computeFinalScore({ competence: 0.9, thermalScore: 1.0, queueDepth: 5, state: 'HOT' });
  assert(Math.abs(busyScore - 0.76) < 0.01, `Final score for busy HOT expert should be 0.76. Got: ${busyScore}`);

  // --- 3. HYBRID SEARCH / RRF FUSION ---
  console.log("\n--- 3. Hybrid Search (RRF Fusion) ---");
  
  const scoreA = rrf(0, 9); 
  const scoreB = rrf(4, 4);
  assert(scoreB > scoreA, `Balanced hybrid (5,5) should score higher than skewed (1,10) in RRF. Got: B=${scoreB.toFixed(4)}, A=${scoreA.toFixed(4)}`);
  
  console.log(`\n📊 RÉSULTAT FINAL : ${passed} passés, ${failed} échoués.`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests();

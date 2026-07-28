import { computeThermalScore } from '../src/agent/router/expertScorer.js';

async function runExtendedTests() {
  console.log("🧬 DÉMARRAGE DES TESTS ÉTENDUS : GOUVERNANCE & STRESS\n");

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

  // 1. STRESS DE VRAM (Transition progressive)
  console.log("--- 1. Stress VRAM (Courbe de Pression) ---");
  
  const points = [0.1, 0.4, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95];
  const results = points.map(p => {
    const mode = p >= 0.85 ? 'PANIC' : (p >= 0.75 ? 'RESTRICTED' : (p >= 0.6 ? 'SELECTIVE' : 'CRUISE'));
    const score = computeThermalScore({ state: 'COLD', avgLoadTime: 15000, mode, priority: 3, pressureRatio: p });
    return { p, mode, score };
  });

  assert(results.find(r => r.mode === 'CRUISE').score > 0.1, "Cruise score for cold is positive.");
  assert(results.find(r => r.mode === 'RESTRICTED').score === -1.0, "Restricted mode correctly blocks P3 cold.");
  assert(results.find(r => r.mode === 'PANIC').score === -1.0, "Panic mode correctly blocks P3 cold.");

  // 2. SIMULATION DE CONTEXTE ÉLEVÉ
  console.log("\n--- 2. Simulation de Pression Contexte ---");
  // Dans Ollama, le contexte augmente la VRAM. On simule ici l'impact indirect via le pressureRatio.
  const highContextPressure = 0.82; // Contexte lourd faisant monter la VRAM
  const p1Score = computeThermalScore({ state: 'HOT', avgLoadTime: 0, mode: 'RESTRICTED', priority: 1, pressureRatio: highContextPressure });
  assert(p1Score > 0.5, "P1 HOT remains highly viable even under high context pressure (RESTRICTED).");

  console.log(`\n📊 EXTENDED RESULT : ${passed} passés, ${failed} échoués.`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runExtendedTests();

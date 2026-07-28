import expertRouter from '../src/agent/router/expertRouter.js';
import ollama from '../src/llm/ollama.js';
import * as manifestStore from '../src/agent/router/expertManifestStore.js';

async function runSmokeTests() {
  console.log("💨 DÉMARRAGE DES TESTS SMOKE : NEXXUS CITADEL\n");

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

  // 1. IMPORT DES MODULES CRITIQUES
  assert(!!expertRouter, "ExpertRouter module loaded.");
  assert(!!ollama, "Ollama LLM module loaded.");
  assert(!!manifestStore, "ManifestStore module loaded.");

  // 2. DISPONIBILITÉ DES MANIFESTS
  try {
    const manifests = await manifestStore.extractManifestsFromFile({ 
      division: "Elite", 
      experts: [{ key: "expert_curator", name: "Nexxus Curator" }] 
    }, "expert_curator.json", "path/to/curator.json");
    assert(manifests.length > 0 && manifests[0].key === "expert_curator", "Nexxus Curator manifest extraction is functional.");
  } catch (err) {
    assert(false, `Manifest extraction failed: ${err.message}`);
  }

  console.log(`\n📊 SMOKE RESULT : ${passed} passés, ${failed} échoués.`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runSmokeTests();

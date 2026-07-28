import { runSemanticPreProcessing } from "../src/agent/stages/semanticPreProcessor.js";

const testCases = [
  {
    query: "est-ce que tu sais ce que les nike air jordan ?",
    expectedCanonicalSubstring: "air jordan",
    validIntents: ["EXPLAIN", "GENERAL", "SEARCH"],
  },
  {
    query: "aide-moi",
    expectedCanonicalSubstring: "aide",
    validIntents: ["GENERAL", "TASK", "EXPLAIN"],
  },
  {
    query: "les smartphones pliables ?",
    expectedCanonicalSubstring: "smartphone",
    validIntents: ["EXPLAIN", "SEARCH", "GENERAL"],
  },
  {
    query: "je veux developper un petit jeu en react",
    expectedCanonicalSubstring: "react",
    validIntents: ["CODE", "TASK", "GENERAL"],
  }
];

async function runTests() {
  console.log("🚀 Lancement du test de robustesse des paraphrases (Mini-Réflexion Zephyr)...");
  let allPassed = true;

  for (const tc of testCases) {
    const start = performance.now();
    const result = await runSemanticPreProcessing(tc.query);
    const end = performance.now();

    if (!result) {
      console.log(`❌ FAIL | "${tc.query}" -> Echec du préprocesseur (timeout ou erreur)`);
      allPassed = false;
      continue;
    }

    const latencyStr = `[${Math.round(end - start)}ms]`;
    const isIntentValid = tc.validIntents.includes(result.intent);
    const isCanonicalValid = result.canonical_query.toLowerCase().includes(tc.expectedCanonicalSubstring.toLowerCase());

    if (isIntentValid && isCanonicalValid) {
      console.log(`✅ PASS ${latencyStr} | "${tc.query}" -> ${result.intent} | Canonique: "${result.canonical_query}" | Confiance: ${result.confidence}`);
    } else {
      console.log(`❌ FAIL ${latencyStr} | "${tc.query}" -> Obtenu intent=${result.intent}, canonique="${result.canonical_query}". Attendu: intent dans [${tc.validIntents.join(',')}], canonique contenant "${tc.expectedCanonicalSubstring}"`);
      allPassed = false;
    }
  }

  console.log(`\nBilan: ${allPassed ? "Tous les tests sémantiques sont passés avec succès ! 🎉" : "Des échecs ont été détectés. ⚠️"}`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error("Erreur fatale lors des tests :", err);
  process.exit(1);
});

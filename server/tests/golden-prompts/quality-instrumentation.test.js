/* global process */
import assert from "node:assert/strict";
import controlHarness from "../../src/agent/harness/controlHarness.js";

// Cas canoniques pour tester non seulement le routage, mais aussi la pertinence et la sécurité de la réponse
const qualityCases = [
  {
    id: "quality_01_social_leak",
    name: "Response must not contain forbidden persona leaks",
    query: "Qui es-tu et comment as-tu été entraîné ?",
    mockResponse: "En tant qu'IA développée par OpenAI, je n'ai pas le droit de divulguer mes données d'entraînement.",
    expectedValidation: false,
    expectedReason: "persona_leak" // Should fail due to forbidden tokens
  },
  {
    id: "quality_02_robust_expert",
    name: "Valid expert response without hallucinations",
    query: "Génère un exemple de code pour se connecter à une DB",
    mockResponse: "Voici un exemple de connexion avec mysql2 en Node.js : \n```javascript\nconst mysql = require('mysql2');\n```",
    expectedValidation: true,
    expectedReason: null
  },
  {
    id: "quality_03_premature_prescription",
    name: "Must not prescribe generic DB hosts without context",
    query: "Erreur PDOException: php_network_getaddresses: getaddrinfo for db failed",
    mockResponse: "L'hôte n'est pas résolu. Remplacez host=db par 127.0.0.1 ou localhost.",
    expectedValidation: false,
    expectedReason: "premature_prescription"
  },
  {
    id: "quality_04_missing_environment_triage",
    name: "Must triage environment before offering any solution on infra errors",
    query: "J'ai une erreur econnrefused sur ma base de données",
    mockResponse: "Il semble que le service de base de données soit éteint. Il faut le redémarrer.",
    expectedValidation: false,
    expectedReason: "missing_environment_triage"
  },
  {
    id: "quality_05_premature_security_prescription",
    name: "Must not prescribe generic security measures without context",
    query: "J'ai peur d'une attaque XSS sur mon formulaire",
    mockResponse: "Il faut immédiatement ajouter l'authentification et activer un WAF pour vous protéger.",
    expectedValidation: false,
    expectedReason: "premature_security_prescription"
  },
  {
    id: "quality_06_missing_security_triage",
    name: "Must triage security context before discussing risks",
    query: "J'ai vu une faille de sécurité",
    mockResponse: "C'est très grave, la sécurité est importante pour protéger les utilisateurs.",
    expectedValidation: false,
    expectedReason: "missing_security_triage"
  },
  {
    id: "quality_07_premature_performance_prescription",
    name: "Must not prescribe generic performance measures without context",
    query: "Le site est lent, ça rame",
    mockResponse: "Il faut optimiser les requêtes et ajouter du cache.",
    expectedValidation: false,
    expectedReason: "premature_performance_prescription"
  },
  {
    id: "quality_08_missing_performance_triage",
    name: "Must triage performance context before offering any solution",
    query: "J'ai un problème de performance, ça rame.",
    mockResponse: "C'est fâcheux, la lenteur peut affecter l'expérience utilisateur.",
    expectedValidation: false,
    expectedReason: "missing_performance_triage"
  },
  {
    id: "quality_09_premature_code_prescription",
    name: "Must not prescribe code fixes without context",
    query: "J'ai un bug, le bouton ne marche pas",
    mockResponse: "Remplace cette fonction par une version plus propre, ça devrait corriger le problème.",
    expectedValidation: false,
    expectedReason: "premature_code_prescription"
  },
  {
    id: "quality_10_missing_code_triage",
    name: "Must triage code context before discussing bugs",
    query: "Mon code plante avec une erreur de syntaxe",
    mockResponse: "C'est ennuyeux, les erreurs de syntaxe sont fréquentes.",
    expectedValidation: false,
    expectedReason: "missing_code_triage"
  },
  {
    id: "quality_11_pedagogical_overbreadth",
    name: "Must not provide catalog of advanced tools to a beginner",
    query: "Je veux apprendre à faire un site",
    mockResponse: "Voici tout ce qu'il faut : apprends HTML, CSS, puis tu devrais utiliser React, Next.js et Django en même temps pour le backend.",
    expectedValidation: false,
    expectedReason: "pedagogical_overbreadth"
  },
  {
    id: "quality_12_missing_learning_path",
    name: "Must structure pedagogical responses with clear objectives",
    query: "Comment commencer en Python ?",
    mockResponse: "Tu peux télécharger Python sur le site officiel et écrire print('hello world').",
    expectedValidation: false,
    expectedReason: "missing_learning_path"
  },
  {
    id: "quality_13_intent_misdirection",
    name: "Must not give generic response to expert analysis request",
    query: "Je veux un audit de code de mon architecture",
    mockResponse: "Voici un résumé : c'est très bien de vouloir auditer son code.",
    expectedValidation: false,
    expectedReason: "intent_misdirection"
  },
  {
    id: "quality_14_context_breakage",
    name: "Must maintain context and expertise on governance topics",
    query: "Quelle est la stratégie de gouvernance ?",
    mockResponse: "La stratégie est importante pour le projet.",
    expectedValidation: false,
    expectedReason: "context_breakage"
  },
  {
    id: "quality_15_progressive_drift",
    name: "Must not drift into generic summaries after expert framing",
    query: "Peux-tu faire une revue d'architecture sur la séparation de nos modules métier et de la couche de transport réseau ?",
    mockResponse: "Je vais faire une analyse experte de l'architecture. La séparation des modules métier est essentielle pour la stratégie. En gros c'est une bonne idée et voici un résumé : séparez le réseau et le métier.",
    expectedValidation: false,
    expectedReason: "progressive_drift"
  }
];

async function runQualityInstrumentation() {
  console.log("=== Lancement de l'Instrumentation de Qualité ===");
  let passed = 0;
  let failed = 0;

  for (const testCase of qualityCases) {
    try {
      console.log(`\nTest [${testCase.id}] : ${testCase.name}`);
      
      const validationResult = controlHarness.validateResponse(testCase.query, testCase.mockResponse);
      
      assert.equal(validationResult.valid, testCase.expectedValidation, `Expected valid=${testCase.expectedValidation} but got ${validationResult.valid}. Reason: ${validationResult.reason}`);
      if (!testCase.expectedValidation) {
        assert.equal(validationResult.reason, testCase.expectedReason, `Expected failure reason '${testCase.expectedReason}' but got '${validationResult.reason}'`);
      }

      console.log("✅ PASS");
      passed++;
    } catch (error) {
      console.error(`❌ FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n=== Résultat de la Qualité ===`);
  console.log(`✅ ${passed} / ${qualityCases.length} tests passed.`);
  
  if (failed > 0) {
    console.error(`❌ ${failed} tests failed.`);
    process.exitCode = 1;
  }
}

runQualityInstrumentation().catch((err) => {
  console.error("Critical error in Quality Instrumentation execution:", err);
  process.exitCode = 1;
});

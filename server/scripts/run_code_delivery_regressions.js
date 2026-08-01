/**
 * Régression conversationnelle live — livraison code multi-langages.
 * Nécessite un backend LLM opérationnel (Ollama ou provider configuré).
 *
 * Usage :
 *   CODE_DELIVERY_LIVE=1 node scripts/run_code_delivery_regressions.js
 *   npm run test:code-delivery:live
 */
import assert from "node:assert/strict";
import agent from "../src/agent/agent.js";
import {
  CODE_DELIVERY_GOLDEN_QUERIES,
  GOLDEN_QUERY_CATEGORIES,
} from "../tests/fixtures/codeDeliveryGoldenQueries.js";
import { CODE_DELIVERY_SECTION_MARKERS } from "../src/agent/policies/code/codeDeliveryPolicy.js";
import { evaluateCodeDeliverySentinels } from "../src/agent/policies/code/codeDeliverySentinels.js";

function includesAll(text, patterns = []) {
  const body = String(text || "").toLowerCase();
  return patterns.every((p) => body.includes(String(p).toLowerCase()));
}

function includesNone(text, patterns = []) {
  const body = String(text || "").toLowerCase();
  return patterns.every((p) => !body.includes(String(p).toLowerCase()));
}

async function runLiveCase(scenario) {
  const streamed = [];
  const steps = [];
  const response = await agent.run(scenario.query, [], {
    onContent: (token) => streamed.push(token),
    onStep: (step) => steps.push(step),
  });

  assert.ok(response && response.trim().length > 80, `[${scenario.id}] Réponse trop courte`);
  assert.ok(
    includesNone(response, scenario.responseForbidden),
    `[${scenario.id}] Réponse contaminée: ${response.slice(0, 600)}`,
  );

  const markerHits = CODE_DELIVERY_SECTION_MARKERS.filter((m) => response.includes(m)).length;
  assert.ok(
    markerHits >= 3,
    `[${scenario.id}] Structure insuffisante (${markerHits}/5 marqueurs)`,
  );

  assert.ok(
    includesAll(
      response,
      scenario.responseMustInclude.slice(0, Math.min(3, scenario.responseMustInclude.length)),
    ),
    `[${scenario.id}] Contenu attendu absent`,
  );

  const sentinelEval = evaluateCodeDeliverySentinels(response, scenario);
  assert.ok(
    sentinelEval.pass,
    `[${scenario.id}] sentinelles: ${JSON.stringify(sentinelEval.failures)}`,
  );

  assert.equal(streamed.join(""), response, `[${scenario.id}] Flux visible ≠ réponse finale`);

  const tag =
    scenario.category === GOLDEN_QUERY_CATEGORIES.PRODUCTION_BUG ? "[prod]" : "[demo]";
  console.log(`PASS - ${tag} [${scenario.language}] ${scenario.label}`);
  return { response, steps: steps.length };
}

async function main() {
  console.log(`=== Code delivery live regression (${CODE_DELIVERY_GOLDEN_QUERIES.length} cas) ===`);
  let passed = 0;

  for (const scenario of CODE_DELIVERY_GOLDEN_QUERIES) {
    await runLiveCase(scenario);
    passed += 1;
  }

  console.log(`\n${passed}/${CODE_DELIVERY_GOLDEN_QUERIES.length} cas live OK`);
}

main().catch((err) => {
  console.error("FAIL -", err.message);
  process.exit(1);
});

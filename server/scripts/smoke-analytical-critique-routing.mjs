#!/usr/bin/env node
/**
 * Vérifie le routage analytical_critique vs document analysis (sans LLM).
 * Usage: node server/scripts/smoke-analytical-critique-routing.mjs
 */
import { isAnalyticalCritiqueIntent } from "../src/agent/utils/analyticalCritiqueIntentGuards.js";
import { isDocumentAnalysisIntent } from "../src/agent/utils/conversationGuards.js";

const PASTE = `
Verdict technique — synthèse terrain La Citadelle.
1 Réponse méta OK si « Sur mes fonctionnalités actuelles ».
2 Même réponse = ancien template « options structurées, sans sur-promesse ».
3 Forge → refus ; runtime SIMPLE_FAST + refus.
Preuve : grep à zéro. Sous-intents capability_learn, capability_gaps, forge_status.
Tests passent en local ; décalage nodemon / npm run start / short-circuit pipeline.
`.trim();

const explicit =
  "j'ai fait la citadelle analyser une analyse — elle n'a fait qu'extraire des points clés au lieu d'interpréter.";

function row(label, query) {
  const critique = isAnalyticalCritiqueIntent(query);
  const doc = isDocumentAnalysisIntent(query);
  const path = critique
    ? "analytical_critique (court-circuit amont agentPipeline)"
    : doc
      ? "document_analysis (extractif — à éviter pour ce cas)"
      : "autre (IntentStage / short-circuit / LLM)";
  return { label, critique, doc, path };
}

console.log("=== Smoke routage — analytical_critique ===\n");
for (const { label, query } of [
  { label: "Pavé diagnostic runtime", query: PASTE },
  { label: "Demande explicite courte", query: explicit },
]) {
  const r = row(label, query);
  console.log(`[${r.label}]`);
  console.log(`  isAnalyticalCritiqueIntent: ${r.critique}`);
  console.log(`  isDocumentAnalysisIntent:   ${r.doc}`);
  console.log(`  chemin attendu:             ${r.path}`);
  console.log("");
}

const ok =
  isAnalyticalCritiqueIntent(PASTE) &&
  !isDocumentAnalysisIntent(PASTE) &&
  isAnalyticalCritiqueIntent(explicit) &&
  !isDocumentAnalysisIntent(explicit);

if (!ok) {
  console.error("ÉCHEC — garde-fous incohérents avec le patch.");
  process.exit(1);
}
console.log("OK — classification prête. En runtime, log attendu :");
console.log(
  "  [PIPELINE] analytical_critique → interprétation (pas document extract)",
);

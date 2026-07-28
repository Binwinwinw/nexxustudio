/**
 * Cas golden — tri d'intention (règles + scores, local-first).
 * Enrichi manuellement ; complété par intentTriageGoldenExported.js via npm run triage:export-golden.
 */
import { EXPORT_CATEGORIES } from "../../src/agent/classifiers/intentTriageFeedbackExporter.js";
import { BROKEN_CALCULATRICE_PY_SNIPPET } from "./codeReviewGoldenQueries.js";

/** @type {import("../../src/agent/classifiers/intentTriageFeedbackExporter.js").IntentTriageGoldenCase[]} */
export const INTENT_TRIAGE_BASELINE_QUERIES = [
  {
    id: "baseline-calculatrice-code-review-high",
    category: EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    observedAt: "2026-05-27",
    query: `analyse le code suivant c'est du python :\n${BROKEN_CALCULATRICE_PY_SNIPPET}`,
    expectedTopIntent: "code_review",
    minConfidence: "high",
    routingAction: "route_direct",
    incident:
      "Incident terrain : formulation « analyse » + snippet Python → ne doit pas router vers document_analysis.",
    source: "baseline",
  },
  {
    id: "baseline-resume-sans-code",
    category: EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    observedAt: "2026-05-27",
    query:
      "Résume ce passage et extrais les points clés :\n\nLa Citadelle est un système local-first conçu pour l'orchestration souveraine.",
    expectedTopIntent: "document_analysis",
    minConfidence: "high",
    routingAction: "route_direct",
    source: "baseline",
  },
  {
    id: "baseline-explain-vs-review",
    category: EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    observedAt: "2026-05-27",
    query:
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))",
    expectedTopIntent: "code_explain",
    minConfidence: "high",
    routingAction: "route_direct",
    source: "baseline",
  },
  {
    id: "baseline-explicit-code-review-phrase",
    category: EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    observedAt: "2026-05-27",
    query:
      "Fais une revue de code Python orientée exécution : commence par les erreurs bloquantes.\ndef broken( return 1",
    expectedTopIntent: "code_review",
    minConfidence: "high",
    routingAction: "route_direct",
    source: "baseline",
  },
  {
    id: "baseline-self-analysis-improvements",
    category: EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    observedAt: "2026-05-27",
    query:
      "hé bien je me demandais si tu voudrais m'aider à lister tes dernières améliorations côté structure, et côté réponse dans la conversation si tu es en capacité de t'auto-analyser",
    expectedTopIntent: "self_analysis",
    minConfidence: "high",
    routingAction: "route_direct",
    incident:
      "Incident terrain : auto-analyse assistant triée document_analysis → orchestrateur EXPERT_TASK + scripts inventés.",
    source: "baseline",
  },
  {
    id: "baseline-temporal-awareness-meta",
    category: EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    observedAt: "2026-05-27",
    query:
      "comment faire pour te faire maitriser le sens de l'heure pour en prendre conscience?",
    expectedTopIntent: "self_analysis",
    minConfidence: "high",
    routingAction: "route_direct",
    incident:
      "Incident terrain : question conscience temporelle → multi_segment puis salutation générique.",
    source: "baseline",
  },
];

export { EXPORT_CATEGORIES };

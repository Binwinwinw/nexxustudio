export const ROUTER_LIMITS = Object.freeze({
  semanticThreshold: 0.55,
  maxSemanticCandidates: 10,
  maxLexicalCandidates: 10,
  maxFinalCandidates: 5,
  maxCognitiveCandidates: 2,
  rrfK: 60,
  bm25: {
    k1: 1.2,
    b: 0.75,
  },
});

export const ROUTER_MESSAGES = Object.freeze({
  scanning: '🔍 Analyse lexicale en cours...',
  indexing: '⚙️ Indexation sémantique',
  cognitive: '🎖️ Sélection cognitive par le Master Orchestrator...',
  cacheCorrupted: '[Router] Cache corrompu.',
  cognitiveFallback: '[Router] Fallback cognitif actif.',
});

export function buildRouterDecisionPrompt(query, candidates = []) {
  const candidatesList = candidates
    .map((c) => `- ${c.expert.fullKey}: ${c.expert.description}`)
    .join('\n');

  return [
    `DEMANDE : "${query}"`,
    'CANDIDATS :',
    candidatesList || '- Aucun candidat',
    'Réponds en JSON STRICT.',
    'JSON FORMAT: {"selected_experts":["Division:key"], "strategic_plan": "Description du plan d\'action (Planner)"}',
    'MISSION : Sélectionner les experts indispensables et définir la stratégie de coordination.'
  ].join('\n');
}

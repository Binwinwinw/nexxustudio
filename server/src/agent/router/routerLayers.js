export const ROUTER_LAYERS = {
  L0_BOOTSTRAP: 'L0_BOOTSTRAP',
  L1_LEXICAL_ROUTING: 'L1_LEXICAL_ROUTING',
  L2_COGNITIVE_SELECTION: 'L2_COGNITIVE_SELECTION',
  L3_EXPERT_HYDRATION: 'L3_EXPERT_HYDRATION',
};

export const ROUTER_BUDGETS = {
  maxBootstrapFiles: 64,
  maxLexicalCandidates: 5,
  maxCognitiveCandidates: 3,
  maxHydratedExpertsPerTurn: 2,
};

export function formatLayerLog(layer, message, details = {}) {
  const suffix = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

  return suffix ? `[Router][${layer}] ${message} ${suffix}` : `[Router][${layer}] ${message}`;
}

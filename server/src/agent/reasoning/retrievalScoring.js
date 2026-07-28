export function computeLexicalScore(query, candidate) {
  // Simple token overlap baseline
  const queryTokens = new Set(query.toLowerCase().split(/\W+/).filter(t => t.length > 2));
  const contentTokens = new Set(candidate.content.toLowerCase().split(/\W+/).filter(t => t.length > 2));
  
  if (queryTokens.size === 0) return 0;
  
  let matchCount = 0;
  for (const qt of queryTokens) {
    if (contentTokens.has(qt)) matchCount++;
  }
  
  return Math.min(1.0, matchCount / queryTokens.size);
}

export function computeSemanticScore(query, candidate) {
  // Fallback V1: Not implemented yet, return 0 or mild baseline
  return 0.5;
}

export function computeProximityScore(queryEnvelope, candidate) {
  // Bonus if the candidate matches the current session ID
  if (queryEnvelope.context?.session_id && candidate.content.includes(queryEnvelope.context.session_id)) {
    return 0.9;
  }
  // Baseline
  return 0.3;
}

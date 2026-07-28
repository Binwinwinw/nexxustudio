/**
 * Quality gate Design Extract v2 — score + merge_ok + blockers.
 */

/**
 * @param {object} payload
 * @param {object} [payload.tokens]
 * @param {Array} [payload.layout_signatures]
 * @param {string} [payload.reproduction_prompt]
 * @param {Array} [payload.patterns]
 */
export function evaluateDesignExtractQualityGate(payload = {}) {
  const blockers = [];
  let score = 0;

  const colorCount = payload.tokens?.colors?.distinct_count ?? 0;
  const typoFamilies = payload.tokens?.typography?.distinct_families ?? 0;
  const typoSizes = payload.tokens?.typography?.distinct_sizes ?? 0;
  const layoutCount = (payload.layout_signatures || []).length;
  const patternCount = (payload.patterns || []).length;
  const prompt = String(payload.reproduction_prompt || '');

  if (colorCount >= 3) score += 25;
  else blockers.push({ code: 'INSUFFICIENT_PALETTE', message: 'Moins de 3 couleurs clusterisées.' });

  if (typoFamilies >= 1 && typoSizes >= 2) score += 25;
  else if (typoFamilies >= 1) score += 12;

  if (layoutCount >= 2) score += 20;
  else if (layoutCount >= 1) score += 10;

  if (patternCount >= 2) score += 15;
  else if (patternCount >= 1) score += 8;

  const promptValid =
    prompt.length >= 120 &&
    prompt.length <= 800 &&
    /Refonte fidèle/i.test(prompt) &&
    !prompt.includes('{');
  if (promptValid) score += 15;

  const merge_ok = score >= 60 && blockers.length === 0;

  return {
    score,
    merge_ok,
    blockers,
  };
}

export default { evaluateDesignExtractQualityGate };

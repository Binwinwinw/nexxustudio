import manifest from './manifest.json' with { type: 'json' };

function normalizeQuery(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text = '') {
  const normalized = normalizeQuery(text);
  return normalized ? normalized.split(' ') : [];
}

function exactTokenMatch(queryTokens, targetTokens) {
  return queryTokens.length > 0 && targetTokens.length > 0 && queryTokens.join(' ') === targetTokens.join(' ');
}

function includesAllTokens(queryTokens, targetTokens) {
  return targetTokens.length > 0 && targetTokens.every(token => queryTokens.includes(token));
}

function detectTautologyOrRiddle(query = '') {
  const q = normalizeQuery(query);
  if (!q) return false;

  const patterns = [
    /\bquelle est la couleur blanche du cheval blanc de napoleon\b/,
    /\bcheval blanc de napoleon\b/,
    /\bquelle est la couleur de .*blanc\b/,
    /\btautolog/i,
    /\bdevinette\b/,
    /\bquestion piege\b/,
  ];

  return patterns.some(re => re.test(q));
}

function scoreTopic(query, topic) {
  const q = normalizeQuery(query);
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0;

  let score = 0;

  // 1. HARD MATCHES (Canonical Questions)
  for (const question of topic.canonicalQuestions || []) {
    const normalized = normalizeQuery(question);
    const questionTokens = tokenize(question);
    if (!normalized) continue;

    if (q === normalized) { score += 100; continue; }
    if (exactTokenMatch(qTokens, questionTokens)) { score += 80; continue; }
    if (includesAllTokens(qTokens, questionTokens) && questionTokens.length >= 2) { score += 25; continue; }
  }

  // 2. SYNONYMS & TAGS
  for (const synonym of topic.synonyms || []) {
    const normalized = normalizeQuery(synonym);
    if (normalized && (q === normalized || q.includes(normalized))) score += 5;
  }
  for (const tag of topic.tags || []) {
    const normalized = normalizeQuery(tag);
    if (normalized && qTokens.includes(normalized)) score += 2;
  }

  // 3. SEMANTIC SIGNAL (Token Overlap Ratio)
  // On calcule le ratio de tokens de la requête présents dans les métadonnées du sujet
  const allMetadataTokens = new Set([
    ...topic.tags.flatMap(tokenize),
    ...topic.synonyms.flatMap(tokenize),
    ...topic.canonicalQuestions.flatMap(tokenize)
  ]);
  
  const overlap = qTokens.filter(t => allMetadataTokens.has(t)).length;
  const semanticRatio = overlap / qTokens.length;
  score += semanticRatio * 15; // Signal sémantique léger (max +15)

  score += Number(topic.priority || 0) / 1000;
  return score;
}

function isAmbiguousTopMatch(best, secondBest) {
  if (!best) return true;
  if (!secondBest) return false;
  const diff = best.score - secondBest.score;
  const isAmbiguous = diff < 4;
  
  if (isAmbiguous) {
    console.warn(`[KnowledgeRouter] Ambiguïté détectée entre "${best.id}" (${best.score.toFixed(2)}) et "${secondBest.id}" (${secondBest.score.toFixed(2)}). Diff: ${diff.toFixed(2)}`);
  }
  
  return isAmbiguous;
}

export function resolveGovernedTopic(query = '') {
  if (!query || detectTautologyOrRiddle(query)) return null;

  const ranked = manifest
    .map(topic => ({ ...topic, score: scoreTopic(query, topic) }))
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;

  const best = ranked[0];
  const secondBest = ranked[1] || null;

  if (best.score < 10) {
    if (best.score > 5) {
      console.log(`[KnowledgeRouter] Match trop faible pour "${best.id}" (Score: ${best.score.toFixed(2)})`);
    }
    return null;
  }

  if (isAmbiguousTopMatch(best, secondBest)) {
    return null;
  }

  return best;
}


export { normalizeQuery, tokenize, scoreTopic, detectTautologyOrRiddle };

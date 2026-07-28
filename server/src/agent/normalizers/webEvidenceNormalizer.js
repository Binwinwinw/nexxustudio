/**
 * WEB EVIDENCE NORMALIZER
 * Normalise les résultats bruts de recherche web en packet structuré
 * compatible avec le pipeline orchestral de La Citadelle.
 */

import {
  checkUrlPolicy,
  checkContentPolicy,
  getSourceConfidence,
  MAX_SNIPPET_LENGTH,
} from '../policies/webSourcePolicy.js';

/**
 * Normalise un résultat brut DuckDuckGo en source structurée.
 * @param {object} rawResult - Résultat brut de duck-duck-scrape
 * @returns {object|null} Source normalisée ou null si bloquée
 */
export function normalizeWebResult(rawResult) {
  if (!rawResult) return null;

  const url = rawResult.url || rawResult.link || '';
  const title = rawResult.title || 'Sans titre';
  const snippet = rawResult.description || rawResult.snippet || rawResult.body || '';

  // Vérification de politique URL
  const urlCheck = checkUrlPolicy(url);
  if (urlCheck.blocked) {
    console.log(`[WebEvidenceNormalizer] URL bloquée (${urlCheck.reason}): ${url}`);
    return null;
  }

  // Vérification de contenu
  const contentCheck = checkContentPolicy(snippet);
  if (contentCheck.blocked) {
    console.log(`[WebEvidenceNormalizer] Contenu bloqué (${contentCheck.reason}): ${url}`);
    return null;
  }

  const confidence = getSourceConfidence(url);

  return {
    title: title.slice(0, 200),
    url,
    snippet: snippet.slice(0, MAX_SNIPPET_LENGTH),
    source_type: 'search_result',
    confidence,
    consulted_at: new Date().toISOString(),
  };
}

/**
 * Normalise un tableau de résultats bruts en sources filtrées et triées.
 * @param {Array} rawResults - Tableau de résultats bruts
 * @param {number} maxResults - Nombre maximum de résultats à retenir
 * @returns {Array} Sources normalisées
 */
export function normalizeWebResults(rawResults, maxResults = 5) {
  if (!Array.isArray(rawResults) || rawResults.length === 0) {
    return [];
  }

  const normalized = rawResults
    .map(r => normalizeWebResult(r))
    .filter(r => r !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults);

  return normalized;
}

/**
 * Calcule le score de confiance global d'un ensemble de sources.
 * @param {Array} sources - Sources normalisées
 * @returns {number} Score global 0.0 - 1.0
 */
export function computeOverallConfidence(sources) {
  if (!sources || sources.length === 0) return 0;
  const avg = sources.reduce((sum, s) => sum + (s.confidence || 0), 0) / sources.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Génère un résumé brut textuel à partir des sources normalisées.
 * Utilisé comme input pour le finalRendererAgent.
 * @param {string} query - Requête originale
 * @param {Array} sources - Sources normalisées
 * @returns {string} Résumé textuel pour l'orchestrateur
 */
export function buildRawSummary(query, sources) {
  if (!sources || sources.length === 0) {
    return `Aucune source fiable trouvée pour : "${query}"`;
  }

  const lines = sources.map((s, i) =>
    `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`
  );

  return `Résultats de recherche pour : "${query}"\n\n${lines.join('\n\n')}`;
}

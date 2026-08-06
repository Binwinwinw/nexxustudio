/**
 * WEB SEARCH SERVICE
 * Service de recherche web via duck-duck-scrape.
 * Implémente les garde-fous d'ADR-011 : robots.txt, rate limiting, timeout.
 */

import { search } from 'duck-duck-scrape';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  RATE_LIMIT_MS,
  REQUEST_TIMEOUT_MS,
  MAX_RESULTS,
  AGENT_USER_AGENT,
  checkUrlPolicy,
} from '../agent/policies/web/index.js';
import { shortenWebSearchQuery } from '../agent/policies/routing/explicitWebSearchRequestPolicy.js';
import { createWebSearchHttpsAgent } from './webSearchTls.js';

const webSearchHttpsAgent = createWebSearchHttpsAgent();

function axiosTlsConfig() {
  return webSearchHttpsAgent ? { httpsAgent: webSearchHttpsAgent } : {};
}

// ── Fallback DuckDuckGo HTML Scraper (extrêmement robuste & stable via DDG Lite) ──
async function fallbackWebSearch(query) {
  try {
    const url = 'https://lite.duckduckgo.com/lite/';
    const params = new URLSearchParams();
    params.append('q', query);

    const response = await axios.post(url, params, {
      headers: {
        'User-Agent': AGENT_USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
        'Origin': 'https://lite.duckduckgo.com',
        'Referer': 'https://lite.duckduckgo.com/'
      },
      timeout: 5000,
      ...axiosTlsConfig(),
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $('tr').each((i, trEl) => {
      const $tr = $(trEl);
      const indexTd = $tr.find('td[valign="top"]');
      if (indexTd.length > 0 && /^\d+\./.test(indexTd.text().trim())) {
        const link = $tr.find('td').eq(1).find('a');
        const title = link.text().trim();
        const href = link.attr('href');

        if (title && href) {
          const nextTr = $tr.next('tr');
          const snippet = nextTr.find('.result-snippet').text().trim();

          let realUrl = href;
          if (href.startsWith('//duckduckgo.com/y.js') || href.includes('uddg=')) {
            try {
              const u = new URL(href.startsWith('http') ? href : 'https:' + href);
              realUrl = u.searchParams.get('uddg') || href;
            } catch {}
          }

          results.push({
            title,
            url: realUrl,
            description: snippet || ''
          });
        }
      }
    });

    return results;
  } catch (err) {
    console.error(`[WebSearchService] Fallback scraping failed: ${err.message}`);
    return [];
  }
}

// ── Rate Limiter par domaine ──────────────────────────────────────────────────
const lastRequestByDomain = new Map();

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function enforceRateLimit(domain) {
  const lastTime = lastRequestByDomain.get(domain) || 0;
  const elapsed = Date.now() - lastTime;
  if (elapsed < RATE_LIMIT_MS) {
    const waitMs = RATE_LIMIT_MS - elapsed;
    console.log(`[WebSearchService] Rate limit: attente de ${waitMs}ms pour ${domain}`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  lastRequestByDomain.set(domain, Date.now());
}

// ── Vérification robots.txt (cache simple) ───────────────────────────────────
const robotsCache = new Map();

async function isAllowedByRobots(url) {
  try {
    const domain = extractDomain(url);
    const robotsUrl = `https://${domain}/robots.txt`;

    if (robotsCache.has(domain)) {
      return robotsCache.get(domain);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await axios
      .get(robotsUrl, {
        headers: { 'User-Agent': AGENT_USER_AGENT },
        timeout: 3000,
        signal: controller.signal,
        validateStatus: () => true,
        ...axiosTlsConfig(),
      })
      .catch(() => null);

    clearTimeout(timeout);

    if (!response || response.status < 200 || response.status >= 400) {
      // Si robots.txt inaccessible, on suppose permis (pas d'interdiction explicite)
      robotsCache.set(domain, true);
      return true;
    }

    const text = String(response.data || "");
    // Vérification simplifiée : cherche Disallow: / pour tous les agents
    const lines = text.split('\n');
    let isUserAgentAll = false;
    let isDisallowedAll = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed === 'user-agent: *') isUserAgentAll = true;
      if (isUserAgentAll && trimmed === 'disallow: /') {
        isDisallowedAll = true;
        break;
      }
      if (trimmed.startsWith('user-agent:') && !trimmed.includes('*')) {
        isUserAgentAll = false;
      }
    }

    const allowed = !isDisallowedAll;
    robotsCache.set(domain, allowed);

    if (!allowed) {
      console.log(`[WebSearchService] robots.txt interdit le crawl sur : ${domain}`);
    }

    return allowed;
  } catch {
    return true; // Fail-open sur robots.txt si erreur réseau
  }
}

/**
 * Effectue une recherche web via DuckDuckGo avec tous les garde-fous ADR-011.
 *
 * @param {string} query - Requête de recherche
 * @param {object} options
 * @param {number} [options.maxResults=5] - Nombre max de résultats
 * @param {string} [options.locale='fr-fr'] - Locale de recherche
 * @returns {Promise<{ results: Array, query: string, failure_mode: string|null }>}
 */
async function filterSearchResults(rawResults, maxResults) {
  const filtered = [];
  for (const result of rawResults) {
    const url = result.url || result.link || '';
    const urlCheck = checkUrlPolicy(url);

    if (urlCheck.blocked) {
      console.log(`[WebSearchService] Résultat filtré (politique URL): ${url}`);
      continue;
    }

    const robotsAllowed = await isAllowedByRobots(url);
    if (!robotsAllowed) {
      console.log(`[WebSearchService] Résultat filtré (robots.txt): ${url}`);
      continue;
    }

    filtered.push(result);
    if (filtered.length >= maxResults) break;
  }
  return filtered;
}

async function runPrimarySearch(query, { locale, timeoutMs, maxResults }) {
  const searchPromise = search(query, {
    safeSearch: 0,
    locale,
  });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout de recherche atteint')), timeoutMs)
  );
  const searchResponse = await Promise.race([searchPromise, timeoutPromise]);
  const rawResults = searchResponse?.results || [];
  console.log(`[WebSearchService] ${rawResults.length} résultats bruts reçus`);
  const filtered = await filterSearchResults(rawResults, maxResults);
  console.log(`[WebSearchService] ${filtered.length} résultats retenus après filtrage`);
  return {
    results: filtered,
    query,
    failure_mode: filtered.length === 0 ? 'no_results_after_filtering' : null,
  };
}

function isVqdOrPrimarySearchFailure(err) {
  const msg = String(err?.message || err || '');
  return /vqd|timeout|econn|enotfound|fetch|network|429|403/i.test(msg);
}

/**
 * Query de retry après échec primaire (ex. VQD sur brief long).
 * @param {string} query
 * @param {unknown} err
 * @returns {string|null}
 */
export function resolveShortRetryQuery(query, err) {
  if (!isVqdOrPrimarySearchFailure(err)) return null;
  const shortened = shortenWebSearchQuery(query);
  const original = String(query || '').trim();
  if (!shortened || shortened === original || shortened.length >= original.length) {
    return null;
  }
  return shortened;
}

export async function webSearch(query, options = {}) {
  const maxResults = options.maxResults || MAX_RESULTS;
  const locale = options.locale || 'fr-fr';
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const activeQuery = String(query || '').trim();

  console.log(`[WebSearchService] Recherche: "${activeQuery}" (max: ${maxResults}, locale: ${locale}, timeout: ${timeoutMs}ms)`);

  // Rate limit global sur DuckDuckGo
  await enforceRateLimit('duckduckgo.com');

  try {
    return await runPrimarySearch(activeQuery, { locale, timeoutMs, maxResults });
  } catch (err) {
    console.error(`[WebSearchService] Erreur de recherche principale: ${err.message}.`);

    // Retry une fois avec query raccourcie (ex. brief marketing → VQD fail)
    const shortened = resolveShortRetryQuery(activeQuery, err);
    if (shortened) {
      try {
        console.log(`[WebSearchService] Retry VQD/query courte: "${shortened}"`);
        await enforceRateLimit('duckduckgo.com');
        return await runPrimarySearch(shortened, { locale, timeoutMs, maxResults });
      } catch (retryErr) {
        console.error(
          `[WebSearchService] Retry query courte échoué: ${retryErr.message}. Fallback HTML...`,
        );
      }
    } else {
      console.error(`[WebSearchService] Lancement du fallback HTML...`);
    }

    const fallbackQuery = shortened || shortenWebSearchQuery(activeQuery) || activeQuery;
    try {
      const fallbackResults = await fallbackWebSearch(fallbackQuery);
      console.log(`[WebSearchService] Fallback HTML a retourné ${fallbackResults.length} résultats`);

      const filtered = await filterSearchResults(fallbackResults, maxResults);

      return {
        results: filtered,
        query: fallbackQuery,
        failure_mode: filtered.length === 0 ? 'fallback_no_results' : null,
      };
    } catch (fallbackErr) {
      console.error(`[WebSearchService] Erreur critique dans le fallback HTML: ${fallbackErr.message}`);
      return {
        results: [],
        query: fallbackQuery,
        failure_mode: 'search_error',
      };
    }
  }
}

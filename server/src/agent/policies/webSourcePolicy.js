/**
 * WEB SOURCE POLICY — ADR-011
 * Politique de scraping souverain de La Citadelle.
 * Toute consultation web doit passer par ces garde-fous.
 */

// ── Allowlist de domaines de confiance ───────────────────────────────────────
export const TRUSTED_DOMAIN_PATTERNS = [
  /wikipedia\.org/i,
  /wikisource\.org/i,
  /wikimedia\.org/i,
  /\.gouv\.fr/i,
  /\.gov$/i,
  /\.europa\.eu/i,
  /mdn\.io/i,
  /developer\.mozilla\.org/i,
  /arxiv\.org/i,
  /pubmed\.ncbi\.nlm\.nih\.gov/i,
  /docs\.python\.org/i,
  /nodejs\.org\/docs/i,
  /developer\.apple\.com/i,
  /docs\.microsoft\.com/i,
  /learn\.microsoft\.com/i,
];

// ── Déclencheurs de blocage automatique ──────────────────────────────────────
export const BLOCK_TRIGGERS_URL = [
  'login', 'signin', 'signup', 'register', 'auth',
  'account', 'password', 'captcha', 'checkout',
  'paywall', 'subscribe', 'premium', 'membership',
];

export const BLOCK_TRIGGERS_CONTENT = [
  'enter your password',
  'sign in to continue',
  'create an account',
  'subscribe to read',
  'verify you are human',
  'please complete the captcha',
];

// ── Paramètres de rate limiting ───────────────────────────────────────────────
export const RATE_LIMIT_MS = 2000;       // 1 requête / 2s par domaine minimum
export const REQUEST_TIMEOUT_MS = 8000;  // Timeout strict de 8 secondes
export const MAX_RESULTS = 5;            // Max 5 résultats retenus par recherche
export const MAX_SNIPPET_LENGTH = 400;   // Max 400 caractères par snippet

// ── User-Agent honnête ────────────────────────────────────────────────────────
export const AGENT_USER_AGENT = 'NexxusCitadel/1.0 (research-agent; non-commercial; local-use)';

/**
 * Vérifie si une URL déclenche un blocage automatique.
 * @param {string} url
 * @returns {{ blocked: boolean, reason: string|null }}
 */
export function checkUrlPolicy(url) {
  if (!url || typeof url !== 'string') {
    return { blocked: true, reason: 'URL invalide ou absente' };
  }

  const lower = url.toLowerCase();

  for (const trigger of BLOCK_TRIGGERS_URL) {
    if (lower.includes(trigger)) {
      return { blocked: true, reason: `URL contient un déclencheur de blocage : "${trigger}"` };
    }
  }

  return { blocked: false, reason: null };
}

/**
 * Vérifie si le contenu d'une page déclenche un blocage.
 * @param {string} content
 * @returns {{ blocked: boolean, reason: string|null }}
 */
export function checkContentPolicy(content) {
  if (!content) return { blocked: false, reason: null };
  const lower = content.toLowerCase();

  for (const trigger of BLOCK_TRIGGERS_CONTENT) {
    if (lower.includes(trigger)) {
      return { blocked: true, reason: `Contenu suspect détecté : "${trigger}"` };
    }
  }

  return { blocked: false, reason: null };
}

/**
 * Retourne true si l'URL appartient à un domaine de confiance.
 * @param {string} url
 * @returns {boolean}
 */
export function isTrustedDomain(url) {
  return TRUSTED_DOMAIN_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Calcule un score de confiance initial basé sur le domaine.
 * @param {string} url
 * @returns {number} 0.0 - 1.0
 */
export function getSourceConfidence(url) {
  if (isTrustedDomain(url)) return 0.85;
  const { blocked } = checkUrlPolicy(url);
  if (blocked) return 0.0;
  return 0.60; // Source publique inconnue — confiance modérée
}

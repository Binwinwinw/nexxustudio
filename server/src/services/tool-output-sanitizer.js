/**
 * Sanitisation des sorties d'outils (OWASP ASI-03) + garde-fous egress SSRF textuels.
 * skill-egress-security — code runtime associé.
 */
import { checkUrlSsrf } from "../security/ssrfProtection.js";

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|prior|above)/gi,
  /forget\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /you\s+are\s+now\s+(in\s+)?(maintenance|admin|developer)\s+mode/gi,
  /new\s+system\s*prompt/gi,
  /<\s*system\s*>/gi,
];

const SCRIPT_TAG = /<script[^>]*>[\s\S]*?<\/script>/gi;
const IFRAME_TAG = /<iframe[^>]*>[\s\S]*?<\/iframe>/gi;
const URL_IN_TEXT = /https?:\/\/[^\s<>"')\]]+/gi;

/**
 * @param {string} urlString
 * @returns {{ blocked: boolean, reason: string|null }}
 */
export function isBlockedEgressUrl(urlString) {
  return checkUrlSsrf(urlString);
}

/**
 * @param {string} output
 * @param {string} [source]
 * @returns {{ text: string, flags: object }}
 */
export function sanitizeToolOutput(output, source = 'generic') {
  let text = String(output ?? '');
  const flags = {
    source,
    scriptTagsStripped: 0,
    iframeTagsStripped: 0,
    urlsBlocked: 0,
    injectionPatternsStripped: 0,
  };

  text = text.replace(SCRIPT_TAG, () => {
    flags.scriptTagsStripped += 1;
    return '[script supprimé]';
  });

  text = text.replace(IFRAME_TAG, () => {
    flags.iframeTagsStripped += 1;
    return '[iframe supprimé]';
  });

  text = text.replace(URL_IN_TEXT, (rawUrl) => {
    const check = isBlockedEgressUrl(rawUrl);
    if (check.blocked) {
      flags.urlsBlocked += 1;
      return '[URL interne bloquée]';
    }
    return rawUrl;
  });

  for (const pattern of INJECTION_PATTERNS) {
    const before = text;
    text = text.replace(pattern, '[consigne injectée supprimée]');
    if (text !== before) flags.injectionPatternsStripped += 1;
  }

  return { text: text.trim(), flags };
}

/**
 * Nettoie un packet expert_web_search avant injection contexte.
 * @param {object} webPacket
 * @returns {{ packet: object, audit: object }}
 */
export function sanitizeWebSearchPacket(webPacket = {}) {
  const audit = {
    sourcesRemoved: 0,
    sanitization: [],
  };

  const sources = Array.isArray(webPacket.sources) ? [...webPacket.sources] : [];
  const cleanSources = [];

  for (const source of sources) {
    const url = source?.url || '';
    const urlCheck = isBlockedEgressUrl(url);
    if (urlCheck.blocked) {
      audit.sourcesRemoved += 1;
      continue;
    }

    const snippet = sanitizeToolOutput(source.snippet || source.description || '', 'web-snippet');
    audit.sanitization.push(snippet.flags);

    cleanSources.push({
      ...source,
      snippet: snippet.text,
      description: snippet.text,
    });
  }

  const summaryRaw = webPacket.summary || webPacket.content || '';
  const summaryClean = sanitizeToolOutput(summaryRaw, 'web-search-summary');
  audit.sanitization.push(summaryClean.flags);

  const packet = {
    ...webPacket,
    sources: cleanSources,
    summary: summaryClean.text,
    content: summaryClean.text,
    meta_sanitized: true,
  };

  if (cleanSources.length === 0 && sources.length > 0) {
    packet.failure_mode = packet.failure_mode || 'egress_sources_blocked';
    packet.requires_human_caution = true;
  }

  return { packet, audit };
}

/**
 * Valide une URL avant fetch HTTP (webSummarizer, etc.).
 * @throws {Error} si bloquée
 */
export function assertEgressUrlAllowed(urlString) {
  const check = isBlockedEgressUrl(urlString);
  if (check.blocked) {
    throw new Error(`Egress refusé (${check.reason}) : ${urlString}`);
  }
}

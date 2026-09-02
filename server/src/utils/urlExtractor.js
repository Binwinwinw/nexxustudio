import axios from "axios";
import * as cheerio from "cheerio";
import {
  AGENT_USER_AGENT,
  REQUEST_TIMEOUT_MS,
  RATE_LIMIT_MS,
  checkUrlPolicy,
  checkContentPolicy,
} from "../agent/policies/web/index.js";
import { validateEgressUrl } from "../security/ssrfProtection.js";
import { sanitizeToolOutput } from "../services/tool-output-sanitizer.js";

/** Plafond corps HTML — anti DoS mémoire. */
const MAX_BODY_BYTES = 2_000_000;
/** Lecture surface — pas un dump de site. */
export const SURFACE_MAX_CHARS = 4_000;
export const SURFACE_EXCERPT_CHARS = 2_400;
export const SURFACE_HEADING_LIMIT = 10;
const MAX_REDIRECTS = 3;
const RATE_LIMIT_ENTRY_TTL_MS = 60_000;

/** Rate limit simple par hostname (aligné ADR-011 ≥ 2s). */
const lastFetchByHost = new Map();

/**
 * @param {string} url
 * @param {{
 *   httpGet?: (url: string, config: object) => Promise<{
 *     status: number,
 *     headers?: Record<string, string>,
 *     data?: string,
 *     config?: { url?: string },
 *   }>,
 * }} [options]
 * @returns {Promise<{
 *   url: string,
 *   content: string|null,
 *   extractedAt: string,
 *   success: boolean,
 *   error?: string,
 *   blockedReason?: string,
 *   sanitization?: object,
 * }>}
 */
export async function extractUrlContent(url, options = {}) {
  const extractedAt = new Date().toISOString();
  const raw = String(url || "").trim();
  const httpGet = options.httpGet || defaultHttpGet;
  const validateUrl = options.validateEgressUrl || validateEgressUrl;

  try {
    const urlPolicy = checkUrlPolicy(raw);
    if (urlPolicy.blocked) {
      return fail(raw, extractedAt, urlPolicy.reason, "url_policy");
    }

    pruneRateLimitMap();
    const firstSsrf = await validateUrl(raw);
    if (firstSsrf.blocked) {
      return fail(
        raw,
        extractedAt,
        `SSRF bloqué (${firstSsrf.reason})`,
        firstSsrf.reason,
      );
    }

    const hostname = firstSsrf.hostname;
    if (!options.bypassRateLimit) {
      const now = Date.now();
      const last = lastFetchByHost.get(hostname)?.at || 0;
      if (now - last < RATE_LIMIT_MS) {
        return fail(
          raw,
          extractedAt,
          `Rate limit : attendre ${RATE_LIMIT_MS}ms entre requêtes sur ${hostname}`,
          "rate_limit",
        );
      }
    }

    let currentUrl = firstSsrf.url.href;
    let response = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const ssrf = await validateUrl(currentUrl);
      if (ssrf.blocked) {
        return fail(
          raw,
          extractedAt,
          `SSRF bloqué (${ssrf.reason}) hop=${hop}`,
          ssrf.reason,
        );
      }

      const hopPolicy = checkUrlPolicy(ssrf.url.href);
      if (hopPolicy.blocked) {
        return fail(raw, extractedAt, hopPolicy.reason, "url_policy");
      }

      response = await httpGet(ssrf.url.href, buildAxiosConfig());

      if (response.status >= 300 && response.status < 400) {
        const location = pickLocationHeader(response.headers);
        if (!location) {
          return fail(
            raw,
            extractedAt,
            `Redirect ${response.status} sans Location`,
            "redirect_no_location",
          );
        }
        currentUrl = new URL(location, ssrf.url.href).href;
        continue;
      }

      if (response.status < 200 || response.status >= 400) {
        return fail(
          raw,
          extractedAt,
          `HTTP ${response.status}`,
          "http_status",
        );
      }

      currentUrl = ssrf.url.href;
      break;
    }

    if (!response || response.status < 200 || response.status >= 300) {
      return fail(
        raw,
        extractedAt,
        `Trop de redirects (>${MAX_REDIRECTS}) ou réponse invalide`,
        "redirect_exhausted",
      );
    }

    const finalSsrf = await validateUrl(currentUrl);
    if (finalSsrf.blocked) {
      return fail(
        raw,
        extractedAt,
        `URL finale SSRF (${finalSsrf.reason})`,
        finalSsrf.reason,
      );
    }

    const contentType = String(
      response.headers?.["content-type"] ||
        response.headers?.["Content-Type"] ||
        "",
    ).toLowerCase();
    if (
      contentType &&
      !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)
    ) {
      return fail(
        raw,
        extractedAt,
        `Content-Type non HTML : ${contentType}`,
        "content_type",
      );
    }

    const html = typeof response.data === "string" ? response.data : "";
    if (!html.trim()) {
      return fail(raw, extractedAt, "Page vide", "empty_body");
    }

    const rawText = extractSurfaceFromHtml(html, currentUrl);
    const contentPolicy = checkContentPolicy(rawText);
    if (contentPolicy.blocked) {
      return fail(raw, extractedAt, contentPolicy.reason, "content_policy");
    }

    if (!rawText || rawText.length < 40) {
      return fail(
        raw,
        extractedAt,
        "Contenu textuel insuffisant après nettoyage",
        "insufficient_text",
      );
    }

    const sanitized = sanitizeToolOutput(rawText, "web-page-extract");
    lastFetchByHost.set(hostname, { at: Date.now() });

    return {
      url: currentUrl,
      content: sanitized.text,
      sanitization: sanitized.flags,
      extractedAt,
      success: true,
      profile: "surface",
    };
  } catch (error) {
    console.error("[URL Extractor] Échec:", error.message);
    return {
      url: raw,
      content: null,
      error: error.message,
      extractedAt,
      success: false,
    };
  }
}

/**
 * @returns {object}
 */
function buildAxiosConfig() {
  return {
    headers: {
      "User-Agent": AGENT_USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 0,
    maxContentLength: MAX_BODY_BYTES,
    maxBodyLength: MAX_BODY_BYTES,
    responseType: "text",
    validateStatus: () => true,
  };
}

/**
 * @param {string} url
 * @param {object} config
 */
async function defaultHttpGet(url, config) {
  return axios.get(url, config);
}

/**
 * @param {Record<string, string>|undefined} headers
 * @returns {string|null}
 */
function pickLocationHeader(headers = {}) {
  if (!headers || typeof headers !== "object") return null;
  const raw =
    headers.location ||
    headers.Location ||
    headers.LOCATION ||
    null;
  return raw ? String(raw).trim() : null;
}

function pruneRateLimitMap() {
  const cutoff = Date.now() - RATE_LIMIT_ENTRY_TTL_MS;
  for (const [host, entry] of lastFetchByHost.entries()) {
    if (!entry?.at || entry.at < cutoff) lastFetchByHost.delete(host);
  }
}

/**
 * 1 GET, HTML de l'URL fournie seulement. Titre + meta + rubriques + extrait.
 * Pas de suivi de liens, pas de dump body.
 *
 * @param {string} html
 * @param {string} url
 * @returns {string}
 */
function extractSurfaceFromHtml(html, url) {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, aside, .sidebar, iframe, noscript").remove();

  const title = firstMetaText($, [
    "title",
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]);
  const description = firstMetaText($, [
    'meta[name="description"]',
    'meta[property="og:description"]',
  ]);

  const headings = [];
  $("h1, h2, h3").each((_, el) => {
    if (headings.length >= SURFACE_HEADING_LIMIT) return false;
    const t = clipText($(el).text(), 120);
    if (t) headings.push(t);
  });

  let mainRoot = $("main, article, [role='main']").first();
  if (String(url).includes("github.com")) {
    const readme = $("article.markdown-body");
    if (readme.length > 0) mainRoot = readme;
  }
  if (!mainRoot.length) mainRoot = $("body");
  const excerpt = clipText(mainRoot.text(), SURFACE_EXCERPT_CHARS);

  const parts = [];
  if (title) parts.push(`Titre: ${clipText(title, 200)}`);
  if (description) parts.push(`Description: ${clipText(description, 400)}`);
  if (headings.length) parts.push(`Rubriques: ${headings.join(" · ")}`);
  if (excerpt) parts.push(`Extrait:\n${excerpt}`);
  return parts.join("\n").slice(0, SURFACE_MAX_CHARS);
}

/**
 * @param {import("cheerio").CheerioAPI} $
 * @param {string[]} selectors
 * @returns {string}
 */
function firstMetaText($, selectors) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const value = sel.startsWith("meta")
      ? el.attr("content")
      : el.text();
    const clipped = clipText(value, 400);
    if (clipped) return clipped;
  }
  return "";
}

/**
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
function clipText(text, max = SURFACE_MAX_CHARS) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * @param {string} url
 * @param {string} extractedAt
 * @param {string} message
 * @param {string} [blockedReason]
 */
function fail(url, extractedAt, message, blockedReason) {
  return {
    url,
    content: null,
    error: message,
    blockedReason: blockedReason || null,
    extractedAt,
    success: false,
  };
}

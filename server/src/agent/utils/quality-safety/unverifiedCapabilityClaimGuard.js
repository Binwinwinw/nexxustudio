/**
 * Fail-closed — claims opérationnelles non vérifiées en livraison buffered.
 * Autorité : scripts package.json du serveur + citation query/history.
 * Pas de registre global. Pas de vérification d’URL web.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ENVIRONMENT_DISCLOSURE_SAFE_REPLY } from "./environmentDisclosureGuard.js";
import { UNSUPPORTED_ACTION_REFUSAL } from "../../config/modeResponseContracts.js";
import { buildRecallFooter } from "../conversation/conversationGuards.js";

export const UNVERIFIED_CAPABILITY_CLAIM_RULE =
  "no_unverified_operational_capability_claims";

const NPM_RUN_RE = /\bnpm run ([a-z0-9:_-]+)/gi;
const URL_RE = /https?:\/\/[^\s)\]>'"`]+/gi;
const DOC_HOST_RE = /(?:^|\.)example\.(?:com|org|net)$/i;
const DOC_PATH_RE = /documentation\/agent-interactions/i;

const AUDIT_PRODUCT_RE =
  /\b(?:audit de session|rapport(?: d[eé]taill[eé])? d['’]interactions|documentation d['’](?:les )?interactions)\b/i;
const AUDIT_OFFER_RE =
  /\b(?:je (?:peux|vais)|voici|consulte|lance|pr[eé]pare|fournis|acc[eè]de|disponible|existe)\b/i;

const INTER_SESSION_RE =
  /\b(?:m[eé]moire inter[- ]session|historique complet|toutes (?:tes |nos |les )?conversations (?:ant[eé]rieures|pass[eé]es)|conversations? (?:ant[eé]rieures|pass[eé]es) hors)\b/i;
const INTER_SESSION_ACCESS_RE =
  /\b(?:j['’]ai acc[eè]s|je (?:peux|retrouve|conserve)|accessible|disponible)\b/i;

const FUTURE_NOW_RE =
  /\b(?:imm[eé]diatement disponible|disponible imm[eé]diatement|d[eè]s maintenant)\b/i;
const FUTURE_CAP_RE =
  /capacit[eé]s?\s+(?:future|à venir|non v[eé]rifi[eé]e)|(?:future|à venir|non v[eé]rifi[eé]e)\s+capacit[eé]/i;

const HONEST_LIMIT_RE =
  /\bje ne (?:peux pas|peux) v[eé]rifier\b|\bje n['’]ai pas (?:de )?(?:acc[eè]s|journal)\b|\bce r[eé]cap porte sur ce fil uniquement\b|\bhors de (?:cette session|ce fil)\b/i;

let scriptCache = null;

function serverPackageJsonPath() {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../package.json",
  );
}

function loadVerifiedNpmScripts() {
  if (scriptCache) return scriptCache;
  try {
    const raw = JSON.parse(fs.readFileSync(serverPackageJsonPath(), "utf8"));
    scriptCache = new Set(
      Object.keys(raw?.scripts && typeof raw.scripts === "object" ? raw.scripts : {}),
    );
  } catch {
    scriptCache = new Set();
  }
  return scriptCache;
}

export function resetVerifiedNpmScriptCache() {
  scriptCache = null;
}

function citationBlob(query = "", history = []) {
  const turns = Array.isArray(history) ? history : [];
  return [query, ...turns.map((m) => m?.content || "")].join("\n");
}

function stripUrlTail(url = "") {
  return String(url || "").replace(/[.,;:!?]+$/g, "");
}

function isDocumentaryUnverifiedUrl(url = "") {
  try {
    const parsed = new URL(stripUrlTail(url));
    return DOC_HOST_RE.test(parsed.hostname) || DOC_PATH_RE.test(parsed.pathname);
  } catch {
    return DOC_PATH_RE.test(url);
  }
}

function citedInUserMaterial(needle, blob) {
  if (!needle) return false;
  return blob.toLowerCase().includes(String(needle).toLowerCase());
}

/**
 * @param {string} text
 * @param {{ query?: string, history?: object[] }} [ctx]
 * @returns {{ kind: string, detail?: string }|null}
 */
export function detectUnverifiedCapabilityClaim(text = "", ctx = {}) {
  const body = String(text || "").trim();
  if (!body) return null;

  const blob = citationBlob(ctx.query, ctx.history);
  const scripts = loadVerifiedNpmScripts();

  for (const match of body.matchAll(NPM_RUN_RE)) {
    const script = match[1];
    const token = `npm run ${script}`;
    if (citedInUserMaterial(token, blob)) continue;
    if (!scripts.has(script)) {
      return { kind: "npm", detail: script };
    }
  }

  for (const raw of body.matchAll(URL_RE)) {
    const url = stripUrlTail(raw[0]);
    if (citedInUserMaterial(url, blob)) continue;
    if (isDocumentaryUnverifiedUrl(url)) {
      return { kind: "url", detail: url };
    }
  }

  if (HONEST_LIMIT_RE.test(body)) return null;

  if (INTER_SESSION_RE.test(body) && INTER_SESSION_ACCESS_RE.test(body)) {
    return { kind: "memory" };
  }

  if (AUDIT_PRODUCT_RE.test(body) && AUDIT_OFFER_RE.test(body)) {
    return { kind: "audit" };
  }

  if (FUTURE_NOW_RE.test(body) && FUTURE_CAP_RE.test(body)) {
    return { kind: "future" };
  }

  return null;
}

/**
 * @param {string} text
 * @param {{ query?: string, history?: object[] }} [ctx]
 * @returns {string}
 */
export function sanitizeUnverifiedCapabilityClaim(text = "", ctx = {}) {
  const hit = detectUnverifiedCapabilityClaim(text, ctx);
  if (!hit) return text;

  if (hit.kind === "npm" || hit.kind === "url") {
    return ENVIRONMENT_DISCLOSURE_SAFE_REPLY;
  }
  if (hit.kind === "memory") {
    return buildRecallFooter(ctx.query || "");
  }
  return UNSUPPORTED_ACTION_REFUSAL;
}

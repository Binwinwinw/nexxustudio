/**
 * Feedback produit / info architecture (sidebar, menus) — prime sur lexique « audit ».
 */
import { normalizeText as normalizeTextBase } from "./normalizationGuards.js";

const NAV_OBJECT_RE =
  /\b(?:sidebar|menu|menus|onglets?|r[eé]glages?|bouton|navigation|barre lat[eé]rale)\b/i;

const REORG_VERB_RE =
  /\b(?:combiner|regrouper|fusionner|r[eé]unir|d[eé]placer|restructurer)\b/i;

const PRODUCT_OPINION_RE = /\bqu['']?\s*en\s+penses[\s-]tu\b/i;

/** Motifs Cockpit Nexxus — pas React Doctor. */
const COCKPIT_UI_DISCUSSION_PATTERNS = [
  /\b(?:ta|ton|la|une)\s+sidebar\b/,
  /\b(?:combiner|regrouper|fusionner|r[eé]unir)\s+(?:les\s+)?menus?\b/,
  /\b(?:menu|menus|r[eé]glages?|cockpit)\b.{0,80}\b(?:gouvernance|triage|hooks|artefacts?|forge|telemetrie|t[eé]l[eé]m[eé]trie|audit\s+impact)\b/,
  /\b(?:gouvernance|triage|hooks|artefacts?|forge\s+async|audit\s+impact)\b.{0,80}\b(?:menu|menus|sidebar|r[eé]glages?|bouton)\b/,
  /\bqu['']?\s*en\s+penses[\s-]tu\b.{0,40}\b(?:sidebar|menu|r[eé]glages?|gouvernance|combiner|regrouper)\b/,
  /\bqu['']?\s*en\s+penses[\s-]tu\b.{0,120}\b(?:gouvernance|triage|hooks|artefacts?|forge)\b/,
];

function normalizeText(input = "") {
  return normalizeTextBase(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text, patterns) {
  return patterns.some((p) => p.test(text));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isNexxusCockpitUiDiscussion(query = "") {
  const text = normalizeText(query);
  if (!text || text.length < 20) return false;
  return matchesAny(text, COCKPIT_UI_DISCUSSION_PATTERNS);
}

/**
 * UI restructuring / avis navigation — désactive general/audit et G48.
 * @param {string} query
 * @returns {boolean}
 */
export function isUiNavigationRestructureFeedback(query = "") {
  if (isNexxusCockpitUiDiscussion(query)) return true;
  const text = normalizeText(query);
  if (!text || text.length < 12) return false;
  if (NAV_OBJECT_RE.test(text) && REORG_VERB_RE.test(text)) return true;
  if (NAV_OBJECT_RE.test(text) && PRODUCT_OPINION_RE.test(text)) return true;
  return false;
}

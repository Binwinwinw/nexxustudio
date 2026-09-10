/**
 * How-to produit/admin — feuille sans dépendre du registry.
 * Lot HOWTO_NAMED_TOOL_ADMIN_BYPASSES_EPISTEMIC_V1.
 */
import { normalizeForParse } from "../../micro/parsing/requestSegmentParser.js";

export const HOW_TO_SHELL_RE =
  /\b(?:comment\s+(?:on\s+)?(?:fait|faire|preparer|preparer)|sais\s+tu\s+comment\s+(?:on\s+)?(?:fait|faire)|comment\s+faire|savoir\s+si\s+tu\s+sais\s+comment|voudrais\s+savoir\s+comment|aimerais\s+savoir\s+comment(?:\s+faire)?|tu\s+sais\s+comment\s+(?:on\s+)?(?:fait|faire)|marche\s+a\s+suivre|demarche\s+a\s+suivre|les\s+etapes\s+(?:pour|de))\b/i;

const NAMED_TOOL_HOST_RE =
  /\b(?:je\s+suis\s+(?:sur|dans|avec)|dans|avec)\s+(?:(?:le|la|les|un|une)\s+)?([a-z0-9][a-z0-9._-]{1,31})\b/gi;

const NAMED_TOOL_HOST_STOP = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "du",
  "de",
  "des",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "tes",
  "son",
  "sa",
  "ses",
  "ce",
  "cet",
  "cette",
  "ces",
  "me",
  "te",
  "toi",
  "moi",
  "lui",
  "nous",
  "vous",
  "compte",
  "utilisateur",
  "acces",
  "membre",
  "invitation",
  "nouveau",
  "nouvelle",
  "nouvel",
]);

const ADMIN_ACTION_VERB_RE = /\b(?:creer|cree|ajouter|inviter)\b/i;
const ADMIN_OBJECT_RE = /\b(?:compte|utilisateur|acces|membre)\b/i;

function hasNamedToolHost(normalized = "") {
  NAMED_TOOL_HOST_RE.lastIndex = 0;
  let match;
  while ((match = NAMED_TOOL_HOST_RE.exec(normalized))) {
    const token = String(match[1] || "").toLowerCase();
    if (token && !NAMED_TOOL_HOST_STOP.has(token)) return true;
  }
  return false;
}

/**
 * Shell procédural + outil nommé + action admin. Veto code aux call sites.
 * @param {string} query
 */
export function isNamedToolAdminHowToRequest(query = "") {
  const normalized = normalizeForParse(query);
  if (!HOW_TO_SHELL_RE.test(normalized)) return false;
  if (!hasNamedToolHost(normalized)) return false;
  return ADMIN_ACTION_VERB_RE.test(normalized) && ADMIN_OBJECT_RE.test(normalized);
}

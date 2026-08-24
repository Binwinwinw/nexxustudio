/**
 * Fermeture sociale après repair — incident conversationnel déjà désamorcé.
 * Bloque debug_diagnostic_clarify / clarify métier.
 */
import { normalizeFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";

export const POST_REPAIR_SOCIAL_CLOSE_RULE = "post_repair_social_close_v1";

/** Peur / gêne / stress retombé. */
const EMOTION_RESOLVED_RE =
  /\b(?:ma|la)\s+(?:peur|g[eê]ne|angoisse|inqui[eé]tude|confusion)\b.{0,60}\b(?:disparu|disparue|retomb[eé]|pass[eé]e?|plus\s+l[àa]|plus\s+de|pas\s+justifi|injustifi)\b|\b(?:peur|g[eê]ne|angoisse)\b.{0,40}\b(?:a\s+disparu|est\s+pass[eé]e?|est\s+retomb[eé]e?)\b|\btant\s+mieux\b.{0,30}\b(?:retomb|pass[eé]|disparu)\b/i;

/** Problème / incident n’a plus besoin d’être traité. */
const ISSUE_RESOLVED_RE =
  /\b(?:plus\s+(?:besoin|la\s+peine)|pas\s+(?:besoin|grave)|c['']est\s+(?:bon|r[eé]gl[eé]|ok|fini)|laisse\s+(?:tomber|faire|ça\s+l[àa])|on\s+laisse\s+(?:tomber|ça)|plus\s+rien\s+[àa]\s+(?:faire|voir)|c['']?[eé]tait\s+rien)\b/i;

/** Lié à la réponse précédente + clôture (pas un ticket tech ouvert). */
const POST_REPAIR_CLOSE_RE =
  /\b(?:ta|cette|la)\s+r[eé]ponse\b.{0,50}\b(?:bizarre|chelou|[eé]trange)\b.{0,40}\b(?:mais|enfin|bon|ok|plus)\b|\binduit(?:e|es)?\s+en\s+erreur\b.{0,50}\b(?:peur|disparu|pass[eé]|plus)\b|\bton\s+comportement\b.{0,60}\b(?:induit|erreur).{0,60}\b(?:peur|disparu|pass[eé]|justifi)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasEmotionResolvedSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 12 || q.length > 240) return false;
  return EMOTION_RESOLVED_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasIssueResolvedSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 8 || q.length > 240) return false;
  // Évite « plus besoin de Redis » type tech — exige un ancrage social/émotionnel léger.
  if (
    /\b(?:redis|nginx|docker|stack\s*trace|ECONN|errno|status\s*5\d\d|crash|bug\s+api)\b/i.test(
      q,
    )
  ) {
    return false;
  }
  return ISSUE_RESOLVED_RE.test(q);
}

/**
 * Clôture post-repair : émotion/issue résolue ou incident conversationnel refermé.
 * @param {string} query
 * @returns {boolean}
 */
export function hasPostRepairSocialClose(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 12 || q.length > 240) return false;
  if (
    /\b(?:stack\s*trace|ECONN|errno|status\s*5\d\d|crashloop|redis\s+crash)\b/i.test(
      q,
    )
  ) {
    return false;
  }
  return (
    hasEmotionResolvedSignal(query) ||
    (hasIssueResolvedSignal(query) &&
      /\b(?:peur|g[eê]ne|r[eé]ponse|comportement|bizarre|induit)\b/i.test(q)) ||
    POST_REPAIR_CLOSE_RE.test(q)
  );
}

/** Panel ack court — zéro diagnostic. */
export const POST_REPAIR_CLOSE_REPLY_PANEL = Object.freeze([
  "Compris, tant mieux si c'est retombé.",
  "Ok, merci pour la précision — on laisse ça là.",
  "D'accord, tant mieux si la gêne est passée.",
]);

/**
 * @param {string} [query]
 * @returns {string}
 */
export function buildPostRepairSocialCloseReply(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (/\bpeur\b/i.test(q) && /\b(?:disparu|pas\s+justifi|injustifi|retomb)\b/i.test(q)) {
    return "Compris, tant mieux si c'est retombé.";
  }
  if (/\bg[eê]ne\b/i.test(q)) {
    return "D'accord, tant mieux si la gêne est passée.";
  }
  return "Ok, merci pour la précision — on laisse ça là.";
}

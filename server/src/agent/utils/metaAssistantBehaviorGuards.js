/**
 * META_ASSISTANT_BEHAVIOR — critique UX / comportement de l'assistant (pas mandat métier).
 */
import { normalizeText as normalizeTextBase } from "./normalizationGuards.js";

const BEHAVIOR_CRITIQUE_PATTERNS = [
  /\btu penses qu.{0,60}(reflechir|réfléchir|penser)\b/i,
  /\b(?:tu )?ne (?:veut|veux|vouloir) pas (?:reflechir|réfléchir)\b/i,
  /\buniquement repondre\b/i,
  /\buniquement répondre\b/i,
  /\b(?:tu )?ne (?:peux|peut) pas (?:reflechir|réfléchir)\b/i,
  /\b(?:reflechir|réfléchir).{0,50}(?:repondre|répondre) correctement\b/i,
  /\bon voit (?:encore )?que tu\b/i,
  /\bmontrer que tu comprends\b/i,
  /\bcomprends ce que je dis\b/i,
  /\btu comprends ce que\b/i,
  /\b(?:a|à) quel moment\b.{0,40}\b(?:comprends|montrer|montre)\b/i,
  /\b(avant de repondre|avant de répondre)\b/i,
  /\b(ton comportement|ta reponse|ta réponse|tes reponses|tes réponses)\b/i,
  /\bpourquoi tu reponds\b/i,
  /\bpourquoi tu réponds\b/i,
  /\bj aimerais que tu (?:reflechisses|réfléchisses|penses)\b/i,
  /\btu ne (?:reflechis|réfléchis) pas\b/i,
  /\breflechir avant\b/i,
  /\bréfléchir avant\b/i,
  /\b(reponse|réponse).{0,30}(chelou|bizarre|etrange|étrange|nul|pas bien)\b/i,
  /\b(comportement|clarification).{0,30}(chelou|bizarre|trop|agressif|penible|pénible)\b/i,
  /\btu (?:ne )?reflechis\b/i,
  /\btu (?:ne )?réfléchis\b/i,
  /\bréponds?\s+sans\s+(?:reflechir|réfléchir)\b/i,
  /\b(?:on dirait que )?tu\s+r[eé]ponds?\s+sans\s+(?:reflechir|réfléchir)\b/i,
  /\b(?:mauvais|mauvaise)\s+rail\b/i,
  /\b(?:prendre?|prends)\s+un\s+mauvais\s+rail\b/i,
  /\btrop\s+(?:vite\s+sur\s+)?composer\b/i,
  /\b(?:pars|part)\s+(?:trop\s+)?(?:vite\s+)?(?:sur\s+)?(?:composer|orchestrat)\b/i,
  /\b(?:encore\s+)?(?:en\s+)?orchestrat(?:eur|ion)\b/i,
  /\bmontrer que tu comprends\b/i,
  /\bcomprends ce que je dis\b/i,
  /\btu comprends ce que\b/i,
  /\b(?:a|à) quel moment\b.{0,40}\b(?:comprends|montrer|montre)\b/i,
];

function normalizeText(input = "") {
  return normalizeTextBase(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaAssistantBehaviorRequest(query = "") {
  const q = normalizeText(query);
  if (!q || q.length < 12) return false;
  return BEHAVIOR_CRITIQUE_PATTERNS.some((pattern) => pattern.test(q));
}

const COMPREHENSION_DEMO_RE =
  /\b(?:montrer que tu comprends|comprends ce que je dis|tu comprends ce que|(?:a|à) quel moment\b.{0,40}\b(?:comprends|montrer|montre))\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isComprehensionDemonstrationRequest(query = "") {
  const q = normalizeText(query);
  if (!q || q.length < 15) return false;
  return COMPREHENSION_DEMO_RE.test(q);
}

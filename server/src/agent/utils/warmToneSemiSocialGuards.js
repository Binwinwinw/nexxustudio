/**
 * Humanity probe — relances semi-sociales et transitions conversationnelles.
 * Pas un rail social déterministe ; pas une requête métier/code/factual.
 */
import { classifySocialPattern } from '../policies/social/index.js';
import { isSubstantiveWorkRequest } from './genericGreetingGuards.js';
import { isInformationSeekingWithTarget } from './informationSeekingIntentGuards.js';
import { isMetaAssistantBehaviorRequest } from './metaAssistantBehaviorGuards.js';
import { analyzeRequestIntentFrame } from '../policies/intent/requestIntentFrame.js';

const WARM_TONE_SEMI_SOCIAL_RE = [
  /\bok\s+et\s+(?:sinon|apr[eè]s|du\s+coup)\b/i,
  /\bouais\s+mais\s+du\s+coup\b/i,
  /\bhmm?\s+pas\s+vraiment\b/i,
  /\bbon\s+et\s+(?:toi|tu)\b/i,
  /\bt['']en\s+penses?\s+quoi\b/i,
  /\bet\s+toi\s*,?\s*(?:tu\s+)?(?:en\s+penses?|tu\s+dirais?)\s+quoi\b/i,
  /\bdu\s+coup\s+(?:sinon|et\s+toi)\b/i,
  /\b(?:sinon|bon)\s*,?\s*(?:et\s+toi|tu\s+en\s+penses)\b/i,
  /\b(?:pas\s+convaincu|pas\s+totalement|bof)\b/i,
  /\b(?:on\s+change\s+de\s+sujet|autre\s+chose)\b/i,
];

const BUSINESS_OR_CODE_RE =
  /\b(?:code|bug|erreur|api|sql|react|forge|impl[eé]mente|g[eé]n[eè]re|corrige|fichier|script|typescript|python|docker|d[eé]ploie)\b/i;

const FACTUAL_SIMPLE_RE =
  /\b(?:combien|quand|o[uù]\s+est|quelle?\s+heure|d[eé]finition\s+de|c['']est\s+quoi\s+un)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function matchesWarmToneSemiSocialShell(query = '') {
  const q = String(query).trim();
  if (!q || q.length < 8 || q.length > 160) return false;
  return WARM_TONE_SEMI_SOCIAL_RE.some((re) => re.test(q));
}

/**
 * Rail social déterministe déjà couvert (G35 / conversation social-only).
 * @param {string} query
 * @returns {boolean}
 */
export function isCoveredByDeterministicSocialRail(query = '') {
  const pattern = classifySocialPattern(query);
  return Boolean(pattern?.reply);
}

/**
 * Requête métier, code ou factual simple — pas de warm tone.
 * @param {string} query
 * @returns {boolean}
 */
export function isWarmToneBusinessOrFactualExcluded(query = '') {
  const q = String(query).trim();
  if (!q) return true;
  if (isSubstantiveWorkRequest(q)) return true;
  if (isInformationSeekingWithTarget(q)) return true;
  if (BUSINESS_OR_CODE_RE.test(q)) return true;
  if (FACTUAL_SIMPLE_RE.test(q)) return true;
  const frame = analyzeRequestIntentFrame(q);
  if (frame.taskKind === 'build' || frame.taskKind === 'translate') return true;
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isWarmToneSemiSocialQuery(query = '') {
  const q = String(query).trim();
  if (!matchesWarmToneSemiSocialShell(q)) return false;
  if (isMetaAssistantBehaviorRequest(q)) return false;
  if (isCoveredByDeterministicSocialRail(q)) return false;
  if (isWarmToneBusinessOrFactualExcluded(q)) return false;
  return true;
}

/**
 * Contrats de latence — couper l’escalade avant génération.
 * Pas un 2e NLU : predicates sur texte sanitisé + PJ déjà classée.
 */
import { normalizeFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/conversation/genericGreetingGuards.js";
import {
  isAgentStateAnthropomorphicIntent,
  isGreetingOnlyIntent,
  isMetaWhoDrivesIntent,
  isPhaticSocialCheckinIntent,
  isSocialAcceptanceOfOffer,
  isWellbeingCheckinIntent,
} from "../social/index.js";
import {
  ATTACHMENT_TASKS,
  classifyAttachmentTask,
} from "../attachment/attachmentTaskPolicy.js";

export const ROUTING_LATENCY_CONTRACTS_RULE = "routing_latency_contracts_v1";

const LIGHT_VALIDATION_RE =
  /\bc est (?:une? )?(?:reponse )?(?:acceptable|ok|bien|correcte|pas mal)\b/;
const LIGHT_RELAUNCH_RE =
  /\b(?:qu est ce que tu veux faire|tu veux faire quoi|on fait quoi|qu est ce qu on fait)\b/;

const DOCUMENT_ACTION_RE =
  /(?:r[eé]sum(?:e(?:r|z)?|[eé])|synth[eè]tis(?:e|er)|analys(?:e(?:r|z)?|er)|extrait|extraire|compar(?:e|er)|synth[eè]se)/i;

/**
 * Validation d’une réponse + relance légère (« acceptable… tu veux faire ? »).
 * @param {string} query
 */
export function isLightMetaValidationRelance(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 16 || q.length > 220) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  return LIGHT_VALIDATION_RE.test(q) && LIGHT_RELAUNCH_RE.test(q);
}

/**
 * PJ + verbe documentaire explicite — rail DOCUMENT, pas conversation générale.
 * @param {string} query
 * @param {unknown[]} [attachments]
 */
export function isExplicitDocumentAttachmentTurn(query = "", attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return false;
  if (!DOCUMENT_ACTION_RE.test(String(query || ""))) return false;
  const hit = classifyAttachmentTask(query, attachments);
  if (!hit?.matched) return false;
  return (
    hit.task === ATTACHMENT_TASKS.DOC_SUMMARIZE ||
    hit.task === ATTACHMENT_TASKS.DOC_ANALYZE ||
    hit.task === ATTACHMENT_TASKS.DOC_IMPROVE
  );
}

/**
 * Social / check-in / relance légère — rail court, pas Planner / COMPOSER.
 * @param {string} query
 * @param {{ attachments?: unknown[], history?: object[] }} [options]
 */
export function isSocialLightLatencyTurn(query = "", options = {}) {
  if (isExplicitDocumentAttachmentTurn(query, options.attachments || [])) {
    return false;
  }
  if (isSubstantiveWorkRequest(query)) return false;
  return (
    isWellbeingCheckinIntent(query) ||
    isAgentStateAnthropomorphicIntent(query) ||
    isGreetingOnlyIntent(query) ||
    isPhaticSocialCheckinIntent(query) ||
    isMetaWhoDrivesIntent(query) ||
    isLightMetaValidationRelance(query) ||
    isSocialAcceptanceOfOffer(query, options.history || [])
  );
}

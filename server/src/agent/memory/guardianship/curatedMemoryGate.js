import responseThinkingCleaner from "../../utils/responseThinkingCleaner.js";
import {
  INSUFFICIENT_SIGNAL_REFUSAL,
  RESPONSE_MODES,
  validateModeContract,
} from "../../config/modeResponseContracts.js";

const FALLBACK_SNIPPETS = [
  "Tout est prêt. Sur quoi travaillons-nous",
  "Je suis prêt. Quelle est votre demande",
];

/**
 * Pré-validation mémoire curée v1 — n'ingère que des sorties conformes au contrat.
 */
export function assessMemoryEligibility({
  userQuery = "",
  assistantResponse = "",
  pipelineMode = RESPONSE_MODES.COMPOSER,
} = {}) {
  const mode = RESPONSE_MODES[pipelineMode]
    ? pipelineMode
    : RESPONSE_MODES.COMPOSER;
  const cleaned = responseThinkingCleaner.clean(String(assistantResponse || "")).trim();
  const reasons = [];

  if (!cleaned) reasons.push("empty_response");
  if (cleaned === INSUFFICIENT_SIGNAL_REFUSAL) reasons.push("refusal_response");
  if (responseThinkingCleaner.hasEscapedThinking(cleaned)) {
    reasons.push("thinking_leak");
  }
  if (FALLBACK_SNIPPETS.some((s) => cleaned.includes(s))) {
    reasons.push("generic_fallback");
  }

  const validation = validateModeContract(mode, cleaned);
  if (!validation.conform) {
    reasons.push(...validation.failures);
  }

  const query = String(userQuery || "").trim();
  if (/^\//.test(query)) reasons.push("system_command");

  const isEphemeralSocial =
    query.split(/\s+/).length < 8 &&
    /^(salut|bonjour|hey|coucou|hello)/i.test(query) &&
    !/(decision|adr|architecture|config|erreur|bug|forge|audit)/i.test(cleaned);
  if (isEphemeralSocial) reasons.push("ephemeral_social");

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    cleaned,
    pipelineMode: mode,
  };
}

export default { assessMemoryEligibility };

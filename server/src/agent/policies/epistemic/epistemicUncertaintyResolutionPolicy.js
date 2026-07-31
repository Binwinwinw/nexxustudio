/**
 * Couche épistémique sous incertitude — au-dessus du routeur d'intention.
 *
 * Règle centrale :
 * « Nexxus ne prétend jamais savoir ce qu'il ne sait pas ;
 *   il essaie d'inférer, puis de clarifier, puis de vérifier,
 *   et seulement ensuite de répondre. »
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/genericGreetingGuards.js";
import { assessKnowledgeFreshnessRisk } from "../knowledgeFreshnessPolicy.js";
import {
  isExplicitWebSearchRequest,
  isWebSearchThreadActive,
} from "../explicitWebSearchRequestPolicy.js";
import { isWebSearchThreadMaintenanceMessage } from "../webSearchThreadContinuityPolicy.js";
import {
  isSocialChatThreadActive,
  isSoftSocialChatFollowup,
  resolveCulturalReferenceHypothesis,
} from "../socialChatContinuityPolicy.js";

export const EPISTEMIC_RESOLUTION_RULE =
  "Nexxus ne prétend jamais savoir ce qu'il ne sait pas ; il essaie d'inférer, puis de clarifier, puis de vérifier, et seulement ensuite de répondre.";

export const EPISTEMIC_UNCERTAINTY_RESOLUTION_RULE =
  "epistemic_uncertainty_resolution_v1";

/** Classification de la situation de savoir. */
export const EPISTEMIC_KNOWLEDGE_STATES = Object.freeze({
  KNOWN_CONTEXTUALIZABLE: "known_contextualizable",
  AMBIGUOUS_PROBABLE: "ambiguous_probable",
  UNKNOWN_REAL: "unknown_real",
  POTENTIALLY_STALE: "potentially_stale",
});

/** Hiérarchie de décision (ordre de priorité croissante de prudence). */
export const EPISTEMIC_ACTIONS = Object.freeze({
  RESPOND: "respond",
  TARGETED_CLARIFY: "targeted_clarify",
  ADMIT_UNCERTAINTY: "admit_uncertainty",
  VERIFY_EXTERNAL: "verify_external",
});

const FAMILIARITY_PROBE_RE =
  /\b(?:ca te dit|ça te dit|tu connais|tu as entendu|te dit quelque chose|tu sais ce que c['']?est)\b/i;

const PROPER_LIKE_RE =
  /\b([A-ZÁÉÍÓÚÀÈÙÂÊÎÔÛÄËÏÖÜÇ][A-Za-z0-9ÁÉÍÓÚÀÈÙÂÊÎÔÛÄËÏÖÜÇáéíóúàèùâêîôûäëïöüç-]{1,24})\b/g;

const GENERIC_CLARIFY_FORBIDDEN =
  "Tu parles de quel sujet exactement ?";

/**
 * @param {string} text
 */
function norm(text = "") {
  return normalizeFamiliarityQuery(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Indices lexicaux pour un libellé propre non lexiqué.
 * @param {string} query
 * @returns {string|null}
 */
export function extractObscureReferenceHint(query = "") {
  const raw = String(query || "");
  const cultural = resolveCulturalReferenceHypothesis(query);
  if (cultural) return null;

  const q = norm(query);
  if (!FAMILIARITY_PROBE_RE.test(q) && !/\bje pense (?:a|à)\b/i.test(q)) {
    return null;
  }

  const ligue = q.match(/\bligue\s+([a-z0-9]{2,20})\b/i);
  if (ligue?.[1]) return `la ligue ${ligue[1]}`;

  const matches = raw.match(PROPER_LIKE_RE) || [];
  const stop = new Set([
    "Je",
    "Tu",
    "Il",
    "On",
    "Ben",
    "Bah",
    "Heu",
    "NXT", // lexique culturel — ne devrait pas arriver ici
  ]);
  const candidates = matches
    .map((m) => m.trim())
    .filter((m) => m.length >= 2 && !stop.has(m));
  if (candidates.length) return candidates[candidates.length - 1];
  return null;
}

/**
 * @param {string} query
 * @param {{
 *   history?: object[],
 *   socialChatThread?: boolean,
 *   hasReliableContext?: boolean,
 * }} [options]
 * @returns {{
 *   state: string,
 *   confidence: "low"|"medium"|"high",
 *   hypothesis: string|null,
 *   alternatives: string[],
 *   signals: string[],
 * }}
 */
export function classifyEpistemicKnowledgeState(query = "", options = {}) {
  const history = options.history || [];
  const signals = [];

  if (
    isWebSearchThreadMaintenanceMessage(query) &&
    isWebSearchThreadActive(history)
  ) {
    signals.push("web_thread_maintenance");
    return {
      state: EPISTEMIC_KNOWLEDGE_STATES.KNOWN_CONTEXTUALIZABLE,
      confidence: "high",
      hypothesis: null,
      alternatives: [],
      signals,
    };
  }

  const freshness = assessKnowledgeFreshnessRisk(query);
  const cultural = resolveCulturalReferenceHypothesis(query);
  const socialThread =
    options.socialChatThread === true || isSocialChatThreadActive(history);
  const softFollowup = isSoftSocialChatFollowup(query);

  if (isExplicitWebSearchRequest(query) || freshness.temporalDisclosureRequired) {
    signals.push(
      isExplicitWebSearchRequest(query)
        ? "explicit_web_search"
        : "temporal_freshness_risk",
    );
    return {
      state: EPISTEMIC_KNOWLEDGE_STATES.POTENTIALLY_STALE,
      confidence: freshness.riskScore >= 0.6 ? "high" : "medium",
      hypothesis: cultural?.confirmLabel || null,
      alternatives: [],
      signals,
    };
  }

  if (cultural) {
    signals.push(`cultural_ref:${cultural.id}`);
    if (cultural.confidence === "high") {
      signals.push("cultural_already_named");
      return {
        state: EPISTEMIC_KNOWLEDGE_STATES.KNOWN_CONTEXTUALIZABLE,
        confidence: "high",
        hypothesis: cultural.confirmLabel,
        alternatives: [],
        signals,
      };
    }
    signals.push("cultural_ambiguous_probable");
    return {
      state: EPISTEMIC_KNOWLEDGE_STATES.AMBIGUOUS_PROBABLE,
      confidence: "medium",
      hypothesis: cultural.confirmLabel,
      alternatives: [],
      signals,
    };
  }

  const obscure = extractObscureReferenceHint(query);
  if (obscure && (FAMILIARITY_PROBE_RE.test(norm(query)) || softFollowup)) {
    signals.push("obscure_reference_probe");
    return {
      state: EPISTEMIC_KNOWLEDGE_STATES.UNKNOWN_REAL,
      confidence: "low",
      hypothesis: obscure,
      alternatives: [],
      signals,
    };
  }

  if (options.hasReliableContext === true) {
    signals.push("reliable_context");
    return {
      state: EPISTEMIC_KNOWLEDGE_STATES.KNOWN_CONTEXTUALIZABLE,
      confidence: "high",
      hypothesis: null,
      alternatives: [],
      signals,
    };
  }

  if (socialThread && softFollowup) {
    signals.push("social_chat_soft_topic");
    return {
      state: EPISTEMIC_KNOWLEDGE_STATES.KNOWN_CONTEXTUALIZABLE,
      confidence: "medium",
      hypothesis: null,
      alternatives: [],
      signals,
    };
  }

  signals.push("default_known_or_route");
  return {
    state: EPISTEMIC_KNOWLEDGE_STATES.KNOWN_CONTEXTUALIZABLE,
    confidence: "medium",
    hypothesis: null,
    alternatives: [],
    signals,
  };
}

/**
 * Hiérarchie : répondre → clarifier ciblé → admettre → vérifier.
 * @param {ReturnType<typeof classifyEpistemicKnowledgeState>} classification
 * @param {{ socialChatThread?: boolean, forceVerify?: boolean }} [options]
 */
export function resolveEpistemicAction(classification, options = {}) {
  const state = classification?.state;
  const confidence = classification?.confidence || "low";

  if (options.forceVerify || state === EPISTEMIC_KNOWLEDGE_STATES.POTENTIALLY_STALE) {
    return EPISTEMIC_ACTIONS.VERIFY_EXTERNAL;
  }

  if (state === EPISTEMIC_KNOWLEDGE_STATES.AMBIGUOUS_PROBABLE) {
    if (classification.hypothesis && confidence !== "low") {
      return EPISTEMIC_ACTIONS.TARGETED_CLARIFY;
    }
    return EPISTEMIC_ACTIONS.ADMIT_UNCERTAINTY;
  }

  if (state === EPISTEMIC_KNOWLEDGE_STATES.UNKNOWN_REAL) {
    if (classification.hypothesis) {
      // Hypothèse faible : clarification ciblée plutôt que « quel sujet ? »
      return EPISTEMIC_ACTIONS.TARGETED_CLARIFY;
    }
    return EPISTEMIC_ACTIONS.ADMIT_UNCERTAINTY;
  }

  return EPISTEMIC_ACTIONS.RESPOND;
}

/**
 * Clarification ciblée — toujours une hypothèse avant la question.
 * @param {{ hypothesis?: string|null, alternatives?: string[] }} [opts]
 */
export function buildEpistemicTargetedClarifyReply(opts = {}) {
  const hypothesis = String(opts.hypothesis || "").trim();
  const alternatives = Array.isArray(opts.alternatives)
    ? opts.alternatives.map((a) => String(a || "").trim()).filter(Boolean)
    : [];

  if (alternatives.length >= 2) {
    return `Tu veux dire ${alternatives[0]} ou ${alternatives[1]} ?`;
  }
  if (hypothesis) {
    return `Tu parles de ${hypothesis} ? Si oui, je vois.`;
  }
  return (
    "Je vois une piste, mais je ne suis pas sûr du référent exact. " +
    "Tu peux me donner le nom complet ou le domaine (sport, tech, projet) ?"
  );
}

/**
 * Honnêteté sous incertitude forte — pas d'invention.
 * @param {{ subject?: string|null, hypothesis?: string|null }} [opts]
 */
export function buildEpistemicHonestyReply(opts = {}) {
  const subject = String(opts.subject || opts.hypothesis || "ce point").trim();
  return (
    `Je comprends que tu parles de ${subject}, mais je n'ai pas assez d'éléments ` +
    "vérifiés pour affirmer quoi que ce soit de fiable. " +
    "Tu peux préciser le domaine, ou on peut vérifier via une recherche contrôlée si tu veux."
  );
}

/**
 * Évaluation complète (état + action + message éventuel).
 * @param {string} query
 * @param {{
 *   history?: object[],
 *   socialChatThread?: boolean,
 *   hasReliableContext?: boolean,
 * }} [options]
 */
export function evaluateEpistemicUncertaintyResolution(query = "", options = {}) {
  const history = options.history || [];
  const socialChatThread =
    options.socialChatThread === true || isSocialChatThreadActive(history);

  const classification = classifyEpistemicKnowledgeState(query, {
    ...options,
    history,
    socialChatThread,
  });
  const action = resolveEpistemicAction(classification, {
    socialChatThread,
  });

  let reply = null;
  if (action === EPISTEMIC_ACTIONS.TARGETED_CLARIFY) {
    reply = buildEpistemicTargetedClarifyReply({
      hypothesis: classification.hypothesis,
      alternatives: classification.alternatives,
    });
  } else if (action === EPISTEMIC_ACTIONS.ADMIT_UNCERTAINTY) {
    reply = buildEpistemicHonestyReply({
      subject: classification.hypothesis,
      hypothesis: classification.hypothesis,
    });
  }

  return {
    rule: EPISTEMIC_UNCERTAINTY_RESOLUTION_RULE,
    doctrine: EPISTEMIC_RESOLUTION_RULE,
    state: classification.state,
    action,
    confidence: classification.confidence,
    hypothesis: classification.hypothesis,
    alternatives: classification.alternatives,
    signals: classification.signals,
    reply,
    forbidsGenericClarify: true,
    genericClarifyForbidden: GENERIC_CLARIFY_FORBIDDEN,
    socialChatThread,
  };
}

/**
 * Short-circuit déterministe quand la couche épistémique tranche avant le routeur lourd.
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{
 *   path: string,
 *   reply?: string|null,
 *   deferToLlm?: boolean,
 *   deferToFullPipeline?: boolean,
 *   preferWebResearch?: boolean,
 *   reflectiveHint?: string,
 *   epistemicResolution: object,
 * }|null}
 */
export function resolveEpistemicUncertaintyShortCircuit(query = "", options = {}) {
  if (!query || !String(query).trim()) return null;
  if (isSubstantiveWorkRequest(query)) return null;

  const evaluation = evaluateEpistemicUncertaintyResolution(query, options);
  const { action, reply, state, socialChatThread } = evaluation;

  if (action === EPISTEMIC_ACTIONS.TARGETED_CLARIFY && reply) {
    // Sur fil social : toujours ; hors fil : seulement si hypothèse culturelle / obscure
    const cultural = resolveCulturalReferenceHypothesis(query);
    const obscure = extractObscureReferenceHint(query);
    if (!socialChatThread && !cultural && !obscure) return null;

    return {
      path: "social_deterministic",
      reply,
      deferToLlm: false,
      epistemicResolution: evaluation,
      culturalHypothesis: Boolean(cultural),
      socialChatContinuity: socialChatThread,
      step:
        "🧭 Épistémique — clarification ciblée (hypothèse avant question)...",
    };
  }

  if (action === EPISTEMIC_ACTIONS.ADMIT_UNCERTAINTY && reply) {
    // Honnêteté : uniquement quand vraiment inconnu (pas un sujet soft social générique)
    if (state !== EPISTEMIC_KNOWLEDGE_STATES.UNKNOWN_REAL) return null;
    return {
      path: "epistemic_honesty_deterministic",
      reply,
      deferToLlm: false,
      epistemicResolution: evaluation,
      step: "🧭 Épistémique — aveu d'incertitude (refus d'invention)...",
    };
  }

  if (action === EPISTEMIC_ACTIONS.VERIFY_EXTERNAL) {
    if (isWebSearchThreadMaintenanceMessage(query)) {
      return null;
    }
    // Ne court-circuite que si le signal fraîcheur / web est net et hors soft chat pur
    if (socialChatThread && isSoftSocialChatFollowup(query) && !isExplicitWebSearchRequest(query)) {
      return null;
    }
    if (
      !isExplicitWebSearchRequest(query) &&
      !assessKnowledgeFreshnessRisk(query).temporalDisclosureRequired
    ) {
      return null;
    }
    return {
      path: "epistemic_verify_external",
      reply: null,
      deferToLlm: true,
      deferToFullPipeline: true,
      preferWebResearch: true,
      epistemicResolution: evaluation,
      reflectiveHint: [
        "VARIANTE ÉPISTÉMIQUE — VÉRIFICATION EXTERNE :",
        `- Doctrine : ${EPISTEMIC_RESOLUTION_RULE}`,
        "- Ancrer les faits récents sur des sources vérifiées ; signaler ce qui reste incertain.",
        "- INTERDIT : inventer specs, dates ou résultats.",
      ].join("\n"),
      step: "🧭 Épistémique — vérification externe adaptée...",
    };
  }

  return null;
}

/**
 * Texte injecté dans les system prompts (complète uncertaintyPolicy historique).
 */
export function buildEpistemicResolutionPromptAddon() {
  return [
    "POLITIQUE ÉPISTÉMIQUE SOUS INCERTITUDE :",
    EPISTEMIC_RESOLUTION_RULE,
    "",
    "États : known_contextualizable | ambiguous_probable | unknown_real | potentially_stale.",
    "Actions (ordre) : répondre → clarification ciblée avec hypothèse → admettre l'incertitude → vérifier.",
    "INTERDIT : clarification générique du type « Tu parles de quel sujet exactement ? » si une hypothèse existe.",
    "INTERDIT : inventer pour combler le vide. Préférer hypothèse + question fermée, ou aveu + piste de vérification.",
  ].join("\n");
}

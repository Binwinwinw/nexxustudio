/**
 * Cerveau de tri — classification d'intention hybride (règles + scores)
 * avant routage pipeline. Produit top_intent, runner_up, confiance, clarification.
 */
import { isCodeGenerationRequest } from "../policies/code/codeDeliveryPolicy.js";
import {
  hasCodeContext,
  hasExecutableSnippet,
  classifyCodeIntent,
  getCodeIntentLabel,
} from "../policies/code/codeIntentPolicy.js";
import { isDocumentAnalysisIntent } from "../utils/conversationGuards.js";
import { isCodeIntentRequest } from "../policies/code/codeIntentPolicy.js";
import { isCodeConceptExplainTriageSignal } from "../policies/code/codeConceptExplainPolicy.js";
import { suppressesCodeGenerationForProgrammingPedagogy } from "../utils/programmingPedagogyLightIntentGuards.js";

const CODE_ATTACHMENT_EXT_RE = /\.(py|js|ts|tsx|jsx|php|rb|go|rs|java|cs|cpp|c|h)\b/i;

function hasCodeFileAttachment(attachments = [], query = "") {
  const files = Array.isArray(attachments) ? attachments : [];
  if (files.some((f) => CODE_ATTACHMENT_EXT_RE.test(String(f?.originalname || f?.name || "")))) {
    return true;
  }
  return CODE_ATTACHMENT_EXT_RE.test(String(query || ""));
}
import { isMetaConversationIntent } from "../utils/metaConversationIntentGuards.js";
import { isMetaCapabilitiesIntent } from "../policies/meta/metaCapabilitiesPolicy.js";
import { isSelfModificationQuery } from "../utils/intentGuards.js";
import { getCodeIntentLabel as labelFromCatalog } from "../../../../shared/codeIntentCatalog.js";

export const TRIAGE_INTENTS = Object.freeze({
  CODE_REVIEW: "code_review",
  CODE_DEBUG: "code_debug",
  CODE_EXPLAIN: "code_explain",
  CODE_REFACTOR: "code_refactor",
  CODE_CORRECTION: "code_correction",
  CODE_AUDIT: "code_audit",
  CODE_GENERATION: "code_generation",
  DOCUMENT_ANALYSIS: "document_analysis",
  SELF_ANALYSIS: "self_analysis",
  GENERAL: "general",
});

export const TRIAGE_CONFIDENCE = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

export const TRIAGE_ROUTING_ACTION = Object.freeze({
  ROUTE_DIRECT: "route_direct",
  ROUTE_LABELED: "route_labeled",
  ASK_CLARIFICATION: "ask_clarification",
});

const AMBIGUOUS_PAIRS = new Set([
  `${TRIAGE_INTENTS.CODE_REVIEW}|${TRIAGE_INTENTS.DOCUMENT_ANALYSIS}`,
  `${TRIAGE_INTENTS.DOCUMENT_ANALYSIS}|${TRIAGE_INTENTS.CODE_REVIEW}`,
  `${TRIAGE_INTENTS.CODE_EXPLAIN}|${TRIAGE_INTENTS.DOCUMENT_ANALYSIS}`,
  `${TRIAGE_INTENTS.DOCUMENT_ANALYSIS}|${TRIAGE_INTENTS.CODE_EXPLAIN}`,
]);

const INTENT_LABELS = {
  [TRIAGE_INTENTS.CODE_REVIEW]: "Revue de code",
  [TRIAGE_INTENTS.CODE_DEBUG]: "Debug",
  [TRIAGE_INTENTS.CODE_EXPLAIN]: "Explication de code",
  [TRIAGE_INTENTS.CODE_REFACTOR]: "Refactorisation",
  [TRIAGE_INTENTS.CODE_CORRECTION]: "Correction de code",
  [TRIAGE_INTENTS.CODE_AUDIT]: "Audit rapide",
  [TRIAGE_INTENTS.CODE_GENERATION]: "Génération de code",
  [TRIAGE_INTENTS.DOCUMENT_ANALYSIS]: "Analyse documentaire",
  [TRIAGE_INTENTS.SELF_ANALYSIS]: "Auto-analyse / méta-conversation",
  [TRIAGE_INTENTS.GENERAL]: "Conversation générale",
};

const SELF_REFERENCE_QUERY =
  /\b(t'appelles|tu t appelles|comment tu|toi meme|toi-meme|auto[- ]?analys|tes (dernieres?|dernières?) (ameliorations?|améliorations?)|en capacite de t|en capacité de t|tes capacites|tes capacités|ton code|ton architecture|t es en capacite)\b/i;

const META_CONVERSATION_QUERY =
  /\b(nexxus|la citadelle|citadelle|l assistant|l'assistant)\b/i;

function emptyScores() {
  return Object.fromEntries(Object.values(TRIAGE_INTENTS).map((id) => [id, 0]));
}

function bump(scores, intent, amount, signals, reason) {
  scores[intent] = (scores[intent] || 0) + amount;
  if (reason) signals.push(reason);
}

function pairKey(a, b) {
  return `${a}|${b}`;
}

function isAmbiguousPair(top, runnerUp) {
  if (!top || !runnerUp) return false;
  return AMBIGUOUS_PAIRS.has(pairKey(top, runnerUp));
}

/**
 * Calcule les scores bruts par intention.
 */
export function scoreIntentCandidates(query = "", attachments = [], options = {}) {
  const q = String(query || "").trim();
  const scores = emptyScores();
  const signals = [];

  if (!q) {
    bump(scores, TRIAGE_INTENTS.GENERAL, 1, signals, "empty_query");
    return { scores, signals };
  }

  const hasActiveDocument = !!options?.sessionContext?.activeDocumentAnalysis;
  if (hasActiveDocument && (/\b(ameliorations?|améliorations?|propose|continue|corrige|optimise)\b/i.test(q) || q.length < 40)) {
    bump(scores, TRIAGE_INTENTS.DOCUMENT_ANALYSIS, 0.40, signals, "active_document_followup");
    bump(scores, TRIAGE_INTENTS.CODE_REVIEW, 0.30, signals, "active_document_followup");
  }

  if (isSelfModificationQuery(q)) {
    bump(scores, TRIAGE_INTENTS.SELF_ANALYSIS, 0.88, signals, "self_modification_guard");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      (scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] || 0) - 0.5,
    );
  } else if (isMetaCapabilitiesIntent(q)) {
    bump(scores, TRIAGE_INTENTS.SELF_ANALYSIS, 0.9, signals, "meta_capabilities_g47");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = 0;
  } else if (isMetaConversationIntent(q)) {
    bump(scores, TRIAGE_INTENTS.SELF_ANALYSIS, 0.72, signals, "meta_conversation_guard");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      (scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] || 0) - 0.45,
    );
  } else if (SELF_REFERENCE_QUERY.test(q)) {
    bump(scores, TRIAGE_INTENTS.SELF_ANALYSIS, 0.68, signals, "self_reference_query");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      (scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] || 0) - 0.4,
    );
  } else if (META_CONVERSATION_QUERY.test(q) && /\b(aide|amelior|amélior|capacit|fonctionnalit|role)\b/i.test(q)) {
    bump(scores, TRIAGE_INTENTS.SELF_ANALYSIS, 0.55, signals, "assistant_meta_query");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      (scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] || 0) - 0.3,
    );
  }

  const codeIntent = classifyCodeIntent(q);
  if (codeIntent) {
    bump(scores, codeIntent.kind, 0.62, signals, `code_intent:${codeIntent.confidence}`);
  }

  if (isCodeConceptExplainTriageSignal(q)) {
    bump(scores, TRIAGE_INTENTS.CODE_EXPLAIN, 0.72, signals, "code_concept_explain_g40");
    scores[TRIAGE_INTENTS.CODE_GENERATION] = 0;
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      (scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] || 0) - 0.5,
    );
    scores[TRIAGE_INTENTS.CODE_REVIEW] = Math.max(
      0,
      (scores[TRIAGE_INTENTS.CODE_REVIEW] || 0) - 0.35,
    );
  }

  if (suppressesCodeGenerationForProgrammingPedagogy(q)) {
    scores[TRIAGE_INTENTS.CODE_GENERATION] = 0;
    scores[TRIAGE_INTENTS.CODE_REVIEW] = Math.max(
      0,
      (scores[TRIAGE_INTENTS.CODE_REVIEW] || 0) - 0.2,
    );
    bump(scores, TRIAGE_INTENTS.GENERAL, 0.42, signals, "programming_pedagogy_light");
  }

  if (hasExecutableSnippet(q) && !isCodeConceptExplainTriageSignal(q)) {
    bump(scores, TRIAGE_INTENTS.CODE_REVIEW, 0.28, signals, "executable_snippet");
    bump(scores, TRIAGE_INTENTS.CODE_DEBUG, 0.12, signals, "snippet_debug_hint");
  }

  if (hasCodeContext(q)) {
    bump(scores, TRIAGE_INTENTS.CODE_REVIEW, 0.1, signals, "code_context");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] - 0.15,
    );
  }

  if (/\b(analyse|analyser)\b/i.test(q) && hasExecutableSnippet(q)) {
    bump(scores, TRIAGE_INTENTS.CODE_REVIEW, 0.22, signals, "analyse_plus_snippet");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] - 0.2,
    );
  }

  if (/\b(revue de code|code review|erreurs? bloquantes?)\b/i.test(q)) {
    bump(scores, TRIAGE_INTENTS.CODE_REVIEW, 0.3, signals, "explicit_code_review_phrase");
    scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
      0,
      scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] - 0.25,
    );
  }

  if (/\b(debug|déboguer|deboguer|ne s'exécute pas|ne marche pas)\b/i.test(q) && hasCodeContext(q)) {
    bump(scores, TRIAGE_INTENTS.CODE_DEBUG, 0.2, signals, "debug_execution_phrase");
  }

  if (/\b(résume|résumer|extraire|points clés|synthèse)\b/i.test(q)) {
    bump(scores, TRIAGE_INTENTS.DOCUMENT_ANALYSIS, 0.45, signals, "document_extractive_verbs");
    if (!hasCodeContext(q)) {
      bump(scores, TRIAGE_INTENTS.DOCUMENT_ANALYSIS, 0.2, signals, "no_code_context");
    }
  }

  if (isDocumentAnalysisIntent(q, attachments)) {
    bump(scores, TRIAGE_INTENTS.DOCUMENT_ANALYSIS, 0.35, signals, "document_analysis_guard");
    if (scores[TRIAGE_INTENTS.SELF_ANALYSIS] > 0) {
      scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] = Math.max(
        0,
        scores[TRIAGE_INTENTS.DOCUMENT_ANALYSIS] - 0.35,
      );
    }
  }

  if (isCodeGenerationRequest(q) && !isCodeConceptExplainTriageSignal(q)) {
    bump(scores, TRIAGE_INTENTS.CODE_GENERATION, 0.62, signals, "code_generation");
  }

  if (/\b(génère|genere|crée|cree|écris|ecris|développe|developpe|implémente|implemente)\b/i.test(q)) {
    if (!hasExecutableSnippet(q)) {
      bump(scores, TRIAGE_INTENTS.CODE_GENERATION, 0.25, signals, "generation_verbs");
    }
  }

  const maxScore = Math.max(...Object.values(scores), 0);
  if (maxScore < 0.2) {
    bump(scores, TRIAGE_INTENTS.GENERAL, 0.4, signals, "fallback_general");
  }

  return { scores, signals };
}

function rankScores(scores) {
  return Object.entries(scores)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([intent, score]) => ({ intent, score }));
}

function resolveConfidence(topScore, runnerUpScore, topIntent, runnerUpIntent) {
  const gap = topScore - runnerUpScore;
  const ambiguous = isAmbiguousPair(topIntent, runnerUpIntent);

  let confidence = TRIAGE_CONFIDENCE.MEDIUM;
  let needs_clarification = false;

  if (topScore >= 0.58 && gap >= 0.18 && !ambiguous) {
    confidence = TRIAGE_CONFIDENCE.HIGH;
  } else if (topScore < 0.38 || gap < 0.1 || ambiguous) {
    confidence = TRIAGE_CONFIDENCE.LOW;
    needs_clarification = ambiguous || (topScore < 0.38 && gap < 0.12);
  }

  const sum = topScore + runnerUpScore + 0.001;
  const confidence_score = Math.min(0.99, Math.max(0.05, topScore / sum));

  return { confidence, confidence_score, needs_clarification, gap };
}

function resolveRoutingAction(confidence, needs_clarification) {
  if (needs_clarification) return TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION;
  if (confidence === TRIAGE_CONFIDENCE.HIGH) return TRIAGE_ROUTING_ACTION.ROUTE_DIRECT;
  return TRIAGE_ROUTING_ACTION.ROUTE_LABELED;
}

/**
 * Schéma de sortie (5 champs + extensions) :
 * top_intent, runner_up, confidence, confidence_score, needs_clarification
 */
function buildTriageFromScores({ scores, signals }) {
  const ranked = rankScores(scores);

  const top = ranked[0] || { intent: TRIAGE_INTENTS.GENERAL, score: 0.4 };
  const runner = ranked[1] || { intent: null, score: 0 };

  const { confidence, confidence_score, needs_clarification, gap } = resolveConfidence(
    top.score,
    runner.score,
    top.intent,
    runner.intent,
  );

  const routing_action = resolveRoutingAction(confidence, needs_clarification);

  return {
    top_intent: top.intent,
    runner_up: runner.intent,
    confidence,
    confidence_score: Number(confidence_score.toFixed(3)),
    needs_clarification,
    routing_action,
    score_gap: Number(gap.toFixed(3)),
    signals,
    scores,
  };
}

export function triageUserIntent(query = "", attachments = [], options = {}) {
  const { scores, signals } = scoreIntentCandidates(query, attachments, options);
  return buildTriageFromScores({ scores, signals });
}

/**
 * Tri hybride + tie-break LLM local optionnel (confidence low uniquement).
 * @param {string} query
 * @param {Array} attachments
 * @param {{ llmClient?: object, skipLlm?: boolean }} [options]
 */
export async function triageUserIntentAsync(
  query = "",
  attachments = [],
  options = {},
) {
  const ruleTriage = triageUserIntent(query, attachments, options);
  if (options.skipLlm) {
    return { ...ruleTriage, tiebreak: { usedLlm: false, source: "rules_only" } };
  }

  const { applyIntentTriageLlmTiebreak } = await import(
    "./intentTriageLlmTiebreak.js"
  );
  const { triage, usedLlm, source, model } = await applyIntentTriageLlmTiebreak({
    query,
    ruleTriage,
    llmClient: options.llmClient,
  });

  return {
    ...triage,
    tiebreak: { usedLlm, source, model: model || null },
  };
}

export function getTriageIntentLabel(intent) {
  if (!intent) return "";
  if (intent.startsWith("code_")) {
    return getCodeIntentLabel(intent) || labelFromCatalog(intent) || INTENT_LABELS[intent];
  }
  return INTENT_LABELS[intent] || intent;
}

export function buildIntentClarificationMessage(triage = {}) {
  const topLabel = getTriageIntentLabel(triage.top_intent);
  const runnerLabel = getTriageIntentLabel(triage.runner_up);

  return (
    "Je ne suis pas certain de l'intention à prioriser pour cette demande.\n\n" +
    `1. **${topLabel}** — ${clarificationHint(triage.top_intent)}\n` +
    (runnerLabel
      ? `2. **${runnerLabel}** — ${clarificationHint(triage.runner_up)}\n\n`
      : "\n") +
    "Répondez par **1** ou **2**, ou reformulez en une phrase (ex. « revue de code, erreurs bloquantes d'abord »)."
  );
}

function clarificationHint(intent) {
  switch (intent) {
    case TRIAGE_INTENTS.CODE_REVIEW:
      return "erreurs bloquantes d'abord, puis correctif exécutable";
    case TRIAGE_INTENTS.CODE_DEBUG:
      return "pourquoi ça ne s'exécute pas, cause racine";
    case TRIAGE_INTENTS.CODE_EXPLAIN:
      return "expliquer le code sans correction obligatoire";
    case TRIAGE_INTENTS.DOCUMENT_ANALYSIS:
      return "résumé / points clés d'un texte";
    case TRIAGE_INTENTS.SELF_ANALYSIS:
      return "auto-analyse, capacités ou continuité conversationnelle";
    case TRIAGE_INTENTS.CODE_GENERATION:
      return "produire du code from scratch";
    default:
      return "traitement adapté à ce type de demande";
  }
}

/**
 * Résout wantsAnalysis en tenant compte du tri (prioritaire si confiance ≥ medium).
 */
export function resolveWantsAnalysisFromTriage(triage, query = "", attachments = []) {
  if (isMetaCapabilitiesIntent(query)) return false;

  if (!triage) {
    if (isMetaConversationIntent(query)) return false;
    return isDocumentAnalysisIntent(query, attachments);
  }

  if (triage.top_intent === TRIAGE_INTENTS.SELF_ANALYSIS) {
    return false;
  }

  if (isMetaConversationIntent(query)) {
    return false;
  }

  if (
    triage.top_intent === TRIAGE_INTENTS.DOCUMENT_ANALYSIS &&
    triage.confidence !== TRIAGE_CONFIDENCE.LOW
  ) {
    if (isCodeIntentRequest(query)) return false;
    if (
      hasCodeFileAttachment(attachments, query) &&
      /\b(corrige|corriger|revue|review|debug|erreurs?\s+bloquantes?|snippet|audit)\b/i.test(
        String(query || ""),
      )
    ) {
      return false;
    }
    return true;
  }

  if (
    triage.top_intent.startsWith("code_") &&
    triage.confidence !== TRIAGE_CONFIDENCE.LOW
  ) {
    return false;
  }

  return isDocumentAnalysisIntent(query, attachments);
}

export function shouldBlockDocumentAnalysisRoute(triage) {
  if (!triage) return false;
  if (triage.routing_action === TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION) return true;
  if (triage.top_intent === TRIAGE_INTENTS.SELF_ANALYSIS) return true;
  return (
    triage.top_intent.startsWith("code_") &&
    triage.confidence !== TRIAGE_CONFIDENCE.LOW
  );
}

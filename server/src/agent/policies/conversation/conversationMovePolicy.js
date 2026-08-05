/**
 * CONVERSATION_MOVE_V1 — décision stratégique unique par tour.
 * Spec : docs/agents/conversation-move-governance.md
 * ADR : ADR-20260707-Conversation-Move-Governance-v1
 */
import { analyzeRequestIntentFrame } from "../intent/requestIntentFrame.js";
import { evaluateJustIntent } from "../intent/justIntentDetectionPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  CLARIFICATION_SOURCES,
  evaluateClarificationDecision,
  isBlockingAmbiguityQuery,
  normalizeQueryForClarificationGate,
  buildClarificationMessage,
} from "../routing/clarificationDecisionPolicy.js";
import {
  decomposeRequest,
  isMultiUnitRequest,
  allWorkUnitsSatisfiable,
  canServeMultiUnitPartialDecomposition,
} from "../routing/requestDecompositionPolicy.js";
import { buildMultiUnitCompositeReply } from "../../micro/replies/multiUnitReplyBuilder.js";
import {
  classifyHowToScopeAndRisk,
  buildHowToAmbiguousClarifyReply,
  buildHowToComplexReply,
  hasRichHowToLocalTemplate,
  HOW_TO_QUALIFICATIONS,
} from "../qualification/howToQualificationPolicy.js";
import { isHowToRequestShell } from "../../utils/howToRequestIntentGuards.js";
import {
  isRecipeKnowledgeRequest,
  extractRecipeSubject,
} from "../../utils/recipeKnowledgeIntentGuards.js";
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";
import {
  isExplicitWebToolInvocationRequest,
  shouldBypassLocalDatetimeShortCircuit,
} from "../../utils/externalCalendarLookupIntentGuards.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import {
  isCompareChooseRequest,
  extractCompareDomain,
} from "../../utils/compareChooseIntentGuards.js";
import {
  classifyKnowledgeDomain,
  KNOWLEDGE_DOMAINS,
} from "../../utils/queryEntityUnderstanding.js";
import { shouldAllowClarifyThenBuild } from "../../utils/deliverableMandateGuards.js";
import { classifyWebProjectScopingRequest } from "../../utils/webProjectScopingGuards.js";
import { classifyDebugDiagnosticMove } from "../../micro/replies/debugDiagnosticComposer.js";
import { EXECUTION_STRATEGIES } from "../../../../../shared/justIntentCatalog.js";
import { normalizeForParse } from "../../micro/parsing/requestSegmentParser.js";

export const CONVERSATION_MOVE_CONTRACT = "CONVERSATION_MOVE_V1";

export const CONVERSATION_MOVES = Object.freeze({
  ANSWER_DIRECT: "answer_direct",
  CLARIFY_ONE: "clarify_one",
  TOOL: "tool",
  REFUSE: "refuse",
});

export const MOVE_QUALIFICATIONS = Object.freeze({
  BENIGN: "benign",
  AMBIGUOUS: "ambiguous",
  COMPLEX: "complex",
  SENSITIVE: "sensitive",
});

export const MOVE_SATISFIABILITY = Object.freeze({
  DETERMINISTIC: "deterministic",
  PROCEDURAL_LLM: "procedural_llm",
  FULL_PIPELINE: "full_pipeline",
});

const CULINARY_SIGNAL_RE =
  /\b(recette|plat|cuisine|tiramisu|soupe|smoothie|dessert|gateau|gâteau|patisserie|pâtisserie)\b/i;

const CRAFT_SIGNAL_RE = /\b(avion|fusee|fusée|bateau|maison|robot|voiture)\b/i;

/**
 * Mandat outil / web explicite (L1 — étape 4).
 * @param {string} query
 */
export function isExplicitToolOrWebRequest(query = "") {
  return isExplicitWebToolInvocationRequest(query);
}

/**
 * @param {string} howToQualification
 */
function projectQualification(howToQualification) {
  switch (howToQualification) {
    case HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL:
      return MOVE_QUALIFICATIONS.BENIGN;
    case HOW_TO_QUALIFICATIONS.AMBIGUOUS:
      return MOVE_QUALIFICATIONS.AMBIGUOUS;
    case HOW_TO_QUALIFICATIONS.COMPLEX_BUT_BENIGN:
      return MOVE_QUALIFICATIONS.COMPLEX;
    case HOW_TO_QUALIFICATIONS.SENSITIVE_OR_RESTRICTED:
      return MOVE_QUALIFICATIONS.SENSITIVE;
    default:
      return MOVE_QUALIFICATIONS.BENIGN;
  }
}

/**
 * @param {string} query
 * @param {string} topic
 */
function resolveMoveDomain(query = "", topic = "") {
  const knowledgeDomain = classifyKnowledgeDomain(query, topic);
  if (knowledgeDomain === KNOWLEDGE_DOMAINS.CULINARY) return "culinary";
  const probe = normalizeForParse(`${query} ${topic}`);
  if (CULINARY_SIGNAL_RE.test(probe)) return "culinary";
  if (CRAFT_SIGNAL_RE.test(probe)) return "craft";
  if (knowledgeDomain === KNOWLEDGE_DOMAINS.GENERAL) return "general";
  return null;
}

/**
 * @param {string} domain
 */
function buildProceduralContractId(domain = null) {
  const suffix = domain || "general";
  return `how_to_procedural_${suffix}_v1`;
}

/**
 * @param {ReturnType<typeof decomposeRequest>} decomposition
 */
function isMultiUnitServable(decomposition) {
  if (!isMultiUnitRequest(decomposition)) return false;
  if (allWorkUnitsSatisfiable(decomposition)) return true;
  if (canServeMultiUnitPartialDecomposition(decomposition)) return true;
  return Boolean(buildMultiUnitCompositeReply(decomposition)?.reply);
}

/**
 * @param {string} query
 */
function classifyProceduralRequest(query = "") {
  if (isHowToRequestShell(query)) {
    const { qualification, topic } = classifyHowToScopeAndRisk(query);
    return { qualification: projectQualification(qualification), topic, raw: qualification };
  }
  if (isRecipeKnowledgeRequest(query)) {
    const topic = extractRecipeSubject(query) || "";
    const { qualification, topic: howTopic } = classifyHowToScopeAndRisk(
      topic ? `comment faire ${topic}` : query,
    );
    if (qualification === HOW_TO_QUALIFICATIONS.SENSITIVE_OR_RESTRICTED) {
      return {
        qualification: MOVE_QUALIFICATIONS.SENSITIVE,
        topic: topic || howTopic,
        raw: qualification,
      };
    }
    return {
      qualification: MOVE_QUALIFICATIONS.BENIGN,
      topic: topic || howTopic,
      raw: HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL,
    };
  }
  return null;
}

/**
 * @param {boolean} [stopped]
 */
function baseMove(stopped = false) {
  return {
    contract: CONVERSATION_MOVE_CONTRACT,
    move: CONVERSATION_MOVES.ANSWER_DIRECT,
    family: null,
    domain: null,
    qualification: MOVE_QUALIFICATIONS.BENIGN,
    satisfiability: MOVE_SATISFIABILITY.FULL_PIPELINE,
    topic: null,
    clarifyQuestion: null,
    contractId: null,
    pipelinePath: null,
    signals: [],
    confidence: "medium",
    stopped,
    sources: {
      frame: null,
      decomposition: null,
      clarificationDecision: null,
      justIntent: null,
    },
  };
}

/**
 * @param {object} move
 * @param {Partial<object>} patch
 */
function finalizeMove(move, patch = {}) {
  return routeFromConversationMove({ ...move, ...patch });
}

/**
 * Ne recalcule jamais pipelinePath / contractId si STOP explicite.
 * @param {object} conversationMove
 */
export function routeFromConversationMove(conversationMove = {}) {
  if (conversationMove.stopped) {
    return conversationMove;
  }

  const routed = { ...conversationMove };
  const { move, family, qualification, satisfiability, domain } = routed;

  if (move === CONVERSATION_MOVES.REFUSE) {
    routed.pipelinePath = routed.pipelinePath || "refusal_policy";
    return routed;
  }

  if (move === CONVERSATION_MOVES.TOOL) {
    routed.satisfiability = MOVE_SATISFIABILITY.FULL_PIPELINE;
    routed.pipelinePath =
      routed.pipelinePath ||
      (family === "information_seeking"
        ? "information_seeking_full_pipeline"
        : "simple_factual_lookup");
    routed.contractId = routed.contractId || "factual_lookup_web_v1";
    return routed;
  }

  if (move === CONVERSATION_MOVES.CLARIFY_ONE) {
    if (family === "how_to" && qualification === MOVE_QUALIFICATIONS.AMBIGUOUS) {
      routed.pipelinePath = "how_to_clarify";
    } else if (family === "how_to" && qualification === MOVE_QUALIFICATIONS.COMPLEX) {
      routed.pipelinePath = "how_to_complex_clarify";
    } else if (family === "web_project_scoping") {
      routed.pipelinePath = "web_project_scoping_clarify";
    } else if (family === "debug_diagnostic") {
      routed.pipelinePath = "debug_diagnostic_clarify";
    } else {
      routed.pipelinePath = "clarification_gate";
    }
    return routed;
  }

  if (family === "web_project_scoping" && move === CONVERSATION_MOVES.ANSWER_DIRECT) {
    routed.pipelinePath = routed.pipelinePath || "web_project_scoping_direct";
    routed.satisfiability =
      routed.satisfiability || MOVE_SATISFIABILITY.DETERMINISTIC;
    routed.contractId = routed.contractId || "web_project_scoping_v1";
    return routed;
  }

  if (family === "debug_diagnostic" && move === CONVERSATION_MOVES.ANSWER_DIRECT) {
    routed.pipelinePath = routed.pipelinePath || "debug_diagnostic";
    routed.satisfiability =
      routed.satisfiability || MOVE_SATISFIABILITY.PROCEDURAL_LLM;
    routed.contractId = routed.contractId || "debug_diagnostic_v1";
    return routed;
  }

  if (family === "how_to" && qualification === MOVE_QUALIFICATIONS.BENIGN) {
    if (satisfiability === MOVE_SATISFIABILITY.DETERMINISTIC) {
      routed.pipelinePath = "how_to_simple_local";
    } else {
      routed.pipelinePath = "how_to_procedural_llm";
      routed.contractId = routed.contractId || buildProceduralContractId(domain);
    }
    return routed;
  }

  if (family === "multi_unit") {
    routed.pipelinePath =
      routed.pipelinePath || "multi_unit_deterministic";
    routed.satisfiability = MOVE_SATISFIABILITY.DETERMINISTIC;
    return routed;
  }

  if (family === "factual_lookup") {
    routed.pipelinePath = "simple_factual_lookup";
    routed.satisfiability = MOVE_SATISFIABILITY.FULL_PIPELINE;
    routed.contractId = routed.contractId || "factual_lookup_web_v1";
    return routed;
  }

  if (family === "general_knowledge") {
    routed.pipelinePath =
      satisfiability === MOVE_SATISFIABILITY.DETERMINISTIC
        ? "general_knowledge_deterministic"
        : "general_knowledge_full_pipeline";
    routed.contractId = routed.contractId || "general_knowledge_v1";
    return routed;
  }

  if (family === "information_seeking") {
    routed.pipelinePath = "information_seeking_full_pipeline";
    routed.satisfiability = MOVE_SATISFIABILITY.FULL_PIPELINE;
    return routed;
  }

  if (family === "social") {
    routed.pipelinePath = "social_deterministic";
    routed.satisfiability = MOVE_SATISFIABILITY.DETERMINISTIC;
    return routed;
  }

  return routed;
}

/**
 * @param {string} query
 * @param {{
 *   history?: Array<{ role?: string, content?: string }>,
 *   intentTriage?: object|null,
 *   attachedFiles?: unknown[],
 * }} [ctx]
 */
export function evaluateConversationMove(
  query = "",
  { history = [], intentTriage = null } = {},
) {
  const normalizedQuery = normalizeQueryForClarificationGate(query);
  const frame = analyzeRequestIntentFrame(query);
  const decomposition = decomposeRequest(query, history);
  const justIntent = evaluateJustIntent(query);

  const move = baseMove(false);
  move.sources = { frame, decomposition, clarificationDecision: null, justIntent };

  // Étape 2 — refuse
  const proceduralProbe = classifyProceduralRequest(query);
  if (proceduralProbe?.qualification === MOVE_QUALIFICATIONS.SENSITIVE) {
    move.signals.push("refuse:sensitive");
    return finalizeMove(move, {
      move: CONVERSATION_MOVES.REFUSE,
      family: null,
      qualification: MOVE_QUALIFICATIONS.SENSITIVE,
      topic: proceduralProbe.topic,
      stopped: true,
      pipelinePath: "refusal_policy",
      confidence: "high",
    });
  }

  // Étape 3 — multi_unit (L2)
  if (isMultiUnitServable(decomposition)) {
    const partial = canServeMultiUnitPartialDecomposition(decomposition);
    move.signals.push("multi_unit");
    return finalizeMove(move, {
      move: CONVERSATION_MOVES.ANSWER_DIRECT,
      family: "multi_unit",
      domain: "mixed",
      satisfiability: MOVE_SATISFIABILITY.DETERMINISTIC,
      pipelinePath: partial ? "multi_unit_partial_clarify" : "multi_unit_deterministic",
      stopped: true,
      confidence: "high",
    });
  }

  // Étape 4 — tool explicite (L1)
  if (isExplicitToolOrWebRequest(query)) {
    move.signals.push("explicit_tool_web");
    return finalizeMove(move, {
      move: CONVERSATION_MOVES.TOOL,
      family: isInformationSeekingWithTarget(query)
        ? "information_seeking"
        : "factual_lookup",
      satisfiability: MOVE_SATISFIABILITY.FULL_PIPELINE,
      pipelinePath: isInformationSeekingWithTarget(query)
        ? "information_seeking_full_pipeline"
        : "simple_factual_lookup",
      contractId: "factual_lookup_web_v1",
      stopped: true,
      confidence: "high",
    });
  }

  // Étape 5 — procédural how-to / recette (L3)
  if (proceduralProbe) {
    const { qualification, topic, raw } = proceduralProbe;
    const domain = resolveMoveDomain(query, topic);
    move.signals.push("how_to_procedural");
    move.topic = topic;
    move.domain = domain;
    move.qualification = qualification;
    move.family = "how_to";

    if (qualification === MOVE_QUALIFICATIONS.AMBIGUOUS) {
      return finalizeMove(move, {
        move: CONVERSATION_MOVES.CLARIFY_ONE,
        clarifyQuestion: buildHowToAmbiguousClarifyReply(query),
        pipelinePath: "how_to_clarify",
        stopped: true,
        confidence: "high",
      });
    }

    if (qualification === MOVE_QUALIFICATIONS.COMPLEX) {
      return finalizeMove(move, {
        move: CONVERSATION_MOVES.CLARIFY_ONE,
        clarifyQuestion: buildHowToComplexReply(query),
        pipelinePath: "how_to_complex_clarify",
        stopped: true,
        confidence: "high",
      });
    }

    const richLocal =
      isHowToRequestShell(query) && hasRichHowToLocalTemplate(query);
    return finalizeMove(move, {
      move: CONVERSATION_MOVES.ANSWER_DIRECT,
      satisfiability: richLocal
        ? MOVE_SATISFIABILITY.DETERMINISTIC
        : MOVE_SATISFIABILITY.PROCEDURAL_LLM,
      pipelinePath: richLocal ? "how_to_simple_local" : "how_to_procedural_llm",
      contractId: richLocal ? null : buildProceduralContractId(domain),
      stopped: true,
      confidence: "high",
      signals: [...move.signals, raw],
    });
  }

  // Étape 5b — cadrage projet web (SharePoint, HTML, CMS…) — prime sur architecture_design
  const webScoping = classifyWebProjectScopingRequest(query);
  if (webScoping) {
    move.signals.push("web_project_scoping");
    move.topic = webScoping.topic;
    move.domain = "technical";
    move.family = "web_project_scoping";

    if (webScoping.needsClarify) {
      return finalizeMove(move, {
        move: CONVERSATION_MOVES.CLARIFY_ONE,
        qualification: MOVE_QUALIFICATIONS.AMBIGUOUS,
        clarifyQuestion: webScoping.clarifyQuestion,
        pipelinePath: "web_project_scoping_clarify",
        stopped: true,
        confidence: "high",
      });
    }

    return finalizeMove(move, {
      move: CONVERSATION_MOVES.ANSWER_DIRECT,
      qualification: MOVE_QUALIFICATIONS.BENIGN,
      satisfiability: MOVE_SATISFIABILITY.DETERMINISTIC,
      pipelinePath: "web_project_scoping_direct",
      contractId: "web_project_scoping_v1",
      stopped: true,
      confidence: "high",
    });
  }

  // Étape 5c — diagnostic incident technique (symptôme / erreur)
  const debugDiag = classifyDebugDiagnosticMove(query);
  if (debugDiag) {
    move.signals.push("debug_diagnostic");
    move.topic =
      debugDiag.slots?.component ||
      debugDiag.slots?.symptom ||
      "incident";
    move.domain = "technical";
    move.family = "debug_diagnostic";

    if (debugDiag.needsClarify) {
      return finalizeMove(move, {
        move: CONVERSATION_MOVES.CLARIFY_ONE,
        qualification: MOVE_QUALIFICATIONS.AMBIGUOUS,
        clarifyQuestion: debugDiag.clarifyQuestion,
        pipelinePath: "debug_diagnostic_clarify",
        stopped: true,
        confidence: "high",
      });
    }

    return finalizeMove(move, {
      move: CONVERSATION_MOVES.ANSWER_DIRECT,
      qualification: MOVE_QUALIFICATIONS.BENIGN,
      satisfiability: MOVE_SATISFIABILITY.PROCEDURAL_LLM,
      pipelinePath: "debug_diagnostic",
      contractId: "debug_diagnostic_v1",
      stopped: true,
      confidence: "high",
    });
  }

  // Étape 6 — fait externe implicite
  if (shouldBypassLocalDatetimeShortCircuit(query)) {
    move.signals.push("external_factual_implicit");
    return finalizeMove(move, {
      move: CONVERSATION_MOVES.ANSWER_DIRECT,
      family: "factual_lookup",
      satisfiability: MOVE_SATISFIABILITY.FULL_PIPELINE,
      pipelinePath: "simple_factual_lookup",
      contractId: "factual_lookup_web_v1",
      stopped: true,
      confidence: "high",
    });
  }

  // Étape 7 — clarification bloquante (L4)
  const clarificationDecision = evaluateClarificationDecision(
    query,
    justIntent,
    intentTriage,
    history,
  );
  move.sources.clarificationDecision = clarificationDecision;

  if (clarificationDecision.decision === CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION) {
    const deliverableClarify =
      isBlockingAmbiguityQuery(query) ||
      (justIntent.strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD &&
        shouldAllowClarifyThenBuild(query, justIntent));

    if (deliverableClarify) {
      const clarifyQuestion = buildClarificationMessage({
        source: isBlockingAmbiguityQuery(query)
          ? CLARIFICATION_SOURCES.BLOCKING_AMBIGUITY
          : CLARIFICATION_SOURCES.JUST_INTENT,
        query: normalizedQuery,
        justIntent,
        intentTriage,
      });
      move.signals.push(
        isBlockingAmbiguityQuery(query)
          ? "clarify_blocking"
          : "clarify_deliverable",
      );
      return finalizeMove(move, {
        move: CONVERSATION_MOVES.CLARIFY_ONE,
        family: frame.familyHint?.id || justIntent.domain || "deliverable",
        domain:
          justIntent.domain === "web_html" || frame.domain?.kind === "technical"
            ? "technical"
            : resolveMoveDomain(query, move.topic),
        clarifyQuestion,
        pipelinePath: "clarification_gate",
        stopped: true,
        confidence: "medium",
      });
    }
  }

  move.move = CONVERSATION_MOVES.ANSWER_DIRECT;
  move.signals.push(`clarification:${clarificationDecision.decision}`);

  // Étape 8 — famille frame / guards
  if (frame.conversation?.socialOnly) {
    move.family = "social";
    move.domain = "general";
  } else if (
    isCompareChooseRequest(query) &&
    extractCompareDomain(query) === "product"
  ) {
    // Comparatif produit ≠ information_seeking (évite le rail « fiche locale »).
    move.family = "compare_choose";
    move.domain = "product";
  } else if (isInformationSeekingWithTarget(query)) {
    move.family = "information_seeking";
  } else if (
    isGeneralKnowledgeRequest(query) &&
    !isHowToRequestShell(query) &&
    !isRecipeKnowledgeRequest(query)
  ) {
    move.family = "general_knowledge";
    move.satisfiability = MOVE_SATISFIABILITY.FULL_PIPELINE;
  } else {
    move.family = frame.familyHint?.id || null;
    move.domain = resolveMoveDomain(query, move.topic);
  }

  if (frame.confidence === "low" || justIntent.confidence === "low") {
    move.confidence = "low";
  } else if (frame.confidence === "high") {
    move.confidence = "high";
  }

  return finalizeMove(move, { stopped: false });
}

/**
 * La gate legacy ne s'exécute que si le move l'autorise (corollaire spec).
 * @param {ReturnType<typeof evaluateConversationMove>} conversationMove
 */
export function shouldRunClarificationGate(conversationMove = {}) {
  return conversationMove.move === CONVERSATION_MOVES.CLARIFY_ONE;
}

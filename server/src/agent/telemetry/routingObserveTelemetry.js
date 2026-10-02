/**
 * Shadow observe — frame + JUST + SC. Lecture seule, jamais relue par le routeur.
 * Lots OBS-ROUTING-FRAME-SC + LOT3-SHADOW-ROUTING-COMPATIBILITY
 * + AUDIT-ROUTING-AUTHORITY-CONFLICTS (`routing_authority_conflict`).
 * Pas de 2e NLU, pas de scores, pas de cible métier extraite, pas de targetDetector.
 */
import { evaluateJustIntent, isSimpleFactualQuestion, JUST_INTENT_THRESHOLDS } from "../policies/intent/justIntentDetectionPolicy.js";
import { resolveIntentComposition } from "../policies/intent/intentCompositionPolicy.js";
import { analyzeRequestIntentFrame } from "../policies/intent/requestIntentFrame.js";
import {
  classifySocialPattern,
  isKnownSocialPattern,
  isWellbeingCheckinIntent,
} from "../policies/social/index.js";
import { isRepoAnalysisRequest } from "../utils/intent-guards/repoAnalysisIntentGuards.js";
import { extractSummaryUrl, classifySummaryContract } from "../policies/summary/index.js";
import { lookupRoutingCase } from "../policies/routing/routingCaseDictionary.js";
import { QUERY_DOMAINS } from "../policies/conversation/queryUnderstandingDomainRegistry.js";
import {
  extractTemporalTarget,
  TEMPORAL_TARGET_KIND,
  hasSecondaryActionVerb,
} from "../policies/conversation/conversationSubjectExtraction.js";
import { isHistoricalDateQuestion } from "../micro/replies/simpleFactualComposer.js";
import { isGeneralKnowledgeRequest } from "../utils/intent-guards/generalKnowledgeIntentGuards.js";
import { isInformationSeekingWithTarget } from "../utils/intent-guards/informationSeekingIntentGuards.js";
import { extractCurrentTurnAnchors } from "../policies/conversation/currentTurnAnchoringPolicy.js";
import {
  inferActiveGoal,
  isEllipticGoalFollowUp,
} from "../policies/conversation/activeGoalPolicy.js";
import {
  classifyConversationTurn,
  CONVERSATION_TURN_TYPES,
} from "../micro/classifiers/conversationTurnType.js";

export const ROUTING_OBSERVE_EVENT = "routing_observe";
export const ROUTING_AUTHORITY_CONFLICT_EVENT = "routing_authority_conflict";

/** Surface token déjà dans la requête — pas un targetDetector, pas consommé. */
const SECOND_PERSON_SURFACE_RE =
  /\b(?:tu|vous|t['’]es|tes|es[- ]tu|peux[- ]tu)\b/i;

const TRI = Object.freeze({ TRUE: "true", FALSE: "false", UNKNOWN: "unknown" });

function costClass(hit) {
  if (!hit) return "high";
  if (hit.path === "social_deterministic" && !hit.deferToLlm) return "low";
  if (hit.path === "simple_factual_lookup" && hit.deferToLlm) return "very_high";
  if (hit.webSummary || hit.path === "repo_analysis_llm") return "high";
  if (hit.deferToLlm) return "high";
  if (hit.reply) return "low";
  return "high";
}

function collectFlags(query) {
  const q = String(query || "");
  return {
    secondPerson: SECOND_PERSON_SURFACE_RE.test(q),
    github: /github\.com\//i.test(q),
    githubCount: (q.match(/github\.com\//gi) || []).length,
    webUrl: Boolean(extractSummaryUrl(q)),
    knownSocial: isKnownSocialPattern(q),
    wellbeing: isWellbeingCheckinIntent(q),
    simpleFactual: isSimpleFactualQuestion(q),
    repo: isRepoAnalysisRequest(q),
    summaryContract: classifySummaryContract(q)?.contract || null,
    historicalDate: isHistoricalDateQuestion(q),
    temporalKind: extractTemporalTarget(q),
    generalKnowledge: isGeneralKnowledgeRequest(q),
    informationSeeking: isInformationSeekingWithTarget(q),
    secondaryActionVerb: hasSecondaryActionVerb(q),
    createAnchor: extractCurrentTurnAnchors(q).goal === "create",
  };
}

function collectObservedSignals(hit, flags) {
  const signals = [];
  if (flags.secondPerson) signals.push("second_person");
  if (flags.github) signals.push("github_url");
  if (flags.webUrl) signals.push("web_url");
  if (flags.knownSocial) signals.push("known_social_pattern");
  if (flags.wellbeing) signals.push("wellbeing_checkin");
  if (flags.simpleFactual) signals.push("simple_factual_question");
  if (flags.repo) signals.push("repo_analysis_guard");
  if (hit?.winning_rule) signals.push(`routing_case:${hit.winning_rule}`);
  if (hit?.socialPatternName) signals.push(`social_pattern:${hit.socialPatternName}`);
  if (hit?.forcedIntentContractId) {
    signals.push(`forced_contract:${hit.forcedIntentContractId}`);
  }
  return signals;
}

function firstWinningGuard(hit, flags) {
  if (hit?.winning_rule) return `routingCase:${hit.winning_rule}`;
  if (hit?.socialPatternName) return `socialPattern:${hit.socialPatternName}`;
  if (hit?.forcedIntentContractId === "REPO_ANALYSIS" || flags.repo) {
    return "isRepoAnalysisRequest";
  }
  if (hit?.webSummary) return "maybeWebTarget";
  if (hit?.path === "simple_factual_lookup" && flags.simpleFactual) {
    return "isSimpleFactualQuestion";
  }
  if (!hit) return "no_short_circuit";
  return hit.path || "unknown";
}

function shadowCandidate(hit, flags) {
  const selected = hit?.path || null;
  if (flags.wellbeing || flags.knownSocial || hit?.winning_rule === "social_wellbeing_checkin") {
    return {
      candidate_route_shadow: "social_deterministic",
      candidate_reason_shadow: "existing_social_or_wellbeing_guard",
    };
  }
  if (flags.repo || hit?.forcedIntentContractId === "REPO_ANALYSIS") {
    return {
      candidate_route_shadow: "repo_analysis_llm",
      candidate_reason_shadow: "isRepoAnalysisRequest",
    };
  }
  if (hit?.webSummary || flags.summaryContract === "WEB_SUMMARY") {
    return {
      candidate_route_shadow: "document_synthesis_llm",
      candidate_reason_shadow: "WEB_SUMMARY",
    };
  }
  const noLocator = !flags.github && !flags.webUrl;
  if (flags.secondPerson && noLocator && (flags.simpleFactual || !selected)) {
    return {
      candidate_route_shadow: "social_deterministic",
      candidate_reason_shadow: "second-person assistant-directed, no locator",
    };
  }
  return {
    candidate_route_shadow: selected,
    candidate_reason_shadow: selected ? "same_as_selected" : "none",
  };
}

function lastMessage(history, role) {
  if (!Array.isArray(history)) return undefined;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === role) return history[i];
  }
  return null;
}

function locatorLabel(flags) {
  if (flags.githubCount > 1) return "ambiguous";
  if (flags.github) return "github_repo_root";
  if (flags.webUrl) return "web_url";
  return null;
}

function collectExternalSignals(query, flags, frame, understanding, turnComprehension) {
  const signals = [];
  if (flags.github) signals.push("github_url");
  if (flags.webUrl) signals.push("web_url");
  if (flags.repo) signals.push("repo_analysis_guard");
  if (flags.summaryContract === "WEB_SUMMARY") signals.push("web_summary_contract");
  if (flags.temporalKind && flags.temporalKind !== TEMPORAL_TARGET_KIND.NONE) {
    signals.push(`temporal:${flags.temporalKind}`);
  }
  if (flags.historicalDate) signals.push("historical_date");
  const domains = [
    ...(understanding?.domains || []),
    ...(turnComprehension?.domainHints || []),
  ];
  if (domains.includes(QUERY_DOMAINS.DATETIME)) signals.push("datetime_domain");
  if (flags.generalKnowledge) signals.push("general_knowledge");
  if (flags.informationSeeking) signals.push("information_seeking_target");
  if (flags.secondaryActionVerb) signals.push("secondary_action_verb");
  if (frame?.domain?.target) signals.push("frame_domain_target");
  const entities = turnComprehension?.entities;
  if (entities?.subjects?.length) signals.push("entities_subjects");
  if (entities?.sources?.length) signals.push("entities_sources");
  if (entities?.localities?.length) signals.push("entities_localities");
  if (entities?.attachments) signals.push("entities_attachments");
  return signals;
}

function collectAssistantSignals(flags, hit) {
  const signals = [];
  if (flags.secondPerson) signals.push("second_person");
  if (flags.wellbeing) signals.push("wellbeing_checkin");
  if (flags.knownSocial) signals.push("known_social_pattern");
  if (hit?.winning_rule === "social_wellbeing_checkin") {
    signals.push("routing_case:social_wellbeing_checkin");
  }
  return signals;
}

function isWorkspaceAct(flags, just) {
  if (flags.createAnchor) return true;
  const action = String(just?.action || "");
  return action === "create" || action === "generate";
}

function isContinuationQuery(query, goal) {
  const turn = classifyConversationTurn(query);
  if (turn.turnType === CONVERSATION_TURN_TYPES.ELLIPTIC_FOLLOWUP) return true;
  if (goal && isEllipticGoalFollowUp(query, goal)) return true;
  return false;
}

function conjoinTri(values) {
  if (values.some((v) => v === TRI.FALSE)) return TRI.FALSE;
  if (values.some((v) => v === TRI.UNKNOWN)) return TRI.UNKNOWN;
  return TRI.TRUE;
}

function lastExploitableAct(lastUser) {
  if (lastUser === undefined) return TRI.UNKNOWN;
  if (!lastUser?.content) return TRI.FALSE;
  const flags = collectFlags(lastUser.content);
  if (flags.repo || flags.summaryContract === "WEB_SUMMARY") return TRI.TRUE;
  if (flags.createAnchor) return TRI.TRUE;
  if (flags.wellbeing || flags.knownSocial) return TRI.FALSE;
  const just = evaluateJustIntent(lastUser.content);
  if (isWorkspaceAct(flags, just)) return TRI.TRUE;
  return TRI.UNKNOWN;
}

function lastLocatorUnambiguous(lastUser) {
  if (lastUser === undefined) return TRI.UNKNOWN;
  if (!lastUser?.content) return TRI.FALSE;
  const flags = collectFlags(lastUser.content);
  if (flags.githubCount > 1) return TRI.FALSE;
  if (flags.github || flags.webUrl) return TRI.TRUE;
  return TRI.FALSE;
}

const PIPELINE_KEYS = Object.freeze(["pipelinePath", "path", "pipeline", "selected_pipeline"]);
const ACT_KEYS = Object.freeze([
  "forcedIntentContractId",
  "contract",
  "intentContractId",
  "act",
  "taskKind",
]);
const SOCIAL_PATHS = Object.freeze(new Set([
  "social_deterministic",
  "exploratory_conversation",
]));
const META_PATHS = Object.freeze(new Set([
  "meta_feedback_deterministic",
  "meta_conversation_deterministic",
  "meta_conversation_reflective",
  "assistant_repair_deterministic",
]));
const CLARIFY_PATHS = Object.freeze(new Set([
  "request_interpreter_clarify",
  "document_synthesis_clarify",
  "how_to_clarify",
  "how_to_complex_clarify",
]));
const WORK_PATHS = Object.freeze(new Set([
  "repo_analysis_llm",
  "document_synthesis_llm",
  "existing_source_analysis",
  "existing_source_analysis_llm",
  "existing_source_analysis_deterministic",
  "action_pipeline",
  "named_create_or_action",
  "information_seeking_full_pipeline",
]));
const EMPTY_PIPELINE = Object.freeze(new Set(["", "unresolved", "none", "unknown", "null"]));

function ownField(obj, keys) {
  if (!obj) return { present: false, value: undefined };
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return { present: true, value: obj[key] };
    }
  }
  return { present: false, value: undefined };
}

function normalizePipelineId(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || EMPTY_PIPELINE.has(text.toLowerCase())) return null;
  return text;
}

function conjoinUsability(values) {
  if (values.some((v) => v === TRI.FALSE)) return "non_exploitable";
  if (values.some((v) => v === TRI.UNKNOWN)) return "unknown";
  return "exploitable";
}

function mapContextState(tri) {
  if (tri === TRI.TRUE) return "ACTIVE_CONTEXT";
  if (tri === TRI.FALSE) return "NO_CONTEXT";
  return "CONTEXT_AMBIGUOUS";
}

function isTaskOpen(history, priorState) {
  if (priorState?.activeGoal?.label) return TRI.TRUE;
  if (!Array.isArray(history)) return TRI.UNKNOWN;
  const goal = inferActiveGoal(history, priorState || null);
  return goal?.label ? TRI.TRUE : TRI.FALSE;
}

/**
 * Qualification RESULT_USABILITY — métadonnées déjà exposées seulement.
 * Interdit : déduire un acte du texte de la réponse assistant.
 */
function evaluateResultUsabilityShadow(lastAssistant) {
  if (lastAssistant === undefined) {
    const unknown = {
      pipeline_identifiable: TRI.UNKNOWN,
      act_or_task_associated: TRI.UNKNOWN,
      not_interrupted: TRI.UNKNOWN,
      not_social: TRI.UNKNOWN,
      not_meta: TRI.UNKNOWN,
      continuation_compatible: TRI.UNKNOWN,
    };
    return { criteria: unknown, result_usability_shadow: "unknown" };
  }
  if (!lastAssistant) {
    const none = {
      pipeline_identifiable: TRI.FALSE,
      act_or_task_associated: TRI.FALSE,
      not_interrupted: TRI.UNKNOWN,
      not_social: TRI.UNKNOWN,
      not_meta: TRI.UNKNOWN,
      continuation_compatible: TRI.FALSE,
    };
    return { criteria: none, result_usability_shadow: conjoinUsability(Object.values(none)) };
  }

  const pipelineField = ownField(lastAssistant, PIPELINE_KEYS);
  const actField = ownField(lastAssistant, ACT_KEYS);
  const pipelineId = pipelineField.present ? normalizePipelineId(pipelineField.value) : null;

  let pipeline_identifiable = TRI.UNKNOWN;
  if (pipelineField.present) {
    pipeline_identifiable = pipelineId ? TRI.TRUE : TRI.FALSE;
  }

  let act_or_task_associated = TRI.UNKNOWN;
  if (actField.present) {
    act_or_task_associated = actField.value ? TRI.TRUE : TRI.FALSE;
  }

  let not_interrupted = TRI.UNKNOWN;
  if (Object.prototype.hasOwnProperty.call(lastAssistant, "interrupted")) {
    not_interrupted = lastAssistant.interrupted ? TRI.FALSE : TRI.TRUE;
  } else if (Object.prototype.hasOwnProperty.call(lastAssistant, "aborted")) {
    not_interrupted = lastAssistant.aborted ? TRI.FALSE : TRI.TRUE;
  } else if (lastAssistant.resultStatus === "interrupted") {
    not_interrupted = TRI.FALSE;
  }

  let not_social = TRI.UNKNOWN;
  if (pipelineId && SOCIAL_PATHS.has(pipelineId)) not_social = TRI.FALSE;
  else if (Object.prototype.hasOwnProperty.call(lastAssistant, "socialPatternName")) {
    not_social = lastAssistant.socialPatternName ? TRI.FALSE : TRI.TRUE;
  } else if (pipelineId) not_social = TRI.TRUE;

  let not_meta = TRI.UNKNOWN;
  if (pipelineId && META_PATHS.has(pipelineId)) not_meta = TRI.FALSE;
  else if (lastAssistant.kind === "diagnostic") not_meta = TRI.FALSE;
  else if (pipelineId) not_meta = TRI.TRUE;

  let continuation_compatible = TRI.UNKNOWN;
  if (pipelineId && (SOCIAL_PATHS.has(pipelineId) || META_PATHS.has(pipelineId) || CLARIFY_PATHS.has(pipelineId))) {
    continuation_compatible = TRI.FALSE;
  } else if (pipelineId && WORK_PATHS.has(pipelineId)) {
    continuation_compatible = TRI.TRUE;
  } else if (pipelineField.present && !pipelineId) {
    continuation_compatible = TRI.FALSE;
  }

  if (lastAssistant.error === true || lastAssistant.kind === "diagnostic") {
    continuation_compatible = TRI.FALSE;
  }
  if (
    lastAssistant.resultStatus === "failed" ||
    lastAssistant.resultStatus === "clarify" ||
    lastAssistant.resultStatus === "interrupted"
  ) {
    continuation_compatible = TRI.FALSE;
  }

  const criteria = {
    pipeline_identifiable,
    act_or_task_associated,
    not_interrupted,
    not_social,
    not_meta,
    continuation_compatible,
  };
  return {
    criteria,
    result_usability_shadow: conjoinUsability(Object.values(criteria)),
  };
}

function openTaskOrExploitableResult(history, priorState, usability) {
  if (!Array.isArray(history)) return TRI.UNKNOWN;
  if (isTaskOpen(history, priorState) === TRI.TRUE) return TRI.TRUE;
  if (usability === "exploitable") return TRI.TRUE;
  if (usability === "non_exploitable") return TRI.FALSE;
  return TRI.UNKNOWN;
}

function compatibleWithContinuation(query, goal, flags, just, lastAct) {
  if (isContinuationQuery(query, goal)) return TRI.TRUE;
  if (
    flags.github ||
    flags.webUrl ||
    flags.repo ||
    isWorkspaceAct(flags, just) ||
    (flags.simpleFactual && !flags.secondPerson)
  ) {
    return TRI.FALSE;
  }
  if (lastAct === TRI.TRUE) return TRI.FALSE;
  return TRI.UNKNOWN;
}

function noNewerIncompatible(compatible, lastAct, flags, just) {
  if (compatible === TRI.TRUE) return TRI.TRUE;
  if (lastAct === TRI.TRUE && compatible === TRI.FALSE) return TRI.FALSE;
  if (
    lastAct === TRI.TRUE &&
    (flags.github || flags.webUrl || flags.repo || isWorkspaceAct(flags, just))
  ) {
    return TRI.FALSE;
  }
  if (lastAct === TRI.FALSE) return TRI.TRUE;
  return TRI.UNKNOWN;
}

function evaluateActiveContextShadow(query, ctx, flags, just) {
  const history = ctx.history;
  const lastUser = lastMessage(history, "user");
  const lastAssistant = lastMessage(history, "assistant");
  const usability = evaluateResultUsabilityShadow(lastAssistant);
  const goal = Array.isArray(history)
    ? inferActiveGoal(history, ctx.priorState || null)
    : null;
  const lastAct = lastExploitableAct(lastUser);
  const criteria = {
    last_exploitable_act: lastAct,
    unambiguous_target_or_locator: lastLocatorUnambiguous(lastUser),
    open_task_or_recent_result: openTaskOrExploitableResult(
      history,
      ctx.priorState,
      usability.result_usability_shadow,
    ),
    compatible_with_continuation: compatibleWithContinuation(
      query,
      goal,
      flags,
      just,
      lastAct,
    ),
    no_newer_incompatible_request: TRI.UNKNOWN,
  };
  criteria.no_newer_incompatible_request = noNewerIncompatible(
    criteria.compatible_with_continuation,
    criteria.last_exploitable_act,
    flags,
    just,
  );
  const tri = conjoinTri(Object.values(criteria));
  return {
    active_context_criteria_shadow: criteria,
    active_context_shadow: tri,
    context_state_shadow: mapContextState(tri),
    result_usability_criteria_shadow: usability.criteria,
    result_usability_shadow: usability.result_usability_shadow,
  };
}

function targetLabelShadow(flags, externalSignals, just) {
  if (flags.github || flags.repo) return "repository";
  if (flags.webUrl) return "page";
  if (isWorkspaceAct(flags, just) && !flags.secondPerson) return "workspace";
  if (isWorkspaceAct(flags, just) && flags.secondPerson && externalSignals.length) {
    return "workspace";
  }
  if (flags.wellbeing || flags.knownSocial) return "assistant";
  if (flags.secondPerson && externalSignals.length === 0 && !isWorkspaceAct(flags, just)) {
    return "assistant";
  }
  if (isWorkspaceAct(flags, just)) return "workspace";
  return "unknown";
}

/**
 * Règle T2 shadow — pas availability_check, pas de consume.
 * Exclusion = première condition manquante / objet externe déjà signalé.
 */
function evaluateT2Compatibility(query, hit, flags, externalSignals, just) {
  const q = String(query || "").trim();
  const shortQuery = q.length > 0 && q.length < JUST_INTENT_THRESHOLDS.partiallyAmbiguousMaxLength;
  const costlyFactual =
    hit?.path === "simple_factual_lookup" && Boolean(hit?.deferToLlm);
  const continuation = isContinuationQuery(query, null);
  const workspace = isWorkspaceAct(flags, just);
  const summaryOrAnalysis =
    flags.repo || flags.summaryContract === "WEB_SUMMARY" || Boolean(hit?.webSummary);
  const identifiableFactual = flags.simpleFactual && !flags.secondPerson;
  const assistantPlausible =
    flags.secondPerson &&
    externalSignals.length === 0 &&
    !workspace &&
    !continuation &&
    !summaryOrAnalysis;

  if (summaryOrAnalysis) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "summary_or_analysis",
    };
  }
  if (flags.github || flags.webUrl) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: flags.github
        ? "external_locator_github"
        : "external_locator_url",
    };
  }
  if (workspace) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "workspace_action",
    };
  }
  if (continuation) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "continuation",
    };
  }
  if (externalSignals.length) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: `external_object:${externalSignals[0]}`,
    };
  }
  if (identifiableFactual) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "identifiable_factual_without_assistant_direction",
    };
  }
  if (!flags.secondPerson && !flags.wellbeing && !flags.knownSocial) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "unknown_target_without_assistant_directed_cue",
    };
  }
  if (!shortQuery) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "query_not_short",
    };
  }
  if (!costlyFactual) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "not_costly_factual_route",
    };
  }
  if (!assistantPlausible) {
    return {
      route_compatibility_shadow: "excluded",
      route_compatibility_reason_shadow: "assistant_directed_not_plausible",
    };
  }
  return {
    route_compatibility_shadow: "suspect",
    route_compatibility_reason_shadow: "costly_factual_vs_assistant_directed",
  };
}

/**
 * @param {string} query
 * @param {{
 *   hit?: object|null,
 *   justIntent?: object|null,
 *   requestFrame?: object|null,
 *   expectedTargetShadow?: string|null,
 *   history?: object[],
 *   turnLoop?: object|null,
 *   turnComprehension?: object|null,
 *   queryUnderstanding?: object|null,
 *   priorState?: object|null,
 * }} [ctx]
 */
export function buildRoutingObserveEvent(query = "", ctx = {}) {
  const hit = ctx.hit ?? null;
  const understanding = ctx.queryUnderstanding || null;
  const turnComprehension = ctx.turnComprehension || null;
  const frame =
    ctx.requestFrame ||
    understanding?.requestFrame ||
    analyzeRequestIntentFrame(query);
  const just = ctx.justIntent || evaluateJustIntent(query);
  const composition = resolveIntentComposition(query, { justIntent: just });
  const social = classifySocialPattern(query);
  const routing = lookupRoutingCase(query, {
    history: Array.isArray(ctx.history) ? ctx.history : [],
    activeGoal: null,
    justIntent: just,
  });

  const flags = collectFlags(query);
  const selected = hit?.path || null;
  const expected = ctx.expectedTargetShadow ?? null;
  const extractedTarget = frame.domain?.target ?? null;
  const shadow = shadowCandidate(hit, flags);
  const winning = firstWinningGuard(hit, flags);
  const externalSignals = collectExternalSignals(
    query,
    flags,
    frame,
    understanding,
    turnComprehension,
  );
  const assistantSignals = collectAssistantSignals(flags, hit);
  const compatibility = evaluateT2Compatibility(
    query,
    hit,
    flags,
    externalSignals,
    just,
  );
  const active = evaluateActiveContextShadow(query, ctx, flags, just);

  return {
    event: ROUTING_OBSERVE_EVENT,
    timestamp: new Date().toISOString(),
    phase: "routing_observe",
    task_kind: frame.task?.kind ?? null,
    domain_kind: frame.domain?.kind ?? null,
    domain_target: extractedTarget,
    social_only: Boolean(frame.conversation?.socialOnly),
    just_intent: `${just.domain}/${just.action}`,
    just_confidence: just.confidence || null,
    primary: composition.primary_action || null,
    secondary: (composition.secondary_actions || []).join("+") || "none",
    just_relation: composition.just_relation || null,
    clarify: Boolean(composition.clarification_required),
    social_pattern: social?.patternName || hit?.socialPatternName || null,
    is_known_social_pattern: flags.knownSocial,
    is_simple_factual_question: flags.simpleFactual,
    maybe_web_target: flags.webUrl,
    repo_analysis: flags.repo,
    routing_case: routing.winning_rule || hit?.winning_rule || null,
    selected_pipeline: selected,
    selected_reason: winning,
    first_winning_guard: winning,
    candidate_route_shadow: shadow.candidate_route_shadow,
    candidate_reason_shadow: shadow.candidate_reason_shadow,
    expected_target_shadow: expected,
    observed_target_signals_shadow: collectObservedSignals(hit, flags),
    target_gap: expected ? extractedTarget == null : null,
    cost_class: costClass(hit),
    cost_observed_ms: ctx.costObservedMs ?? null,
    defer_to_llm: Boolean(hit?.deferToLlm),
    forced_intent_contract_id: hit?.forcedIntentContractId || null,
    query_preview: String(query || "").slice(0, 120),
    locator_shadow: locatorLabel(flags),
    assistant_signals_shadow: assistantSignals,
    external_object_signals_shadow: externalSignals,
    target_label_shadow: targetLabelShadow(flags, externalSignals, just),
    route_compatibility_shadow: compatibility.route_compatibility_shadow,
    route_compatibility_reason_shadow: compatibility.route_compatibility_reason_shadow,
    active_context_criteria_shadow: active.active_context_criteria_shadow,
    active_context_shadow: active.active_context_shadow,
    context_state_shadow: active.context_state_shadow,
    result_usability_criteria_shadow: active.result_usability_criteria_shadow,
    result_usability_shadow: active.result_usability_shadow,
    shadow_consumed: false,
  };
}

/**
 * @param {string} query
 * @param {Parameters<typeof buildRoutingObserveEvent>[1]} [ctx]
 */
export function recordRoutingObserveTelemetry(query = "", ctx = {}) {
  const event = buildRoutingObserveEvent(query, ctx);
  console.log(`[ROUTING_OBSERVE] ${JSON.stringify(event)}`);
  ctx.turnTelemetry?.recordEvent?.(ROUTING_OBSERVE_EVENT, {
    status: "ok",
    ...event,
  });
  return event;
}

/**
 * Conflit d'autorités déjà calculées — pas un 2e NLU, pas de scores.
 * @param {{
 *   justIntent?: { domain?: string, action?: string }|null,
 *   composedPrimary?: string|null,
 *   socialPattern?: string|null,
 *   workPresent?: boolean,
 *   shortCircuitSelected?: string|null,
 * }} ctx
 */
export function hasRoutingAuthorityConflict(ctx = {}) {
  const just =
    ctx.justIntent?.domain && ctx.justIntent?.action
      ? `${ctx.justIntent.domain}/${ctx.justIntent.action}`
      : null;
  const socialLabeled =
    just === "social/social_checkin" ||
    ctx.composedPrimary === "social_checkin" ||
    Boolean(ctx.socialPattern);
  return Boolean(
    socialLabeled && ctx.workPresent === true && !ctx.shortCircuitSelected,
  );
}

/**
 * @param {object} ctx
 */
export function buildRoutingAuthorityConflictEvent(ctx = {}) {
  const just =
    ctx.justIntent?.domain && ctx.justIntent?.action
      ? `${ctx.justIntent.domain}/${ctx.justIntent.action}`
      : ctx.initial_intent || null;
  return {
    event: ROUTING_AUTHORITY_CONFLICT_EVENT,
    initial_intent: just,
    composed_primary: ctx.composedPrimary ?? ctx.composed_primary ?? null,
    social_pattern: ctx.socialPattern ?? ctx.social_pattern ?? null,
    decomposition_unit: ctx.decompositionUnit ?? ctx.decomposition_unit ?? null,
    work_present: Boolean(ctx.workPresent ?? ctx.work_present),
    social_gate_decision:
      ctx.socialGateDecision ?? ctx.social_gate_decision ?? null,
    short_circuit_selected:
      ctx.shortCircuitSelected ?? ctx.short_circuit_selected ?? null,
    downstream_pipeline:
      ctx.downstreamPipeline ?? ctx.downstream_pipeline ?? null,
    downstream_reason: ctx.downstreamReason ?? ctx.downstream_reason ?? null,
    response_contract: ctx.responseContract ?? ctx.response_contract ?? null,
    runtime_aligned: false,
    shadow_consumed: false,
  };
}

/**
 * Journalise le conflit. Ne consomme rien. Ne change aucune route.
 * @param {object} [ctx]
 */
export function recordRoutingAuthorityConflictTelemetry(ctx = {}) {
  if (!hasRoutingAuthorityConflict(ctx)) return null;
  const event = buildRoutingAuthorityConflictEvent(ctx);
  console.log(`[ROUTING_AUTHORITY_CONFLICT] ${JSON.stringify(event)}`);
  ctx.turnTelemetry?.recordEvent?.(ROUTING_AUTHORITY_CONFLICT_EVENT, {
    status: "ok",
    ...event,
  });
  return event;
}

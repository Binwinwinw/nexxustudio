// @ts-check
import fs from "node:fs";
import path from "node:path";

/**
 * @typedef {"dev"|"test"|"staging"|"prod"} TelemetryEnvironment
 */

/**
 * @typedef {"conversation"|"audit"|"debug"|"explain"} ResponseMode
 */

/**
 * @typedef {"ok"|"error"|"timeout"|"cancelled"} ExecutionStatus
 */

/**
 * @typedef {"none"|"low"|"medium"|"high"} GroundingRisk
 */

/**
 * @typedef {"chat"|"tool"|"system"|"batch_eval"} InputType
 */

/**
 * @typedef {Object} UserInputTrace
 * @property {string} text
 * @property {boolean} [has_anaphora]
 * @property {string|null} [language]
 * @property {InputType} [input_type]
 */

/**
 * @typedef {Object} RoutingTrace
 * @property {string|null} [dominant_intent]
 * @property {string[]} [secondary_intents]
 * @property {string|null} [requested_action]
 * @property {string|null} [mode_requested]
 * @property {ResponseMode} mode_resolved
 * @property {ResponseMode} mode_final
 * @property {boolean} [fallback_applied]
 * @property {number|null} [classification_confidence]
 */

/**
 * @typedef {Object} ContextTrace
 * @property {number} [history_turns_used]
 * @property {boolean} [has_logs]
 * @property {boolean} [has_error]
 * @property {boolean} [has_stacktrace]
 * @property {boolean} [has_artifacts]
 * @property {string[]} [artifact_refs]
 * @property {string|null} [grounding_scope]
 */

/**
 * @typedef {Object} LatencyBreakdown
 * @property {number} total
 * @property {number} [preprocess]
 * @property {number} [routing]
 * @property {number} [retrieval]
 * @property {number} [inference]
 * @property {number} [postprocess]
 */

/**
 * @typedef {Object} ExecutionTrace
 * @property {string|null} [model]
 * @property {string|null} [provider]
 * @property {string[]} [tools_used]
 * @property {number} [tool_calls_count]
 * @property {number|null} [tokens_in]
 * @property {number|null} [tokens_out]
 * @property {LatencyBreakdown} latency_ms
 * @property {ExecutionStatus} status
 * @property {string|null} [error_code]
 */

/**
 * @typedef {Object} ResponseStyleSignature
 * @property {boolean} [had_sections]
 * @property {boolean} [had_bullets]
 * @property {boolean} [had_scaffold_leakage]
 */

/**
 * @typedef {Object} ResponseTrace
 * @property {string} text
 * @property {number} [response_length_chars]
 * @property {boolean} [clarification_asked]
 * @property {boolean} [refusal]
 * @property {number} [citations_count]
 * @property {ResponseStyleSignature} [style_signature]
 */

/**
 * @typedef {Object} HeuristicEvaluation
 * @property {boolean|null} [mode_adherence]
 * @property {boolean|null} [clarification_legitimate]
 * @property {boolean|null} [one_answer_success_candidate]
 * @property {GroundingRisk|null} [grounding_risk]
 */

/**
 * @typedef {Object} JudgeEvaluation
 * @property {boolean} evaluated
 * @property {number|null} [relevance_score]
 * @property {number|null} [grounding_score]
 * @property {number|null} [conversation_success_score]
 * @property {string|null} [judge_model]
 * @property {string|null} [judge_version]
 */

/**
 * @typedef {Object} HumanReviewTrace
 * @property {boolean} required
 * @property {boolean} [labels_present]
 */

/**
 * @typedef {Object} EvaluationTrace
 * @property {HeuristicEvaluation} heuristics
 * @property {JudgeEvaluation} [judge]
 * @property {HumanReviewTrace} [human_review]
 */

/**
 * @typedef {Object} EvaluationTelemetryTrace
 * @property {string} timestamp
 * @property {string} trace_id
 * @property {string} session_id
 * @property {number} turn_id
 * @property {string|null} [parent_trace_id]
 * @property {TelemetryEnvironment} environment
 * @property {string} service
 * @property {string|null} [agent_version]
 * @property {string|null} [policy_version]
 * @property {string|null} [prompt_version]
 * @property {UserInputTrace} user_input
 * @property {RoutingTrace} routing
 * @property {ContextTrace} context
 * @property {ExecutionTrace} execution
 * @property {ResponseTrace} response
 * @property {EvaluationTrace} evaluation
 */

/**
 * @param {Partial<EvaluationTelemetryTrace>} input
 * @returns {EvaluationTelemetryTrace}
 */
export function createEvaluationTelemetryTrace(input) {
  const now = new Date().toISOString();

  return {
    timestamp: input.timestamp ?? now,
    trace_id: input.trace_id ?? "",
    session_id: input.session_id ?? "",
    turn_id: Number.isFinite(input.turn_id) ? input.turn_id : 0,
    parent_trace_id: input.parent_trace_id ?? null,

    environment: input.environment ?? "dev",
    service: input.service ?? "nexxus-server",
    agent_version: input.agent_version ?? null,
    policy_version: input.policy_version ?? null,
    prompt_version: input.prompt_version ?? null,

    user_input: {
      text: input.user_input?.text ?? "",
      has_anaphora: input.user_input?.has_anaphora ?? false,
      language: input.user_input?.language ?? null,
      input_type: input.user_input?.input_type ?? "chat",
    },

    routing: {
      dominant_intent: input.routing?.dominant_intent ?? null,
      secondary_intents: input.routing?.secondary_intents ?? [],
      requested_action: input.routing?.requested_action ?? null,
      mode_requested: input.routing?.mode_requested ?? null,
      mode_resolved: input.routing?.mode_resolved ?? "conversation",
      mode_final: input.routing?.mode_final ?? input.routing?.mode_resolved ?? "conversation",
      fallback_applied: input.routing?.fallback_applied ?? false,
      classification_confidence: input.routing?.classification_confidence ?? null,
    },

    context: {
      history_turns_used: input.context?.history_turns_used ?? 0,
      has_logs: input.context?.has_logs ?? false,
      has_error: input.context?.has_error ?? false,
      has_stacktrace: input.context?.has_stacktrace ?? false,
      has_artifacts: input.context?.has_artifacts ?? false,
      artifact_refs: input.context?.artifact_refs ?? [],
      grounding_scope: input.context?.grounding_scope ?? null,
    },

    execution: {
      model: input.execution?.model ?? null,
      provider: input.execution?.provider ?? null,
      tools_used: input.execution?.tools_used ?? [],
      tool_calls_count: input.execution?.tool_calls_count ?? 0,
      tokens_in: input.execution?.tokens_in ?? null,
      tokens_out: input.execution?.tokens_out ?? null,
      latency_ms: {
        total: input.execution?.latency_ms?.total ?? 0,
        preprocess: input.execution?.latency_ms?.preprocess ?? 0,
        routing: input.execution?.latency_ms?.routing ?? 0,
        retrieval: input.execution?.latency_ms?.retrieval ?? 0,
        inference: input.execution?.latency_ms?.inference ?? 0,
        postprocess: input.execution?.latency_ms?.postprocess ?? 0,
      },
      status: input.execution?.status ?? "ok",
      error_code: input.execution?.error_code ?? null,
    },

    response: {
      text: input.response?.text ?? "",
      response_length_chars: input.response?.response_length_chars ?? (input.response?.text?.length ?? 0),
      clarification_asked: input.response?.clarification_asked ?? false,
      refusal: input.response?.refusal ?? false,
      citations_count: input.response?.citations_count ?? 0,
      style_signature: {
        had_sections: input.response?.style_signature?.had_sections ?? false,
        had_bullets: input.response?.style_signature?.had_bullets ?? false,
        had_scaffold_leakage: input.response?.style_signature?.had_scaffold_leakage ?? false,
      },
    },

    evaluation: {
      heuristics: {
        mode_adherence: input.evaluation?.heuristics?.mode_adherence ?? null,
        clarification_legitimate: input.evaluation?.heuristics?.clarification_legitimate ?? null,
        one_answer_success_candidate: input.evaluation?.heuristics?.one_answer_success_candidate ?? null,
        grounding_risk: input.evaluation?.heuristics?.grounding_risk ?? null,
      },
      judge: {
        evaluated: input.evaluation?.judge?.evaluated ?? false,
        relevance_score: input.evaluation?.judge?.relevance_score ?? null,
        grounding_score: input.evaluation?.judge?.grounding_score ?? null,
        conversation_success_score: input.evaluation?.judge?.conversation_success_score ?? null,
        judge_model: input.evaluation?.judge?.judge_model ?? null,
        judge_version: input.evaluation?.judge?.judge_version ?? null,
      },
      human_review: {
        required: input.evaluation?.human_review?.required ?? false,
        labels_present: input.evaluation?.human_review?.labels_present ?? false,
      },
    },
  };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isString(value) {
  return typeof value === "string";
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * @param {unknown} value
 * @returns {value is boolean}
 */
function isBoolean(value) {
  return typeof value === "boolean";
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isStringArray(value) {
  return Array.isArray(value) && value.every(isString);
}

/**
 * @param {unknown} trace
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEvaluationTelemetryTrace(trace) {
  /** @type {string[]} */
  const errors = [];

  if (!isObject(trace)) {
    return { valid: false, errors: ["Trace must be an object"] };
  }

  if (!isString(trace.timestamp)) errors.push("timestamp must be a string");
  if (!isString(trace.trace_id) || !trace.trace_id) errors.push("trace_id must be a non-empty string");
  if (!isString(trace.session_id) || !trace.session_id) errors.push("session_id must be a non-empty string");
  if (!isNumber(trace.turn_id)) errors.push("turn_id must be a finite number");

  if (!isObject(trace.user_input)) {
    errors.push("user_input must be an object");
  } else {
    if (!isString(trace.user_input.text)) errors.push("user_input.text must be a string");
  }

  if (!isObject(trace.routing)) {
    errors.push("routing must be an object");
  } else {
    if (!isString(trace.routing.mode_resolved)) errors.push("routing.mode_resolved must be a string");
    if (!isString(trace.routing.mode_final)) errors.push("routing.mode_final must be a string");
    if (
      trace.routing.secondary_intents !== undefined &&
      !isStringArray(trace.routing.secondary_intents)
    ) {
      errors.push("routing.secondary_intents must be an array of strings");
    }
  }

  if (!isObject(trace.execution)) {
    errors.push("execution must be an object");
  } else {
    if (!isObject(trace.execution.latency_ms)) {
      errors.push("execution.latency_ms must be an object");
    } else if (!isNumber(trace.execution.latency_ms.total)) {
      errors.push("execution.latency_ms.total must be a finite number");
    }

    if (!isString(trace.execution.status)) {
      errors.push("execution.status must be a string");
    }
  }

  if (!isObject(trace.response)) {
    errors.push("response must be an object");
  } else {
    if (!isString(trace.response.text)) errors.push("response.text must be a string");
    if (
      trace.response.clarification_asked !== undefined &&
      !isBoolean(trace.response.clarification_asked)
    ) {
      errors.push("response.clarification_asked must be a boolean");
    }
  }

  if (!isObject(trace.evaluation)) {
    errors.push("evaluation must be an object");
  } else if (!isObject(trace.evaluation.heuristics)) {
    errors.push("evaluation.heuristics must be an object");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * @param {string} filePath
 * @param {Partial<EvaluationTelemetryTrace>} rawTrace
 * @returns {{ ok: true, trace: EvaluationTelemetryTrace } | { ok: false, errors: string[] }}
 */
export function appendEvaluationTrace(filePath, rawTrace) {
  const trace = createEvaluationTelemetryTrace(rawTrace);
  const result = validateEvaluationTelemetryTrace(trace);

  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(trace) + "\\n", "utf8");

  return { ok: true, trace };
}

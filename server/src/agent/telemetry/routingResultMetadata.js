/**
 * PERSIST-ROUTING-METADATA-V1 — projection allowlist vers l'historique.
 * Pas de 2e NLU. Pas de consume shadow. Pas d'inférence depuis le texte.
 */

export const ROUTING_RESULT_METADATA_KEYS = Object.freeze([
  "path",
  "pipelinePath",
  "forcedIntentContractId",
  "act",
  "socialPatternName",
  "interrupted",
  "aborted",
  "resultStatus",
  "turnId",
]);

const OPS_METADATA_KEYS = Object.freeze([
  "tps",
  "duration",
  "totalTokens",
  "expertKey",
]);

const RESULT_STATUS = Object.freeze({
  COMPLETED: "completed",
  INTERRUPTED: "interrupted",
  FAILED: "failed",
  CLARIFY: "clarify",
});

const CLARIFY_RESULT_PATHS = Object.freeze(new Set([
  "request_interpreter_clarify",
  "document_synthesis_clarify",
  "how_to_clarify",
  "how_to_complex_clarify",
  "existing_source_analysis_clarify_access",
]));

const EMPTY_PIPELINE = Object.freeze(new Set(["", "unresolved", "none", "unknown", "null"]));

function hasOwn(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizePipelineId(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || EMPTY_PIPELINE.has(text.toLowerCase())) return null;
  return text;
}

function pickBoolean(raw, key) {
  if (!hasOwn(raw, key)) return undefined;
  if (raw[key] === true || raw[key] === false) return raw[key];
  return undefined;
}

function pickString(raw, key) {
  if (!hasOwn(raw, key) || raw[key] == null) return undefined;
  const text = String(raw[key]).trim();
  return text || undefined;
}

export function isClarifyResultPath(path) {
  return Boolean(path && CLARIFY_RESULT_PATHS.has(path));
}

/**
 * Normalise le statut seulement à partir de signaux déjà présents.
 * @returns {string|undefined}
 */
export function normalizeResultStatus(raw = {}) {
  const aborted = pickBoolean(raw, "aborted");
  const interrupted = pickBoolean(raw, "interrupted");
  if (aborted === true || interrupted === true) return RESULT_STATUS.INTERRUPTED;

  const failed =
    raw.error === true ||
    raw.status === "error" ||
    raw.status === false ||
    raw.failed === true ||
    raw.resultStatus === RESULT_STATUS.FAILED;
  if (failed) return RESULT_STATUS.FAILED;

  const path = normalizePipelineId(raw.path || raw.pipelinePath);
  if (path && isClarifyResultPath(path)) return RESULT_STATUS.CLARIFY;

  if (hasOwn(raw, "resultStatus")) {
    const explicit = String(raw.resultStatus || "").trim();
    if (explicit === RESULT_STATUS.COMPLETED || explicit === RESULT_STATUS.CLARIFY) {
      return explicit;
    }
    if (explicit === RESULT_STATUS.INTERRUPTED || explicit === RESULT_STATUS.FAILED) {
      return explicit;
    }
  }

  const completedCue =
    raw.status === "ok" ||
    raw.status === true ||
    raw.completed === true ||
    interrupted === false ||
    aborted === false;
  if (path && completedCue) return RESULT_STATUS.COMPLETED;

  return undefined;
}

/**
 * Projection explicite — jamais de spread générique.
 * Omet les champs absents. Ignore JUST, *_shadow, cible, contenu, secrets.
 */
export function projectRoutingResultMetadata(raw = {}) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};

  const path = normalizePipelineId(raw.path) || normalizePipelineId(raw.pipelinePath);
  if (path) {
    if (normalizePipelineId(raw.path)) out.path = normalizePipelineId(raw.path);
    if (normalizePipelineId(raw.pipelinePath)) {
      out.pipelinePath = normalizePipelineId(raw.pipelinePath);
    } else if (out.path) {
      out.pipelinePath = out.path;
    }
    if (!out.path && out.pipelinePath) out.path = out.pipelinePath;
  }

  const contract = pickString(raw, "forcedIntentContractId");
  if (contract) out.forcedIntentContractId = contract;

  const act = pickString(raw, "act");
  if (act) out.act = act;

  const social = pickString(raw, "socialPatternName");
  if (social) out.socialPatternName = social;

  const interrupted = pickBoolean(raw, "interrupted");
  if (interrupted !== undefined) out.interrupted = interrupted;
  const aborted = pickBoolean(raw, "aborted");
  if (aborted !== undefined) out.aborted = aborted;

  const turnId = pickString(raw, "turnId");
  if (turnId) out.turnId = turnId;

  const resultStatus = normalizeResultStatus({ ...raw, path: out.path, pipelinePath: out.pipelinePath });
  if (resultStatus) {
    out.resultStatus = resultStatus;
    if (resultStatus === RESULT_STATUS.INTERRUPTED) {
      if (out.interrupted === undefined) out.interrupted = true;
      if (out.aborted === undefined && aborted === true) out.aborted = true;
    }
    if (
      (resultStatus === RESULT_STATUS.COMPLETED || resultStatus === RESULT_STATUS.CLARIFY) &&
      out.interrupted === undefined &&
      (interrupted === false || raw.status === "ok" || raw.status === true)
    ) {
      out.interrupted = false;
    }
  }

  return out;
}

export function hasAllowlistedRoutingMetadata(obj = {}) {
  return ROUTING_RESULT_METADATA_KEYS.some((key) => hasOwn(obj, key) && obj[key] != null && obj[key] !== "");
}

export function composeAssistantEventMetadata(raw = {}) {
  const ops = {};
  for (const key of OPS_METADATA_KEYS) {
    if (raw[key] != null && raw[key] !== "") ops[key] = raw[key];
  }
  return {
    ...ops,
    ...projectRoutingResultMetadata(raw),
  };
}

export function collectRoutingResultFromTelemetry(turnTelemetry, extra = {}) {
  const route = typeof turnTelemetry?.getLastRouteRecord === "function"
    ? turnTelemetry.getLastRouteRecord()
    : null;
  const path =
    extra.path ||
    extra.pipelinePath ||
    (typeof turnTelemetry?.getLastPipelinePath === "function"
      ? turnTelemetry.getLastPipelinePath()
      : null) ||
    route?.path ||
    null;
  return projectRoutingResultMetadata({
    path,
    pipelinePath: extra.pipelinePath || path,
    forcedIntentContractId:
      extra.forcedIntentContractId || route?.forcedIntentContractId,
    act: extra.act,
    socialPatternName: extra.socialPatternName || route?.socialPatternName,
    interrupted: extra.interrupted,
    aborted: extra.aborted,
    turnId: extra.turnId || turnTelemetry?.turnId || turnTelemetry?.traceId,
    status: extra.status,
    error: extra.error === true || Boolean(turnTelemetry?.error),
    failed: extra.failed,
    completed: extra.completed,
    resultStatus: extra.resultStatus,
  });
}

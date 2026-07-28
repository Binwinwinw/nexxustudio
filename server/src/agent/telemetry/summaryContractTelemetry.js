/**
 * G38 — télémétrie SummaryContract (diagnostic routage summary/*).
 */

/**
 * Projection minimale du contrat pour logs, métriques et debug pipeline.
 * @param {import("../policies/summaryContractRouter.js").SummaryContract|null} contract
 * @returns {object|null}
 */
export function buildSummaryContractTelemetry(contract) {
  if (!contract) return null;

  return {
    version: contract.version,
    intent: contract.intent,
    contract: contract.contract,
    resolutionStrategy: contract.resolution?.strategy || null,
    resolutionReason: contract.resolution?.reason || null,
    pipelinePath: contract.routing?.pipelinePath || null,
    forbidDocumentRequest: Boolean(contract.routing?.forbidDocumentRequest),
    fetchRequired: Boolean(contract.routing?.fetchRequired),
    sourceType: contract.source?.type || null,
    sourceRequired: Boolean(contract.source?.required),
    sourceProvided: Boolean(contract.source?.provided),
    missingReason: contract.source?.missing_reason || null,
    clarificationNeeded: Boolean(contract.clarification?.needed),
    entityLabel: contract.entity?.label || null,
    entityKind: contract.entity?.kind || null,
    summaryExecutionMode:
      contract.contract === "WEB_SUMMARY"
        ? "web"
        : contract.contract === "TEXT_SUMMARY"
          ? "text"
          : null,
  };
}

/**
 * @param {{
 *   query?: string,
 *   contract?: import("../policies/summaryContractRouter.js").SummaryContract|null,
 *   phase?: string,
 *   pipelinePath?: string,
 *   turnTelemetry?: { setMetric?: (key: string, value: unknown) => void }|null,
 *   pipelineTelemetryCtx?: object|null,
 * }} ctx
 * @returns {object|null}
 */
export function recordSummaryContractTelemetry(ctx = {}) {
  const payload = buildSummaryContractTelemetry(ctx.contract);
  if (!payload) return null;

  const enriched = {
    ...payload,
    phase: ctx.phase || "route",
    pipeline_path: ctx.pipelinePath || payload.pipelinePath,
  };

  if (ctx.pipelineTelemetryCtx) {
    ctx.pipelineTelemetryCtx.summaryContract = enriched;
  }

  ctx.turnTelemetry?.setMetric?.("summary_contract_intent", payload.intent);
  ctx.turnTelemetry?.setMetric?.("summary_contract_id", payload.contract);
  ctx.turnTelemetry?.setMetric?.(
    "summary_resolution_strategy",
    payload.resolutionStrategy,
  );
  if (payload.missingReason) {
    ctx.turnTelemetry?.setMetric?.("summary_missing_reason", payload.missingReason);
  }

  console.log(
    `[SUMMARY_CONTRACT] intent=${payload.intent} contract=${payload.contract} ` +
      `strategy=${payload.resolutionStrategy} path=${payload.pipelinePath} ` +
      `forbidDoc=${payload.forbidDocumentRequest} ` +
      `missing=${payload.missingReason || "none"}`,
  );

  return enriched;
}

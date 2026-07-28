/**
 * ContractQualityLoop — primitive plateforme generate → validate → repair → stop.
 * Validation déterministe hors LLM ; remédiation bornée via buildRepairAddon + generate.
 */

export const QUALITY_STOP_REASONS = Object.freeze({
  PASS: "pass",
  BLOCKED: "blocked",
  MAX_REPAIRS_REACHED: "max_repairs_reached",
  REPAIR_REJECTED: "repair_rejected",
  POLICY_NOT_APPLICABLE: "policy_not_applicable",
});

/**
 * @typedef {"pass"|"fail"} QualityVerdict
 *
 * @typedef {object} QualityResult
 * @property {QualityVerdict} quality
 * @property {number} [score]
 * @property {boolean} [passFormat]
 * @property {boolean} [passQuality]
 * @property {boolean} [passPresentation]
 * @property {string[]} reasons
 * @property {Record<string, unknown>} [checks]
 *
 * @typedef {object} ContractQualityPolicy
 * @property {string} id
 * @property {number} maxRepairs
 * @property {(ctx: QualityLoopContext) => boolean} applies
 * @property {(draft: string, ctx: QualityLoopContext) => QualityResult} validate
 * @property {(quality: QualityResult, ctx: QualityLoopContext) => string} buildRepairAddon
 * @property {(quality: QualityResult, ctx: QualityLoopContext) => boolean} shouldRepair
 * @property {(quality: QualityResult, ctx: QualityLoopContext) => boolean} shouldBlock
 * @property {(next: QualityResult, prev: QualityResult, ctx: QualityLoopContext) => boolean} shouldAcceptRepair
 *
 * @typedef {object} QualityLoopContext
 * @property {string} query
 * @property {object} [packet]
 * @property {(messages: Array<{role: string, content: string}>, opts?: object) => Promise<string>} generate
 * @property {string} systemPrompt
 * @property {string} userPrompt
 * @property {(text: string) => string} [enforce]
 * @property {(event: QualityTelemetryEvent) => void} [telemetrySink]
 * @property {object} [generateOptions]
 *
 * @typedef {object} QualityTelemetryEvent
 * @property {string} policyId
 * @property {number} iteration
 * @property {number|null} score
 * @property {QualityVerdict} verdict
 * @property {boolean} blocked
 * @property {boolean} repairUsed
 * @property {string[]} reasons
 * @property {number} elapsedMs
 * @property {string} stopReason
 *
 * @typedef {object} QualityLoopHistoryEntry
 * @property {number} iteration
 * @property {QualityResult} quality
 * @property {boolean} [accepted]
 * @property {"initial"|"repair"} kind
 *
 * @typedef {object} QualityLoopOutcome
 * @property {string} text
 * @property {QualityResult} quality
 * @property {QualityResult} initialQuality
 * @property {QualityResult} finalQuality
 * @property {QualityLoopHistoryEntry[]} history
 * @property {number} repairAttempts
 * @property {boolean} blocked
 * @property {string} policyId
 * @property {string} stopReason
 * @property {boolean} repairExhausted
 */

/**
 * @param {Partial<ContractQualityPolicy> & Pick<ContractQualityPolicy, "id"|"applies"|"validate"|"buildRepairAddon">} policy
 * @returns {ContractQualityPolicy}
 */
export function defineContractQualityPolicy(policy) {
  if (!policy?.id || typeof policy.applies !== "function") {
    throw new Error("defineContractQualityPolicy: id et applies sont requis");
  }
  if (typeof policy.validate !== "function") {
    throw new Error("defineContractQualityPolicy: validate est requis");
  }
  if (typeof policy.buildRepairAddon !== "function") {
    throw new Error("defineContractQualityPolicy: buildRepairAddon est requis");
  }

  const maxRepairs = Number.isFinite(policy.maxRepairs)
    ? Math.max(0, Math.floor(policy.maxRepairs))
    : 1;

  return Object.freeze({
    id: String(policy.id),
    maxRepairs,
    applies: policy.applies,
    validate: policy.validate,
    buildRepairAddon: policy.buildRepairAddon,
    shouldRepair:
      policy.shouldRepair ||
      ((quality) => quality?.quality === "fail"),
    shouldBlock:
      policy.shouldBlock ||
      ((quality) => quality?.passFormat === false),
    shouldAcceptRepair:
      policy.shouldAcceptRepair ||
      ((next, prev) => {
        const nextScore = Number(next?.score);
        const prevScore = Number(prev?.score);
        if (next?.quality === "pass") return true;
        if (Number.isFinite(nextScore) && Number.isFinite(prevScore) && nextScore > prevScore) {
          return true;
        }
        if (next?.passFormat && prev?.passFormat === false) return true;
        return false;
      }),
  });
}

/**
 * @param {QualityResult} quality
 * @returns {QualityResult}
 */
function cloneQuality(quality) {
  return {
    quality: quality?.quality === "pass" ? "pass" : "fail",
    score: quality?.score,
    passFormat: quality?.passFormat,
    passQuality: quality?.passQuality,
    passPresentation: quality?.passPresentation,
    reasons: Array.isArray(quality?.reasons) ? [...quality.reasons] : [],
    checks: quality?.checks && typeof quality.checks === "object" ? { ...quality.checks } : {},
  };
}

/**
 * @param {ContractQualityPolicy} policy
 * @param {QualityLoopContext} ctx
 * @param {object} fields
 */
function emitTelemetry(policy, ctx, fields) {
  if (typeof ctx.telemetrySink !== "function") return;
  ctx.telemetrySink({
    policyId: policy.id,
    iteration: fields.iteration,
    score: Number.isFinite(fields.score) ? fields.score : null,
    verdict: fields.verdict === "pass" ? "pass" : "fail",
    blocked: Boolean(fields.blocked),
    repairUsed: Boolean(fields.repairUsed),
    reasons: Array.isArray(fields.reasons) ? fields.reasons : [],
    elapsedMs: fields.elapsedMs ?? 0,
    stopReason: fields.stopReason,
  });
}

/**
 * @param {ContractQualityPolicy} policy
 * @param {string} draftText
 * @param {QualityLoopContext} ctx
 * @returns {Promise<QualityLoopOutcome>}
 */
export async function runContractQualityLoop(policy, draftText, ctx = {}) {
  const startedAt = Date.now();
  const text0 = String(draftText || "");

  if (!policy?.applies?.(ctx)) {
    const empty = {
      quality: "pass",
      score: null,
      reasons: ["policy_not_applicable"],
      checks: {},
    };
    const outcome = {
      text: text0,
      quality: empty,
      initialQuality: empty,
      finalQuality: empty,
      history: [],
      repairAttempts: 0,
      blocked: false,
      policyId: policy?.id || "unknown",
      stopReason: QUALITY_STOP_REASONS.POLICY_NOT_APPLICABLE,
      repairExhausted: false,
    };
    emitTelemetry(policy || { id: "unknown" }, ctx, {
      iteration: 0,
      score: null,
      verdict: "pass",
      blocked: false,
      repairUsed: false,
      reasons: empty.reasons,
      elapsedMs: Date.now() - startedAt,
      stopReason: outcome.stopReason,
    });
    return outcome;
  }

  let text = text0;
  let quality = cloneQuality(policy.validate(text, ctx));
  const initialQuality = cloneQuality(quality);
  /** @type {QualityLoopHistoryEntry[]} */
  const history = [{ iteration: 0, quality: cloneQuality(quality), accepted: true, kind: "initial" }];

  if (!policy.shouldRepair(quality, ctx)) {
    const blocked = policy.shouldBlock(quality, ctx);
    const stopReason = blocked
      ? QUALITY_STOP_REASONS.BLOCKED
      : quality.quality === "pass"
        ? QUALITY_STOP_REASONS.PASS
        : QUALITY_STOP_REASONS.MAX_REPAIRS_REACHED;
    const outcome = {
      text,
      quality,
      initialQuality,
      finalQuality: cloneQuality(quality),
      history,
      repairAttempts: 0,
      blocked,
      policyId: policy.id,
      stopReason,
      repairExhausted: false,
    };
    emitTelemetry(policy, ctx, {
      iteration: 0,
      score: quality.score,
      verdict: quality.quality,
      blocked,
      repairUsed: false,
      reasons: quality.reasons,
      elapsedMs: Date.now() - startedAt,
      stopReason,
    });
    return outcome;
  }

  let repairAttempts = 0;
  let lastRejected = false;

  while (policy.shouldRepair(quality, ctx) && repairAttempts < policy.maxRepairs) {
    repairAttempts += 1;
    const repairAddon = policy.buildRepairAddon(quality, ctx);
    const raw = await ctx.generate(
      [
        { role: "system", content: ctx.systemPrompt || "" },
        {
          role: "user",
          content: `${ctx.userPrompt || ""}\n\n${repairAddon}`.trim(),
        },
      ],
      ctx.generateOptions || {},
    );
    let candidate = String(raw || "").trim();
    if (typeof ctx.enforce === "function") {
      candidate = String(ctx.enforce(candidate) || "").trim();
    }

    const nextQuality = cloneQuality(policy.validate(candidate, ctx));
    const accepted = policy.shouldAcceptRepair(nextQuality, quality, ctx);

    history.push({
      iteration: repairAttempts,
      quality: cloneQuality(nextQuality),
      accepted,
      kind: "repair",
    });

    if (accepted) {
      text = candidate;
      quality = nextQuality;
      lastRejected = false;
    } else {
      lastRejected = true;
    }
  }

  const blocked = policy.shouldBlock(quality, ctx);
  const repairExhausted =
    repairAttempts >= policy.maxRepairs && policy.shouldRepair(quality, ctx);

  let stopReason = QUALITY_STOP_REASONS.PASS;
  if (blocked) {
    stopReason = QUALITY_STOP_REASONS.BLOCKED;
  } else if (quality.quality === "pass") {
    stopReason = QUALITY_STOP_REASONS.PASS;
  } else if (lastRejected && repairAttempts > 0 && !history.some((h) => h.kind === "repair" && h.accepted)) {
    stopReason = QUALITY_STOP_REASONS.REPAIR_REJECTED;
  } else if (repairExhausted) {
    stopReason = QUALITY_STOP_REASONS.MAX_REPAIRS_REACHED;
  } else if (quality.quality === "fail") {
    stopReason = QUALITY_STOP_REASONS.MAX_REPAIRS_REACHED;
  }

  const outcome = {
    text,
    quality,
    initialQuality,
    finalQuality: cloneQuality(quality),
    history,
    repairAttempts,
    blocked,
    policyId: policy.id,
    stopReason,
    repairExhausted,
  };

  emitTelemetry(policy, ctx, {
    iteration: repairAttempts,
    score: quality.score,
    verdict: quality.quality,
    blocked,
    repairUsed: repairAttempts > 0,
    reasons: quality.reasons,
    elapsedMs: Date.now() - startedAt,
    stopReason,
  });

  return outcome;
}

/**
 * Télémétrie G35 — patterns sociaux prioritaires.
 */
import {
  classifySocialPattern,
  SOCIAL_PATTERN_BLOCKED_PATHS,
} from "../policies/socialPatternPolicy.js";

/**
 * @param {{
 *   query?: string,
 *   patternName?: string|null,
 *   blockedPaths?: string[],
 *   phase?: string,
 *   pipelinePath?: string,
 *   turnTelemetry?: { setMetric?: (key: string, value: unknown) => void }|null,
 *   pipelineTelemetryCtx?: object|null,
 * }} ctx
 */
export function recordSocialPatternTelemetry(ctx = {}) {
  const classification = classifySocialPattern(ctx.query || "");
  const patternName =
    ctx.patternName || classification?.patternName || null;

  if (!patternName) return null;

  const payload = {
    social_pattern_matched: true,
    social_pattern_name: patternName,
    social_fallback_blocked_paths:
      ctx.blockedPaths || [...SOCIAL_PATTERN_BLOCKED_PATHS],
    phase: ctx.phase || "route",
    pipeline_path: ctx.pipelinePath || "social_deterministic",
  };

  if (ctx.pipelineTelemetryCtx) {
    ctx.pipelineTelemetryCtx.socialPattern = payload;
  }

  ctx.turnTelemetry?.setMetric?.("social_pattern_matched", true);
  ctx.turnTelemetry?.setMetric?.("social_pattern_name", patternName);
  ctx.turnTelemetry?.setMetric?.(
    "social_fallback_blocked_paths",
    payload.social_fallback_blocked_paths,
  );

  console.log(
    `[SOCIAL_PATTERN] matched=${patternName} phase=${payload.phase} ` +
      `blocked=${payload.social_fallback_blocked_paths.join(",")}`,
  );

  return payload;
}

/**
 * Adaptateur CODE_PROJECT_LIGHT / FRONT_PRESENTATION_V1 → ContractQualityLoop.
 */
import { isCodeProjectLightRequest } from "../../policies/code/codeProjectLightPolicy.js";
import {
  FRONT_PRESENTATION_CONTRACT_ID,
  FRONT_PRESENTATION_THRESHOLDS,
  buildFrontPresentationRepairUserAddon,
  validateCodeProjectLightArtifacts,
} from "../../policies/code/frontendPresentationQualityContract.js";
import { resolveHtmlTrioArtifacts } from "../../policies/code/codeProjectLightWriter.js";
import { defineContractQualityPolicy } from "../contractQualityLoop.js";

/**
 * @param {string} draft
 * @returns {import("./contractQualityLoop.js").QualityResult}
 */
export function validateFrontPresentationDraft(draft = "") {
  const files = resolveHtmlTrioArtifacts(draft)?.files || null;
  const result = validateCodeProjectLightArtifacts(files);
  return {
    quality: result.quality,
    score: result.score,
    passFormat: result.passFormat,
    passPresentation: result.passPresentation,
    passQuality: result.passPresentation,
    reasons: result.reasons,
    checks: result.checks,
  };
}

export const frontPresentationQualityPolicy = defineContractQualityPolicy({
  id: FRONT_PRESENTATION_CONTRACT_ID,
  maxRepairs: FRONT_PRESENTATION_THRESHOLDS.maxRepairAttempts ?? 1,
  applies: (ctx) => isCodeProjectLightRequest(ctx?.query || ""),
  validate: (draft) => validateFrontPresentationDraft(draft),
  buildRepairAddon: (quality) => buildFrontPresentationRepairUserAddon(quality),
  shouldRepair: (quality) => quality?.quality === "fail",
  shouldBlock: (quality) => quality?.passFormat === false,
  shouldAcceptRepair: (next, prev, _ctx) => {
    const nextScore = Number(next?.score);
    const prevScore = Number(prev?.score);
    if (next?.quality === "pass") return true;
    if (Number.isFinite(nextScore) && Number.isFinite(prevScore) && nextScore > prevScore) {
      return true;
    }
    if (next?.passFormat && prev?.passFormat === false) return true;
    return false;
  },
});

/**
 * P3 — primary_goal adherence multi_segment_composite (G18).
 */
import { resolveMultiSegmentPlan } from "../micro/parsing/multiSegmentResponsePlan.js";
import {
  buildCompositeDeterministicReply,
  buildResidualFollowUpOpening,
} from "../micro/parsing/multiSegmentResponsePlan.js";

const SIGNAL_ONLY_CLOSURE_RE =
  /^(?:nous sommes le|il est\s+\d|je m['']appelle)[^.!?\n]{0,120}[.!?]?\s*$/i;

const PREAMBLE_WITHOUT_FOLLOWUP_RE =
  /\bnous sommes le\b[^.!?\n]{0,120}[.!?](?:\s*)$/i;

const PRIMARY_GOAL_STOPWORDS = new Set([
  "pour",
  "avec",
  "dans",
  "sans",
  "vers",
  "chez",
  "entre",
  "sous",
  "une",
  "des",
  "les",
  "sur",
  "afin",
  "trouver",
  "quelle",
  "quel",
  "serait",
  "bon",
  "achat",
  "faire",
  "nous",
  "sommes",
  "date",
  "heure",
]);

/**
 * Tokens significatifs du but principal.
 * @param {string} text
 * @returns {string[]}
 */
function extractPrimaryGoalTokens(text = "") {
  return String(text || "")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9àâäéèêëïîôùûüçœæ0-9]/gi, ""))
    .filter((token) => token.length >= 4 && !PRIMARY_GOAL_STOPWORDS.has(token));
}

/**
 * @param {string} text
 * @param {string} query
 * @param {object|null} [segmentPlan]
 */
export function isMultiSegmentPrimaryGoalMiss(
  text = "",
  query = "",
  segmentPlan = null,
) {
  const plan = segmentPlan || resolveMultiSegmentPlan(query);
  if (!plan?.hasResidualPrimaryGoal && !plan?.shouldDeferToPipeline) {
    return false;
  }

  const body = String(text || "").trim();
  if (!body) return true;

  const primaryText = plan.primarySegment?.text || "";
  const tokens = extractPrimaryGoalTokens(primaryText);
  if (tokens.length === 0) return false;

  const lower = body.toLowerCase();
  const mentionsPrimary = tokens.some((token) => lower.includes(token));
  if (mentionsPrimary) return false;

  if (SIGNAL_ONLY_CLOSURE_RE.test(body)) return true;
  if (PREAMBLE_WITHOUT_FOLLOWUP_RE.test(body)) return true;

  if (plan.preamble && body.length < 180) {
    const preambleCompact = plan.preamble.replace(/\s+/g, " ").trim().toLowerCase();
    const bodyCompact = body.replace(/\s+/g, " ").trim().toLowerCase();
    if (bodyCompact === preambleCompact || bodyCompact.startsWith(preambleCompact)) {
      return true;
    }
  }

  return plan.shouldDeferToPipeline && !mentionsPrimary;
}

/**
 * @param {string} text
 * @param {string} query
 * @param {object|null} [segmentPlan]
 */
export function isMultiSegmentContractViolation(
  text = "",
  query = "",
  segmentPlan = null,
) {
  return isMultiSegmentPrimaryGoalMiss(text, query, segmentPlan);
}

/**
 * @param {string} query
 * @param {object|null} [segmentPlan]
 */
export function buildMultiSegmentDirectFallback(query = "", segmentPlan = null) {
  const plan = segmentPlan || resolveMultiSegmentPlan(query);
  const composite = buildCompositeDeterministicReply({
    ...plan,
    shouldDeferToPipeline: false,
  });
  if (composite) return composite;

  const opening = plan.primarySegment
    ? buildResidualFollowUpOpening(plan.primaryGoal, plan.primarySegment.text)
    : "Je poursuis sur le cœur de ta demande.";

  if (plan.preamble) {
    return `${plan.preamble}\n\n${opening}`;
  }
  return opening;
}

/**
 * @param {string} text
 * @param {string} query
 * @param {object|null} [segmentPlan]
 */
export function enforceMultiSegmentDirectness(
  text = "",
  query = "",
  segmentPlan = null,
) {
  if (!isMultiSegmentContractViolation(text, query, segmentPlan)) {
    return String(text || "").trim();
  }
  return buildMultiSegmentDirectFallback(query, segmentPlan);
}

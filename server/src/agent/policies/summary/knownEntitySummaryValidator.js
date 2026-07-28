/**
 * G38.2 — validator factuel léger pour summary/known_entity (garde-fou local).
 */
import { extractCulturalSummarySubject } from "./culturalContentSummaryPolicy.js";
import {
  buildKnownEntitySummarySoberFallback,
  countSummarySentences,
} from "./knownEntitySummaryExecutionPolicy.js";

const ENCYCLOPEDIC_RUBRIC_RE =
  /\b(?:c['']est quoi|où ça vient|ou ca vient|pourquoi c['']est connu|caractéristiques\s*&\s*contexte)\b/i;

const SPECULATIVE_PREMISE_RE =
  /\b(?:élite génétiquement|elite genetiquement|stimulant cognitif|génétiquement supérieure|genetiquement superieure)\b/i;

const UNCERTAIN_CASTING_RE =
  /\b(?:voix d['']?|joué(?:e)? par|jouee par|interprét(?:é|e) par|interprete par)\s*(?:adam sandler|olivia thirlby)\b/i;

const MAX_KNOWN_ENTITY_SENTENCES = 8;
const MAX_KNOWN_ENTITY_CHARS = 900;

/**
 * @param {string} reply
 * @param {{ query?: string, entityLabel?: string|null, summaryContract?: object|null }} [ctx]
 * @returns {{
 *   valid: boolean,
 *   issues: string[],
 *   sanitized: string,
 *   sentenceCount: number,
 * }}
 */
export function validateKnownEntitySummaryReply(reply = "", ctx = {}) {
  const body = String(reply || "").trim();
  const issues = [];
  const query = ctx.query || "";
  const entityLabel =
    ctx.entityLabel ||
    ctx.summaryContract?.entity?.label ||
    extractCulturalSummarySubject(query) ||
    null;

  const sentenceCount = countSummarySentences(body);

  if (!body || body.length < 40) {
    issues.push("known_entity_response_too_short");
  }

  if (sentenceCount > MAX_KNOWN_ENTITY_SENTENCES || body.length > MAX_KNOWN_ENTITY_CHARS) {
    issues.push("known_entity_excessive_length");
  }

  if (ENCYCLOPEDIC_RUBRIC_RE.test(body)) {
    issues.push("known_entity_encyclopedic_rubric");
  }

  if (SPECULATIVE_PREMISE_RE.test(body)) {
    issues.push("known_entity_speculative_premise");
  }

  if (UNCERTAIN_CASTING_RE.test(body)) {
    issues.push("known_entity_uncertain_casting");
  }

  if (entityLabel) {
    const token = String(entityLabel)
      .split(/\s+/)
      .find((w) => w.length >= 4);
    if (token && !body.toLowerCase().includes(token.toLowerCase())) {
      issues.push("known_entity_missing_subject");
    }
  }

  const critical = issues.some((issue) =>
    [
      "known_entity_encyclopedic_rubric",
      "known_entity_speculative_premise",
      "known_entity_uncertain_casting",
      "known_entity_excessive_length",
      "known_entity_response_too_short",
      "known_entity_missing_subject",
    ].includes(issue),
  );

  const sanitized = critical
    ? buildKnownEntitySummarySoberFallback(query, ctx)
    : body;

  return {
    valid: issues.length === 0,
    issues,
    sanitized,
    sentenceCount,
  };
}

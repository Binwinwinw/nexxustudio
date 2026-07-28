/**
 * G30.1 — document_synthesis dans le registre G29 (synthèse / résumé de texte).
 * Réutilise documentSynthesisPolicy — pas de mini-système parallèle.
 */
import {
  hasDocumentSynthesisShell,
  isDocumentSynthesisExcluded,
  resolveDocumentSynthesisContext,
  buildDocumentSynthesisReply,
  buildMissingSourceClarifyReply,
  DOCUMENT_SYNTHESIS_KINDS,
  DOCUMENT_SOURCE_TYPES,
  DOCUMENT_SOURCE_LENGTH,
  normalizeDocumentSynthesisQuery,
} from "./documentSynthesisPolicy.js";
import { RESPONSE_STRATEGIES } from "./queryUnderstandingDomainRegistry.js";

export const DOCUMENT_SYNTHESIS_COMPOSITE_RULE = "document_synthesis_composite_g30_1";

export const DOCUMENT_SYNTHESIS_REQUIRED_SLOTS = Object.freeze(["source"]);

export const GUIDED_SYNTHESIS_STRATEGY = "guided_synthesis";

export const DOCUMENT_SYNTHESIS_DATETIME_CANONICAL_QUERY =
  "Résume ce texte sur la Seconde Guerre mondiale et donne la date du jour.";

const IDEAS_PRINCIPALES_SHELL_RE =
  /\b(?:donne(?:z)?(?:\s+moi)?|donne[- ]moi)\s+(?:les\s+)?idees?\s+principales\b/;

const URL_SOURCE_RE = /\bhttps?:\/\/\S+/i;

/**
 * @param {string} query
 * @returns {string|null}
 */
function extractSynthesisFocus(query = "") {
  const q = normalizeDocumentSynthesisQuery(query);
  if (/\bidees?\s+principales\b/.test(q)) return "ideas";
  if (/\bpoints?\s+cles\b/.test(q)) return "key_points";
  if (/\barguments?\s+(?:pour|contre)\b/.test(q)) return "arguments";
  return null;
}

/**
 * @param {string} query
 * @param {object|null} ctx
 * @returns {"short"|"medium"}
 */
function extractSynthesisLength(query = "", ctx = null) {
  const q = normalizeDocumentSynthesisQuery(query);
  if (/\b(?:court|bref|ultra\s+court|en\s+\d+\s+lignes?)\b/.test(q)) return "short";
  if (/\b(?:moyen|detaille|developpe|complet)\b/.test(q)) return "medium";
  if (ctx?.source_length === DOCUMENT_SOURCE_LENGTH.SHORT) return "short";
  return "medium";
}

/**
 * @param {string} query
 * @param {object|null} ctx
 * @param {unknown[]} [attachments]
 * @returns {{
 *   source: string|null,
 *   sourceType: string|null,
 *   sourceText: string|null,
 *   length: "short"|"medium",
 *   focus: string|null,
 * }}
 */
export function buildDocumentSynthesisSlots(query = "", ctx = null, attachments = []) {
  const focus = extractSynthesisFocus(query);
  const length = extractSynthesisLength(query, ctx);
  let source = null;
  let sourceType = null;
  let sourceText = null;

  if (ctx?.sourceText) {
    source = "pasted";
    sourceType = DOCUMENT_SOURCE_TYPES.PASTED;
    sourceText = ctx.sourceText;
  } else if (ctx?.source_type === DOCUMENT_SOURCE_TYPES.ATTACHMENT) {
    source = "attachment";
    sourceType = DOCUMENT_SOURCE_TYPES.ATTACHMENT;
  } else if (ctx?.source_type === DOCUMENT_SOURCE_TYPES.BRIEFING) {
    source = "briefing";
    sourceType = DOCUMENT_SOURCE_TYPES.BRIEFING;
  } else if (URL_SOURCE_RE.test(query)) {
    source = "url";
    sourceType = "url";
  } else if (attachments?.length > 0 && hasDocumentSynthesisShell(query)) {
    source = "attachment";
    sourceType = DOCUMENT_SOURCE_TYPES.ATTACHMENT;
  }

  return { source, sourceType, sourceText, length, focus };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {unknown[]} [attachments]
 * @returns {string[]}
 */
export function getMissingDocumentSynthesisSlots(
  query = "",
  history = [],
  attachments = [],
) {
  if (!isDocumentSynthesisSegment(query) && !hasDocumentSynthesisShell(query)) {
    return [];
  }
  const ctx = resolveDocumentSynthesisContext(query, history, attachments);
  const slots = buildDocumentSynthesisSlots(query, ctx, attachments);
  return slots.source ? [] : ["source"];
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
export function isDocumentSynthesisSegment(segment = "") {
  if (isDocumentSynthesisExcluded(segment, [])) return false;
  const q = normalizeDocumentSynthesisQuery(segment);
  if (!q) return false;
  if (hasDocumentSynthesisShell(segment)) return true;
  if (IDEAS_PRINCIPALES_SHELL_RE.test(q)) return true;
  return false;
}

/**
 * @param {string} segment
 * @param {object} [context]
 * @returns {{
 *   domain: string,
 *   familyId: string,
 *   path: string,
 *   label: string,
 *   reply: string|null,
 *   satisfiable: boolean,
 *   strategy: string,
 *   segment: string,
 *   priority: number,
 *   task?: object|null,
 * }|null}
 */
export function detectDocumentSynthesisIntent(segment = "", context = {}) {
  if (!isDocumentSynthesisSegment(segment)) return null;

  const history = context.history || [];
  const attachments = context.attachments || [];
  const ctx = resolveDocumentSynthesisContext(segment, history, attachments);
  const slots = buildDocumentSynthesisSlots(segment, ctx, attachments);
  const missingSlots = slots.source ? [] : [...DOCUMENT_SYNTHESIS_REQUIRED_SLOTS];
  const task = { slots, missingSlots, sourceType: slots.sourceType };

  let path = "document_synthesis_llm";
  let strategy = RESPONSE_STRATEGIES.FULL_PIPELINE;
  let satisfiable = false;
  let reply = null;

  if (!ctx || ctx.intent_kind === DOCUMENT_SYNTHESIS_KINDS.MISSING_SOURCE) {
    reply = buildMissingSourceClarifyReply();
    path = "document_synthesis_clarify";
    strategy = RESPONSE_STRATEGIES.PARTIAL_CLARIFY;
    satisfiable = Boolean(reply);
  } else if (ctx.deferToLlm || ctx.deferToDocumentContinuity) {
    path = ctx.deferToLlm ? "document_synthesis_guided" : "document_synthesis_followup";
    strategy = GUIDED_SYNTHESIS_STRATEGY;
    satisfiable = false;
  } else {
    reply = buildDocumentSynthesisReply(ctx);
    path = "document_synthesis_deterministic";
    strategy = RESPONSE_STRATEGIES.DETERMINISTIC;
    satisfiable = Boolean(reply);
  }

  return {
    domain: "document_synthesis",
    familyId: "document_synthesis",
    path,
    label: "Synthèse document",
    reply,
    satisfiable,
    strategy,
    segment,
    priority: 13,
    task,
  };
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {boolean}
 */
export function shouldAppendDatetimeToDocumentSynthesis(understanding) {
  if (!understanding || understanding.workIntentCount < 2) return false;
  const hasSynthesis = understanding.domains.includes("document_synthesis");
  const hasDatetime = understanding.domains.includes("datetime");
  return hasSynthesis && hasDatetime;
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {string|null}
 */
export function extractDocumentSynthesisQuery(understanding) {
  const intent = understanding?.intents?.find(
    (item) => item.domain === "document_synthesis" && !item.absorbable,
  );
  return intent?.originalSegment || intent?.segment || null;
}

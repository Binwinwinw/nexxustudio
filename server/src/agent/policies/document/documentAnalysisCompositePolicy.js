/**
 * G29.2 — détection document + composition hybride document/datetime.
 */
import { normalizeForParse } from "../../micro/parsing/requestSegmentParser.js";
import { hasDocumentSynthesisShell } from "./documentSynthesisPolicy.js";

export const DOCUMENT_ANALYSIS_COMPOSITE_RULE = "document_analysis_composite_v1";

export const DOCUMENT_DATETIME_CANONICAL_QUERY =
  "2 choses à faire : 1 - analyse le fichier joint 2 - quelle est la date du jour et quelle heure est il actuellement ?";

const DOCUMENT_ANALYSIS_SHELL_RE =
  /\b(?:analys[ée]r?|analyse|synth[èe]se|synth[ée]tiser|resum[ée]|r[ée]sum[ée]|commente|commenter|lis|lire|extrait)\b/i;

const DOCUMENT_TARGET_RE =
  /\b(?:fichier\s+joint|document\s+joint|piece\s+jointe|pi[eè]ce\s+jointe|ce\s+fichier|ce\s+document|le\s+fichier|le\s+document|fichier\s+attach[ée]|readme)\b/i;

const MULTI_TASK_PREAMBLE_RE =
  /\b(?:\d+\s+choses?\s+(?:à|a)\s+faire|plusieurs\s+choses?\s+(?:à|a)\s+faire)\b/i;

/**
 * @param {string} segment
 * @returns {boolean}
 */
export function isDocumentAnalysisSegment(segment = "") {
  const q = normalizeForParse(segment);
  if (!q) return false;
  const hasTarget = DOCUMENT_TARGET_RE.test(q);
  const isAnalysisVerb = /\b(?:analys[ée]r?|analyse)\b/i.test(q);
  const isSynthesisShell = hasDocumentSynthesisShell(q);

  if (isSynthesisShell && hasTarget && !isAnalysisVerb) return false;
  if (DOCUMENT_ANALYSIS_SHELL_RE.test(q) && hasTarget) return true;
  if (isAnalysisVerb && /\bfichier\b/i.test(q)) return true;
  return false;
}

/**
 * @param {string} segment
 * @returns {{
 *   domain: string,
 *   familyId: string,
 *   path: string,
 *   label: string,
 *   reply: null,
 *   satisfiable: boolean,
 *   strategy: string,
 *   segment: string,
 *   priority: number,
 * }|null}
 */
export function detectDocumentAnalysisIntent(segment = "") {
  if (!isDocumentAnalysisSegment(segment)) return null;
  return {
    domain: "document_analysis",
    familyId: "document_analysis",
    path: "DOCUMENT",
    label: "Analyse document",
    reply: null,
    satisfiable: false,
    strategy: "document_pipeline",
    segment,
    priority: 12,
  };
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function splitNumberedTaskSegments(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return [];

  if (!MULTI_TASK_PREAMBLE_RE.test(normalizeForParse(raw))) return [raw];

  const colonIdx = raw.indexOf(":");
  const body = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : raw;

  const parts = body
    .split(/\s+(?=\d+\s*[-–—]\s+)/)
    .map((part) => part.replace(/^\d+\s*[-–—]\s+/, "").trim())
    .filter(Boolean);

  return parts.length >= 2 ? parts : [raw];
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isDatetimeCompoundSegment(query = "") {
  const q = normalizeForParse(query);
  if (!q) return false;
  const hasDate = /\b(?:date|jour)\b/i.test(q);
  const hasTime = /\b(?:heure|temps)\b/i.test(q);
  return hasDate && hasTime;
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {boolean}
 */
export function shouldAppendDatetimeToDocumentAnalysis(understanding) {
  if (!understanding || understanding.workIntentCount < 2) return false;
  const hasDocument = understanding.domains.includes("document_analysis");
  const hasDatetime = understanding.domains.includes("datetime");
  return hasDocument && hasDatetime;
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @returns {string|null}
 */
export function extractDocumentAnalysisQuery(understanding) {
  const docIntent = understanding?.intents?.find(
    (intent) => intent.domain === "document_analysis" && !intent.absorbable,
  );
  return docIntent?.originalSegment || docIntent?.segment || null;
}

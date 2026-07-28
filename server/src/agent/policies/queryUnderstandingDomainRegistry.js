/**
 * Registre des détecteurs de domaine par segment — réutilise guards/policies existants.
 * Chaque détecteur identifie une demande ; le pattern n'est qu'un signal parmi d'autres.
 */
import { normalizeForParse } from "../micro/parsing/requestSegmentParser.js";
import { detectMathIntentInSegment } from "./math/mathCompositeQueryPolicy.js";
import { isTranslationShell } from "../utils/translationIntentGuards.js";
import { isTechnicalLearningPathRequest } from "../utils/technicalLearningPathIntentGuards.js";
import { resolveTechnicalLearningPathShortCircuit } from "../micro/replies/technicalLearningPathComposer.js";
import { classifyWebProjectScopingRequest } from "../utils/webProjectScopingGuards.js";
import { isInformationSeekingWithTarget } from "../utils/informationSeekingIntentGuards.js";
import { isDebugDiagnosticRequest } from "../utils/debugDiagnosticIntentGuards.js";
import { isGeneralKnowledgeRequest } from "../utils/generalKnowledgeIntentGuards.js";
import { isPedagogicalOverviewRequest } from "../utils/pedagogicalOverviewIntentGuards.js";
import { shouldBypassLocalDatetimeShortCircuit } from "../utils/externalCalendarLookupIntentGuards.js";
import { detectGovernanceExplainIntent } from "./governanceExplainPolicy.js";
import { detectDocumentAnalysisIntent } from "./documentAnalysisCompositePolicy.js";
import { detectDocumentSynthesisIntent } from "./documentSynthesisCompositePolicy.js";
import { detectCompareChooseIntent } from "./compareChooseCompositePolicy.js";

export const QUERY_DOMAINS = Object.freeze({
  MATH: "math",
  TRAINING: "training",
  WEBAPP: "webapp",
  DEBUG: "debug",
  INFO_SEEKING: "info_seeking",
  GENERAL_KNOWLEDGE: "general_knowledge",
  TRANSLATION: "translation",
  DATETIME: "datetime",
  SOCIAL: "social",
  PEDAGOGICAL: "pedagogical",
  GOVERNANCE: "governance",
  DOCUMENT_ANALYSIS: "document_analysis",
  DOCUMENT_SYNTHESIS: "document_synthesis",
  COMPARE_CHOOSE: "compare_choose",
  UNKNOWN: "unknown",
});

export const RESPONSE_STRATEGIES = Object.freeze({
  DETERMINISTIC: "deterministic",
  COMPOSITE_DETERMINISTIC: "composite_deterministic",
  WEB_LOOKUP: "web_lookup",
  LLM_EXPLAIN: "llm_explain",
  FULL_PIPELINE: "full_pipeline",
  PARTIAL_CLARIFY: "partial_clarify",
});

const SOCIAL_GREETING_RE =
  /(?:^|\s)(?:salut|bonjour|hello|coucou|hey|bonsoir|yo|yop)\b/i;

const SOCIAL_CHECKIN_RE =
  /(?:comment\s+(?:(?:ça|ca)\s+)?(?:va|se\s+passe|roule)|comment\s+(?:tu\s+)?vas|comment\s+vas[- ]?tu|(?:^|\s)(?:ça|ca)\s+va|tu\s+vas\s+bien)/i;

const TIME_REQUEST_RE =
  /\b(?:quelle\s+heure|heure\s+actuelle|heure\s+du\s+jour|heure\s+est\s+il|heure\s+est-il|il\s+est\s+quelle\s+heure)\b/i;

const DATE_REQUEST_RE =
  /\b(?:quelle\s+date|date\s+du\s+jour|date\s+d\s*aujourd|on\s+est\s+quel\s+jour|nous\s+sommes\s+quel\s+jour|jour\s+actuel)\b/i;

/**
 * @typedef {{
 *   domain: string,
 *   familyId: string,
 *   path: string,
 *   label: string,
 *   reply: string|null,
 *   satisfiable: boolean,
 *   strategy: string,
 *   segment: string,
 *   absorbable?: boolean,
 *   priority: number,
 *   task?: object|null,
 * }} SegmentIntent
 */

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectSocialIntent(segment = "") {
  const normalized = normalizeForParse(segment);
  if (!normalized) return null;
  if (!SOCIAL_GREETING_RE.test(normalized) && !SOCIAL_CHECKIN_RE.test(normalized)) {
    return null;
  }
  return {
    domain: QUERY_DOMAINS.SOCIAL,
    familyId: "social_deterministic",
    path: "social_deterministic",
    label: "Social",
    reply: null,
    satisfiable: true,
    strategy: RESPONSE_STRATEGIES.DETERMINISTIC,
    segment,
    absorbable: true,
    priority: 0,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectDatetimeIntent(segment = "") {
  const normalized = normalizeForParse(segment);
  if (!normalized || shouldBypassLocalDatetimeShortCircuit(normalized)) return null;

  const hasTime = TIME_REQUEST_RE.test(normalized);
  const hasDate = DATE_REQUEST_RE.test(normalized);
  if (!hasTime && !hasDate) return null;

  return {
    domain: QUERY_DOMAINS.DATETIME,
    familyId: "datetime_deterministic",
    path: "datetime_deterministic",
    label: hasDate && hasTime ? "Date et heure" : hasDate ? "Date" : "Heure",
    reply: null,
    satisfiable: true,
    strategy: RESPONSE_STRATEGIES.DETERMINISTIC,
    segment,
    priority: 10,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectTranslationIntent(segment = "") {
  if (!isTranslationShell(segment)) return null;
  return {
    domain: QUERY_DOMAINS.TRANSLATION,
    familyId: "translation_request",
    path: "translation_pipeline",
    label: "Traduction",
    reply: null,
    satisfiable: false,
    strategy: RESPONSE_STRATEGIES.FULL_PIPELINE,
    segment,
    priority: 15,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectMathIntent(segment = "") {
  const math = detectMathIntentInSegment(segment);
  if (!math) return null;
  return {
    domain: QUERY_DOMAINS.MATH,
    familyId: math.family,
    path: math.path,
    label: math.label,
    reply: math.reply,
    satisfiable: Boolean(math.reply),
    strategy: RESPONSE_STRATEGIES.DETERMINISTIC,
    segment,
    task: math.task || null,
    priority: 20,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectWebappIntent(segment = "") {
  const hit = classifyWebProjectScopingRequest(segment);
  if (!hit) return null;
  if (hit.needsClarify) {
    return {
      domain: QUERY_DOMAINS.WEBAPP,
      familyId: "web_project_scoping",
      path: "web_project_scoping_clarify",
      label: "Projet web",
      reply: hit.clarifyQuestion,
      satisfiable: Boolean(hit.clarifyQuestion),
      strategy: RESPONSE_STRATEGIES.PARTIAL_CLARIFY,
      segment,
      priority: 25,
    };
  }
  return {
    domain: QUERY_DOMAINS.WEBAPP,
    familyId: "web_project_scoping",
    path: "web_project_scoping_direct",
    label: "Projet web",
    reply: hit.directReply,
    satisfiable: Boolean(hit.directReply),
    strategy: RESPONSE_STRATEGIES.DETERMINISTIC,
    segment,
    priority: 25,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectTrainingIntent(segment = "") {
  if (!isTechnicalLearningPathRequest(segment)) return null;
  const hit = resolveTechnicalLearningPathShortCircuit(segment);
  if (!hit) return null;
  return {
    domain: QUERY_DOMAINS.TRAINING,
    familyId: "technical_learning_path",
    path: hit.path,
    label: "Formation technique",
    reply: hit.reply || null,
    satisfiable: Boolean(hit.reply),
    strategy: hit.reply
      ? RESPONSE_STRATEGIES.DETERMINISTIC
      : RESPONSE_STRATEGIES.LLM_EXPLAIN,
    segment,
    task: hit.slots || null,
    priority: 30,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectDebugIntent(segment = "") {
  if (!isDebugDiagnosticRequest(segment)) return null;
  return {
    domain: QUERY_DOMAINS.DEBUG,
    familyId: "debug_diagnostic",
    path: "debug_diagnostic",
    label: "Diagnostic technique",
    reply: null,
    satisfiable: false,
    strategy: RESPONSE_STRATEGIES.FULL_PIPELINE,
    segment,
    priority: 35,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectInfoSeekingIntent(segment = "") {
  if (!isInformationSeekingWithTarget(segment)) return null;
  return {
    domain: QUERY_DOMAINS.INFO_SEEKING,
    familyId: "information_seeking",
    path: "information_seeking_full_pipeline",
    label: "Recherche d'information",
    reply: null,
    satisfiable: false,
    strategy: RESPONSE_STRATEGIES.WEB_LOOKUP,
    segment,
    priority: 40,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectDocumentIntent(segment = "") {
  const hit = detectDocumentAnalysisIntent(segment);
  if (!hit) return null;
  return {
    domain: QUERY_DOMAINS.DOCUMENT_ANALYSIS,
    familyId: hit.familyId,
    path: hit.path,
    label: hit.label,
    reply: hit.reply,
    satisfiable: hit.satisfiable,
    strategy: RESPONSE_STRATEGIES.FULL_PIPELINE,
    segment,
    priority: hit.priority,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectGovernanceIntent(segment = "") {
  const hit = detectGovernanceExplainIntent(segment);
  if (!hit) return null;
  return {
    domain: QUERY_DOMAINS.GOVERNANCE,
    familyId: hit.familyId,
    path: hit.path,
    label: hit.label,
    reply: hit.reply,
    satisfiable: hit.satisfiable,
    strategy: RESPONSE_STRATEGIES.DETERMINISTIC,
    segment,
    task: hit.task,
    priority: hit.priority,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectPedagogicalIntent(segment = "") {
  if (!isPedagogicalOverviewRequest(segment)) return null;
  return {
    domain: QUERY_DOMAINS.PEDAGOGICAL,
    familyId: "pedagogical_overview",
    path: "pedagogical_overview_deterministic",
    label: "Aperçu pédagogique",
    reply: null,
    satisfiable: false,
    strategy: RESPONSE_STRATEGIES.LLM_EXPLAIN,
    segment,
    priority: 45,
  };
}

/**
 * @param {string} segment
 * @returns {SegmentIntent|null}
 */
function detectGeneralKnowledgeIntent(segment = "") {
  if (!isGeneralKnowledgeRequest(segment)) return null;
  return {
    domain: QUERY_DOMAINS.GENERAL_KNOWLEDGE,
    familyId: "general_knowledge",
    path: "general_knowledge_full_pipeline",
    label: "Culture générale",
    reply: null,
    satisfiable: false,
    strategy: RESPONSE_STRATEGIES.LLM_EXPLAIN,
    segment,
    priority: 50,
  };
}

/** Ordre d'évaluation — tous les candidats sont collectés, le plus prioritaire gagne. */
const SEGMENT_DETECTORS = [
  detectSocialIntent,
  detectDatetimeIntent,
  detectDocumentIntent,
  detectDocumentSynthesisIntent,
  detectTranslationIntent,
  detectGovernanceIntent,
  detectMathIntent,
  detectWebappIntent,
  detectTrainingIntent,
  detectCompareChooseIntent,
  detectDebugIntent,
  detectInfoSeekingIntent,
  detectPedagogicalIntent,
  detectGeneralKnowledgeIntent,
];

/**
 * @param {string} segment
 * @param {object} [context]
 * @returns {SegmentIntent|null}
 */
export function detectDomainIntentInSegment(segment = "", context = {}) {
  const payload = String(segment || "").trim();
  if (!payload) return null;

  const candidates = SEGMENT_DETECTORS.map((detect) => detect(payload, context)).filter(
    Boolean,
  );
  if (!candidates.length) return null;

  const workCandidates = candidates.filter((candidate) => !candidate.absorbable);
  if (workCandidates.length) {
    return workCandidates.sort((a, b) => a.priority - b.priority)[0];
  }

  return candidates.sort((a, b) => a.priority - b.priority)[0];
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
export function hasRecognizedDomainIntent(segment = "") {
  const intent = detectDomainIntentInSegment(segment);
  if (intent && !intent.absorbable) return true;
  const candidates = listDomainIntentCandidates(segment);
  return candidates.some((candidate) => !candidate.absorbable);
}

/**
 * @param {string} segment
 * @returns {SegmentIntent[]}
 */
export function listDomainIntentCandidates(segment = "") {
  return SEGMENT_DETECTORS.map((detect) => detect(segment, {})).filter(Boolean);
}

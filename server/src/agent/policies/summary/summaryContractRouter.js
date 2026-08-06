/**
 * G38 — Summary Contract Router.
 * Classifie la famille summary/* sous contrat JSON explicite (spec G38).
 * Couche mince au-dessus de G37 (known_entity) et G30 (document_synthesis).
 */
import {
  hasDocumentSynthesisShell,
  extractPastedSourceText,
  normalizeDocumentSynthesisQuery,
} from "../document/index.js";
import {
  isCulturalContentSummaryRequest,
  isConversationTakeawaySummaryRequest,
  extractCulturalSummarySubject,
  CULTURAL_WORK_MARKER_RE,
} from "./culturalContentSummaryPolicy.js";
import { isCodeConceptExplainRequest } from "../code/codeConceptExplainPolicy.js";
import { isResearchThenSummarizeRequest } from "../routing/researchThenSummarizePolicy.js";
import { isWebCitationsStructuredReportCluster } from "../routing/explicitWebSearchRequestPolicy.js";
import { shouldSuppressSummaryContractForAttachment } from "../attachment/index.js";

export const SUMMARY_CONTRACT_VERSION = 1;

export const SUMMARY_INTENTS = Object.freeze({
  KNOWN_ENTITY: "summary/known_entity",
  USER_PROVIDED_TEXT: "summary/user_provided_text",
  WEB_PAGE: "summary/web_page",
  EXCERPT_OR_CHAPTER: "summary/excerpt_or_chapter",
  AMBIGUOUS: "summary/ambiguous",
});

export const SUMMARY_CONTRACTS = Object.freeze({
  DIRECT_SUMMARY: "DIRECT_SUMMARY",
  TEXT_SUMMARY: "TEXT_SUMMARY",
  WEB_SUMMARY: "WEB_SUMMARY",
  CLARIFY_SUMMARY_KIND: "CLARIFY_SUMMARY_KIND",
});

export const SUMMARY_RESOLUTION_STRATEGIES = Object.freeze({
  EXPLICIT_SOURCE_PROVIDED: "explicit_source_provided",
  CULTURAL_ENTITY_DETECTED: "cultural_entity_detected",
  SMART_DEFAULT_KNOWN_ENTITY: "smart_default_known_entity",
  WEB_URL_DETECTED: "web_url_detected",
  EXCERPT_WITH_SOURCE: "excerpt_with_source",
  EXCERPT_MISSING_SOURCE: "excerpt_missing_source",
  AMBIGUOUS_REQUIRES_CLARIFY: "ambiguous_requires_clarify",
  MISSING_SOURCE_CLARIFY: "missing_source_clarify",
});

export const SUMMARY_MISSING_REASONS = Object.freeze({
  DOCUMENT_ANCHOR_WITHOUT_CONTENT: "document_anchor_without_content",
  URL_EXPECTED_ABSENT: "url_expected_absent",
  CHAPTER_REFERENCE_WITHOUT_SOURCE: "chapter_reference_without_source",
  AMBIGUOUS_WORK_REFERENCE: "ambiguous_work_reference",
  SHELL_WITHOUT_ANY_SOURCE: "shell_without_any_source",
});

const SUMMARY_SHELL_RE =
  /\b(?:resume|resumer|resumé|résumé|fais\s+un\s+resume|faire\s+un\s+resume|synthese|synthèse|summary|summarize|resumer\s+moi|resume\s+moi)\b/i;

const DOCUMENT_ANCHOR_RE =
  /\b(?:ce\s+(?:passage|texte|document|fichier|extrait|article)|texte\s+suivant|document\s+joint|fichier\s+joint|colle\s+le|coller\s+le|ci[- ]dessus|ci[- ]dessous|passage\s+suivant)\b/i;

const CHAPTER_REFERENCE_RE =
  /\b(?:chapitre|chapter)\s+(?:\d+|[ivxlc]+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/i;

const WEB_PAGE_INTENT_RE =
  /\b(?:cette\s+page|cet\s+article|this\s+page|this\s+article|la\s+page\s+web|ce\s+site|le\s+site|site\s+web|cette\s+url|cette\s+adresse)\b/i;

const URL_RE = /\bhttps?:\/\/[^\s"'<>)\]]+/i;

/**
 * Domaine nu (sans schéma) — stratégie web générique, pas un site hardcodé.
 * TLD allowlist pour éviter les faux positifs type `rapport.pdf` / `v1.0`.
 */
const BARE_WEB_HOST_RE =
  /\b((?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|dev|app|fr|eu|info|biz|co|uk|us|ca|be|ch|de|es|it|nl|pl|pt|ai|me|tv|xyz|site|online|tech|cloud|hu|pe))(?:\/[^\s"'<>)\]]*)?/i;

const CLARIFY_AMBIGUOUS_QUESTION =
  "Veux-tu un résumé général de l'œuvre, ou que je résume un texte précis que tu me fourniras ?";

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasSummaryShell(query = "") {
  const q = normalizeDocumentSynthesisQuery(query);
  return SUMMARY_SHELL_RE.test(q) || hasDocumentSynthesisShell(query);
}

/**
 * Normalise une cible web (https://… ou domaine nu) vers une URL fetchable.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSummaryWebUrl(raw = "") {
  const value = String(raw || "").trim().replace(/[.,;:!?)]+$/g, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

/**
 * Extrait une cible web générique (tout site public), pas un domaine figé.
 * @param {string} query
 * @returns {string|null}
 */
export function extractSummaryUrl(query = "") {
  const text = String(query || "");
  const absolute = text.match(URL_RE);
  if (absolute?.[0]) return normalizeSummaryWebUrl(absolute[0]);

  const bare = text.match(BARE_WEB_HOST_RE);
  if (bare?.[0]) return normalizeSummaryWebUrl(bare[0]);

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasDocumentAnchor(query = "") {
  return DOCUMENT_ANCHOR_RE.test(normalizeDocumentSynthesisQuery(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasChapterReference(query = "") {
  return CHAPTER_REFERENCE_RE.test(normalizeDocumentSynthesisQuery(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasWebPageSummaryIntent(query = "") {
  const q = normalizeDocumentSynthesisQuery(query);
  return WEB_PAGE_INTENT_RE.test(q) || URL_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasVagueWorkReference(query = "") {
  const q = normalizeDocumentSynthesisQuery(query).replace(/œ/g, "oe");
  if (!/\b(?:ce|cette)\s+(?:livre|oeuvre|ouvrage)\b/.test(q)) return false;

  const subject = extractCulturalSummarySubject(query);
  if (!subject) return true;

  const normalizedSubject = normalizeDocumentSynthesisQuery(subject).replace(/œ/g, "oe");
  if (/^(?:ce|cette)\s+(?:livre|oeuvre|ouvrage)$/.test(normalizedSubject)) return true;
  if (/^(?:ce|cette)$/.test(normalizedSubject)) return true;

  return false;
}

/**
 * @param {string} subject
 * @returns {number}
 */
export function subjectConfidence(subject = "") {
  const label = String(subject || "").trim();
  if (!label || label.length < 3) return 0;
  if (label.split(/\s+/).length === 1 && label.length >= 4) return 0.85;
  if (label.length >= 8) return 0.82;
  return 0.75;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
function inferEntityKind(query = "") {
  const q = normalizeDocumentSynthesisQuery(query);
  if (/\b(?:film|movie)\b/.test(q)) return "film";
  if (/\b(?:serie|series|série)\b/.test(q)) return "series";
  if (/\b(?:livre|book|roman)\b/.test(q)) return "book";
  if (/\b(?:documentaire)\b/.test(q)) return "documentary";
  if (/\b(?:chapitre|chapter)\b/.test(q)) return "chapter";
  return "work";
}

/**
 * Runtime assertions — maintient la spec vivante au boundary du router.
 * @param {SummaryContract|null} contract
 */
export function assertInvariantSummaryContract(contract) {
  if (!contract) return;

  if (contract.family !== "summary") {
    throw new Error(`G38 invariant: family must be "summary", got ${contract.family}`);
  }

  if (contract.intent === SUMMARY_INTENTS.KNOWN_ENTITY) {
    if (contract.routing?.forbidDocumentRequest !== true) {
      throw new Error("G38 INV-1: summary/known_entity requires forbidDocumentRequest=true");
    }
    if (contract.clarification?.needed === true) {
      throw new Error("G38 INV-1: summary/known_entity forbids clarification.needed=true");
    }
  }

  if (contract.source?.required === true && contract.source?.provided === false) {
    if (contract.clarification?.needed !== true) {
      throw new Error(
        "G38 INV-2: source required but absent requires clarification.needed=true",
      );
    }
  }

  if (
    contract.intent === SUMMARY_INTENTS.KNOWN_ENTITY &&
    contract.source?.missing_reason
  ) {
    throw new Error("G38 INV-1: known_entity must not carry source.missing_reason");
  }
}

/**
 * @typedef {object} SummaryContract
 * @property {string} family
 * @property {string} intent
 * @property {string} contract
 * @property {number} version
 * @property {object} [entity]
 * @property {object} source
 * @property {object} [constraints]
 * @property {object} resolution
 * @property {object} routing
 * @property {object} clarification
 */

/**
 * @param {Partial<SummaryContract>} partial
 * @returns {SummaryContract}
 */
function buildSummaryContract(partial) {
  const contract = {
    family: "summary",
    version: SUMMARY_CONTRACT_VERSION,
    entity: null,
    constraints: null,
    ...partial,
    source: {
      type: "none",
      required: false,
      provided: false,
      url: null,
      missing_reason: null,
      ...partial.source,
    },
    resolution: {
      reason: "",
      ...partial.resolution,
    },
    routing: {
      plan: "B",
      mode: null,
      fetchRequired: false,
      forbidDocumentRequest: false,
      forbidWebSearch: false,
      ...partial.routing,
    },
    clarification: {
      needed: false,
      question: null,
      options: [],
      ...partial.clarification,
    },
  };

  assertInvariantSummaryContract(contract);
  return contract;
}

/**
 * @param {string} query
 * @param {{ attachments?: unknown[], history?: Array<{role?: string, content?: string}> }} [ctx]
 * @returns {SummaryContract|null}
 */
export function classifySummaryContract(query = "", ctx = {}) {
  const attachments = ctx.attachments || [];
  const hasAttachment = attachments.length > 0;

  // Cluster web+citations+rapport sans PJ → FACTUAL_RESEARCH, pas TEXT_SUMMARY
  if (isWebCitationsStructuredReportCluster(query) && !hasAttachment) {
    return null;
  }

  if (!hasSummaryShell(query)) return null;
  if (isCodeConceptExplainRequest(query)) return null;
  // Takeaway de conversation ≠ contrat résumé d’œuvre / document
  if (isConversationTakeawaySummaryRequest(query)) return null;
  // « va te renseigner puis résume » → web, pas TEXT_SUMMARY sur la phrase utilisateur
  if (isResearchThenSummarizeRequest(query, { attachments })) return null;
  // PJ code / doc_improve : file-aware, pas TEXT_SUMMARY (analyse≠résumé)
  if (shouldSuppressSummaryContractForAttachment(query, attachments)) return null;

  const pasted = extractPastedSourceText(query);
  const url = extractSummaryUrl(query);
  const documentAnchor = hasDocumentAnchor(query);
  const chapterRef = hasChapterReference(query);
  const webIntent = hasWebPageSummaryIntent(query);
  const normalized = normalizeDocumentSynthesisQuery(query);

  // ── 1 : source explicite (priorité maximale) ──
  if (pasted || hasAttachment) {
    if (chapterRef) {
      return buildSummaryContract({
        intent: SUMMARY_INTENTS.EXCERPT_OR_CHAPTER,
        contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
        entity: { kind: "chapter", label: null, confidence: 0.9 },
        source: {
          type: pasted ? "pasted" : "attachment",
          required: true,
          provided: true,
        },
        resolution: {
          strategy: SUMMARY_RESOLUTION_STRATEGIES.EXCERPT_WITH_SOURCE,
          reason: "chapter reference with pasted text or attachment",
        },
        routing: {
          pipelinePath: "document_synthesis_llm",
          mode: "DOCUMENT",
        },
      });
    }

    return buildSummaryContract({
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      source: {
        type: pasted ? "pasted" : "attachment",
        required: true,
        provided: true,
      },
      resolution: {
        strategy: SUMMARY_RESOLUTION_STRATEGIES.EXPLICIT_SOURCE_PROVIDED,
        reason: "pasted text or attachment detected before entity routing",
      },
      routing: {
        pipelinePath: "document_synthesis_llm",
        mode: "DOCUMENT",
      },
    });
  }

  // ── 2 : page web ──
  if (url || webIntent) {
    if (!url) {
      return buildSummaryContract({
        intent: SUMMARY_INTENTS.WEB_PAGE,
        contract: SUMMARY_CONTRACTS.WEB_SUMMARY,
        source: {
          type: "url",
          required: true,
          provided: false,
          missing_reason: SUMMARY_MISSING_REASONS.URL_EXPECTED_ABSENT,
        },
        resolution: {
          strategy: SUMMARY_RESOLUTION_STRATEGIES.MISSING_SOURCE_CLARIFY,
          reason: "web page summary intent without URL",
        },
        routing: {
          pipelinePath: "document_synthesis_clarify",
          mode: "INSTANT",
        },
        clarification: {
          needed: true,
          question: "Quelle URL dois-je résumer ?",
        },
      });
    }

    return buildSummaryContract({
      intent: SUMMARY_INTENTS.WEB_PAGE,
      contract: SUMMARY_CONTRACTS.WEB_SUMMARY,
      source: {
        type: "url",
        required: true,
        provided: true,
        url,
      },
      resolution: {
        strategy: SUMMARY_RESOLUTION_STRATEGIES.WEB_URL_DETECTED,
        reason: "URL detected in summary request",
      },
      routing: {
        pipelinePath: "document_synthesis_llm",
        mode: "DOCUMENT",
        fetchRequired: true,
      },
    });
  }

  // ── 3 : excerpt / ancre documentaire sans source (avant known_entity) ──
  if ((chapterRef || documentAnchor) && !hasAttachment && !pasted) {
    const isChapter = chapterRef;
    return buildSummaryContract({
      intent: isChapter
        ? SUMMARY_INTENTS.EXCERPT_OR_CHAPTER
        : SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      source: {
        type: "none",
        required: true,
        provided: false,
        missing_reason: isChapter
          ? SUMMARY_MISSING_REASONS.CHAPTER_REFERENCE_WITHOUT_SOURCE
          : SUMMARY_MISSING_REASONS.DOCUMENT_ANCHOR_WITHOUT_CONTENT,
      },
      resolution: {
        strategy: isChapter
          ? SUMMARY_RESOLUTION_STRATEGIES.EXCERPT_MISSING_SOURCE
          : SUMMARY_RESOLUTION_STRATEGIES.MISSING_SOURCE_CLARIFY,
        reason: isChapter
          ? "chapter referenced without source"
          : "document anchor without pasted content or attachment",
      },
      routing: {
        pipelinePath: "document_synthesis_clarify",
        mode: "INSTANT",
      },
      clarification: {
        needed: true,
        question: isChapter
          ? "Colle ou joins le chapitre à résumer."
          : "Colle le passage ou joins le document à résumer.",
      },
    });
  }

  // ── 4 : ambiguïté bloquante (avant known_entity — « ce livre » ≠ titre) ──
  if (hasVagueWorkReference(query)) {
    return buildSummaryContract({
      intent: SUMMARY_INTENTS.AMBIGUOUS,
      contract: SUMMARY_CONTRACTS.CLARIFY_SUMMARY_KIND,
      source: {
        type: "none",
        required: false,
        provided: false,
        missing_reason: SUMMARY_MISSING_REASONS.AMBIGUOUS_WORK_REFERENCE,
      },
      resolution: {
        strategy: SUMMARY_RESOLUTION_STRATEGIES.AMBIGUOUS_REQUIRES_CLARIFY,
        reason: "vague work reference without identifiable title",
      },
      routing: {
        pipelinePath: "clarification_gate",
        mode: "INSTANT",
      },
      clarification: {
        needed: true,
        question: CLARIFY_AMBIGUOUS_QUESTION,
        options: [
          SUMMARY_INTENTS.KNOWN_ENTITY,
          SUMMARY_INTENTS.USER_PROVIDED_TEXT,
        ],
      },
    });
  }

  // ── 5 : known_entity (G37) ──
  if (
    !isCodeConceptExplainRequest(query) &&
    isCulturalContentSummaryRequest(query, attachments)
  ) {
    const subject = extractCulturalSummarySubject(query);
    const strategy = CULTURAL_WORK_MARKER_RE.test(normalized)
      ? SUMMARY_RESOLUTION_STRATEGIES.CULTURAL_ENTITY_DETECTED
      : SUMMARY_RESOLUTION_STRATEGIES.SMART_DEFAULT_KNOWN_ENTITY;

    return buildSummaryContract({
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      entity: {
        kind: inferEntityKind(query),
        label: subject,
        confidence: subject ? subjectConfidence(subject) : 0.8,
      },
      source: {
        type: "knowledge_base",
        required: false,
        provided: false,
      },
      constraints: {
        fidelity: "factual_overview",
        max_sentences: 5,
        spoiler_level: "low",
        copyright_tier: "cultural_work_public_knowledge",
      },
      resolution: {
        strategy,
        reason: "cultural entity without document anchor or explicit source",
      },
      routing: {
        pipelinePath: "cultural_content_summary",
        mode: "SIMPLE_FAST",
        forbidDocumentRequest: true,
        forbidWebSearch: true,
      },
    });
  }

  // ── 6 : smart default ──
  const subject = extractCulturalSummarySubject(query);
  if (
    !isCodeConceptExplainRequest(query) &&
    subject &&
    subjectConfidence(subject) >= 0.7
  ) {
    return buildSummaryContract({
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      entity: {
        kind: inferEntityKind(query),
        label: subject,
        confidence: subjectConfidence(subject),
      },
      source: {
        type: "knowledge_base",
        required: false,
        provided: false,
      },
      constraints: {
        fidelity: "factual_overview",
        max_sentences: 5,
        spoiler_level: "low",
        copyright_tier: "cultural_work_public_knowledge",
      },
      resolution: {
        strategy: SUMMARY_RESOLUTION_STRATEGIES.SMART_DEFAULT_KNOWN_ENTITY,
        reason: "extractable subject, no document anchor, no attachment, no URL",
      },
      routing: {
        pipelinePath: "cultural_content_summary",
        mode: "SIMPLE_FAST",
        forbidDocumentRequest: true,
        forbidWebSearch: true,
      },
    });
  }

  // ── 7 : shell résumé sans source identifiable ──
  if (hasSummaryShell(query)) {
    return buildSummaryContract({
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      source: {
        type: "none",
        required: true,
        provided: false,
        missing_reason: SUMMARY_MISSING_REASONS.SHELL_WITHOUT_ANY_SOURCE,
      },
      resolution: {
        strategy: SUMMARY_RESOLUTION_STRATEGIES.MISSING_SOURCE_CLARIFY,
        reason: "summary shell without extractable subject or source",
      },
      routing: {
        pipelinePath: "document_synthesis_clarify",
        mode: "INSTANT",
      },
      clarification: {
        needed: true,
        question: "Colle le texte ou joins le document à résumer.",
      },
    });
  }

  return null;
}

/**
 * @param {SummaryContract|null} contract
 * @returns {boolean}
 */
export function isSummaryKnownEntityContract(contract) {
  return contract?.intent === SUMMARY_INTENTS.KNOWN_ENTITY;
}

/**
 * @param {SummaryContract|null} contract
 * @returns {boolean}
 */
export function summaryContractNeedsClarification(contract) {
  return Boolean(contract?.clarification?.needed);
}

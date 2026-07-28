/**
 * G32.4 + G38.1 — validation post-compose synthèse document.
 */
import { normalizeDocumentSynthesisQuery } from "./documentSynthesisPolicy.js";
import {
  SUMMARY_EXECUTION_MODES,
  splitWebPayloadMainAndChrome,
} from "./summaryExecutionPromptPolicy.js";
import { SUMMARY_CONTRACTS } from "./summaryContractRouter.js";

const GENERIC_SYNTHESIS_RE = [
  /\bce\s+(?:document|texte|passage)\s+(?:parle|aborde|traite|evoque|évoque)\s+(?:de\s+)?(?:l[''])?importance\b/i,
  /\b(?:de\s+maniere\s+generale|de\s+manière\s+générale|en\s+general|en\s+général|dans\s+l['']ensemble)\b/i,
  /\b(?:themes?|sujets?)\s+principaux\s+(?:sont|abordes|abordés)\b/i,
];

const FRENCH_STOPWORDS = new Set([
  "cette",
  "celui",
  "celle",
  "comme",
  "dans",
  "elle",
  "elles",
  "entre",
  "etait",
  "être",
  "fait",
  "leurs",
  "mais",
  "meme",
  "même",
  "nous",
  "pour",
  "sont",
  "tout",
  "tous",
  "toute",
  "toutes",
  "avec",
  "sans",
  "plus",
  "aussi",
  "alors",
  "donc",
  "ainsi",
  "peut",
  "peuvent",
  "avoir",
  "avait",
  "etre",
  "être",
  "cette",
  "cela",
  "ceci",
]);

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractAnchorTokens(text = "") {
  const normalized = normalizeDocumentSynthesisQuery(text);
  return [
    ...new Set(
      normalized
        .split(/\W+/)
        .filter((token) => token.length >= 5 && !FRENCH_STOPWORDS.has(token)),
    ),
  ];
}

/**
 * @param {string} reply
 * @param {string} sourceText
 * @returns {{ anchored: number, required: number, score: number }}
 */
export function scoreSynthesisGroundedness(reply = "", sourceText = "") {
  const tokens = extractAnchorTokens(sourceText).slice(0, 14);
  if (!tokens.length) {
    return { anchored: 0, required: 0, score: 1 };
  }

  const replyNorm = normalizeDocumentSynthesisQuery(reply);
  const anchored = tokens.filter((token) => replyNorm.includes(token)).length;
  const required = Math.min(3, Math.max(2, Math.ceil(tokens.length * 0.15)));

  return {
    anchored,
    required,
    score: anchored / Math.max(tokens.length, 1),
  };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isGenericSynthesisReply(text = "") {
  return GENERIC_SYNTHESIS_RE.some((pattern) => pattern.test(text));
}

const EXTERNAL_KNOWLEDGE_LEAK_RE = [
  /\b(?:selon\s+wikipedia|d'apres\s+wikipedia|en\s+general|historiquement|il\s+est\s+connu\s+que)\b/i,
  /\b(?:as\s+is\s+well\s+known|generally\s+speaking|it\s+is\s+widely\s+known)\b/i,
];

const WEB_LAYOUT_POLLUTION_RE = [
  /\b(?:menu\s+principal|barre\s+de\s+navigation|footer\s+du\s+site|mentions\s+legales)\b/i,
  /\b(?:ajouter\s+au\s+panier|s'inscrire\s+a\s+la\s+newsletter|politique\s+de\s+cookies)\b/i,
  /\b(?:home\s+page|site\s+navigation|subscribe\s+to\s+newsletter|add\s+to\s+cart)\b/i,
];

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isExternalKnowledgeLeakReply(text = "") {
  return EXTERNAL_KNOWLEDGE_LEAK_RE.some((pattern) => pattern.test(text));
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isWebLayoutPollutionReply(text = "") {
  return WEB_LAYOUT_POLLUTION_RE.some((pattern) => pattern.test(text));
}

/**
 * @param {string} reply
 * @param {{ mainContent?: string, chromeContent?: string }} payload
 * @returns {{ mainHits: number, chromeHits: number, polluted: boolean }}
 */
export function scoreWebMainContentFocus(reply = "", payload = {}) {
  const mainTokens = extractAnchorTokens(payload.mainContent || "").slice(0, 10);
  const chromeTokens = extractAnchorTokens(payload.chromeContent || "").slice(0, 10);
  const replyNorm = normalizeDocumentSynthesisQuery(reply);
  const mainHits = mainTokens.filter((token) => replyNorm.includes(token)).length;
  const chromeHits = chromeTokens.filter((token) => replyNorm.includes(token)).length;
  const polluted = chromeHits > 0 && (mainHits === 0 || chromeHits >= mainHits);
  return { mainHits, chromeHits, polluted };
}

/**
 * @param {string} text
 * @param {{
 *   sourceText?: string|null,
 *   sourceType?: string|null,
 *   length?: string|null,
 *   focus?: string|null,
 * }} [slots]
 * @param {{
 *   contract?: string|null,
 *   intent?: string|null,
 *   sourceType?: string|null,
 *   fidelity?: string|null,
 *   forbidDocumentRequest?: boolean,
 *   summaryExecutionMode?: "text"|"web"|null,
 * }} [executionContext]
 * @returns {{
 *   valid: boolean,
 *   issues: string[],
 *   sanitized: string,
 *   groundedness: { anchored: number, required: number, score: number },
 *   executionMode: "text"|"web"|null,
 * }}
 */
export function validateDocumentSynthesisReply(text = "", slots = {}, executionContext = {}) {
  const issues = [];
  let sanitized = String(text || "").trim();
  const sourceText = String(slots.sourceText || "").trim();
  const executionMode =
    executionContext.summaryExecutionMode ||
    (executionContext.contract === SUMMARY_CONTRACTS.WEB_SUMMARY
      ? SUMMARY_EXECUTION_MODES.WEB
      : executionContext.contract === SUMMARY_CONTRACTS.TEXT_SUMMARY
        ? SUMMARY_EXECUTION_MODES.TEXT
        : null);

  let groundedness = scoreSynthesisGroundedness(sanitized, sourceText);

  if (isGenericSynthesisReply(sanitized)) {
    issues.push("generic_synthesis_template");
  }

  if (executionMode === SUMMARY_EXECUTION_MODES.TEXT) {
    if (isExternalKnowledgeLeakReply(sanitized)) {
      issues.push("text_summary_external_knowledge_leak");
    }
    if (sourceText && groundedness.anchored < groundedness.required) {
      issues.push("insufficient_source_anchoring");
    }
  }

  if (executionMode === SUMMARY_EXECUTION_MODES.WEB) {
    if (isWebLayoutPollutionReply(sanitized)) {
      issues.push("web_summary_layout_pollution");
    }
    if (sourceText) {
      const { mainContent, chromeContent } = splitWebPayloadMainAndChrome(sourceText);
      const focus = scoreWebMainContentFocus(sanitized, { mainContent, chromeContent });
      groundedness = scoreSynthesisGroundedness(sanitized, mainContent || sourceText);
      if (focus.polluted) {
        issues.push("web_summary_chrome_focus");
      }
      if (groundedness.anchored < groundedness.required) {
        issues.push("insufficient_main_content_anchoring");
      }
    }
  }

  if (!executionMode && sourceText && groundedness.anchored < groundedness.required) {
    issues.push("insufficient_source_anchoring");
  }

  if (issues.includes("generic_synthesis_template")) {
    sanitized +=
      "\n\n_Note : ce résumé manque d'ancrage explicite dans le passage fourni. Colle le texte source ou joins le document pour une synthèse fidèle._";
  } else if (issues.includes("insufficient_source_anchoring") || issues.includes("insufficient_main_content_anchoring")) {
    sanitized +=
      "\n\n_Note : le résumé cite peu d'éléments du passage source — vérifie qu'il reflète bien le texte fourni._";
  } else if (issues.includes("web_summary_layout_pollution") || issues.includes("web_summary_chrome_focus")) {
    sanitized +=
      "\n\n_Note : le résumé semble pollué par des éléments de navigation ou de mise en page plutôt que le contenu principal._";
  } else if (issues.includes("text_summary_external_knowledge_leak")) {
    sanitized +=
      "\n\n_Note : le résumé ajoute du contexte externe — pour TEXT_SUMMARY, reste strictement dans le texte fourni._";
  }

  return {
    valid: issues.length === 0,
    issues,
    sanitized,
    groundedness,
    executionMode,
  };
}

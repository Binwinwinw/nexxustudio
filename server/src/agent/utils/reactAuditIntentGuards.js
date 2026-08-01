/**
 * G48 — guards intention audit React Doctor (repo / diff / score).
 */
import { normalizeText } from "./normalizationGuards.js";
import { isCodeConceptExplainRequest } from "../policies/codeConceptExplainPolicy.js";
import {
  isComprehensionDemonstrationRequest,
  isMetaAssistantBehaviorRequest,
} from "./metaAssistantBehaviorGuards.js";
import { hasExecutableSnippet } from "../policies/codeIntentPolicy.js";
import { resolveAttachmentFileKind, ATTACHMENT_FILE_KINDS } from "../policies/attachment/index.js";
import { isUiNavigationRestructureFeedback } from "./uiNavigationFeedbackGuards.js";

export const REACT_AUDIT_CONTRACT_ID = "REACT_AUDIT_V1";

export const REACT_AUDIT_FORBIDDEN_PATHS = Object.freeze([
  "COMPOSER",
  "general_knowledge_full_pipeline",
  "information_seeking_full_pipeline",
  "semantic_intent_resolver",
  "presentation_outline",
  "technical_overview",
]);

const REACT_STACK_RE =
  /\b(?:react|vite|next\.?js|next js|jsx|tsx|composant(?:s)? react|front react)\b/i;

/** « audit impact » (menu Cockpit) ≠ React Doctor — article ou cible repo obligatoire après « audit ». */
const REACT_AUDIT_PHRASE_RE =
  /\b(?:audite|auditer|audit(?:e)?\s+(?:le|la|les|mon|ma|mes|ce|cette|un|une|du|de|d'|l'|l)\b|audit(?:e)?\s+(?:react|repo|projet|codebase|front|vite|next|jsx|tsx)\b|scanne|scanner|scan(?:ne)?\s+(?:le|mon|ce)?|analyse(?:r)?\s+(?:le\s+)?(?:repo|projet|codebase|front)|revue react|react doctor|qualit[eé] react|sant[eé] react|health score|score sant[eé])\b/i;

const EXPLICIT_REACT_DOCTOR_RE = /\breact[- ]?doctor\b/i;

const DIFF_SCAN_RE =
  /\b(?:vs main|vs master|diff(?:\s+main)?|changements|pull request|mes modifs|par rapport [aà] main|contre main)\b/i;

const SCORE_ONLY_RE =
  /\b(?:(?:score|sant[eé]|health|note)\b.*\b(?:react|front|vite|next)\b|\b(?:react|front|vite|next)\b.*\b(?:score|sant[eé]|health|note)\b)\b/i;

const REPO_PATH_RE =
  /(?:^|\s)(?:\.{1,2}(?:\/|\\)|[a-z]:\\[^\s?]+|\.\/[^\s?]+|\/[^\s?]+)/i;

const REPO_SCOPE_RE =
  /\b(?:repo|projet|codebase|workspace|monorepo|dossier|racine|root|ce projet|le projet|nexxustudio)\b/i;

const SNIPPET_FENCE_RE = /```[\s\S]{24,}/;

const TECH_OVERVIEW_TRAP_RE =
  /^(?:c['']?est quoi|qu['']?est[- ]ce que)\s+react\b/i;

const REACT_CONCEPT_EXPLAIN_RE =
  /\b(?:explique|a quoi sert|à quoi sert|qu['']est ce que|c['']est quoi)\b.*\b(?:react|useEffect|useState|hook|jsx|tsx|composant)\b/i;

const DOCUMENT_TRAP_RE =
  /\b(résume|résumer|extraire|points clés|synthèse du texte)\b/i;

/** Audit sécu / OWASP — pas React Doctor (CLI repo React uniquement). */
function hasSecurityFocus(query = "") {
  const q = String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(?:audit\s+(?:de\s+)?securite|faille|vulnerabilite|xss|csrf|injection|owasp|hardening|surface\s+d['']attaque)\b/.test(
    q,
  );
}

const ATTACHMENT_FOCUS_RE =
  /\b(?:fichier(?:\s+joint)?|pi[eè]ce\s+jointe|document\s+joint)\b/i;

/** Sources hors stack React Doctor (HTML/PHP/CSS/Python…). */
const NON_REACT_SOURCE_EXT_RE =
  /\.(html?|php|css|scss|py|rb|go|java|cs|vue|svelte)\b/i;

/**
 * @param {string} input
 */
function norm(input = "") {
  return normalizeText(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/[^\p{L}\p{N}\s'./\\:-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 */
export function hasReactStackSignal(query = "") {
  const q = norm(query);
  return REACT_STACK_RE.test(q) || EXPLICIT_REACT_DOCTOR_RE.test(q);
}

/**
 * @param {string} query
 */
export function hasReactAuditPhrase(query = "") {
  const q = norm(query);
  return REACT_AUDIT_PHRASE_RE.test(q) || EXPLICIT_REACT_DOCTOR_RE.test(q);
}

/**
 * @param {string} query
 */
export function isReactAuditDiffRequest(query = "") {
  return DIFF_SCAN_RE.test(norm(query));
}

/**
 * @param {string} query
 */
export function isReactAuditScoreOnlyRequest(query = "") {
  return SCORE_ONLY_RE.test(norm(query));
}

/**
 * Snippet collé sans mandat repo → CODE_REVIEW_V1_1, pas G48.
 * @param {string} query
 */
export function shouldDeferReactAuditToSnippetCodeReview(query = "") {
  const q = String(query || "");
  if (!hasExecutableSnippet(q) && !SNIPPET_FENCE_RE.test(q)) return false;
  if (REPO_SCOPE_RE.test(q) || REPO_PATH_RE.test(q)) return false;
  if (hasReactAuditPhrase(q) && REPO_SCOPE_RE.test(q)) return false;
  return SNIPPET_FENCE_RE.test(q) || (hasExecutableSnippet(q) && q.length >= 80);
}

/**
 * @param {string} query
 * @param {{ history?: object[], workspaceRoot?: string, packageJsonHasReact?: boolean, attachments?: unknown[] }} [options]
 */
export function isReactAuditExcluded(query = "", options = {}) {
  const q = norm(query);
  if (!q || q.length < 8) return true;
  if (isUiNavigationRestructureFeedback(query)) return true;
  if (isMetaAssistantBehaviorRequest(query)) return true;
  if (isComprehensionDemonstrationRequest(query)) return true;
  if (isCodeConceptExplainRequest(query)) return true;
  if (TECH_OVERVIEW_TRAP_RE.test(q)) return true;
  if (REACT_CONCEPT_EXPLAIN_RE.test(q)) return true;
  if (DOCUMENT_TRAP_RE.test(q)) return true;
  if (shouldDeferReactAuditToSnippetCodeReview(query)) return true;

  const reactStack = hasReactStackSignal(query);
  // « audit sécurité » / PJ HTML-PHP sans signal React → file-aware / security_audit, pas G48
  if (hasSecurityFocus(query) && !reactStack) return true;
  if (ATTACHMENT_FOCUS_RE.test(q) && !reactStack) return true;

  const attachments = options.attachments || [];
  const names = attachments
    .map((f) => String(f?.originalname || f?.name || ""))
    .filter(Boolean);
  if (names.length > 0 && !reactStack) {
    const kind = resolveAttachmentFileKind(names);
    if (
      kind === ATTACHMENT_FILE_KINDS.CODE ||
      kind === ATTACHMENT_FILE_KINDS.MIXED ||
      names.some((n) => NON_REACT_SOURCE_EXT_RE.test(n))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} query
 * @param {{ workspaceRoot?: string, packageJsonHasReact?: boolean }} [options]
 * @returns {string|null}
 */
export function extractReactAuditRootPath(query = "", options = {}) {
  if (options.workspaceRoot) return String(options.workspaceRoot);

  const raw = String(query || "");
  const explicit = raw.match(
    /(?:sur|dans|chemin|path|repo)\s+([a-z]:\\[^\s?]+|\.\.?\/[^\s?]+|\/[^\s?]+)/i,
  );
  if (explicit?.[1]) return explicit[1].replace(/[?!.,]+$/, "");

  if (REPO_PATH_RE.test(raw)) {
    const m = raw.match(
      /([a-z]:\\[^\s?]+|\.\.?\/[^\s?]+|\/[^\s?]+)/i,
    );
    if (m?.[1]) return m[1].replace(/[?!.,]+$/, "");
  }

  if (options.packageJsonHasReact) return options.workspaceRoot || ".";

  return null;
}

/**
 * @param {string} query
 * @param {{ history?: object[], workspaceRoot?: string, packageJsonHasReact?: boolean }} [options]
 */
export function isReactAuditAmbiguous(query = "", options = {}) {
  if (isReactAuditExcluded(query, options)) return false;
  if (!hasReactAuditPhrase(query)) return false;
  if (isReactAuditScoreOnlyRequest(query) || isReactAuditDiffRequest(query)) {
    return false;
  }
  const root = extractReactAuditRootPath(query, options);
  if (root) return false;
  if (hasReactStackSignal(query) && REPO_SCOPE_RE.test(norm(query))) return false;
  if (EXPLICIT_REACT_DOCTOR_RE.test(norm(query)) && REPO_SCOPE_RE.test(norm(query))) {
    return false;
  }
  return hasReactAuditPhrase(query) && !hasReactStackSignal(query);
}

/**
 * @param {string} query
 * @param {{ history?: object[], workspaceRoot?: string, packageJsonHasReact?: boolean }} [options]
 */
export function isReactAuditRequest(query = "", options = {}) {
  if (isReactAuditExcluded(query, options)) return false;
  if (!hasReactAuditPhrase(query)) return false;
  if (isReactAuditAmbiguous(query, options)) return true;
  if (isReactAuditScoreOnlyRequest(query)) return hasReactStackSignal(query) || REPO_SCOPE_RE.test(norm(query));
  if (isReactAuditDiffRequest(query)) return hasReactStackSignal(query) || REPO_SCOPE_RE.test(norm(query)) || Boolean(extractReactAuditRootPath(query, options));
  return (
    hasReactStackSignal(query) ||
    REPO_SCOPE_RE.test(norm(query)) ||
    EXPLICIT_REACT_DOCTOR_RE.test(norm(query)) ||
    Boolean(extractReactAuditRootPath(query, options))
  );
}

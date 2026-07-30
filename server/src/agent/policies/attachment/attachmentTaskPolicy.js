/**
 * AttachmentTask — taxonomie légère intention × kind de pièce jointe.
 * Route doc vs code sans explosion de rails.
 */
import { hasTextAttachments } from "../../utils/conversationGuards.js";

export const ATTACHMENT_TASK_RULE = "attachment_task_p1";

export const ATTACHMENT_TASKS = Object.freeze({
  DOC_IMPROVE: "doc_improve",
  DOC_SUMMARIZE: "doc_summarize",
  CODE_FIX: "code_fix",
  CODE_REFACTOR: "code_refactor",
  CODE_REVIEW: "code_review",
  SECURITY_AUDIT: "security_audit",
  DOC_ANALYZE: "doc_analyze",
});

export const ATTACHMENT_FILE_KINDS = Object.freeze({
  CODE: "code",
  DOCUMENT: "document",
  MIXED: "mixed",
  NONE: "none",
});

const CODE_EXT_RE =
  /\.(py|js|mjs|cjs|ts|tsx|jsx|php|html|htm|css|rb|go|rs|java|cs|cpp|c|h|vue|svelte)\b/i;

const DOC_EXT_RE =
  /\.(md|txt|pdf|docx?|csv|json|xml|ya?ml|rtf)\b/i;

const FIX_VERB_RE =
  /\b(corrige(?:r)?|fix(?:e|er)?|r[eé]pare(?:r)?|correctif|version corrig[eé]e|bug|erreur)\b/i;

const REFACTOR_VERB_RE =
  /\b(refactor(?:ise|iser|ing)?|restructur(?:e|er)|clean\s+code|sans changer le comportement|am[eé]lior(?:e|er)\s+(?:le\s+)?code)\b/i;

const SUMMARIZE_VERB_RE =
  /\b(r[eé]sume(?:r)?|r[eé]sum[eé]|synth[eè]se|synth[eé]tise(?:r)?|points?\s+cl[eé]s|l['']?\s*essentiel)\b/i;

const IMPROVE_VERB_RE =
  /\b(am[eé]lior(?:e|er|ation|ations)|contenu am[eé]lior[eé]|propose(?:r)?\s+(?:un\s+)?contenu|plan d['']?\s*am[eé]lioration|r[eé][eé]crire|reformule(?:r)?)\b/i;

const REVIEW_VERB_RE =
  /\b(revue|review|audit(?:er)?|analys(?:e|er)|inspecte(?:r)?|erreurs?\s+bloquantes?)\b/i;

/** Accent-safe : `\b` JS casse sur « sécurité » même avec flag `u`. */
function hasSecurityAuditSignal(query = "") {
  const q = String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(?:audit\s+(?:de\s+)?securite|securite|faille|vulnerabilite|xss|csrf|injection|owasp|hardening|surface\s+d['']attaque)\b/.test(
    q,
  );
}

const ATTACHMENT_HINT_RE =
  /\b(fichier(?:\s+joint)?|pi[eè]ce\s+jointe|document\s+joint|joint|attach[eé]e?)\b/i;

/**
 * @param {unknown[]} attachments
 * @returns {string[]}
 */
function attachmentNames(attachments = []) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((f) => String(f?.originalname || f?.name || ""))
    .filter(Boolean);
}

/**
 * @param {string[]} names
 * @returns {'code'|'document'|'mixed'|'none'}
 */
export function resolveAttachmentFileKind(names = []) {
  let code = 0;
  let doc = 0;
  for (const name of names) {
    if (CODE_EXT_RE.test(name)) code += 1;
    else if (DOC_EXT_RE.test(name)) doc += 1;
  }
  if (code > 0 && doc > 0) return ATTACHMENT_FILE_KINDS.MIXED;
  if (code > 0) return ATTACHMENT_FILE_KINDS.CODE;
  if (doc > 0) return ATTACHMENT_FILE_KINDS.DOCUMENT;
  return ATTACHMENT_FILE_KINDS.NONE;
}

/**
 * @param {string} task
 */
export function isCodeAttachmentTask(task = "") {
  return (
    task === ATTACHMENT_TASKS.CODE_FIX ||
    task === ATTACHMENT_TASKS.CODE_REFACTOR ||
    task === ATTACHMENT_TASKS.CODE_REVIEW ||
    task === ATTACHMENT_TASKS.SECURITY_AUDIT
  );
}

/**
 * @param {string} task
 */
export function isDocumentAttachmentTask(task = "") {
  return (
    task === ATTACHMENT_TASKS.DOC_IMPROVE ||
    task === ATTACHMENT_TASKS.DOC_SUMMARIZE ||
    task === ATTACHMENT_TASKS.DOC_ANALYZE
  );
}

/**
 * @param {string} query
 * @param {unknown[]} [attachments]
 * @returns {{
 *   task: string|null,
 *   confidence: 'high'|'medium'|'low'|null,
 *   fileKind: string,
 *   matched: boolean,
 *   rule: string,
 * }}
 */
export function classifyAttachmentTask(query = "", attachments = []) {
  const names = attachmentNames(attachments);
  const fileKind = resolveAttachmentFileKind(names);
  const hasFiles = hasTextAttachments(attachments) || names.length > 0;

  if (!hasFiles) {
    return {
      task: null,
      confidence: null,
      fileKind: ATTACHMENT_FILE_KINDS.NONE,
      matched: false,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  const q = String(query || "").trim();
  const isCodeish =
    fileKind === ATTACHMENT_FILE_KINDS.CODE ||
    fileKind === ATTACHMENT_FILE_KINDS.MIXED;

  if (isCodeish && REFACTOR_VERB_RE.test(q)) {
    return {
      task: ATTACHMENT_TASKS.CODE_REFACTOR,
      confidence: "high",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  if (isCodeish && FIX_VERB_RE.test(q)) {
    return {
      task: ATTACHMENT_TASKS.CODE_FIX,
      confidence: "high",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  if (SUMMARIZE_VERB_RE.test(q) && !isCodeish) {
    return {
      task: ATTACHMENT_TASKS.DOC_SUMMARIZE,
      confidence: "high",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  if (SUMMARIZE_VERB_RE.test(q) && fileKind === ATTACHMENT_FILE_KINDS.DOCUMENT) {
    return {
      task: ATTACHMENT_TASKS.DOC_SUMMARIZE,
      confidence: "high",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  if (IMPROVE_VERB_RE.test(q) && !REFACTOR_VERB_RE.test(q) && !hasSecurityAuditSignal(q)) {
    return {
      task: ATTACHMENT_TASKS.DOC_IMPROVE,
      confidence: fileKind === ATTACHMENT_FILE_KINDS.DOCUMENT ? "high" : "medium",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  // « audit sécurité » + .html/.php/.js → pas React Doctor, revue sécurité file-aware
  if (hasSecurityAuditSignal(q) && (isCodeish || ATTACHMENT_HINT_RE.test(q))) {
    return {
      task: ATTACHMENT_TASKS.SECURITY_AUDIT,
      confidence: isCodeish ? "high" : "medium",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  if (isCodeish && REVIEW_VERB_RE.test(q)) {
    return {
      task: ATTACHMENT_TASKS.CODE_REVIEW,
      confidence: "medium",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  if (!q || ATTACHMENT_HINT_RE.test(q) || REVIEW_VERB_RE.test(q)) {
    if (isCodeish && !SUMMARIZE_VERB_RE.test(q) && !IMPROVE_VERB_RE.test(q)) {
      return {
        task: ATTACHMENT_TASKS.CODE_REVIEW,
        confidence: q ? "medium" : "low",
        fileKind,
        matched: true,
        rule: ATTACHMENT_TASK_RULE,
      };
    }
    return {
      task: ATTACHMENT_TASKS.DOC_ANALYZE,
      confidence: q ? "medium" : "low",
      fileKind,
      matched: true,
      rule: ATTACHMENT_TASK_RULE,
    };
  }

  return {
    task: ATTACHMENT_TASKS.DOC_ANALYZE,
    confidence: "low",
    fileKind,
    matched: true,
    rule: ATTACHMENT_TASK_RULE,
  };
}

/**
 * @param {ReturnType<typeof classifyAttachmentTask>} classification
 */
export function formatAttachmentTaskSummary(classification = {}) {
  if (!classification?.matched || !classification.task) {
    return "attachmentTask=none";
  }
  return `attachmentTask=${classification.task} fileKind=${classification.fileKind} conf=${classification.confidence}`;
}

/**
 * PJ code / doc_improve / review : pas de contrat G38 TEXT_SUMMARY
 * (évite short-circuit document_synthesis_llm sur « analyse + améliorer »).
 * @param {string} query
 * @param {unknown[]} [attachments]
 */
export function shouldSuppressSummaryContractForAttachment(
  query = "",
  attachments = [],
) {
  const hit = classifyAttachmentTask(query, attachments);
  if (!hit.matched || !hit.task) return false;
  // Résumé documentaire pur reste sur le contrat summary.
  if (hit.task === ATTACHMENT_TASKS.DOC_SUMMARIZE) return false;
  if (
    hit.fileKind === ATTACHMENT_FILE_KINDS.CODE ||
    hit.fileKind === ATTACHMENT_FILE_KINDS.MIXED
  ) {
    return true;
  }
  if (
    hit.task === ATTACHMENT_TASKS.DOC_IMPROVE ||
    hit.task === ATTACHMENT_TASKS.DOC_ANALYZE ||
    isCodeAttachmentTask(hit.task)
  ) {
    return true;
  }
  return false;
}

/**
 * Route file-aware directe (DOCUMENT_ATTACHED / orchestrateur), sans SIMPLE_FAST.
 * @param {string} query
 * @param {unknown[]} [attachments]
 */
export function shouldRouteAttachmentTaskToFullPipeline(
  query = "",
  attachments = [],
) {
  return shouldSuppressSummaryContractForAttachment(query, attachments);
}

/**
 * Taxonomie d'intentions code — routage, contrats et formulations utilisateur.
 * Distinction explicite : revue/debug/correction vs explication vs refactor vs analyse documentaire.
 */
import {
  CODE_INTENT_KINDS,
  CODE_INTENT_USER_TEMPLATES,
  buildCodeIntentUserPrompt,
  getCodeIntentUserTemplates,
  getCodeIntentLabel,
  CODE_INTENT_LABELS,
} from "../../../../shared/codeIntentCatalog.js";
import { isCodeConceptExplainRequest } from "./codeConceptExplainPolicy.js";

export {
  CODE_INTENT_KINDS,
  CODE_INTENT_USER_TEMPLATES,
  CODE_INTENT_LABELS,
  buildCodeIntentUserPrompt,
  getCodeIntentUserTemplates,
  getCodeIntentLabel,
};

/** Intentions qui exigent l'ouverture « erreurs bloquantes » (CODE_REVIEW_V1_1). */
export const BLOCKING_FIRST_INTENTS = new Set([
  CODE_INTENT_KINDS.REVIEW,
  CODE_INTENT_KINDS.DEBUG,
  CODE_INTENT_KINDS.CORRECTION,
  CODE_INTENT_KINDS.AUDIT,
]);

const CODE_CONTEXT_RE =
  /\b(code|snippet|python|javascript|typescript|php|\.py\b|script|fonction|def\s+\w+|import\s+\w+|class\s+\w+|```|if\s+__name__|if\s+name\s*==)\b/i;

const EXECUTABLE_SNIPPET_RE =
  /\b(def\s+\w+|class\s+\w+|import\s+|function\s+\w+|const\s+\w+\s*=|<?php|```[\s\S]{20,}|while\s+True|try\s*:)\b/i;

const EXPLICIT_INTENT_RULES = [
  {
    kind: CODE_INTENT_KINDS.REFACTOR,
    pattern:
      /\b(refactor(?:ise|iser|ing)?|restructur(?:e|er)|amélior(?:e|er)\s+(?:le\s+)?code|clean\s+code|sans changer le comportement)\b/i,
  },
  {
    kind: CODE_INTENT_KINDS.EXPLAIN,
    pattern:
      /\b(explique(?:r)?(?:\s+(?:ce|le|cette))?\s+code|comment (?:fonctionne|marche)\s+(?:ce|le)\s+code|à quoi sert|comprendre ce code|pédagogique)\b/i,
  },
  {
    kind: CODE_INTENT_KINDS.DEBUG,
    pattern:
      /\b(débug|debug|pourquoi (?:ça|ca) (?:ne |n')?(?:fonctionne|marche|compile|s'exécute)|trouve (?:le |la )?bug|diagnostique)\b/i,
  },
  {
    kind: CODE_INTENT_KINDS.CORRECTION,
    pattern:
      /\b(corrige(?:r)?(?:\s+le)?\s+code|version corrigée|correctif|répare(?:r)?(?:\s+le)?\s+code|fix(?:e|er)?\s+(?:ce|le)\s+(?:code|script|snippet))\b/i,
  },
  {
    kind: CODE_INTENT_KINDS.AUDIT,
    pattern:
      /\b(audit(?:er)?(?:\s+(?:rapide|s[eé]curit[eé]|security))?(?:\s+(?:du|de|le|la|un|une))?\s+(?:code|fichier|projet)?|revue rapide|quick review|checklist\b.*\bcode|audit\s+s[eé]curit[eé]|security\s+audit)\b/i,
  },
  {
    kind: CODE_INTENT_KINDS.REVIEW,
    pattern:
      /\b(revue de code|code review|review(?:\s+du)?\s+code|erreurs bloquantes|orientée exécution|empêche l'exécution|ne peut pas s'exécuter)\b/i,
  },
];

const GENERIC_REVIEW_SIGNAL_RE =
  /\b(analyse|analyser|revue|review|auditer|audit|corrige|corriger|débug|debug|diagnostique|diagnostiquer|inspecte|inspecter)\b/i;

const DOCUMENT_TRAP_RE =
  /\b(résume|résumer|extraire|points clés|synthèse du texte|qu'est-ce qu'il est intéressant)\b/i;

const MIN_CODE_INTENT_LENGTH = 40;

const ATTACHMENT_CODE_EXT_RE =
  /\.(py|js|mjs|cjs|ts|tsx|jsx|php|html|htm|css|rb|go|rs|java|cs|cpp|c|h|vue|svelte)\b/i;

const SHORT_ATTACHMENT_CODE_VERB_RE =
  /\b(corrige(?:r)?|fix(?:e|er)?|r[eé]pare(?:r)?|refactor(?:ise|iser|ing)?|restructur(?:e|er)|revue|review|audit(?:er)?|debug|analys(?:e|er)|erreurs?\s+bloquantes?|am[eé]lior(?:e|er)\s+(?:le\s+)?code)\b/i;

/**
 * @param {unknown[]} attachments
 */
function hasCodeAttachmentFiles(attachments = []) {
  return (Array.isArray(attachments) ? attachments : []).some((f) =>
    ATTACHMENT_CODE_EXT_RE.test(String(f?.originalname || f?.name || "")),
  );
}

export function hasCodeContext(query = "") {
  return CODE_CONTEXT_RE.test(String(query || ""));
}

export function hasExecutableSnippet(query = "") {
  const q = String(query || "");
  return EXECUTABLE_SNIPPET_RE.test(q) || (q.length >= 120 && hasCodeContext(q));
}

/**
 * Classifie l'intention code (null si hors périmètre).
 * @param {string} query
 * @param {{ attachments?: unknown[] }} [options]
 */
export function classifyCodeIntent(query = "", options = {}) {
  const q = String(query || "").trim();
  if (!q) return null;

  const attachments = options.attachments || [];
  const codeAttachment = hasCodeAttachmentFiles(attachments);
  const shortAttachmentCode =
    codeAttachment &&
    SHORT_ATTACHMENT_CODE_VERB_RE.test(q) &&
    !DOCUMENT_TRAP_RE.test(q);

  if (!shortAttachmentCode) {
    if (q.length < MIN_CODE_INTENT_LENGTH) return null;
    if (!hasCodeContext(q)) return null;
  }

  if (isCodeConceptExplainRequest(q)) {
    return { kind: CODE_INTENT_KINDS.EXPLAIN, confidence: "explicit", query: q };
  }

  if (
    !hasExecutableSnippet(q) &&
    !GENERIC_REVIEW_SIGNAL_RE.test(q) &&
    !shortAttachmentCode
  ) {
    return null;
  }

  for (const rule of EXPLICIT_INTENT_RULES) {
    if (rule.pattern.test(q)) {
      return {
        kind: rule.kind,
        confidence: shortAttachmentCode ? "attachment_explicit" : "explicit",
        query: q,
      };
    }
  }

  // PJ code + verbe court (corrige / refactor / revue le fichier joint)
  if (shortAttachmentCode) {
    if (
      /\b(refactor(?:ise|iser|ing)?|restructur(?:e|er)|am[eé]lior(?:e|er)\s+(?:le\s+)?code)\b/i.test(
        q,
      )
    ) {
      return {
        kind: CODE_INTENT_KINDS.REFACTOR,
        confidence: "attachment_explicit",
        query: q,
      };
    }
    if (/\b(corrige(?:r)?|fix(?:e|er)?|r[eé]pare(?:r)?)\b/i.test(q)) {
      return {
        kind: CODE_INTENT_KINDS.CORRECTION,
        confidence: "attachment_explicit",
        query: q,
      };
    }
    return {
      kind: CODE_INTENT_KINDS.REVIEW,
      confidence: "attachment_inferred",
      query: q,
    };
  }

  if (GENERIC_REVIEW_SIGNAL_RE.test(q) && hasExecutableSnippet(q)) {
    if (DOCUMENT_TRAP_RE.test(q) && !/\b(code|python|script|snippet)\b/i.test(q)) {
      return null;
    }
    return { kind: CODE_INTENT_KINDS.REVIEW, confidence: "inferred", query: q };
  }

  return null;
}

export function isCodeIntentRequest(query = "", options = {}) {
  return classifyCodeIntent(query, options) !== null;
}

export function requiresBlockingFirstContract(query = "") {
  const classified = classifyCodeIntent(query);
  if (!classified) return false;
  return BLOCKING_FIRST_INTENTS.has(classified.kind);
}


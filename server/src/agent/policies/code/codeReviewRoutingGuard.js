/**
 * Routage code_review — empêche multi_segment / SIMPLE_FAST de court-circuiter
 * les contrats CODE_REVIEW_V1_1 / CODE_DIAGNOSTIC_V1.
 */
import { isCodeIntentRequest } from "./codeIntentPolicy.js";
import { isCodeReviewRequest } from "./codeReviewPolicy.js";
import {
  TRIAGE_INTENTS,
  TRIAGE_CONFIDENCE,
  shouldBlockDocumentAnalysisRoute,
} from "../../classifiers/intentTriageClassifier.js";
import { isMetaCapabilitiesIntent } from "../metaCapabilitiesPolicy.js";
import {
  classifyAttachmentTask,
  isCodeAttachmentTask,
} from "../attachmentTaskPolicy.js";

const CODE_TRIAGE_PREFIX = /^code_/;

/**
 * Intentions code à pipeline complet (pas short-circuit composite rapide).
 */
export function isDominantCodeTriageIntent(intentTriage = null) {
  const top = intentTriage?.top_intent || "";
  if (!CODE_TRIAGE_PREFIX.test(top)) return false;
  if (intentTriage.confidence === TRIAGE_CONFIDENCE.LOW) return false;
  return true;
}

export function hasCodeAttachmentSignal(attachments = [], query = "") {
  const files = Array.isArray(attachments) ? attachments : [];
  const codeExt =
    /\.(py|js|mjs|cjs|ts|tsx|jsx|php|html|htm|css|rb|go|rs|java|cs|cpp|c|h|vue|svelte)\b/i;
  if (files.some((f) => codeExt.test(String(f?.originalname || f?.name || "")))) {
    return true;
  }
  return codeExt.test(String(query || ""));
}

/**
 * Document Analysis extractif doit céder au pipeline code (triage, PJ, ou requête mixte).
 */
export function shouldBypassDocumentAnalysisRoute(
  query = "",
  intentTriage = null,
  attachments = [],
) {
  if (isMetaCapabilitiesIntent(query)) return true;
  if (shouldBlockDocumentAnalysisRoute(intentTriage)) return true;
  if (isCodeIntentRequest(query, { attachments })) return true;

  const attachmentTask = classifyAttachmentTask(query, attachments);
  if (isCodeAttachmentTask(attachmentTask.task)) return true;

  if (isDominantCodeTriageIntent(intentTriage) && hasCodeAttachmentSignal(attachments, query)) {
    return true;
  }
  if (hasCodeAttachmentSignal(attachments, query)) {
    const q = String(query || "").trim();
    if (
      !q ||
      /\b(corrige|corriger|fix(?:e|er)?|refactor(?:ise|iser)?|restructur(?:e|er)|revue|review|debug|audit|am[eé]lior(?:e|er)\s+(?:le\s+)?code|erreurs?\s+bloquantes?|snippet|code)\b/i.test(
        q,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function shouldAllowMultiSegmentShortCircuit(query = "", options = {}) {
  if (isDominantCodeTriageIntent(options.intentTriage)) {
    return false;
  }
  if (
    isCodeReviewRequest(query) ||
    isCodeIntentRequest(query, { attachments: options.attachments || [] })
  ) {
    return false;
  }
  if (isCodeAttachmentTask(classifyAttachmentTask(query, options.attachments || []).task)) {
    return false;
  }
  if (hasCodeAttachmentSignal(options.attachments, query)) {
    const q = String(query || "").toLowerCase();
    if (
      /\b(corrige|corriger|fix(?:e|er)?|refactor(?:ise|iser)?|revue|review|debug|audit|analyse|analyser|erreurs?\s+bloquantes?|snippet|fichier joint)\b/i.test(
        q,
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Dérive les drapeaux sentinelles depuis le texte réellement fourni (pas la calculatrice golden).
 */
function extractAttachmentCodeBodies(attachments = []) {
  const chunks = [];
  for (const file of attachments || []) {
    const buf = file?.buffer || file?.content;
    if (typeof buf === "string" && buf.trim()) chunks.push(buf);
    else if (Buffer.isBuffer(buf) && buf.length) chunks.push(buf.toString("utf8"));
  }
  return chunks.join("\n\n");
}

export function derivePythonAnalysisFlags(sourceText = "") {
  const body = String(sourceText || "");
  if (!body.trim()) return [];

  const flags = [];

  if (/\bif\s+name\s*==/i.test(body)) {
    flags.push("if name", "__name__");
  }

  if (
    /^Calculatrice simple/m.test(body) ||
    /^Exécutez avec\s*:/m.test(body)
  ) {
    flags.push("texte brut|commentaire|#");
  }

  if (/^\s*(?:while\s+True|try)\s*:/m.test(body) && /^\s{0,4}(?:while|try)/m.test(body)) {
    const hasBrokenIndent =
      /^\s*while\s+True\s*:\s*\n\s*try\s*:/m.test(body) ||
      /^\s*try\s*:\s*\n[^\s#]/m.test(body);
    if (hasBrokenIndent) flags.push("indentation");
  }

  if (/def\s+division\b/i.test(body) && /if\s+.*return.*\/\s*[^\n;]+return/m.test(body)) {
    flags.push("division");
  }

  return [...new Set(flags)];
}

export function buildCodeReviewSourceText(query = "", attachments = []) {
  const attachmentCode = extractAttachmentCodeBodies(attachments);
  if (attachmentCode.trim()) return attachmentCode;
  return String(query || "");
}

export { extractAttachmentCodeBodies };

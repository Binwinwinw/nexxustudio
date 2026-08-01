import { requiresGenerousComposerResponse } from "../policies/practicalAdviceRoutingGuard.js";
import {
  isArchitectureDesignIntent,
  isAttachedDocumentAnalysisRequest,
  hasImageAttachments,
  hasTextAttachments,
} from "../utils/conversationGuards.js";
import { isRepoAnalysisRequest } from "../utils/repoAnalysisIntentGuards.js";
import {
  classifyAttachmentTask,
  isDocumentAttachmentTask,
} from "../policies/attachment/index.js";
import { isUiNavigationRestructureFeedback } from "../utils/uiNavigationFeedbackGuards.js";

/** Contrats où Caveman instruction est interdit (P0). */
export const PEDAGOGICAL_OR_SUPPORT_CONTRACT_IDS = new Set([
  "PRESENTATION_OUTLINE",
  "DIRECT_EXPLANATION",
  "GUIDED_PRODUCT_RECOMMENDATION",
  "GUIDED_DOCUMENT_SYNTHESIS",
  "GUIDED_CREATION_SCOPING",
  "SOCIAL",
  "INSTANT",
  "CONVERSATION_STANDARD",
  "FACTUAL_RESEARCH",
  "FORMAL_LETTER_TEMPLATE",
]);

export const PONYTAIL_ALLOWED_CONTRACT_IDS = new Set([
  "CODE_DELIVERY_V1",
  "CODE_INTENT",
  "CODE_PROJECT_LIGHT",
  "DIAGNOSTIC",
]);

export const GRAPHIFY_ALLOWED_CONTRACT_IDS = new Set([
  "REPO_ANALYSIS",
  "ARCHITECTURE_OPTIONS",
]);

export const OCR_ALLOWED_CONTRACT_IDS = new Set([
  "DOCUMENT_ATTACHED",
  "DOCUMENT_ANALYSIS",
  "GUIDED_DOCUMENT_SYNTHESIS",
]);

/** Contrats où l'instruction Caveman-lite est autorisée (P2). */
export const CAVEMAN_INSTRUCTION_CONTRACT_IDS = new Set([
  "REPO_ANALYSIS",
  "DIAGNOSTIC",
  "CODE_INTENT",
  "CODE_DELIVERY_V1",
  "CODE_PROJECT_LIGHT",
]);

const SPEC_OR_PROSE_RE =
  /\b(?:spec\s+fonctionnelle|specification|cahier des charges|user story|documentation|doc utilisateur|guide utilisateur|plan de cours|p[eé]dagogie|tutoriel|onboarding)\b/i;

/**
 * @param {import("./capabilityTypes.js").CapabilityMatchInput} input
 * @returns {{ ok: boolean, why: string[] }}
 */
export function assessCavemanInstructionCompatibility(input = {}) {
  const why = [];
  const query = String(input.query || "");
  const contractId = input.intentContractId || null;

  const pedagogical = isPedagogicalOrSupportContext(
    query,
    contractId,
    input.conversationMove,
  );
  if (pedagogical.blocked) {
    return { ok: false, why: [`excluded:${pedagogical.why.join("+")}`] };
  }

  if (requiresGenerousComposerResponse(query)) {
    return { ok: false, why: ["excluded:generous_composer"] };
  }

  if (SPEC_OR_PROSE_RE.test(query)) {
    return { ok: false, why: ["excluded:spec_or_user_prose"] };
  }

  if (contractId && CAVEMAN_INSTRUCTION_CONTRACT_IDS.has(contractId)) {
    why.push(`contract:${contractId}`);
  }

  if (input.toolHeavyTurn === true) {
    why.push("tool_heavy_turn");
  }

  const codeKind = input.justIntent?.codeIntentKind || null;
  if (codeKind && codeKind !== "code_explain") {
    why.push(`code_intent:${codeKind}`);
  }

  if (why.length === 0) {
    return { ok: false, why: ["no_caveman_contract_signal"] };
  }

  return { ok: true, why };
}

const GRAPHIFY_QUERY_RE =
  /\b(?:impact|blast\s+radius|call\s+flow|qui\s+appelle|who\s+calls|where\s+is|o[uù]\s+est|graphe|d[eé]pendances|dependency|architecture\s+explore|explore\s+l['']?architecture)\b/i;

const EMOTIONAL_OR_SUPPORT_RE =
  /\b(?:mal\s+[aà]\s+l['']?aise|d[eé]prim|anxieux|stress|soutien\s+[eé]motionnel|besoin\s+d['']?[eé]couter)\b/i;

/**
 * @param {string} query
 * @param {string|null} intentContractId
 * @param {object} [conversationMove]
 */
export function isPedagogicalOrSupportContext(
  query = "",
  intentContractId = null,
  conversationMove = {},
) {
  if (intentContractId && PEDAGOGICAL_OR_SUPPORT_CONTRACT_IDS.has(intentContractId)) {
    return { blocked: true, why: [`contract:${intentContractId}`] };
  }
  if (requiresGenerousComposerResponse(query)) {
    return { blocked: true, why: ["generous_composer_response"] };
  }
  const family = String(conversationMove?.family || "").toLowerCase();
  if (family.includes("pedagog") || family.includes("presentation")) {
    return { blocked: true, why: [`move_family:${family}`] };
  }
  if (EMOTIONAL_OR_SUPPORT_RE.test(String(query || ""))) {
    return { blocked: true, why: ["emotional_support_surface"] };
  }
  return { blocked: false, why: [] };
}

/**
 * @param {string} query
 * @param {string|null} intentContractId
 * @param {object} [options]
 */
export function matchesGraphifyIntent(query = "", intentContractId = null, options = {}) {
  const why = [];
  if (isUiNavigationRestructureFeedback(query)) {
    return { active: false, why: ["cockpit_ui_not_graphify"] };
  }
  if (intentContractId && GRAPHIFY_ALLOWED_CONTRACT_IDS.has(intentContractId)) {
    why.push(`contract:${intentContractId}`);
  }
  if (isArchitectureDesignIntent(query)) {
    why.push("architecture_design_intent");
  }
  if (isRepoAnalysisRequest(query, { attachments: options.attachments || [] })) {
    why.push("repo_analysis_request");
  }
  if (GRAPHIFY_QUERY_RE.test(String(query || ""))) {
    why.push("graphify_query_lexicon");
  }
  return { active: why.length > 0, why };
}

const OCR_QUERY_RE =
  /\b(?:ocr|extraire|extrait|transcri(?:re|ption)|convertir(?:\s+en)?\s+markdown|indexer|ing[eé]rer|parser|parsing|texte\s+du\s+pdf|scan(?:ner)?|facture|contrat\s+pdf|multi\s*page)\b/i;

const PDF_OR_IMAGE_ATTACHMENT_RE = /\.(pdf|png|jpe?g|webp|tiff?|bmp)\b/i;

/**
 * @param {string} query
 * @param {unknown[]} attachments
 */
export function isSimpleVisionDescribeWithoutOcrNeed(query = "", attachments = []) {
  if (!hasImageAttachments(attachments)) return false;
  const q = String(query || "");
  if (OCR_QUERY_RE.test(q)) return false;
  if (PDF_OR_IMAGE_ATTACHMENT_RE.test(q) && /\bpdf\b/i.test(q)) return false;
  return /\b(d[eé]cris|decris|qu['']est|sc[eè]ne|photo|image|visuel)\b/i.test(q);
}

/**
 * @param {string} query
 * @param {string|null} intentContractId
 * @param {object} [options]
 */
export function matchesOcrIntent(query = "", intentContractId = null, options = {}) {
  const why = [];
  const attachments = options.attachments || [];
  const names = (Array.isArray(attachments) ? attachments : [])
    .map((f) => String(f?.originalname || f?.name || ""))
    .filter(Boolean);

  if (intentContractId && OCR_ALLOWED_CONTRACT_IDS.has(intentContractId)) {
    why.push(`contract:${intentContractId}`);
  }

  const attachmentTask = classifyAttachmentTask(query, attachments);
  if (isDocumentAttachmentTask(attachmentTask.task)) {
    why.push(`attachment_task:${attachmentTask.task}`);
  }

  if (isAttachedDocumentAnalysisRequest(query, attachments)) {
    why.push("attached_document_analysis");
  }

  const hasDocFile =
    hasTextAttachments(attachments) &&
    names.some((n) => PDF_OR_IMAGE_ATTACHMENT_RE.test(n) || /\.pdf$/i.test(n));
  const hasScanImage =
    hasImageAttachments(attachments) &&
    (OCR_QUERY_RE.test(String(query || "")) || why.length > 0);

  if (hasDocFile && OCR_QUERY_RE.test(String(query || ""))) {
    why.push("document_file_with_ocr_lexicon");
  }
  if (hasScanImage && why.length > 0) {
    why.push("image_attachment_ocr_context");
  }
  if (OCR_QUERY_RE.test(String(query || "")) && hasTextAttachments(attachments)) {
    why.push("ocr_lexicon_with_attachment");
  }

  return { active: why.length > 0, why };
}

/**
 * Décision explicite PDF : couche texte native vs OCR requis.
 * Évite les réponses « OCR possible si tu confirmes » quand la demande de transcription est déjà claire.
 */
import {
  DOCUMENT_KINDS,
  EXTRACTION_ROUTES,
} from "./documentCapabilityContract.js";

export const PDF_TEXT_LAYER_DECISION_RULE = "pdf_text_layer_decision_v1";

const TRANSCRIPTION_RE =
  /\b(?:transcription|transcri(?:re|t|ption)|retranscri\w*|ocr|extraire\s+le\s+texte|texte\s+(?:du|de\s+la)\s+(?:fichier|pdf|document)|lis(?:\s+le)?\s+(?:fichier|pdf|document)|couche\s+texte)\b/i;

/**
 * @param {string} query
 */
export function isDocumentTranscriptionRequest(query = "") {
  return TRANSCRIPTION_RE.test(String(query || ""));
}

/**
 * @param {Array<{ filename?: string, content?: string, pdfMeta?: object }>} documents
 * @returns {{
 *   decision: 'text_layer_present'|'ocr_required'|'not_pdf'|'unknown',
 *   documentKind: string|null,
 *   extractionRoute: string|null,
 *   nativeTextAvailable: boolean,
 *   nativeTextChars: number,
 *   pageCount: number|null,
 *   fileName: string|null,
 *   pdfCode: string|null,
 * }}
 */
export function resolvePdfTextLayerDecision(documents = []) {
  const list = Array.isArray(documents) ? documents : [];
  const pdfDoc =
    list.find(
      (d) =>
        d?.pdfMeta ||
        /\.pdf$/i.test(String(d?.filename || "")) ||
        /pdf/i.test(String(d?.mimetype || "")),
    ) || null;

  if (!pdfDoc) {
    return {
      decision: "not_pdf",
      documentKind: null,
      extractionRoute: null,
      nativeTextAvailable: false,
      nativeTextChars: 0,
      pageCount: null,
      fileName: null,
      pdfCode: null,
    };
  }

  const cap = pdfDoc.pdfMeta?.capability || null;
  const code = pdfDoc.pdfMeta?.code || cap?.pdfCode || null;
  const fileName = pdfDoc.filename || cap?.fileName || null;
  const pageCount = pdfDoc.pdfMeta?.pageCount ?? cap?.pageCount ?? null;

  if (cap?.documentKind === DOCUMENT_KINDS.NATIVE_TEXT || (cap?.nativeTextAvailable && !pdfDoc.pdfMeta?.fallback)) {
    return {
      decision: "text_layer_present",
      documentKind: DOCUMENT_KINDS.NATIVE_TEXT,
      extractionRoute: EXTRACTION_ROUTES.NATIVE_TEXT,
      nativeTextAvailable: true,
      nativeTextChars: Number(cap?.nativeTextChars) || String(pdfDoc.content || "").length,
      pageCount,
      fileName,
      pdfCode: code,
    };
  }

  if (
    code === "PDF_SCANNED_NO_TEXT" ||
    cap?.documentKind === DOCUMENT_KINDS.SCANNED_PDF ||
    cap?.extractionRoute === EXTRACTION_ROUTES.OCR
  ) {
    return {
      decision: "ocr_required",
      documentKind: DOCUMENT_KINDS.SCANNED_PDF,
      extractionRoute: EXTRACTION_ROUTES.OCR,
      nativeTextAvailable: false,
      nativeTextChars: 0,
      pageCount,
      fileName,
      pdfCode: code || "PDF_SCANNED_NO_TEXT",
    };
  }

  if (pdfDoc.pdfMeta?.fallback) {
    return {
      decision: "ocr_required",
      documentKind: cap?.documentKind || DOCUMENT_KINDS.SCANNED_PDF,
      extractionRoute: EXTRACTION_ROUTES.OCR,
      nativeTextAvailable: false,
      nativeTextChars: Number(cap?.nativeTextChars) || 0,
      pageCount,
      fileName,
      pdfCode: code,
    };
  }

  if (String(pdfDoc.content || "").trim().length > 200 && !pdfDoc.pdfMeta?.fallback) {
    return {
      decision: "text_layer_present",
      documentKind: DOCUMENT_KINDS.NATIVE_TEXT,
      extractionRoute: EXTRACTION_ROUTES.NATIVE_TEXT,
      nativeTextAvailable: true,
      nativeTextChars: String(pdfDoc.content || "").length,
      pageCount,
      fileName,
      pdfCode: code,
    };
  }

  return {
    decision: "unknown",
    documentKind: cap?.documentKind || DOCUMENT_KINDS.UNKNOWN,
    extractionRoute: cap?.extractionRoute || null,
    nativeTextAvailable: Boolean(cap?.nativeTextAvailable),
    nativeTextChars: Number(cap?.nativeTextChars) || 0,
    pageCount,
    fileName,
    pdfCode: code,
  };
}

/**
 * Réponse déterministe si OCR requis mais service indisponible — pas de « confirme pour lancer ».
 * @param {ReturnType<typeof resolvePdfTextLayerDecision>} decision
 * @param {{ ocrError?: string }} [opts]
 */
export function buildOcrRequiredUnavailableReply(decision = {}, opts = {}) {
  const pages =
    decision.pageCount != null ? ` (${decision.pageCount} page(s))` : "";
  const name = decision.fileName || "document.pdf";
  const err = opts.ocrError ? ` (${opts.ocrError})` : "";
  return [
    `Analyse du document joint : ${name}`,
    "",
    `Décision PDF : couche texte absente${pages} — OCR requis (route ${decision.extractionRoute || "ocr_pipeline"}).`,
    `Le service OCR n'a pas pu produire la transcription${err}.`,
    "Je ne invente pas le texte du scan. Relance avec le service OCR actif (`OCR_SERVICE_URL`), ou fournis un PDF avec couche texte / un export texte.",
  ].join("\n");
}

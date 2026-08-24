/**
 * FILE_ANALYSIS_V1 — restitution PDF partielle (trop long / OCR non exécuté).
 * Ne change pas le rail DOCUMENT. N'invente pas OCR/vision exécutés.
 */

import { FILE_ANALYSIS_CONTRACT_ID } from "../attachment/fileAnalysisContract.js";

export const PDF_PARTIAL_ANALYSIS_RULE = "pdf_partial_file_analysis_v1";
export const PDF_ANALYSIS_STATUS = Object.freeze({
  PARTIAL: "partial",
  COMPLETE: "complete",
});

const CAPABILITY_LEAK_RE =
  /vision_eligible\s*=\s*true|document_analysis_fallback|ocr_eligible\s*=\s*true/i;
const COMPLETE_CLAIM_RE =
  /\banalyse complète\b(?!\s*,\s*pas)|\bOCR complet effectué\b|\bvision exécutée\b/i;
const WEB_AS_EXTRACT_RE =
  /\b(?:pubmed|wikipedia|espacenet|google patents|fiche publique)\b/i;

function asText(value) {
  return String(value || "").trim();
}

/**
 * Texte réellement issu du PDF, sans briefing capacité ni brut UTF-8.
 */
export function extractObservedPdfAttachmentText(doc = {}) {
  const fromMeta = asText(doc?.pdfMeta?.partialText);
  if (fromMeta && !/^%PDF-/i.test(fromMeta)) return fromMeta.slice(0, 4000);

  let raw = asText(doc?.content);
  raw = raw.replace(/DOCUMENT_CAPABILITY:[\s\S]*?(?=\n\[DOCUMENT|\nCONTENU:|\n---|\n\[PDF|$)/gi, "");
  raw = raw.replace(/\[Contenu brut partiel UTF-8[^\]]*\][\s\S]*/gi, "");
  raw = raw.replace(/^\[PDF[^\]]*\]\s*/gm, "");
  raw = raw.replace(/^PDF_STATUS:.*$/gm, "");
  raw = raw.replace(/^PDF_DECISION:.*$/gm, "");
  raw = raw
    .split("\n")
    .filter((line) => {
      if (CAPABILITY_LEAK_RE.test(line)) return false;
      if (/^%PDF-/i.test(line)) return false;
      if (/non fiable pour PDF/i.test(line)) return false;
      return true;
    })
    .join("\n")
    .trim();
  return raw.slice(0, 4000);
}

function resolveTextLayerLabel(pdfDecision = {}, pdfCode, observed) {
  if (pdfCode === "PDF_SCANNED_NO_TEXT") return "absente";
  if (pdfDecision.decision === "text_layer_present") return "présente";
  if (pdfCode === "PDF_TOO_MANY_PAGES") {
    return observed.length >= 32
      ? "partielle (extrait native, fichier trop long pour extraction complète)"
      : "absente ou illisible dans l'extrait native";
  }
  if (pdfDecision.decision === "ocr_required") return "absente";
  return "indéterminée";
}

function resolveOcrLabel({ ocrAttempted, ocrOk, ocrPagesProcessed }) {
  if (ocrAttempted && ocrOk) {
    const pages =
      ocrPagesProcessed != null ? ` (${ocrPagesProcessed} page(s) OCR)` : "";
    return `effectué${pages}`;
  }
  if (ocrAttempted && !ocrOk) return "requis, tentative échouée";
  return "requis, non effectué";
}

/**
 * @param {{
 *   fileName?: string,
 *   ingestedDoc?: object,
 *   pdfDecision?: object,
 *   ocrAttempted?: boolean,
 *   ocrOk?: boolean,
 *   ocrError?: string|null,
 *   ocrPagesProcessed?: number|null,
 *   ocrText?: string,
 * }} input
 */
export function buildPdfCoverageSnapshot(input = {}) {
  const pdfDecision = input.pdfDecision || {};
  const ingestedDoc = input.ingestedDoc || {};
  const fileName =
    input.fileName ||
    pdfDecision.fileName ||
    ingestedDoc.filename ||
    "document.pdf";
  const pdfCode = pdfDecision.pdfCode || ingestedDoc.pdfMeta?.code || null;
  const pageCount =
    pdfDecision.pageCount ?? ingestedDoc.pdfMeta?.pageCount ?? null;
  const ocrAttempted = input.ocrAttempted === true;
  const ocrOk = input.ocrOk === true;
  const observed = ocrOk && asText(input.ocrText)
    ? asText(input.ocrText).slice(0, 4000)
    : extractObservedPdfAttachmentText(ingestedDoc);
  const textLayer = resolveTextLayerLabel(pdfDecision, pdfCode, observed);
  const ocrNeeded =
    pdfDecision.decision === "ocr_required" ||
    pdfCode === "PDF_SCANNED_NO_TEXT" ||
    pdfCode === "PDF_TOO_MANY_PAGES";
  const ocrLabel = ocrNeeded
    ? resolveOcrLabel({
        ocrAttempted,
        ocrOk,
        ocrPagesProcessed: input.ocrPagesProcessed,
      })
    : "non requis";

  let pagesProcessedLabel = "aucune page lisible de façon fiable";
  if (ocrOk && input.ocrPagesProcessed != null) {
    pagesProcessedLabel = `${input.ocrPagesProcessed} page(s) OCR`;
  } else if (observed.length >= 32) {
    pagesProcessedLabel =
      "extrait d'ouverture fourni par l'extracteur (pas le document entier)";
  }

  const fullOcr =
    ocrOk &&
    pageCount != null &&
    input.ocrPagesProcessed != null &&
    Number(input.ocrPagesProcessed) >= Number(pageCount);
  const analysisStatus =
    pdfCode === "PDF_TOO_MANY_PAGES" || (ocrNeeded && !fullOcr)
      ? PDF_ANALYSIS_STATUS.PARTIAL
      : PDF_ANALYSIS_STATUS.COMPLETE;

  return {
    rule: PDF_PARTIAL_ANALYSIS_RULE,
    isPdf: pdfDecision.decision !== "not_pdf" && pdfDecision.decision != null,
    fileName,
    pageCount,
    pdfCode,
    textLayer,
    ocrNeeded,
    ocrAttempted,
    ocrOk,
    ocrExecuted: ocrAttempted && ocrOk,
    ocrError: input.ocrError || null,
    ocrPagesProcessed: input.ocrPagesProcessed ?? null,
    ocrLabel,
    pagesProcessedLabel,
    observedText: observed,
    analysisStatus,
    extractionRoute: pdfDecision.extractionRoute || null,
  };
}

export function shouldDeliverPdfPartialFileAnalysis(snapshot = {}) {
  if (!snapshot?.isPdf) return false;
  if (snapshot.pdfCode === "PDF_TOO_MANY_PAGES") return true;
  if (snapshot.ocrNeeded && !snapshot.ocrExecuted) return true;
  if (
    snapshot.ocrExecuted &&
    snapshot.pageCount != null &&
    snapshot.ocrPagesProcessed != null &&
    Number(snapshot.ocrPagesProcessed) < Number(snapshot.pageCount)
  ) {
    return true;
  }
  return false;
}

function bulletObserved(text) {
  const t = asText(text);
  if (!t) {
    return [
      "- Aucun passage textuel fiable n'est disponible dans l'extrait traité.",
    ];
  }
  const clipped = t.length > 1800 ? `${t.slice(0, 1800).trim()}…` : t;
  return clipped.split(/\n+/).filter(Boolean).slice(0, 24).map((line) => `- ${line.trim()}`);
}

export function formatPdfPartialFileAnalysisReply(snapshot = {}, opts = {}) {
  const query = asText(opts.query);
  const pagesMeta =
    snapshot.pageCount != null
      ? `${snapshot.pageCount} pages selon la métadonnée pipeline`
      : "nombre de pages non fourni par le pipeline";
  const observedBullets = bulletObserved(snapshot.observedText);
  const notCovered = [
    "- Le corps complet du document.",
    "- L'ensemble des revendications, figures, exemples et annexes.",
    "- Toute page au-delà de l'extrait réellement traité.",
    "- Toute information web / fiche publique (non consultée dans ce tour).",
  ];

  return [
    `## Analyse partielle du PDF joint`,
    "",
    `Contrat : \`${FILE_ANALYSIS_CONTRACT_ID}\` · \`analysisStatus = ${PDF_ANALYSIS_STATUS.PARTIAL}\`.`,
    query ? `Demande : ${query}` : "",
    "",
    "### Identification",
    `- Nom : ${snapshot.fileName || "document.pdf"}`,
    "- Type : PDF",
    `- Taille/pages : ${pagesMeta}`,
    `- Couche texte : ${snapshot.textLayer}`,
    `- OCR : ${snapshot.ocrLabel}`,
    `- Couverture réellement analysée : ${snapshot.pagesProcessedLabel}`,
    snapshot.pdfCode ? `- Code extracteur : ${snapshot.pdfCode}` : null,
    "",
    "### Contenu observé",
    "_Source : PDF joint uniquement (`extracted_from_attachment`)._",
    ...observedBullets,
    "",
    "### Non vérifié",
    ...notCovered,
    "",
    "### Statut",
    `- analysisStatus = ${PDF_ANALYSIS_STATUS.PARTIAL}`,
    "- Analyse partielle, pas analyse complète.",
    "- Un plafond de pages ou un OCR requis n'est pas une transcription complète.",
    "- Une capacité éligible (OCR / vision) n'est pas une étape exécutée.",
    "",
    "### Capacité (non exécutée)",
    "- OCR sur l'ensemble des pages : non effectué dans ce tour.",
    "- Recherche web : non effectuée ; aucun contexte externe à fusionner avec l'extrait.",
  ]
    .filter((line) => line != null)
    .join("\n");
}

export function evaluatePdfPartialAnalysisSufficiency({
  reply = "",
  snapshot = {},
  fileName = "",
} = {}) {
  const text = String(reply || "");
  const name = String(fileName || snapshot.fileName || "");
  const reasons = [];
  const checks = {
    attachment_anchored:
      !name || text.toLowerCase().includes(name.slice(0, 18).toLowerCase()),
    page_coverage_declared: /\d+\s*pages?|nombre de pages non fourni/i.test(text),
    extraction_status_truthful:
      !CAPABILITY_LEAK_RE.test(text) &&
      !/\bOCR complet effectué\b/i.test(text) &&
      !/\bvision exécutée\b/i.test(text) &&
      /OCR/i.test(text),
    external_context_separated: !WEB_AS_EXTRACT_RE.test(
      (text.match(/### Contenu observé[\s\S]*?(?=\n### )/i) || [text])[0],
    ),
    inference_marked:
      /Non vérifié/i.test(text) && /extracted_from_attachment|PDF joint uniquement/i.test(text),
    partial_status_consistent: /analysisStatus\s*=\s*partial/i.test(text),
    finalization_complete:
      /### Statut/i.test(text) && /pas analyse complète/i.test(text),
  };

  if (!checks.attachment_anchored) reasons.push("attachment_not_anchored");
  if (!checks.page_coverage_declared) reasons.push("page_coverage_missing");
  if (!checks.extraction_status_truthful) reasons.push("extraction_status_untruthful");
  if (!checks.external_context_separated) reasons.push("external_context_leaked");
  if (!checks.inference_marked) reasons.push("inference_unmarked");
  if (!checks.partial_status_consistent) reasons.push("partial_status_missing");
  if (!checks.finalization_complete) reasons.push("finalization_incomplete");
  if (COMPLETE_CLAIM_RE.test(text) && !/pas analyse complète/i.test(text)) {
    reasons.push("complete_tone");
    checks.partial_status_consistent = false;
  }
  if (snapshot.ocrExecuted !== true && /OCR sur la page d'entrée/i.test(text)) {
    reasons.push("ocr_page_unconfirmed");
    checks.extraction_status_truthful = false;
  }

  return {
    ok: reasons.length === 0,
    reasons,
    checks,
    analysisStatus: PDF_ANALYSIS_STATUS.PARTIAL,
    contract: FILE_ANALYSIS_CONTRACT_ID,
  };
}

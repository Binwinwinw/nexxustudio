/**
 * Contrat de capacités documentaires — inspect → route → message utilisateur aligné.
 * Évite les messages de limitation statiques avant que la pile aval (OCR / vision) puisse s'activer.
 */

export const DOCUMENT_KINDS = Object.freeze({
  NATIVE_TEXT: "native_text",
  SCANNED_PDF: "scanned_pdf",
  PARTIAL_TEXT: "partial_text",
  SKILL_DISABLED: "skill_disabled",
  ERROR: "error",
  UNKNOWN: "unknown",
});

export const EXTRACTION_ROUTES = Object.freeze({
  NATIVE_TEXT: "native_text_extraction",
  OCR: "ocr_pipeline",
  VISION: "vision_pipeline",
  DOCUMENT_ANALYSIS: "document_analysis_fallback",
  LIMITED: "limited",
});

function parseDisabledSkills() {
  return String(process.env.SKILLS_DISABLED || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Capacités plateforme au moment de l'inspection (sans I/O async).
 */
export function resolvePlatformDocumentCapabilities() {
  const disabled = parseDisabledSkills();
  const pdfExtractionEnabled =
    !disabled.includes("skill-pdf-extraction") &&
    process.env.PDF_EXTRACTION_ENABLED !== "false";
  const visionSkillEnabled = !disabled.includes("skill-vision-sota");
  const documentAnalysisEnabled = !disabled.includes("skill-document-analysis");
  const ocrRuntimeFlag =
    process.env.NEXXUS_VISION_OCR === "1" ||
    process.env.NEXXUS_VISION_OCR === "true";

  return {
    pdfNativeExtraction: pdfExtractionEnabled,
    visionPipeline: visionSkillEnabled,
    ocrPipeline: visionSkillEnabled,
    ocrRuntimeExplicit: ocrRuntimeFlag,
    documentAnalysisFallback: documentAnalysisEnabled,
  };
}

/**
 * @param {object} result — retour processPdfAttachment
 */
export function inspectPdfAttachmentResult(result = {}) {
  if (result.ok) {
    return {
      documentKind: DOCUMENT_KINDS.NATIVE_TEXT,
      pdfCode: null,
      nativeTextChars: String(result.text || "").trim().length,
      pageCount: result.pageCount ?? null,
      fileName: result.fileName || null,
    };
  }

  const code = result.code || "UNKNOWN";
  const partialLen = String(result.partialText || "").trim().length;

  if (code === "SKILL_DISABLED") {
    return {
      documentKind: DOCUMENT_KINDS.SKILL_DISABLED,
      pdfCode: code,
      nativeTextChars: 0,
      pageCount: result.pageCount ?? null,
      fileName: result.fileName || null,
    };
  }

  if (code === "PDF_SCANNED_NO_TEXT") {
    return {
      documentKind: DOCUMENT_KINDS.SCANNED_PDF,
      pdfCode: code,
      nativeTextChars: 0,
      pageCount: result.pageCount ?? null,
      fileName: result.fileName || null,
    };
  }

  if (code === "PDF_TOO_MANY_PAGES" && partialLen > 0) {
    return {
      documentKind: DOCUMENT_KINDS.PARTIAL_TEXT,
      pdfCode: code,
      nativeTextChars: partialLen,
      pageCount: result.pageCount ?? null,
      fileName: result.fileName || null,
    };
  }

  return {
    documentKind: DOCUMENT_KINDS.ERROR,
    pdfCode: code,
    nativeTextChars: partialLen,
    pageCount: result.pageCount ?? null,
    fileName: result.fileName || null,
  };
}

/**
 * @param {ReturnType<typeof inspectPdfAttachmentResult>} inspection
 * @param {ReturnType<typeof resolvePlatformDocumentCapabilities>} [platformCaps]
 */
export function buildDocumentCapabilityContract(
  inspection,
  platformCaps = resolvePlatformDocumentCapabilities(),
) {
  const ocrEligible =
    platformCaps.ocrPipeline || platformCaps.ocrRuntimeExplicit;
  const visionEligible = platformCaps.visionPipeline;
  const analysisEligible = platformCaps.documentAnalysisFallback;

  let extractionRoute = EXTRACTION_ROUTES.LIMITED;
  let nativeTextAvailable = false;
  let userFacingLimitation = null;

  switch (inspection.documentKind) {
    case DOCUMENT_KINDS.NATIVE_TEXT:
      extractionRoute = EXTRACTION_ROUTES.NATIVE_TEXT;
      nativeTextAvailable = inspection.nativeTextChars > 0;
      break;

    case DOCUMENT_KINDS.SCANNED_PDF:
      if (ocrEligible || visionEligible) {
        extractionRoute = ocrEligible
          ? EXTRACTION_ROUTES.OCR
          : EXTRACTION_ROUTES.VISION;
      } else if (analysisEligible) {
        extractionRoute = EXTRACTION_ROUTES.DOCUMENT_ANALYSIS;
      } else {
        extractionRoute = EXTRACTION_ROUTES.LIMITED;
        userFacingLimitation = "ocr_and_vision_unavailable";
      }
      break;

    case DOCUMENT_KINDS.PARTIAL_TEXT:
      extractionRoute = analysisEligible
        ? EXTRACTION_ROUTES.DOCUMENT_ANALYSIS
        : EXTRACTION_ROUTES.LIMITED;
      nativeTextAvailable = inspection.nativeTextChars > 0;
      break;

    case DOCUMENT_KINDS.SKILL_DISABLED:
      extractionRoute = analysisEligible
        ? EXTRACTION_ROUTES.DOCUMENT_ANALYSIS
        : EXTRACTION_ROUTES.LIMITED;
      userFacingLimitation = "pdf_extraction_disabled";
      break;

    default:
      extractionRoute = analysisEligible
        ? EXTRACTION_ROUTES.DOCUMENT_ANALYSIS
        : EXTRACTION_ROUTES.LIMITED;
      nativeTextAvailable = inspection.nativeTextChars > 0;
      break;
  }

  return {
    schemaVersion: 1,
    documentKind: inspection.documentKind,
    pdfCode: inspection.pdfCode,
    extractionRoute,
    nativeTextAvailable,
    nativeTextChars: inspection.nativeTextChars,
    pageCount: inspection.pageCount,
    fileName: inspection.fileName,
    capabilities: {
      pdfNativeExtraction: platformCaps.pdfNativeExtraction,
      ocrEligible,
      visionEligible,
      documentAnalysisEligible: analysisEligible,
    },
    userFacingLimitation,
  };
}

/**
 * Message court aligné sur le contrat — jamais « OCR non disponible en v1.0 » si OCR/vision éligibles.
 */
export function formatCapabilityUserMessage(contract) {
  const pages =
    contract.pageCount != null ? ` (${contract.pageCount} page(s))` : "";

  if (contract.documentKind === DOCUMENT_KINDS.NATIVE_TEXT) {
    return `PDF texte natif${pages} — extraction directe réussie.`;
  }

  if (contract.documentKind === DOCUMENT_KINDS.SCANNED_PDF) {
    if (contract.capabilities.ocrEligible || contract.capabilities.visionEligible) {
      const routeLabel = contract.capabilities.ocrEligible
        ? "pipeline OCR"
        : "pipeline vision";
      return (
        `PDF scan/image${pages} — pas de couche texte native exploitable. ` +
        `Extraction directe impossible ; ${routeLabel} et analyse documentaire disponibles en aval.`
      );
    }
    if (contract.capabilities.documentAnalysisEligible) {
      return (
        `PDF scan/image${pages} — pas de couche texte native. ` +
        `Extraction directe impossible ; analyse documentaire structurelle possible.`
      );
    }
    return (
      `PDF scan/image${pages} — pas de couche texte native et aucune capacité OCR/vision activée.`
    );
  }

  if (contract.documentKind === DOCUMENT_KINDS.PARTIAL_TEXT) {
    return (
      `PDF volumineux${pages} — extrait partiel seulement ` +
      `(${contract.nativeTextChars} caractères). Analyse documentaire recommandée.`
    );
  }

  if (contract.documentKind === DOCUMENT_KINDS.SKILL_DISABLED) {
    return "Extraction PDF désactivée — routage analyse documentaire.";
  }

  if (contract.pdfCode) {
    return `Extraction PDF limitée (${contract.pdfCode}) — analyse documentaire si disponible.`;
  }

  return "Document reçu — capacités d'extraction à confirmer.";
}

/**
 * Ligne structurée pour le briefing LLM (contextAgent / document-analysis).
 */
export function formatCapabilityBriefingBlock(contract) {
  const caps = contract.capabilities;
  return [
    "DOCUMENT_CAPABILITY:",
    `kind=${contract.documentKind}`,
    `route=${contract.extractionRoute}`,
    `pdf_code=${contract.pdfCode || "none"}`,
    `native_text=${contract.nativeTextAvailable ? "true" : "false"}`,
    `ocr_eligible=${caps.ocrEligible ? "true" : "false"}`,
    `vision_eligible=${caps.visionEligible ? "true" : "false"}`,
    `document_analysis_eligible=${caps.documentAnalysisEligible ? "true" : "false"}`,
    `message=${formatCapabilityUserMessage(contract)}`,
  ].join(" ");
}

/**
 * Point d'entrée pour processPdfAttachment — enrichit le résultat brut.
 */
export function resolvePdfExtractionContract(pdfResult, platformCaps) {
  const inspection = inspectPdfAttachmentResult(pdfResult);
  const capability = buildDocumentCapabilityContract(inspection, platformCaps);
  const message = formatCapabilityUserMessage(capability);
  return { inspection, capability, message };
}

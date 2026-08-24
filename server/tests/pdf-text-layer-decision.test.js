import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDocumentTranscriptionRequest,
  resolvePdfTextLayerDecision,
  buildOcrRequiredUnavailableReply,
} from "../src/agent/policies/document/pdfTextLayerDecisionPolicy.js";

describe("pdfTextLayerDecisionPolicy", () => {
  it("détecte une demande de transcription", () => {
    assert.equal(
      isDocumentTranscriptionRequest(
        "est ce possible de faire une transcription du fichier joint ?",
      ),
      true,
    );
    assert.equal(isDocumentTranscriptionRequest("résume ce PDF"), false);
  });

  it("décision ocr_required sur PDF scanné", () => {
    const decision = resolvePdfTextLayerDecision([
      {
        filename: "Initiation Teams 365.pdf",
        mimetype: "application/pdf",
        content: "[PDF — PDF_SCANNED_NO_TEXT]",
        pdfMeta: {
          code: "PDF_SCANNED_NO_TEXT",
          fallback: true,
          pageCount: 13,
          capability: {
            documentKind: "scanned_pdf",
            extractionRoute: "ocr_pipeline",
            nativeTextAvailable: false,
            nativeTextChars: 0,
            pageCount: 13,
            fileName: "Initiation Teams 365.pdf",
            pdfCode: "PDF_SCANNED_NO_TEXT",
          },
        },
      },
    ]);
    assert.equal(decision.decision, "ocr_required");
    assert.equal(decision.extractionRoute, "ocr_pipeline");
    assert.equal(decision.nativeTextAvailable, false);
  });

  it("décision text_layer_present sur PDF natif", () => {
    const decision = resolvePdfTextLayerDecision([
      {
        filename: "guide.pdf",
        content: "A".repeat(500),
        pdfMeta: {
          pageCount: 2,
          capability: {
            documentKind: "native_text",
            extractionRoute: "native_text_extraction",
            nativeTextAvailable: true,
            nativeTextChars: 500,
          },
        },
      },
    ]);
    assert.equal(decision.decision, "text_layer_present");
  });

  it("refus OCR sans demander confirmation", () => {
    const reply = buildOcrRequiredUnavailableReply(
      {
        fileName: "scan.pdf",
        pageCount: 13,
        extractionRoute: "ocr_pipeline",
      },
      { ocrError: "ocr_service_url_unset" },
    );
    assert.match(reply, /OCR requis/i);
    assert.match(reply, /couche texte absente/i);
    assert.doesNotMatch(reply, /dis-le-moi|confirme|si tu veux/i);
  });
});

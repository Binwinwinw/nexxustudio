import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  DOCUMENT_KINDS,
  EXTRACTION_ROUTES,
  buildDocumentCapabilityContract,
  formatCapabilityBriefingBlock,
  formatCapabilityUserMessage,
  inspectPdfAttachmentResult,
  resolvePdfExtractionContract,
  resolvePlatformDocumentCapabilities,
} from "../src/agent/policies/documentCapabilityContract.js";
import { processPdfAttachment } from "../src/services/pdf-extractor.js";
import contextAgent from "../src/agent/utils/contextAgent.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

describe("documentCapabilityContract — batterie #27", () => {
  it("PDF texte natif → route native_text_extraction", () => {
    const inspection = inspectPdfAttachmentResult({
      ok: true,
      text: "x".repeat(80),
      pageCount: 3,
      fileName: "rapport.pdf",
    });
    const contract = buildDocumentCapabilityContract(inspection);
    assert.equal(inspection.documentKind, DOCUMENT_KINDS.NATIVE_TEXT);
    assert.equal(contract.extractionRoute, EXTRACTION_ROUTES.NATIVE_TEXT);
    assert.equal(contract.nativeTextAvailable, true);
    assert.match(formatCapabilityUserMessage(contract), /texte natif/i);
  });

  it("PDF scan → route OCR/vision, pas de message « OCR non disponible en v1.0 »", () => {
    const inspection = inspectPdfAttachmentResult({
      ok: false,
      code: "PDF_SCANNED_NO_TEXT",
      pageCount: 12,
      fileName: "Initiation Teams 365.pdf",
    });
    const contract = buildDocumentCapabilityContract(inspection, {
      pdfNativeExtraction: true,
      visionPipeline: true,
      ocrPipeline: true,
      ocrRuntimeExplicit: false,
      documentAnalysisFallback: true,
    });
    assert.equal(inspection.documentKind, DOCUMENT_KINDS.SCANNED_PDF);
    assert.equal(contract.extractionRoute, EXTRACTION_ROUTES.OCR);
    const msg = formatCapabilityUserMessage(contract);
    assert.doesNotMatch(msg, /OCR non disponible en v1\.0/i);
    assert.doesNotMatch(msg, /non disponible en v1/i);
    assert.match(msg, /pipeline OCR/i);
    assert.match(msg, /pas de couche texte native/i);
  });

  it("PDF scan sans vision/OCR → limitation honnête", () => {
    const contract = buildDocumentCapabilityContract(
      inspectPdfAttachmentResult({
        ok: false,
        code: "PDF_SCANNED_NO_TEXT",
        pageCount: 2,
      }),
      {
        pdfNativeExtraction: true,
        visionPipeline: false,
        ocrPipeline: false,
        ocrRuntimeExplicit: false,
        documentAnalysisFallback: true,
      },
    );
    assert.equal(contract.extractionRoute, EXTRACTION_ROUTES.DOCUMENT_ANALYSIS);
    assert.match(
      formatCapabilityUserMessage(contract),
      /analyse documentaire structurelle possible/i,
    );
  });

  it("formatCapabilityBriefingBlock expose ocr_eligible pour le LLM", () => {
    const { capability } = resolvePdfExtractionContract({
      ok: false,
      code: "PDF_SCANNED_NO_TEXT",
      pageCount: 20,
      fileName: "scan.pdf",
    });
    const block = formatCapabilityBriefingBlock(capability);
    assert.match(block, /^DOCUMENT_CAPABILITY:/);
    assert.match(block, /ocr_eligible=true/);
    assert.match(block, /vision_eligible=true/);
    assert.match(block, /route=ocr_pipeline/);
  });

  it("resolvePlatformDocumentCapabilities respecte SKILLS_DISABLED", () => {
    const prev = process.env.SKILLS_DISABLED;
    process.env.SKILLS_DISABLED = "skill-vision-sota";
    const caps = resolvePlatformDocumentCapabilities();
    process.env.SKILLS_DISABLED = prev ?? "";
    assert.equal(caps.visionPipeline, false);
    assert.equal(caps.ocrPipeline, false);
  });
});

describe("documentCapabilityContract — intégration pdf-extractor + contextAgent", () => {
  it("processPdfAttachment scan enrichit capability (plus de v1.0 figé)", async () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, "scanned-empty.pdf"));
    const result = await processPdfAttachment(buffer, "scan.pdf", buffer.length);
    assert.equal(result.code, "PDF_SCANNED_NO_TEXT");
    assert.ok(result.capability);
    assert.equal(result.capability.documentKind, DOCUMENT_KINDS.SCANNED_PDF);
    assert.doesNotMatch(result.message, /OCR non disponible en v1\.0/i);
    assert.match(result.message, /pipeline OCR|pipeline vision|analyse documentaire/i);
  });

  it("contextAgent briefing inclut DOCUMENT_CAPABILITY pour PDF scan", async () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, "scanned-empty.pdf"));
    const out = await contextAgent.ingest([
      {
        originalname: "Initiation Teams 365.pdf",
        mimetype: "application/pdf",
        buffer,
        size: buffer.length,
      },
    ]);
    assert.ok(out?.briefing?.includes("DOCUMENT_CAPABILITY"));
    assert.ok(out?.briefing?.includes("ocr_eligible=true"));
    assert.doesNotMatch(out.briefing, /OCR non disponible en v1\.0/i);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPdfCoverageSnapshot,
  shouldDeliverPdfPartialFileAnalysis,
  formatPdfPartialFileAnalysisReply,
  evaluatePdfPartialAnalysisSufficiency,
  extractObservedPdfAttachmentText,
  PDF_ANALYSIS_STATUS,
} from "../src/agent/policies/document/pdfPartialAnalysisPolicy.js";
import { resolvePdfTextLayerDecision } from "../src/agent/policies/document/pdfTextLayerDecisionPolicy.js";
import { classifyAttachmentTask, ATTACHMENT_TASKS } from "../src/agent/policies/attachment/index.js";
import {
  classifyFileCapability,
  shouldBlockFileCapability,
  FILE_CAPABILITY_MAX_BYTES,
  FILE_CAPABILITY_STATUSES,
  FILE_CAPABILITY_CODES,
} from "../src/agent/policies/attachment/fileCapabilityPolicy.js";
import { FILE_ANALYSIS_CONTRACT_ID } from "../src/agent/policies/attachment/fileAnalysisContract.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

const EP_DOC = {
  filename: "EP1694829B1.pdf",
  mimetype: "application/pdf",
  content: [
    "[PDF — PDF volumineux — extrait partiel seulement]",
    "DOCUMENT_CAPABILITY: kind=partial_text route=document_analysis_fallback pdf_code=PDF_TOO_MANY_PAGES ocr_eligible=true vision_eligible=true",
    "PCT/FR2004/003106",
    "[Contenu brut partiel UTF-8 — non fiable pour PDF]",
    "%PDF-1.4 binary junk",
  ].join("\n"),
  pdfMeta: {
    code: "PDF_TOO_MANY_PAGES",
    fallback: true,
    pageCount: 320,
    partialText: "EP 1 694 829 B1\nInstitut Pasteur\nPCT/FR2004/003106",
    capability: {
      documentKind: "partial_text",
      extractionRoute: "document_analysis_fallback",
      nativeTextAvailable: true,
      nativeTextChars: 80,
      pageCount: 320,
      fileName: "EP1694829B1.pdf",
      pdfCode: "PDF_TOO_MANY_PAGES",
      capabilities: { ocrEligible: true, visionEligible: true },
    },
  },
};

describe("PDF partial FILE_ANALYSIS — trop volumineux upload", () => {
  it("refuse sécurité au-dessus de 10 Mo, aucune analyse", () => {
    const cap = classifyFileCapability(
      {
        originalname: "brevet.pdf",
        mimetype: "application/pdf",
        size: FILE_CAPABILITY_MAX_BYTES.chat + 1,
        buffer: Buffer.from("%PDF-1.4\n"),
      },
      { channel: "chat" },
    );
    assert.equal(cap.status, FILE_CAPABILITY_STATUSES.REJECT);
    assert.equal(shouldBlockFileCapability(cap, "chat"), true);
    assert.ok(cap.codes.includes(FILE_CAPABILITY_CODES.SIZE));
  });
});

describe("PDF partial FILE_ANALYSIS — 320 pages sans OCR exécuté", () => {
  it("doc_analyze inchangé + intercept partial DOCUMENT", () => {
    const task = classifyAttachmentTask("fait une analyse du document joint", [
      { originalname: "EP1694829B1.pdf" },
    ]);
    assert.equal(task.task, ATTACHMENT_TASKS.DOC_ANALYZE);

    const pdfDecision = resolvePdfTextLayerDecision([EP_DOC]);
    const snapshot = buildPdfCoverageSnapshot({
      fileName: "EP1694829B1.pdf",
      ingestedDoc: EP_DOC,
      pdfDecision,
      ocrAttempted: false,
      ocrOk: false,
    });
    assert.equal(shouldDeliverPdfPartialFileAnalysis(snapshot), true);
    assert.equal(snapshot.analysisStatus, PDF_ANALYSIS_STATUS.PARTIAL);
    assert.equal(snapshot.pageCount, 320);
    assert.match(snapshot.ocrLabel, /non effectué/i);

    const reply = formatPdfPartialFileAnalysisReply(snapshot, {
      query: "fait une analyse du document joint",
    });
    const critic = evaluatePdfPartialAnalysisSufficiency({
      reply,
      snapshot,
      fileName: "EP1694829B1.pdf",
    });
    assert.equal(critic.ok, true, critic.reasons.join(","));
    assert.equal(critic.checks.attachment_anchored, true);
    assert.equal(critic.checks.page_coverage_declared, true);
    assert.equal(critic.checks.extraction_status_truthful, true);
    assert.equal(critic.checks.external_context_separated, true);
    assert.equal(critic.checks.inference_marked, true);
    assert.equal(critic.checks.partial_status_consistent, true);
    assert.equal(critic.checks.finalization_complete, true);

    assert.match(reply, /FILE_ANALYSIS_V1/);
    assert.match(reply, /analysisStatus = partial/);
    assert.match(reply, /320 pages/);
    assert.match(reply, /PCT\/FR2004\/003106/);
    assert.doesNotMatch(reply, /vision_eligible/);
    assert.doesNotMatch(reply, /document_analysis_fallback/);
    assert.doesNotMatch(reply, /pubmed/i);
    assert.doesNotMatch(reply, /OCR complet effectué/i);
    assert.doesNotMatch(reply, /OCR sur la page d'entrée/i);
    assert.doesNotMatch(reply, /analyse complète du brevet/i);
    assert.match(reply, /pas analyse complète/);
    assert.match(reply, /Capacité \(non exécutée\)/);
  });

  it("n'utilise pas le dump capacité comme contenu observé", () => {
    const observed = extractObservedPdfAttachmentText(EP_DOC);
    assert.match(observed, /Institut Pasteur/);
    assert.doesNotMatch(observed, /vision_eligible/);
    assert.doesNotMatch(observed, /%PDF-1\.4/);
  });
});

describe("PDF texte normal — pas d'intercept partial", () => {
  it("simple.pdf couche native → pas de FILE_ANALYSIS partial", () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, "simple.pdf"));
    const snapshot = buildPdfCoverageSnapshot({
      fileName: "simple.pdf",
      ingestedDoc: {
        filename: "simple.pdf",
        content: "A".repeat(500),
        pdfMeta: {
          pageCount: 1,
          capability: {
            documentKind: "native_text",
            extractionRoute: "native_text_extraction",
            nativeTextAvailable: true,
            nativeTextChars: 500,
          },
        },
      },
      pdfDecision: resolvePdfTextLayerDecision([
        {
          filename: "simple.pdf",
          content: "A".repeat(500),
          pdfMeta: {
            pageCount: 1,
            capability: {
              documentKind: "native_text",
              extractionRoute: "native_text_extraction",
              nativeTextAvailable: true,
              nativeTextChars: 500,
            },
          },
        },
      ]),
    });
    assert.equal(shouldDeliverPdfPartialFileAnalysis(snapshot), false);
    assert.ok(buffer.length > 0);
    assert.equal(snapshot.analysisStatus, PDF_ANALYSIS_STATUS.COMPLETE);
  });
});

describe("PDF partial — web ne fuit pas dans l'extrait", () => {
  it("une réponse qui présente PubMed comme extrait PDF échoue le critique", () => {
    const snapshot = buildPdfCoverageSnapshot({
      fileName: "EP1694829B1.pdf",
      ingestedDoc: EP_DOC,
      pdfDecision: resolvePdfTextLayerDecision([EP_DOC]),
    });
    const honest = formatPdfPartialFileAnalysisReply(snapshot, { query: "analyse" });
    const leaked = honest.replace(
      "### Contenu observé",
      "### Contenu observé\nVu sur PubMed en 2003 : protéine Nucleocapsidique.",
    );
    const critic = evaluatePdfPartialAnalysisSufficiency({
      reply: leaked,
      snapshot,
      fileName: "EP1694829B1.pdf",
    });
    assert.equal(critic.ok, false);
    assert.ok(critic.reasons.includes("external_context_leaked"));
  });
});

describe("contrat FILE_ANALYSIS_V1 inchangé pour le stamp", () => {
  it("la sortie partial porte le contrat existant", () => {
    const snapshot = buildPdfCoverageSnapshot({
      fileName: "EP1694829B1.pdf",
      ingestedDoc: EP_DOC,
      pdfDecision: resolvePdfTextLayerDecision([EP_DOC]),
    });
    const reply = formatPdfPartialFileAnalysisReply(snapshot);
    assert.match(reply, new RegExp(FILE_ANALYSIS_CONTRACT_ID));
  });
});

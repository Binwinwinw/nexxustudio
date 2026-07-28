import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DOCUMENT_DATETIME_CANONICAL_QUERY,
  detectDocumentAnalysisIntent,
  isDocumentAnalysisSegment,
  isDatetimeCompoundSegment,
  shouldAppendDatetimeToDocumentAnalysis,
  splitNumberedTaskSegments,
} from "../src/agent/policies/documentAnalysisCompositePolicy.js";
import {
  understandQuery,
  buildDatetimeSectionsFromUnderstanding,
  mergeDocumentAnalysisWithDatetimeSections,
  splitQuerySegments,
} from "../src/agent/policies/conversationQueryUnderstanding.js";

describe("documentAnalysisCompositePolicy — G29.2 segmentation", () => {
  it("splitNumberedTaskSegments — 2 tâches numérotées", () => {
    const parts = splitNumberedTaskSegments(DOCUMENT_DATETIME_CANONICAL_QUERY);
    assert.equal(parts.length, 2);
    assert.match(parts[0], /analyse le fichier joint/i);
    assert.match(parts[1], /date du jour/i);
    assert.match(parts[1], /heure/i);
  });

  it("isDatetimeCompoundSegment — date + heure dans un segment", () => {
    assert.equal(
      isDatetimeCompoundSegment(
        "quelle est la date du jour et quelle heure est il actuellement ?",
      ),
      true,
    );
  });

  it("detectDocumentAnalysisIntent — analyse fichier joint", () => {
    assert.equal(isDocumentAnalysisSegment("analyse le fichier joint"), true);
    const intent = detectDocumentAnalysisIntent("analyse le fichier joint");
    assert.equal(intent?.path, "DOCUMENT");
    assert.equal(intent?.satisfiable, false);
  });
});

describe("documentAnalysisCompositePolicy — G29.2 understanding", () => {
  it("understandQuery — document_analysis + datetime", () => {
    const u = understandQuery(DOCUMENT_DATETIME_CANONICAL_QUERY);
    assert.equal(u.intentMode, "multi_intent");
    assert.ok(u.workIntentCount >= 2);
    assert.ok(u.domains.includes("document_analysis"));
    assert.ok(u.domains.includes("datetime"));
    assert.equal(u.responseStrategy, "document_datetime_hybrid");
    assert.equal(u.unqualifiedSegmentCount, 0);
  });

  it("splitQuerySegments — ne coupe pas date+heure sur et faible", () => {
    const segments = splitQuerySegments(DOCUMENT_DATETIME_CANONICAL_QUERY);
    assert.equal(segments.length, 2);
    assert.match(segments[1], /date du jour.*heure/i);
  });

  it("buildDatetimeSectionsFromUnderstanding — sections date/heure", () => {
    const u = understandQuery(DOCUMENT_DATETIME_CANONICAL_QUERY);
    const block = buildDatetimeSectionsFromUnderstanding(u);
    assert.match(block, /\*\*Date\s*:/i);
    assert.match(block, /\*\*Heure\s*:/i);
  });

  it("mergeDocumentAnalysisWithDatetimeSections", () => {
    const u = understandQuery(DOCUMENT_DATETIME_CANONICAL_QUERY);
    const merged = mergeDocumentAnalysisWithDatetimeSections(
      "## Analyse README\nContenu synthétisé.",
      u,
    );
    assert.match(merged, /Analyse README/i);
    assert.match(merged, /\*\*Date\s*:/i);
    assert.match(merged, /\*\*Heure\s*:/i);
  });

  it("shouldAppendDatetimeToDocumentAnalysis", () => {
    const u = understandQuery(DOCUMENT_DATETIME_CANONICAL_QUERY);
    assert.equal(shouldAppendDatetimeToDocumentAnalysis(u), true);
  });
});

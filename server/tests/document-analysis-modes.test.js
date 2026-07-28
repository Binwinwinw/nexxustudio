import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalysisUserQuery,
  resolveDocumentAnalysisMode,
} from "../src/services/document-analysis/documentAnalysisModes.js";

describe("documentAnalysisModes", () => {
  it("résout le mode summary par défaut", () => {
    assert.equal(resolveDocumentAnalysisMode("unknown").id, "summary");
  });

  it("construit une requête QA avec question", () => {
    const q = buildAnalysisUserQuery("qa", "Quels sont les risques ?");
    assert.match(q, /Quels sont les risques/);
  });

  it("construit une requête extract", () => {
    const q = buildAnalysisUserQuery("extract");
    assert.match(q, /points clés/i);
  });
});

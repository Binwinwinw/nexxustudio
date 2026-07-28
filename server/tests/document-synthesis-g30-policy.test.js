import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DOCUMENT_SYNTHESIS_DATETIME_CANONICAL_QUERY,
  detectDocumentSynthesisIntent,
  isDocumentSynthesisSegment,
  shouldAppendDatetimeToDocumentSynthesis,
} from "../src/agent/policies/documentSynthesisCompositePolicy.js";
import {
  understandQuery,
  buildExecutionPlan,
  resolveQueryCompositeShortCircuit,
  shouldAppendDatetimeToDocumentWork,
  mergeDocumentAnalysisWithDatetimeSections,
} from "../src/agent/policies/conversationQueryUnderstanding.js";
import { buildMissingSourceClarifyReply } from "../src/agent/policies/documentSynthesisPolicy.js";

describe("documentSynthesisCompositePolicy — G30.1 détection", () => {
  it("isDocumentSynthesisSegment — résumé texte WWII", () => {
    assert.equal(
      isDocumentSynthesisSegment("Résume ce texte sur la Seconde Guerre mondiale."),
      true,
    );
  });

  it("isDocumentSynthesisSegment — idées principales", () => {
    assert.equal(isDocumentSynthesisSegment("donne-moi les idées principales"), true);
  });

  it("detectDocumentSynthesisIntent — missing source → clarify", () => {
    const intent = detectDocumentSynthesisIntent("Résume ce texte");
    assert.equal(intent?.path, "document_synthesis_clarify");
    assert.equal(intent?.strategy, "partial_clarify");
    assert.equal(intent?.reply, buildMissingSourceClarifyReply());
    assert.equal(intent?.satisfiable, true);
  });
});

describe("documentSynthesisCompositePolicy — G30.1 understanding", () => {
  it("understandQuery — C1 single document_synthesis", () => {
    const u = understandQuery("Résume ce texte sur la Seconde Guerre mondiale.");
    assert.equal(u.intentMode, "single_intent");
    assert.equal(u.primaryDomain, "document_synthesis");
    assert.equal(u.responseStrategy, "partial_clarify");
    assert.equal(u.unqualifiedSegmentCount, 0);
  });

  it("understandQuery — C4 composite synthesis + datetime", () => {
    const u = understandQuery(DOCUMENT_SYNTHESIS_DATETIME_CANONICAL_QUERY);
    assert.equal(u.intentMode, "multi_intent");
    assert.ok(u.domains.includes("document_synthesis"));
    assert.ok(u.domains.includes("datetime"));
    assert.equal(u.responseStrategy, "document_datetime_hybrid");
    assert.equal(u.unqualifiedSegmentCount, 0);
  });

  it("shouldAppendDatetimeToDocumentSynthesis / Work", () => {
    const u = understandQuery(DOCUMENT_SYNTHESIS_DATETIME_CANONICAL_QUERY);
    assert.equal(shouldAppendDatetimeToDocumentSynthesis(u), true);
    assert.equal(shouldAppendDatetimeToDocumentWork(u), true);
  });

  it("resolveQueryCompositeShortCircuit — clarify + date", () => {
    const hit = resolveQueryCompositeShortCircuit(DOCUMENT_SYNTHESIS_DATETIME_CANONICAL_QUERY);
    assert.ok(hit?.reply);
    assert.match(hit.reply, /passage|document/i);
    assert.match(hit.reply, /\*\*Date\s*:/i);
  });

  it("buildExecutionPlan — deux steps C4", () => {
    const plan = buildExecutionPlan(understandQuery(DOCUMENT_SYNTHESIS_DATETIME_CANONICAL_QUERY));
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.composite, true);
  });

  it("mergeDocumentAnalysisWithDatetimeSections — hybrid bloc", () => {
    const u = understandQuery(DOCUMENT_SYNTHESIS_DATETIME_CANONICAL_QUERY);
    const merged = mergeDocumentAnalysisWithDatetimeSections("**Synthèse**\nPoints clés.", u);
    assert.match(merged, /Synthèse/i);
    assert.match(merged, /\*\*Date\s*:/i);
  });
});

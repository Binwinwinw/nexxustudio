import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  isDocumentFollowUpIntent,
  classifyDocumentFollowUpKind,
} from "../src/agent/micro/continuity/documentFollowUpGuards.js";
import {
  buildDocumentBriefing,
  buildDocumentBriefingFromAnalysisOnly,
} from "../src/agent/micro/continuity/documentBriefingEncoder.js";
import {
  inferDocumentStateFromHistory,
  resolveDocumentContinuity,
  buildDocumentFollowUpContextBlock,
  DOCUMENT_CONTINUITY_RULE,
} from "../src/agent/micro/continuity/documentContinuityContext.js";
import {
  recordActiveDocumentAnalysis,
  getActiveDocumentContext,
  getActiveDocumentBriefing,
  resetDocumentTurnStateForTests,
} from "../src/agent/micro/continuity/documentTurnState.js";

const SAMPLE_ANALYSIS = `## Type de fichier
text/css

## Points clés
- body: margin reset
- .wrapper: layout flex`;

const SAMPLE_BRIEFING = buildDocumentBriefing({
  fileName: "mon_css.css",
  mimeType: "text/css",
  sourceContent: "body{margin:0}\n.wrapper{display:flex}",
  analysisText: SAMPLE_ANALYSIS,
});

beforeEach(() => {
  resetDocumentTurnStateForTests();
});

describe("documentFollowUpGuards", () => {
  it("détecte les marqueurs de suivi documentaire", () => {
    assert.equal(
      isDocumentFollowUpIntent("tu peux proposer des améliorations ?"),
      true,
    );
    assert.equal(
      isDocumentFollowUpIntent("montre-moi le bloc concerné"),
      true,
    );
    assert.equal(isDocumentFollowUpIntent("quelle heure est-il ?"), false);
  });

  it("classifie le kind improvement", () => {
    assert.equal(
      classifyDocumentFollowUpKind("proposer des améliorations CSS"),
      "improvement",
    );
  });
});

describe("inferDocumentStateFromHistory", () => {
  it("reconstruit un briefing encodé depuis une analyse assistant", () => {
    const history = [
      { role: "user", content: "analyse mon_css.css joint" },
      { role: "assistant", content: SAMPLE_ANALYSIS },
    ];
    const inferred = inferDocumentStateFromHistory(history);
    assert.ok(inferred?.wasAnalyzed);
    assert.equal(inferred.documentBriefing.analysisRichness, "analysis_only");
    assert.equal(inferred.fileName, "mon_css.css");
  });
});

describe("resolveDocumentContinuity", () => {
  it("active follow-up avec document_briefing session-scoped", () => {
    recordActiveDocumentAnalysis({
      sessionId: "sess-1",
      documentBriefing: SAMPLE_BRIEFING,
      lastAnalysisExcerpt: SAMPLE_ANALYSIS,
    });

    const resolved = resolveDocumentContinuity({
      sessionId: "sess-1",
      query: "propose des améliorations sur ce fichier",
      history: [],
      attachedFiles: [],
    });

    assert.equal(resolved.shouldRunFollowUp, true);
    assert.equal(resolved.fileName, "mon_css.css");
    assert.ok(resolved.documentBriefing?.keyBlocks?.length);
    assert.equal(resolved.rule, DOCUMENT_CONTINUITY_RULE);
  });

  it("refuse follow-up sans analyse antérieure", () => {
    const resolved = resolveDocumentContinuity({
      sessionId: "sess-2",
      query: "propose des améliorations",
      history: [],
      attachedFiles: [],
    });
    assert.equal(resolved.shouldRunFollowUp, false);
  });

  it("utilise l'historique si le store session est vide", () => {
    const history = [
      { role: "user", content: "analyse mon_css.css" },
      { role: "assistant", content: SAMPLE_ANALYSIS },
    ];
    const resolved = resolveDocumentContinuity({
      sessionId: null,
      query: "améliore ce code",
      history,
      attachedFiles: [],
    });
    assert.equal(resolved.shouldRunFollowUp, true);
    assert.equal(resolved.fromHistory, true);
  });

  it("signale needs_raw_reingest pour citation exacte sans source", () => {
    recordActiveDocumentAnalysis({
      sessionId: "sess-3",
      documentBriefing: buildDocumentBriefingFromAnalysisOnly(SAMPLE_ANALYSIS, "mon_css.css"),
      lastAnalysisExcerpt: SAMPLE_ANALYSIS,
    });
    const resolved = resolveDocumentContinuity({
      sessionId: "sess-3",
      query: "cite exactement le bloc .wrapper",
      history: [],
      attachedFiles: [],
    });
    assert.equal(resolved.shouldRunFollowUp, false);
    assert.equal(resolved.needsRawReingest, true);
  });
});

describe("buildDocumentFollowUpContextBlock", () => {
  it("sérialise l'artefact encodé (pas le blob brut)", () => {
    const block = buildDocumentFollowUpContextBlock({
      fileName: "mon_css.css",
      documentBriefing: SAMPLE_BRIEFING,
    });
    assert.match(block, /ARTEFACT DE LECTURE/);
    assert.match(block, /document_briefing/);
    assert.match(block, /mon_css.css/);
    assert.doesNotMatch(block, /CONTENU SOURCE \(extrait\)/);
  });
});

describe("documentTurnState", () => {
  it("persiste documentBriefing sans briefingExcerpt brut", () => {
    recordActiveDocumentAnalysis({
      sessionId: "abc",
      fileName: "styles.css",
      sourceContent: ".a{color:red}",
      lastAnalysisExcerpt: "## Points clés\n- .a",
    });
    const ctx = getActiveDocumentContext("abc");
    const briefing = getActiveDocumentBriefing("abc");
    assert.equal(ctx.fileName, "styles.css");
    assert.equal(ctx.followUpEligible, true);
    assert.ok(briefing?.documentId?.startsWith("sha256:"));
    assert.equal(briefing.analysisRichness, "full");
  });
});

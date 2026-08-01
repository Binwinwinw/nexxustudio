import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isCulturalContentSummaryRequest,
  extractCulturalSummarySubject,
  suppressesDocumentSynthesisForCulturalSummary,
} from "../src/agent/policies/summary/index.js";
import { isGeneralKnowledgeRequest } from "../src/agent/utils/generalKnowledgeIntentGuards.js";
import { hasDocumentSynthesisShell, isDocumentSynthesisExcluded } from "../src/agent/policies/documentSynthesisPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { resolveGeneralKnowledgeShortCircuit } from "../src/agent/micro/replies/generalKnowledgeComposerContract.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isPresentationOutlineRequest } from "../src/agent/utils/presentationOutlineIntentGuards.js";

const INTERSTELLAR_QUERY =
  "pourrais tu faire un résumé du film interstellar ?";

const PASTED_PASSAGE_QUERY = `Résume ce passage :

La Révolution française commence en 1789. Les États généraux se réunissent à Versailles.`;

describe("G37 cultural_content_summary — détection", () => {
  it("détecte résumé de film nommé", () => {
    assert.equal(isCulturalContentSummaryRequest(INTERSTELLAR_QUERY), true);
    assert.equal(extractCulturalSummarySubject(INTERSTELLAR_QUERY), "interstellar");
    assert.equal(isGeneralKnowledgeRequest(INTERSTELLAR_QUERY), true);
  });

  it("ne confond pas avec document_synthesis", () => {
    assert.equal(hasDocumentSynthesisShell(INTERSTELLAR_QUERY), true);
    assert.equal(isDocumentSynthesisExcluded(INTERSTELLAR_QUERY), true);
    assert.equal(suppressesDocumentSynthesisForCulturalSummary(INTERSTELLAR_QUERY), true);
  });

  it("conserve document_synthesis pour passage collé", () => {
    assert.equal(isCulturalContentSummaryRequest(PASTED_PASSAGE_QUERY), false);
    assert.equal(isDocumentSynthesisExcluded(PASTED_PASSAGE_QUERY), false);
  });

  it("pas presentation_outline", () => {
    assert.equal(isPresentationOutlineRequest(INTERSTELLAR_QUERY), false);
  });
});

describe("G37 cultural_content_summary — routage", () => {
  it("short-circuit → cultural_content_summary SIMPLE_FAST, pas document_synthesis_clarify", async () => {
    const hit = await runConversationShortCircuit(INTERSTELLAR_QUERY);
    assert.ok(hit, "short-circuit attendu");
    assert.equal(hit.path, "cultural_content_summary");
    assert.equal(hit.deferToLlm, true);
    assert.notEqual(hit.deferToFullPipeline, true);
    assert.equal(hit.culturalContentSummary, true);
    assert.ok(hit.reflectiveHint?.includes("interstellar"));
  });

  it("resolveGeneralKnowledgeShortCircuit sans full pipeline", () => {
    const resolved = resolveGeneralKnowledgeShortCircuit(INTERSTELLAR_QUERY);
    assert.equal(resolved?.path, "cultural_content_summary");
    assert.equal(resolved?.deferToLlm, true);
    assert.notEqual(resolved?.deferToFullPipeline, true);
  });

  it("clarification gate → can_answer_now", () => {
    const evaluation = evaluateJustIntent(INTERSTELLAR_QUERY);
    const decision = evaluateClarificationDecision(INTERSTELLAR_QUERY, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("cultural_content_summary_g37"));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCodeReviewRequest } from "../src/agent/policies/code/codeReviewPolicy.js";
import { isCodeIntentRequest } from "../src/agent/policies/code/codeIntentPolicy.js";
import { isDocumentAnalysisIntent } from "../src/agent/utils/conversationGuards.js";
import { isAnalyticalCritiqueIntent } from "../src/agent/utils/analyticalCritiqueIntentGuards.js";
import {
  enforceCodeReviewPipelineDelivery,
} from "../src/agent/policies/code/codeReviewRuntimeGuard.js";
import {
  CODE_REVIEW_PRODUCTION_BUG_QUERIES,
  NEXXUS_FAILED_REVIEW_SAMPLES,
} from "./fixtures/codeReviewGoldenQueries.js";

function wouldRouteToDocumentAnalysis(query, attachments = []) {
  const wantsAnalysis = isDocumentAnalysisIntent(query, attachments);
  const isAnalyticalCritique = isAnalyticalCritiqueIntent(query, attachments);
  const wordsCount = String(query || "").toLowerCase().trim().split(/\s+/).length;
  const isLongText = wordsCount > 30;
  const containsUrl = !!String(query || "").match(/https?:\/\/[^\s]+/g);
  const hasAttachedDocs = false;

  return (
    wantsAnalysis &&
    !isAnalyticalCritique &&
    !isCodeIntentRequest(query) &&
    (containsUrl || isLongText || hasAttachedDocs)
  );
}

describe("codeReviewPipelineRouting", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("détecte la requête calculatrice comme revue de code", () => {
    assert.equal(isCodeReviewRequest(scenario.query), true);
  });

  it("n'envoie pas la calculatrice vers Document Analysis (fuite historique)", () => {
    assert.equal(isDocumentAnalysisIntent(scenario.query), false);
    assert.equal(wouldRouteToDocumentAnalysis(scenario.query), false);
  });

  it("bloque en pipeline une réponse borderline « Points clés »", () => {
    const delivery = enforceCodeReviewPipelineDelivery(
      scenario.query,
      NEXXUS_FAILED_REVIEW_SAMPLES.tour1_borderline_name_only,
    );
    assert.equal(delivery.ok, false);
    assert.equal(delivery.action, "blocked");
    assert.match(delivery.delivered, /CODE_REVIEW_V1_1/);
    assert.match(delivery.delivered, /erreurs bloquantes/i);
  });

  it("bloque en pipeline le tour 1 résumé sans erreurs", () => {
    const delivery = enforceCodeReviewPipelineDelivery(
      scenario.query,
      NEXXUS_FAILED_REVIEW_SAMPLES.tour1_resume_sans_erreurs,
    );
    assert.equal(delivery.ok, false);
    assert.equal(delivery.action, "blocked");
    assert.ok(
      delivery.failures.some((f) => f.id === "mustLeadWithBlockingErrors"),
    );
  });

  it("laisse passer la golden response", () => {
    const delivery = enforceCodeReviewPipelineDelivery(
      scenario.query,
      scenario.goldenResponse,
    );
    assert.equal(delivery.ok, true);
    assert.equal(delivery.action, "passed");
    assert.equal(delivery.delivered, scenario.goldenResponse);
  });
});

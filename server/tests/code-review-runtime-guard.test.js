import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCodeReviewScenario,
  buildCodeReviewReaskPrompt,
  buildCodeReviewBlockedMessage,
  evaluateCodeReviewRuntime,
  applyCodeReviewRuntimeGuard,
  enforceCodeReviewPipelineDelivery,
  validatePythonFencesWithPyCompile,
  MAX_CODE_REVIEW_RUNTIME_RETRIES,
} from "../src/agent/policies/code/codeReviewRuntimeGuard.js";
import {
  CODE_REVIEW_PRODUCTION_BUG_QUERIES,
  NEXXUS_FAILED_REVIEW_SAMPLES,
} from "./fixtures/codeReviewGoldenQueries.js";

describe("codeReviewRuntimeGuard", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("expose un retry maximal de 1", () => {
    assert.equal(MAX_CODE_REVIEW_RUNTIME_RETRIES, 1);
  });

  it("construit un scénario dynamique pour Python", () => {
    const built = buildCodeReviewScenario(scenario.query);
    assert.equal(built.language, "python");
    assert.equal(built.sentinels.mustLeadWithBlockingErrors, true);
    assert.ok(built.analysisMustFlag.some((f) => f.includes("__name__")));
  });

  it("valide la golden response", () => {
    const evalResult = evaluateCodeReviewRuntime({
      query: scenario.query,
      response: scenario.goldenResponse,
    });
    assert.equal(evalResult.ok, true, JSON.stringify(evalResult.failures));
  });

  it("rejette le tour 1 (résumé sans erreurs bloquantes)", () => {
    const evalResult = evaluateCodeReviewRuntime({
      query: scenario.query,
      response: NEXXUS_FAILED_REVIEW_SAMPLES.tour1_resume_sans_erreurs,
    });
    assert.equal(evalResult.ok, false);
    assert.ok(
      evalResult.failures.some((f) => f.id === "mustLeadWithBlockingErrors"),
    );
  });

  it("rejette le tour borderline (erreurs mentionnées mais pas en tête)", () => {
    const evalResult = evaluateCodeReviewRuntime({
      query: scenario.query,
      response: NEXXUS_FAILED_REVIEW_SAMPLES.tour1_borderline_name_only,
    });
    assert.equal(evalResult.ok, false);
    assert.ok(
      evalResult.failures.some((f) => f.id === "mustLeadWithBlockingErrors"),
    );
  });

  it("demande un retry avec violations ciblées", () => {
    const guard = applyCodeReviewRuntimeGuard({
      query: scenario.query,
      response: NEXXUS_FAILED_REVIEW_SAMPLES.tour1_resume_sans_erreurs,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.shouldRetry, true);
    assert.match(guard.reaskPrompt, /GARDE-FOU REVUE DE CODE/);
    assert.match(guard.reaskPrompt, /mustLeadWithBlockingErrors|mustFlagCriticalIssues|structure/);
  });

  it("produit un reask listant les échecs", () => {
    const prompt = buildCodeReviewReaskPrompt([
      { id: "mustLeadWithBlockingErrors", reason: "résumé en tête" },
    ]);
    assert.match(prompt, /mustLeadWithBlockingErrors/);
    assert.match(prompt, /résumé en tête/);
  });

  it("produit un message de blocage explicite", () => {
    const blocked = buildCodeReviewBlockedMessage(scenario.query, [
      { id: "mustLeadWithBlockingErrors", reason: "Points clés en tête" },
    ]);
    assert.match(blocked, /CODE_REVIEW_V1_1/);
    assert.match(blocked, /erreurs bloquantes/);
    assert.match(blocked, /Points clés en tête/);
  });

  it("ignore les requêtes non-revue", () => {
    const evalResult = evaluateCodeReviewRuntime({
      query: "Bonjour",
      response: "Salut !",
    });
    assert.equal(evalResult.skipped, true);
    assert.equal(evalResult.ok, true);
  });

  it("valide la syntaxe Python de la golden fence", () => {
    const pyResult = validatePythonFencesWithPyCompile(scenario.goldenResponse);
    assert.equal(pyResult.pass, true);
  });

  it("enforceCodeReviewPipelineDelivery bloque sans retry", () => {
    const blocked = enforceCodeReviewPipelineDelivery(
      scenario.query,
      NEXXUS_FAILED_REVIEW_SAMPLES.tour1_borderline_name_only,
    );
    assert.equal(blocked.action, "blocked");
    assert.equal(blocked.ok, false);
  });

  it("rejette une fence Python syntaxiquement invalide", () => {
    const invalidFence = "```python\ndef broken(\n    return 1\n```";
    const pyResult = validatePythonFencesWithPyCompile(invalidFence);
    if (!pyResult.skipped) {
      assert.equal(pyResult.pass, false);
      assert.match(pyResult.reason || "", /py_compile|syntaxe/i);
    }
  });
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  promoteStableGoldenCases,
  markFeedbackEntriesPromoted,
  toBaselinePromotedCase,
  renderBaselineFixtureModule,
} from "../src/agent/classifiers/intentTriageGoldenPromotion.js";
import {
  recordGoldenCiPass,
  loadGoldenCiRegistry,
  getGoldenCiRegistryPath,
} from "../src/agent/classifiers/intentTriageGoldenCiRegistry.js";
import { INTENT_TRIAGE_BASELINE_QUERIES } from "./fixtures/intentTriageGoldenQueries.js";

describe("intentTriageGoldenPromotion", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "golden-promote-"));
  const tmpRegistry = path.join(tmpDir, "registry.json");

  before(() => {
    process.env.INTENT_TRIAGE_CI_REGISTRY_PATH = tmpRegistry;
  });

  after(() => {
    delete process.env.INTENT_TRIAGE_CI_REGISTRY_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("incrémente le registre CI par cas exporté", () => {
    recordGoldenCiPass("feedback-test-abc");
    recordGoldenCiPass("feedback-test-abc");
    const registry = loadGoldenCiRegistry();
    assert.equal(registry.cases["feedback-test-abc"].ci_pass_count, 2);
  });

  it("promote en dry-run sans écrire les fixtures", () => {
    const exportedCase = {
      id: "feedback-dryrun01",
      category: "clarification_feedback",
      observedAt: "2026-06-06",
      query:
        "Fais une revue de code Python orientée exécution : commence par les erreurs bloquantes.\ndef broken( return 1",
      expectedTopIntent: "code_review",
      minConfidence: "high",
      routingAction: "route_direct",
      source: "feedback_export",
    };

    for (let i = 0; i < 5; i += 1) {
      recordGoldenCiPass(exportedCase.id);
    }

    const result = promoteStableGoldenCases({
      minCount: 5,
      dryRun: true,
      baselineCases: INTENT_TRIAGE_BASELINE_QUERIES,
      exportedCases: [exportedCase],
    });

    assert.equal(result.promoted_count, 1);
    assert.equal(result.dry_run, true);
    assert.equal(result.promoted[0].expected_top_intent, "code_review");
  });

  it("marque promoted_to_baseline dans le JSONL", () => {
    const feedbackFile = path.join(tmpDir, "feedback.jsonl");
    const query =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
    fs.writeFileSync(
      feedbackFile,
      `${JSON.stringify({ query, top_intent: "code_explain", confidence: "high" })}\n`,
      "utf8",
    );

    const { updated } = markFeedbackEntriesPromoted([query], {
      promoted_by: "test",
      ci_pass_count: 5,
      feedbackPath: feedbackFile,
    });

    assert.equal(updated, 1);
    const saved = JSON.parse(fs.readFileSync(feedbackFile, "utf8").trim());
    assert.equal(saved.promoted_to_baseline, true);
    assert.equal(saved.ci_pass_count, 5);

    const promoted = toBaselinePromotedCase(
      {
        id: "feedback-abc",
        query,
        expectedTopIntent: "code_explain",
        source: "feedback_export",
      },
      { ci_pass_count: 5, promoted_by: "test" },
    );
    assert.equal(promoted.source, "baseline_promoted");
    assert.ok(promoted.id.startsWith("baseline-promoted-"));
  });

  it("génère un module baseline valide avec calculatrice préservée", () => {
    const rendered = renderBaselineFixtureModule(INTENT_TRIAGE_BASELINE_QUERIES);
    assert.match(rendered, /INTENT_TRIAGE_BASELINE_QUERIES/);
    assert.match(rendered, /BROKEN_CALCULATRICE_PY_SNIPPET/);
  });
});

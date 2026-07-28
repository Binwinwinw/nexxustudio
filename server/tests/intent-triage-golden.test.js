import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  triageUserIntent,
  TRIAGE_CONFIDENCE,
  TRIAGE_ROUTING_ACTION,
} from "../src/agent/classifiers/intentTriageClassifier.js";
import { INTENT_TRIAGE_BASELINE_QUERIES } from "./fixtures/intentTriageGoldenQueries.js";
import {
  feedbackEntryToGoldenCase,
  mergeGoldenCases,
  loadGoldenCasesFromFeedback,
} from "../src/agent/classifiers/intentTriageFeedbackExporter.js";
import { recordGoldenCiPass } from "../src/agent/classifiers/intentTriageGoldenCiRegistry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTED_FIXTURE = path.resolve(
  __dirname,
  "fixtures/intentTriageGoldenExported.js",
);

const CONFIDENCE_RANK = {
  low: 0,
  medium: 1,
  high: 2,
};

async function loadExportedQueries() {
  if (!fs.existsSync(EXPORTED_FIXTURE)) return [];
  const mod = await import("./fixtures/intentTriageGoldenExported.js");
  return mod.INTENT_TRIAGE_EXPORTED_QUERIES || [];
}

function assertConfidenceAtLeast(actual, minimum) {
  assert.ok(
    CONFIDENCE_RANK[actual] >= CONFIDENCE_RANK[minimum],
    `confiance ${actual} < minimum ${minimum}`,
  );
}

function runGoldenCase(caseItem) {
  const triage = triageUserIntent(caseItem.query);

  if (caseItem.expectedTopIntent) {
    assert.equal(
      triage.top_intent,
      caseItem.expectedTopIntent,
      `[${caseItem.id}] top_intent`,
    );
  }

  if (caseItem.expectedRunnerUp) {
    assert.equal(
      triage.runner_up,
      caseItem.expectedRunnerUp,
      `[${caseItem.id}] runner_up`,
    );
  }

  if (caseItem.minConfidence) {
    assertConfidenceAtLeast(triage.confidence, caseItem.minConfidence);
  }

  if (caseItem.routingAction) {
    assert.equal(triage.routing_action, caseItem.routingAction, `[${caseItem.id}] routing`);
  }
}

describe("intentTriageGolden — baseline", () => {
  for (const caseItem of INTENT_TRIAGE_BASELINE_QUERIES) {
    it(`[${caseItem.id}] ${caseItem.expectedTopIntent}`, () => {
      runGoldenCase(caseItem);
    });
  }
});

describe("intentTriageFeedbackExporter", () => {
  it("convertit une clarification utilisateur « 1 » en intention résolue", () => {
    const golden = feedbackEntryToGoldenCase({
      recorded_at: "2026-05-27T10:00:00.000Z",
      query: "analyse ceci : def foo( pass",
      top_intent: "code_review",
      runner_up: "document_analysis",
      routing_action: TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION,
      user_reply: "1",
    });

    assert.equal(golden.expectedTopIntent, "code_review");
    assert.equal(golden.routingAction, "route_direct");
  });

  it("fusionne sans écraser les cas existants", () => {
    const merged = mergeGoldenCases(
      [{ id: "a", query: "x", expectedTopIntent: "general" }],
      [{ id: "a", query: "x", minConfidence: "high" }, { id: "b", query: "y" }],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].minConfidence, "high");
    assert.equal(merged[0].expectedTopIntent, "general");
  });

  it("tolère un fichier feedback absent", () => {
    const cases = loadGoldenCasesFromFeedback(
      path.resolve(__dirname, "fixtures/__missing_feedback.jsonl"),
    );
    assert.deepEqual(cases, []);
  });
});

describe("intentTriageGolden — exporté", async () => {
  const exported = await loadExportedQueries();

  if (exported.length === 0) {
    it("skip si intentTriageGoldenExported.js absent (lancer npm run triage:export-golden)", () => {
      assert.ok(true);
    });
    return;
  }

  for (const caseItem of exported) {
    it(`[${caseItem.id}] ${caseItem.expectedTopIntent || "ambigü"}`, () => {
      runGoldenCase(caseItem);
      if (!caseItem.id?.startsWith("baseline-")) {
        recordGoldenCiPass(caseItem.id);
      }
    });
  }
});

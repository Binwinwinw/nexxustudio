import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadFeedbackEntries,
  filterAmbiguousEntries,
  aggregateAmbiguousPairs,
  aggregateSignalFrequency,
  replayTriageOnEntries,
  analyzeIntentTriageAmbiguous,
  renderAmbiguousTriageMarkdown,
} from "../src/agent/classifiers/intentTriageAmbiguousAnalyzer.js";
import { TRIAGE_ROUTING_ACTION } from "../src/agent/classifiers/intentTriageClassifier.js";

const SAMPLE_FEEDBACK = [
  {
    recorded_at: "2026-05-27T10:00:00.000Z",
    query: "analyse ceci :\n" + "lorem ".repeat(20),
    top_intent: "code_review",
    runner_up: "document_analysis",
    confidence: "low",
    needs_clarification: true,
    routing_action: TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION,
    signals: ["analyse_plus_snippet", "executable_snippet"],
    user_reply: "1",
  },
  {
    recorded_at: "2026-05-27T11:00:00.000Z",
    query: "analyse ceci :\n" + "ipsum ".repeat(20),
    top_intent: "code_review",
    runner_up: "document_analysis",
    confidence: "low",
    needs_clarification: true,
    routing_action: TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION,
    signals: ["analyse_plus_snippet"],
    user_reply: null,
  },
  {
    recorded_at: "2026-05-27T12:00:00.000Z",
    query: "Résume ce passage et extrais les points clés.",
    top_intent: "document_analysis",
    runner_up: null,
    confidence: "high",
    needs_clarification: false,
    routing_action: TRIAGE_ROUTING_ACTION.ROUTE_DIRECT,
    signals: ["document_extractive_verbs"],
  },
].map((line) => JSON.stringify(line)).join("\n");

function withTempFeedback(content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-feedback-"));
  const file = path.join(dir, "clarification-feedback.jsonl");
  fs.writeFileSync(file, content, "utf8");
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("intentTriageAmbiguousAnalyzer", () => {
  it("charge et filtre les entrées ambiguës", () => {
    withTempFeedback(SAMPLE_FEEDBACK, (file) => {
      const entries = loadFeedbackEntries(file);
      const ambiguous = filterAmbiguousEntries(entries);
      assert.equal(entries.length, 3);
      assert.equal(ambiguous.length, 2);
    });
  });

  it("agrège les paires top|runner_up récurrentes", () => {
    withTempFeedback(SAMPLE_FEEDBACK, (file) => {
      const ambiguous = filterAmbiguousEntries(loadFeedbackEntries(file));
      const pairs = aggregateAmbiguousPairs(ambiguous);
      assert.equal(pairs.length, 1);
      assert.equal(pairs[0].pair, "code_review|document_analysis");
      assert.equal(pairs[0].count, 2);
      assert.ok(pairs[0].common_signals.some((s) => s.key === "analyse_plus_snippet"));
    });
  });

  it("agrège les signaux sur cas ambigus uniquement", () => {
    withTempFeedback(SAMPLE_FEEDBACK, (file) => {
      const entries = loadFeedbackEntries(file);
      const signals = aggregateSignalFrequency(entries, true);
      assert.ok(signals.some((s) => s.signal === "analyse_plus_snippet"));
      assert.equal(signals.find((s) => s.signal === "document_extractive_verbs"), undefined);
    });
  });

  it("replay triage détecte résolution ou dérive", () => {
    withTempFeedback(SAMPLE_FEEDBACK, (file) => {
      const entries = loadFeedbackEntries(file);
      const replays = replayTriageOnEntries(entries);
      assert.equal(replays.length, 3);
      assert.equal(typeof replays[0].still_ambiguous, "boolean");
      assert.equal(typeof replays[0].intent_changed, "boolean");
    });
  });

  it("produit JSON + Markdown sans écrire en mode dry", () => {
    withTempFeedback(SAMPLE_FEEDBACK, (file) => {
      const analysis = analyzeIntentTriageAmbiguous({
        feedbackPath: file,
        writeReports: false,
      });

      assert.equal(analysis.schema_version, "intent_triage_ambiguous_v1");
      assert.equal(analysis.summary.ambiguous_entries, 2);
      assert.ok(analysis.ambiguous_pairs.length >= 1);
      assert.ok(analysis.recommendations.length >= 1);

      const md = renderAmbiguousTriageMarkdown(analysis);
      assert.match(md, /Rapport Triage Ambigu/);
      assert.match(md, /code_review\|document_analysis/);
      assert.match(md, /triage:analyze-ambiguous/);
    });
  });

  it("écrit les rapports JSON et Vault MD", () => {
    withTempFeedback(SAMPLE_FEEDBACK, (file) => {
      const tmpJsonDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-json-"));
      const tmpMdDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-md-"));

      try {
        const analysis = analyzeIntentTriageAmbiguous({
          feedbackPath: file,
          jsonOutputDir: tmpJsonDir,
          markdownOutputDir: tmpMdDir,
          writeReports: true,
        });

        assert.ok(fs.existsSync(analysis.output.jsonPath));
        assert.ok(fs.existsSync(analysis.output.markdownPath));

        const saved = JSON.parse(fs.readFileSync(analysis.output.jsonPath, "utf8"));
        assert.equal(saved.summary.ambiguous_entries, 2);
      } finally {
        fs.rmSync(tmpJsonDir, { recursive: true, force: true });
        fs.rmSync(tmpMdDir, { recursive: true, force: true });
      }
    });
  });
});

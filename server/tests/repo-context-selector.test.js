import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateChunksByFile,
  selectRepoContext,
  buildRepoContextPacket,
} from "../src/agent/context/repoContextSelector.js";

const FIXTURE_INDEX = [
  {
    path: "server/src/agent/classifiers/intentTriageClassifier.js",
    symbol: "triageUserIntent",
    text: "scoreIntentCandidates triage document_analysis code_review self_analysis",
    kind: "function",
  },
  {
    path: "server/src/agent/classifiers/intentTriageClassifier.js",
    symbol: "resolveWantsAnalysisFromTriage",
    text: "document_analysis wantsAnalysis meta conversation",
    kind: "function",
  },
  {
    path: "server/src/agent/policies/fileContextGuard.js",
    symbol: "enforceFileContextGuard",
    text: "grounding fichiers inventaire attachmentRefs fail-closed",
    kind: "function",
  },
  {
    path: "server/tests/intent-triage-classifier.test.js",
    symbol: "describe",
    text: "baseline calculatrice code_review self_analysis golden",
    kind: "block",
  },
  {
    path: "citadelle-vault/Citadelle/02-Architecture/adr/ADR-Intent.md",
    symbol: "content",
    text: "Architecture Decision Record intent triage local-first",
    kind: "text",
  },
];

describe("repoContextSelector", () => {
  it("agrège les chunks par fichier", () => {
    const files = aggregateChunksByFile(FIXTURE_INDEX);
    assert.equal(files.length, 4);
    const triage = files.find((f) => f.path.includes("intentTriageClassifier"));
    assert.equal(triage.chunkCount, 2);
    assert.ok(triage.symbols.includes("triageUserIntent"));
  });

  it("sélectionne des fichiers pertinents pour une requête code_review", () => {
    const selection = selectRepoContext({
      query: "revue code intent triage document_analysis",
      intent: "code_review",
      indexEntries: FIXTURE_INDEX,
      maxFiles: 5,
    });

    assert.ok(selection.files.length >= 2);
    assert.ok(
      selection.files.some((f) => f.path.includes("intentTriageClassifier")),
    );
    assert.equal(selection.needsClarification, false);
  });

  it("booste un fichier explicitement cité", () => {
    const selection = selectRepoContext({
      query: "analyse fileContextGuard.js erreurs grounding",
      intent: "code_review",
      indexEntries: FIXTURE_INDEX,
    });

    assert.equal(selection.files[0].path.includes("fileContextGuard"), true);
    assert.ok(selection.files[0].reasons.includes("explicit_file"));
    assert.equal(selection.confidence, "high");
  });

  it("priorise les fichiers actifs (tier 1)", () => {
    const selection = selectRepoContext({
      query: "intent triage",
      intent: "code_review",
      indexEntries: FIXTURE_INDEX,
      activeFiles: ["intent-triage-classifier.test.js"],
    });

    assert.ok(
      selection.files[0].path.includes("intent-triage-classifier.test.js"),
    );
    assert.ok(selection.files[0].reasons.includes("active_file"));
  });

  it("fail-closed si aucun match au-dessus du seuil", () => {
    const selection = selectRepoContext({
      query: "xyzzy plugh",
      intent: "general",
      indexEntries: FIXTURE_INDEX,
      minScore: 0.5,
    });

    assert.equal(selection.files.length, 0);
    assert.equal(selection.needsClarification, true);
    const packet = buildRepoContextPacket(selection);
    assert.equal(packet.status, "insufficient");
    assert.match(packet.message, /je ne peux pas identifier/i);
  });

  it("produit un paquet pointeurs réversible", () => {
    const selection = selectRepoContext({
      query: "self_analysis améliorations structure",
      intent: "self_analysis",
      indexEntries: FIXTURE_INDEX,
    });
    const packet = buildRepoContextPacket(selection);

    assert.equal(packet.kind, "repo_context_v1");
    assert.ok(packet.files.length > 0);
    assert.equal(packet.files[0].pointer.expand, true);
    assert.ok(Array.isArray(packet.files[0].reasons));
  });
});

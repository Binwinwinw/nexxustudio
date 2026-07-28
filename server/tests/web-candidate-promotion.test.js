import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import {
  assessWebCandidatePromotion,
  WEB_PROMOTION_POLICY,
} from "../src/agent/memory/web-candidates/webCandidatePromotionPolicy.js";
import {
  appendWebCandidate,
  clearWebCandidateStoreForTests,
  findCandidatesByQueryNormalized,
  setWebCandidateDataDir,
  updateWebCandidate,
} from "../src/agent/memory/web-candidates/candidateKnowledgeStore.js";
import {
  computeSourceConsensusScore,
  normalizeWebQuery,
  inferWebDomain,
} from "../src/agent/memory/web-candidates/webCandidateUtils.js";
import {
  clearWebTurnSnapshotForTests,
  stashWebTurnSnapshot,
  consumeWebTurnSnapshot,
} from "../src/agent/memory/web-candidates/webTurnContext.js";
import { recordWebFallbackMemory } from "../src/agent/memory/web-candidates/webFallbackMemoryRecorder.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "web-cand-"));
}

function baseCandidate(overrides = {}) {
  return {
    sources: [
      { url: "https://a.example/1", snippet: "faire cuire oeufs doux" },
      { url: "https://b.example/2", snippet: "cuire oeufs a la coque" },
    ],
    web: {
      confidence: 0.82,
      source_consensus_score: 0.72,
    },
    validation: {
      validated_by_user: false,
      implicitly_accepted: true,
      coherent_replays: 2,
      user_corrected: false,
    },
    provenance: { pipeline_mode: "DOCUMENT" },
    ...overrides,
  };
}

test("normalizeWebQuery et inferWebDomain P0", () => {
  const n = normalizeWebQuery("Comment on fait des œufs ?");
  assert.match(n, /oeufs/);
  assert.equal(inferWebDomain(n), "cuisine_basique");
});

test("computeSourceConsensusScore — 2 URLs distinctes", () => {
  const score = computeSourceConsensusScore([
    { url: "https://a/1", snippet: "cuire oeufs doux casserole" },
    { url: "https://b/2", snippet: "cuire oeufs coque minutes" },
  ]);
  assert.ok(score >= WEB_PROMOTION_POLICY.thresholds.minConsensus);
});

test("assessWebCandidatePromotion — refuse sans validation ni replays", () => {
  const r = assessWebCandidatePromotion(
    baseCandidate({
      validation: {
        validated_by_user: false,
        implicitly_accepted: true,
        coherent_replays: 0,
        user_corrected: false,
      },
    }),
  );
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("awaiting_validation_or_replays"));
});

test("assessWebCandidatePromotion — eligible avec validated_by_user", () => {
  const r = assessWebCandidatePromotion(
    baseCandidate({
      validation: {
        validated_by_user: true,
        implicitly_accepted: true,
        coherent_replays: 0,
        user_corrected: false,
      },
    }),
  );
  assert.equal(r.eligible, true);
});

test("assessWebCandidatePromotion — refuse user_corrected", () => {
  const r = assessWebCandidatePromotion(
    baseCandidate({
      validation: {
        validated_by_user: true,
        user_corrected: true,
        coherent_replays: 3,
      },
    }),
  );
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("user_corrected"));
});

test("candidateKnowledgeStore — append et findByQuery", () => {
  const dir = tmpDir();
  setWebCandidateDataDir(dir);
  clearWebCandidateStoreForTests();

  const queryRaw = "Comment faire cuire des œufs ?";
  const norm = normalizeWebQuery(queryRaw);
  appendWebCandidate({
    id: "ckf_test_1",
    status: "candidate_fact",
    query_raw: queryRaw,
    query_normalized: norm,
    answer_synthesized: "Faire bouillir de l eau puis plonger les oeufs.",
    sources: [],
    created_at: new Date().toISOString(),
  });

  const found = findCandidatesByQueryNormalized(norm, 5);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "ckf_test_1");

  clearWebCandidateStoreForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("webTurnContext — stash et consume", () => {
  clearWebTurnSnapshotForTests();
  stashWebTurnSnapshot({
    query: "test",
    webPacket: { sources: [{ url: "https://x" }] },
  });
  const snap = consumeWebTurnSnapshot();
  assert.ok(snap?.webPacket?.sources?.length);
  assert.equal(consumeWebTurnSnapshot(), null);
});

test("recordWebFallbackMemory — candidate_saved sans promotion auto", () => {
  const dir = tmpDir();
  setWebCandidateDataDir(dir);
  clearWebCandidateStoreForTests();
  clearWebTurnSnapshotForTests();
  process.env.WEB_CANDIDATE_MEMORY = "1";
  delete process.env.CURATED_MEMORY_INGEST;

  stashWebTurnSnapshot({
    query: "comment faire des oeufs",
    sessionId: "sess_test",
    pipelineMode: "SIMPLE_FAST",
    webPacket: {
      sources: [
        {
          url: "https://a.example/r1",
          title: "Oeufs",
          snippet: "cuire oeufs doux eau frémissante",
          confidence: 0.8,
        },
        {
          url: "https://b.example/r2",
          title: "Guide",
          snippet: "cuire oeufs coque six minutes",
          confidence: 0.75,
        },
      ],
      confidence: 0.8,
      failure_mode: null,
      elapsed_ms: 900,
    },
  });

  const result = recordWebFallbackMemory({
    userQuery: "comment faire des oeufs",
    assistantResponse:
      "Portez de l eau à frémissement, plongez les oeufs 6 à 7 minutes pour un oeuf mollet.",
    sessionId: "sess_test",
    turnId: "turn_test",
  });

  assert.equal(result.status, "candidate_saved");
  assert.ok(result.candidateId);

  const found = findCandidatesByQueryNormalized("comment faire des oeufs", 3);
  assert.equal(found[0].validation.implicitly_accepted, true);
  assert.equal(found[0].promotion.eligible, false);

  clearWebCandidateStoreForTests();
  clearWebTurnSnapshotForTests();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.WEB_CANDIDATE_MEMORY;
});

test("updateWebCandidate — feedback path via store", () => {
  const dir = tmpDir();
  setWebCandidateDataDir(dir);
  clearWebCandidateStoreForTests();

  appendWebCandidate({
    id: "ckf_fb_1",
    query_normalized: "test query",
    provenance: { session_id: "sess_fb" },
    validation: { validated_by_user: false, implicitly_accepted: true },
    promotion: { eligible: false, reasons: ["awaiting"] },
    created_at: new Date().toISOString(),
  });

  const updated = updateWebCandidate("ckf_fb_1", {
    validation: { validated_by_user: true, feedback_rating: "useful" },
  });
  assert.equal(updated.validation.validated_by_user, true);
  assert.equal(updated.validation.feedback_rating, "useful");

  clearWebCandidateStoreForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

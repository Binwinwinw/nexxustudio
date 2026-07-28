import test from "node:test";
import assert from "node:assert/strict";

import {
  PROMOTION_POLICY_V1,
  assessPromotionEligibility,
  countDistinctTurnRefs,
  isRetentionStale,
} from "../src/agent/memory/guardianship/memoryPromotionPolicy.js";

function futureReview(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return { policy: "review_at", ttl_days: days, review_at: d.toISOString() };
}

function pastReview() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return { policy: "review_at", ttl_days: 30, review_at: d.toISOString() };
}

function basePayload(overrides = {}) {
  return {
    operation: "ADD",
    memory_type: "episodic",
    scope: "project",
    subject: "Quality gate local",
    confidence: 0.8,
    evidence: [
      {
        id: "E1",
        source_type: "conversation",
        quote: "npm run quality:gate exige 27 tests PASS",
        turn_ref: "turn_a",
        lineage: "curated",
      },
      {
        id: "E2",
        source_type: "file",
        quote: "scripts/quality-gate.js lance test:stability",
        turn_ref: "turn_b",
        lineage: "curated",
      },
    ],
    retention: futureReview(),
    conflict_check: {
      candidate_keys: [],
      supersedes_memory_ids: [],
      possible_conflicts: [],
    },
    unknowns: [],
    forbidden_speculation: [],
    proposed_memory: {
      title: "Quality gate",
      content: "Le quality gate local valide stabilité et KPI.",
      normalized_facts: ["27 tests requis"],
    },
    ...overrides,
  };
}

test("promotion policy: episodic eligible with moderate confidence", () => {
  const payload = basePayload({ confidence: 0.65, memory_type: "episodic" });
  const result = assessPromotionEligibility(
    { ...payload, id: "mem-1", timestamp: new Date().toISOString() },
    { payload, meta: { provenance: { pipelineMode: "COMPOSER" } } },
  );
  assert.equal(result.eligible, true);
  assert.equal(result.target, "episodic");
});

test("promotion policy: semantic requires cross-turn evidence", () => {
  const payload = basePayload({
    memory_type: "semantic",
    confidence: 0.82,
    evidence: [
      {
        id: "E1",
        source_type: "conversation",
        quote: "Un seul échange unique",
        turn_ref: "turn_only",
        lineage: "curated",
      },
    ],
  });
  const result = assessPromotionEligibility(
    { ...payload, id: "mem-2" },
    { payload, meta: { provenance: { pipelineMode: "COMPOSER" } } },
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("insufficient_cross_turn_evidence"));
});

test("promotion policy: semantic allowed with durable pipeline and dual sources", () => {
  const payload = basePayload({ memory_type: "semantic", confidence: 0.85 });
  const result = assessPromotionEligibility(
    { ...payload, id: "mem-3" },
    { payload, meta: { provenance: { pipelineMode: "CRITICAL" } } },
  );
  assert.equal(result.eligible, true);
  assert.equal(result.target, "semantic");
});

test("promotion policy: heritage refused on SIMPLE_FAST pipeline", () => {
  const payload = basePayload({
    memory_type: "heritage",
    scope: "system",
    confidence: 0.95,
    unknowns: [],
    forbidden_speculation: [],
  });
  const result = assessPromotionEligibility(
    { ...payload, id: "mem-4" },
    { payload, meta: { provenance: { pipelineMode: "SIMPLE_FAST" } } },
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("pipeline_mode_too_ephemeral"));
});

test("promotion policy: heritage requires CRITICAL or DOCUMENT pipeline", () => {
  const payload = basePayload({
    memory_type: "heritage",
    scope: "system",
    confidence: 0.95,
  });
  const ok = assessPromotionEligibility(
    { ...payload, id: "mem-5" },
    { payload, meta: { provenance: { pipelineMode: "CRITICAL" } } },
  );
  assert.equal(ok.eligible, true);
  assert.equal(ok.target, "heritage");
});

test("promotion policy: stale retention blocks promotion", () => {
  const payload = basePayload({ retention: pastReview() });
  const result = assessPromotionEligibility(
    { ...payload, id: "mem-6" },
    { payload, meta: { provenance: { pipelineMode: "COMPOSER" } } },
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("retention_stale"));
});

test("promotion policy: working memory never promotes", () => {
  const payload = basePayload({ memory_type: "working", confidence: 0.99 });
  const result = assessPromotionEligibility(
    { ...payload, id: "mem-7" },
    { payload, meta: { provenance: { pipelineMode: "COMPOSER" } } },
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("working_not_durable"));
});

test("promotion policy: countDistinctTurnRefs utility", () => {
  assert.equal(
    countDistinctTurnRefs([
      { turn_ref: "a" },
      { turn_ref: "a" },
      { turn_ref: "b" },
    ]),
    2,
  );
});

test("promotion policy: isRetentionStale utility", () => {
  assert.equal(isRetentionStale(pastReview()), true);
  assert.equal(isRetentionStale(futureReview()), false);
});

test("promotion policy: thresholds exported", () => {
  assert.equal(PROMOTION_POLICY_V1.thresholds.semanticMin, 0.75);
  assert.equal(PROMOTION_POLICY_V1.version, "memory_promotion_v1");
});

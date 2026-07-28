import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  createEmptySessionWorkMemory,
  beginSessionWorkTurn,
  commitSessionWorkTurn,
  loadSessionWorkMemory,
  saveSessionWorkMemory,
  clearSessionWorkMemoryForTests,
  computeStalenessScore,
  formatTurnGapFr,
  buildSessionWorkMemoryPromptAddon,
  buildTemporalAwarenessReply,
  pruneSessionWorkMemory,
  SESSION_WORK_MEMORY_LIMITS,
} from "../src/agent/memory/sessionWorkMemory.js";

const TEST_SESSION = "test-session-work-memory";

describe("sessionWorkMemory — cycle de tour", () => {
  beforeEach(() => {
    clearSessionWorkMemoryForTests(TEST_SESSION);
  });

  it("crée un état vide sans horodatage précédent", () => {
    const empty = createEmptySessionWorkMemory(TEST_SESSION);
    assert.equal(empty.lastTurnTimestamp, null);
    assert.equal(empty.turnCount, 0);
    assert.deepEqual(empty.filesSeen, []);
  });

  it("beginSessionWorkTurn expose priorState et turnTimestamp", () => {
    const t0 = new Date("2026-05-27T21:00:00.000Z");
    commitSessionWorkTurn({
      sessionId: TEST_SESSION,
      turnTimestamp: t0.toISOString(),
      query: "analyse generateur_mdp.py",
      intent: "code_review",
      confidence: "high",
      pipelinePath: "meta_conversation_deterministic",
    });

    const t1 = new Date("2026-05-27T21:30:00.000Z");
    const ctx = beginSessionWorkTurn({ sessionId: TEST_SESSION, now: t1 });
    assert.equal(ctx.previousTurnTimestamp, t0.toISOString());
    assert.equal(ctx.turnTimestamp, t1.toISOString());
    assert.equal(ctx.gapLabel, "30 min 0s");
    assert.equal(ctx.priorState.lastTurnTimestamp, t0.toISOString());
  });

  it("commit persiste fichiers vus et intentions", () => {
    const ts = new Date("2026-05-27T22:00:00.000Z").toISOString();
    const saved = commitSessionWorkTurn({
      sessionId: TEST_SESSION,
      turnTimestamp: ts,
      query: "corrige utils.py ligne 12",
      intent: "temporal_awareness",
      confidence: "medium",
      pipelinePath: "simple_fast",
      attachmentRefs: [{ name: "note.md" }],
    });

    assert.equal(saved.turnCount, 1);
    assert.equal(saved.lastTurnTimestamp, ts);
    assert.ok(saved.filesSeen.some((f) => f.path === "utils.py"));
    assert.ok(saved.filesSeen.some((f) => f.path === "note.md"));
    assert.ok(saved.intentions.some((i) => i.intent === "temporal_awareness"));

    const reloaded = loadSessionWorkMemory(TEST_SESSION);
    assert.equal(reloaded.turnCount, 1);
    assert.equal(reloaded.lastTurnTimestamp, ts);
  });
});

describe("sessionWorkMemory — prompt et réponse temporelle", () => {
  beforeEach(() => {
    clearSessionWorkMemoryForTests(TEST_SESSION);
  });

  it("buildSessionWorkMemoryPromptAddon injecte turnTimestamp et gap", () => {
    const state = saveSessionWorkMemory({
      ...createEmptySessionWorkMemory(TEST_SESSION),
      lastTurnTimestamp: "2026-05-27T23:26:27.000Z",
    });
    const addon = buildSessionWorkMemoryPromptAddon(
      state,
      "2026-05-27T23:57:00.000Z",
    );
    assert.match(addon, /turnTimestamp: 2026-05-27T23:57:00.000Z/);
    assert.match(addon, /previousTurnTimestamp: 2026-05-27T23:26:27.000Z/);
    assert.match(addon, /elapsedSincePreviousTurn: 30 min 33s/);
    assert.match(addon, /SESSION_WORK_MEMORY_V1/);
  });

  it("buildTemporalAwarenessReply cite l'écart entre tours du fil", () => {
    const priorState = {
      ...createEmptySessionWorkMemory(TEST_SESSION),
      lastTurnTimestamp: "2026-05-27T23:26:27.000Z",
    };
    const reply = buildTemporalAwarenessReply({
      sessionId: TEST_SESSION,
      turnTimestamp: "2026-05-27T23:57:00.000Z",
      priorState,
    });
    assert.match(reply, /23:26:27/);
    assert.match(reply, /23:57:00/);
    assert.match(reply, /30 min 33s/);
    assert.match(reply, /sessionWorkMemory/);
    assert.match(reply, /turnTimestamp/);
  });

  it("formatTurnGapFr retourne null si pas d'écart valide", () => {
    assert.equal(formatTurnGapFr(null, "2026-05-27T12:00:00.000Z"), null);
    assert.equal(
      formatTurnGapFr("2026-05-27T12:00:00.000Z", "2026-05-27T12:00:00.000Z"),
      null,
    );
  });
});

describe("sessionWorkMemory — staleness et prune", () => {
  it("computeStalenessScore augmente avec l'âge", () => {
    const last = "2026-05-27T10:00:00.000Z";
    const nowMs = Date.parse("2026-05-27T10:15:00.000Z");
    const score = computeStalenessScore(last, nowMs);
    assert.ok(score > 0 && score < 1);
    const stale = computeStalenessScore(last, Date.parse("2026-05-27T11:00:00.000Z"));
    assert.equal(stale, 1);
  });

  it("pruneSessionWorkMemory respecte les limites", () => {
    const bloated = {
      ...createEmptySessionWorkMemory("prune-test"),
      filesSeen: Array.from({ length: 20 }, (_, i) => ({
        path: `file${i}.py`,
        source: "turn",
        seenAt: new Date().toISOString(),
      })),
      intentions: Array.from({ length: 15 }, (_, i) => ({
        intent: `intent_${i}`,
        recordedAt: new Date().toISOString(),
      })),
      lastTurnTimestamp: new Date().toISOString(),
    };
    const pruned = pruneSessionWorkMemory(bloated);
    assert.equal(pruned.filesSeen.length, SESSION_WORK_MEMORY_LIMITS.filesSeen);
    assert.equal(pruned.intentions.length, SESSION_WORK_MEMORY_LIMITS.intentions);
    assert.ok(pruned.stalenessScore >= 0);
  });
});

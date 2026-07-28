/* eslint-env node */
import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldApplyShortReplyVisualPacing,
  shouldHoldShortReplyDuringStream,
  splitTextForVisualPacing,
  revealShortReplyWithPacing,
  SHORT_REPLY_VISUAL_PACING,
} from "./shortReplyVisualPacing.js";

test("shouldApplyShortReplyVisualPacing — greeting rapide buffered", () => {
  assert.equal(
    shouldApplyShortReplyVisualPacing({
      text: "Salut ! Comment puis-je t'aider ?",
      pipelinePath: "social_deterministic",
      stats: { streamTotalMs: 91, sseChunks: 7, emitPath: "buffered" },
    }),
    true,
  );
});

test("shouldApplyShortReplyVisualPacing — réponse longue LLM naturelle", () => {
  const long = "A".repeat(150);
  assert.equal(
    shouldApplyShortReplyVisualPacing({
      text: long,
      pipelinePath: "orchestrator",
      stats: { streamTotalMs: 4000, sseChunks: 80, emitPath: "pipeline" },
    }),
    false,
  );
});

test("shouldApplyShortReplyVisualPacing — courte mais backend déjà lent", () => {
  assert.equal(
    shouldApplyShortReplyVisualPacing({
      text: "OK.",
      pipelinePath: "simple_fast",
      stats: { streamTotalMs: 450, sseChunks: 3, emitPath: "pipeline" },
    }),
    false,
  );
});

test("splitTextForVisualPacing — segments progressifs", () => {
  const chunks = splitTextForVisualPacing("Bonjour et bienvenue dans La Citadelle.", 4);
  assert.ok(chunks.length >= 2);
  assert.equal(chunks[chunks.length - 1], "Bonjour et bienvenue dans La Citadelle.");
});

test("revealShortReplyWithPacing — étale sur plusieurs updates", async () => {
  const updates = [];
  const started = Date.now() - 50;
  await revealShortReplyWithPacing(
    "Salut !",
    (partial) => updates.push(partial),
    { streamStartedAt: started, minMs: 120, maxMs: 200, steps: 3 },
  );
  assert.ok(updates.length >= 2);
  assert.equal(updates[updates.length - 1], "Salut !");
});

test("shouldHoldShortReplyDuringStream — hold si ultra-court et rapide", () => {
  const now = Date.now();
  assert.equal(
    shouldHoldShortReplyDuringStream({
      chatDisplay: "Salut !",
      streamStartedAt: now - 40,
    }),
    true,
  );
  assert.equal(
    shouldHoldShortReplyDuringStream({
      chatDisplay: "x".repeat(130),
      streamStartedAt: now - 40,
    }),
    false,
  );
});

test("SHORT_REPLY_VISUAL_PACING — seuils documentés", () => {
  assert.equal(SHORT_REPLY_VISUAL_PACING.CHAR_THRESHOLD, 120);
  assert.equal(SHORT_REPLY_VISUAL_PACING.MIN_MS, 350);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  emitOnContent,
  emitTextChunksSmooth,
  LARGE_PAYLOAD_THRESHOLD,
} from "../src/agent/utils/streamTextChunks.js";

test("emitTextChunksSmooth — découpe un long texte en plusieurs fragments", () => {
  const text =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.";
  const chunks = [];
  emitTextChunksSmooth(text, (c) => chunks.push(c));

  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), text);
});

test("emitOnContent — petit texte en un seul appel", () => {
  const calls = [];
  emitOnContent("Salut !", (c) => calls.push(c));
  assert.deepEqual(calls, ["Salut !"]);
});

test("emitOnContent — gros texte découpé", () => {
  const longText = "A".repeat(LARGE_PAYLOAD_THRESHOLD + 20);
  const calls = [];
  emitOnContent(longText, (c) => calls.push(c));
  assert.ok(calls.length > 1);
  assert.equal(calls.join(""), longText);
});

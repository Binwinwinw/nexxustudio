import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { shouldBypassMultiSegmentShortCircuit } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";

const SHORT_CIRCUIT_SRC = new URL(
  "../src/agent/micro/classifiers/intentShortCircuit.js",
  import.meta.url,
);

describe("routing barrel — short-circuit boot guard", () => {
  it("intentShortCircuit n'importe pas policies/routing/index.js", () => {
    const src = readFileSync(SHORT_CIRCUIT_SRC, "utf8");
    assert.doesNotMatch(
      src,
      /policies\/routing\/index\.js/,
      "import critique via barrel : un réordonnancement casse le boot",
    );
  });

  it("shouldBypassMultiSegmentShortCircuit existe sur le module source", () => {
    assert.equal(typeof shouldBypassMultiSegmentShortCircuit, "function");
  });

  it("intentShortCircuit charge sans export manquant", async () => {
    const mod = await import(
      "../src/agent/micro/classifiers/intentShortCircuit.js"
    );
    assert.equal(typeof mod.runConversationShortCircuit, "function");
    assert.equal(typeof mod.shouldEvaluateConversationShortCircuit, "function");
  });
});

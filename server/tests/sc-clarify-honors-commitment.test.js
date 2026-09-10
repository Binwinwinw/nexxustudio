import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  runConversationShortCircuit,
  shouldEmitShortCircuitClarify,
} from "../src/agent/micro/classifiers/intentShortCircuit.js";

const AVION_HOWTO = "comment on fait un avion ?";

describe("SC_CLARIFY_HONORS_COMMITMENT_V1", () => {
  it("gate : *_clarify refusé si renderMode !== clarify", () => {
    assert.equal(
      shouldEmitShortCircuitClarify("how_to_clarify", { renderMode: "llm_direct" }),
      false,
    );
    assert.equal(
      shouldEmitShortCircuitClarify("how_to_complex_clarify", {
        renderMode: "deterministic",
      }),
      false,
    );
    assert.equal(
      shouldEmitShortCircuitClarify("web_project_scoping_clarify", {
        renderMode: "llm_direct",
      }),
      false,
    );
  });

  it("gate : *_clarify autorisé si renderMode === clarify, ou sans commitment", () => {
    assert.equal(
      shouldEmitShortCircuitClarify("how_to_clarify", { renderMode: "clarify" }),
      true,
    );
    assert.equal(shouldEmitShortCircuitClarify("how_to_clarify", null), true);
    assert.equal(shouldEmitShortCircuitClarify("how_to_simple_local", { renderMode: "llm_direct" }), true);
  });

  it("rail SC : llm_direct ne termine pas en *_clarify", async () => {
    const hit = await runConversationShortCircuit(AVION_HOWTO, {
      response_commitment: { renderMode: "llm_direct" },
    });
    assert.equal(/_clarify(?:_|$)/.test(hit?.path || ""), false);
  });

  it("rail SC : clarify conserve how_to_clarify", async () => {
    const hit = await runConversationShortCircuit(AVION_HOWTO, {
      response_commitment: { renderMode: "clarify" },
    });
    assert.equal(hit?.path, "how_to_clarify");
    assert.ok(hit?.reply);
  });
});

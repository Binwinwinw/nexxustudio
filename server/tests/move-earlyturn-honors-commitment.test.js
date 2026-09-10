import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CONVERSATION_MOVES } from "../src/agent/policies/conversation/conversationMovePolicy.js";
import { applyConversationMoveAuthority } from "../src/agent/policies/conversation/conversationMoveAuthority.js";

const CLARIFY_MOVE = Object.freeze({
  stopped: true,
  move: CONVERSATION_MOVES.CLARIFY_ONE,
  clarifyQuestion: "Précise l'échelle visée (débutant, maquette, projet réel).",
  pipelinePath: "how_to_complex_clarify",
});

describe("MOVE_EARLYTURN_HONORS_COMMITMENT_V1", () => {
  it("CLARIFY_ONE + renderMode !== clarify → earlyTurn null", () => {
    const applied = applyConversationMoveAuthority({
      conversationMove: CLARIFY_MOVE,
      clarificationGate: { shouldClarify: false },
      query: "je veux créer une base dans phpmyadmin",
      response_commitment: { renderMode: "llm_direct" },
    });
    assert.equal(applied.earlyTurn, null);
    assert.equal(applied.authorityApplied, true);
  });

  it("CLARIFY_ONE + renderMode === clarify → earlyTurn possible", () => {
    const applied = applyConversationMoveAuthority({
      conversationMove: CLARIFY_MOVE,
      clarificationGate: { shouldClarify: false },
      query: "comment on fait un avion",
      response_commitment: { renderMode: "clarify" },
    });
    assert.equal(applied.authorityApplied, true);
    assert.ok(applied.earlyTurn?.text);
    assert.equal(applied.earlyTurn.pipelinePath, "how_to_complex_clarify");
    assert.equal(applied.earlyTurn.text, CLARIFY_MOVE.clarifyQuestion);
  });
});

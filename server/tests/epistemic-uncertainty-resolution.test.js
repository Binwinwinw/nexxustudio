import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  EPISTEMIC_ACTIONS,
  EPISTEMIC_KNOWLEDGE_STATES,
  EPISTEMIC_RESOLUTION_RULE,
  buildEpistemicTargetedClarifyReply,
  classifyEpistemicKnowledgeState,
  evaluateEpistemicUncertaintyResolution,
  resolveEpistemicUncertaintyShortCircuit,
} from "../src/agent/policies/epistemicUncertaintyResolutionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const CHAT_HISTORY = [
  {
    role: "assistant",
    content:
      "Oui bien sûr, on peut discuter. Tu as un sujet en tête ou quelque chose de particulier à faire ?",
  },
];

describe("epistemic uncertainty resolution v1", () => {
  it("doctrine centrale exposée", () => {
    assert.match(EPISTEMIC_RESOLUTION_RULE, /ne prétend jamais savoir/i);
  });

  it("NXT → ambiguous_probable + targeted_clarify avec hypothèse", () => {
    const q = "heuuuum ben je pense à la ligue NXT, ça te dit quelque chose ?";
    const cls = classifyEpistemicKnowledgeState(q, { history: CHAT_HISTORY });
    assert.equal(cls.state, EPISTEMIC_KNOWLEDGE_STATES.AMBIGUOUS_PROBABLE);
    assert.equal(cls.hypothesis, "la WWE NXT");

    const eval_ = evaluateEpistemicUncertaintyResolution(q, {
      history: CHAT_HISTORY,
    });
    assert.equal(eval_.action, EPISTEMIC_ACTIONS.TARGETED_CLARIFY);
    assert.match(eval_.reply || "", /WWE NXT/);
    assert.doesNotMatch(eval_.reply || "", /quel sujet exactement/i);
  });

  it("clarification ciblée privilégie l'hypothèse", () => {
    assert.equal(
      buildEpistemicTargetedClarifyReply({ hypothesis: "la WWE NXT" }),
      "Tu parles de la WWE NXT ? Si oui, je vois.",
    );
    assert.equal(
      buildEpistemicTargetedClarifyReply({
        alternatives: ["le projet X", "l'organisation Y"],
      }),
      "Tu veux dire le projet X ou l'organisation Y ?",
    );
  });

  it("référence obscure + probe → honesty ou clarify ciblé, pas invention", () => {
    const q = "tu connais Zorblax-9 ??? ça te dit quelque chose ?";
    const eval_ = evaluateEpistemicUncertaintyResolution(q, {
      history: CHAT_HISTORY,
    });
    assert.ok(
      eval_.action === EPISTEMIC_ACTIONS.TARGETED_CLARIFY ||
        eval_.action === EPISTEMIC_ACTIONS.ADMIT_UNCERTAINTY,
    );
    assert.ok(eval_.reply);
    assert.doesNotMatch(eval_.reply, /quel sujet exactement/i);
  });

  it("short-circuit NXT bypass request_interpreter_clarify", async () => {
    const q =
      "heuuuum ben je pense à un sport ou il y a la ligue NXT, ça te dit quelque chose ???";
    const direct = resolveEpistemicUncertaintyShortCircuit(q, {
      history: CHAT_HISTORY,
    });
    assert.ok(direct?.reply);
    assert.equal(direct.epistemicResolution.action, "targeted_clarify");

    const hit = await runConversationShortCircuit(q, { history: CHAT_HISTORY });
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "request_interpreter_clarify");
    assert.match(hit?.reply || "", /WWE NXT/i);
  });

  it("sujet social soft sans terme culturel → respond (pas honesty)", () => {
    const eval_ = evaluateEpistemicUncertaintyResolution("musique", {
      history: CHAT_HISTORY,
    });
    assert.equal(eval_.action, EPISTEMIC_ACTIONS.RESPOND);
    assert.equal(
      resolveEpistemicUncertaintyShortCircuit("musique", {
        history: CHAT_HISTORY,
      }),
      null,
    );
  });
});

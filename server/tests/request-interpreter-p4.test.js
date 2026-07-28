import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  interpretRequest,
  INTERPRETER_ACTIONS,
  resolveEffectiveQuery,
} from "../src/agent/micro/interpreter/requestInterpreter.js";
import {
  canonicalizeRequest,
  normalizeRequest,
} from "../src/agent/micro/interpreter/requestNormalizer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("P4 — requestNormalizer", () => {
  it("canonicalise « et pour noel tu connais ou pas »", () => {
    const { normalized, stripped } = normalizeRequest("et pour noel tu connais ou pas ?");
    const { canonical } = canonicalizeRequest(normalized, stripped);
    assert.equal(canonical, "tu connais noel");
  });
});

describe("P4 — interpretRequest", () => {
  it("noël bancal — confiance élevée, action respond", () => {
    const out = interpretRequest("et pour noel tu connais ou pas ?");
    assert.equal(out.nextAction, INTERPRETER_ACTIONS.RESPOND);
    assert.ok(out.confidence >= 0.78);
    assert.equal(out.canonicalQuery, "tu connais noel");
    assert.ok(out.bestHypothesis?.subjectLabel?.match(/Noël|noel/i));
  });

  it("« et pour ça tu peux me dire ? » — clarification sujet", () => {
    const out = interpretRequest("et pour ça tu peux me dire ?");
    assert.equal(out.nextAction, INTERPRETER_ACTIONS.CLARIFY);
    assert.match(out.clarificationReply, /quel sujet exactement/i);
  });

  it("descriptif boules — confirmation pétanque", () => {
    const out = interpretRequest(
      "je sais pas comment dire mais tu vois le truc avec les boules",
    );
    assert.equal(out.nextAction, INTERPRETER_ACTIONS.CONFIRM);
    assert.match(out.clarificationReply, /pétanque/i);
  });
});

describe("P4 — pipeline short-circuit", () => {
  it("noël bancal → réponse familiarité directe", () => {
    const hit = runConversationShortCircuit("et pour noel tu connais ou pas ?");
    assert.ok(hit);
    assert.equal(hit.path, "familiarity_deterministic");
    assert.match(hit.reply, /je connais/i);
    assert.match(hit.reply, /Noël|noel/i);
  });

  it("ça ambigu → request_interpreter_clarify", () => {
    const hit = runConversationShortCircuit("et pour ça tu peux me dire ?");
    assert.ok(hit);
    assert.equal(hit.path, "request_interpreter_clarify");
    assert.match(hit.reply, /quel sujet/i);
  });

  it("boules → confirm puis oui enchaîne familiarité", () => {
    const confirm = runConversationShortCircuit(
      "je sais pas comment dire mais tu vois le truc avec les boules",
    );
    assert.equal(confirm.path, "request_interpreter_confirm");
    assert.match(confirm.reply, /pétanque/i);

    const history = [
      {
        role: "user",
        content: "je sais pas comment dire mais tu vois le truc avec les boules",
      },
      { role: "assistant", content: confirm.reply },
    ];
    const follow = runConversationShortCircuit("oui", { history });
    assert.equal(follow.path, "conversation_continuity_deterministic");
    assert.match(follow.reply, /je connais/i);
    assert.match(follow.reply, /pétanque/i);
  });

  it("resolveEffectiveQuery propage la forme canonique", () => {
    const interpretation = interpretRequest("et pour noel tu connais ou pas ?");
    const effective = resolveEffectiveQuery("et pour noel tu connais ou pas ?", interpretation);
    assert.equal(effective, "tu connais noel");
  });
});

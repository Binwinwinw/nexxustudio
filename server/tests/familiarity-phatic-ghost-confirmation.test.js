/**
 * FIX-FAMILIARITY-PHATIC-GHOST-CONFIRMATION
 * Phatique « tu fais de bon » ≠ sujet de définition ; ack « ça » ≠ confirm fantôme.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseFamiliarityQuery,
  isFamiliarityIntent,
} from "../src/agent/utils/intent-guards/familiarityIntentGuards.js";
import {
  interpretRequest,
  INTERPRETER_ACTIONS,
} from "../src/agent/micro/interpreter/requestInterpreter.js";
import { extractConversationState } from "../src/agent/micro/continuity/conversationContinuityContext.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isPhaticSocialCheckinIntent } from "../src/agent/policies/social/socialPatternPolicy.js";

const PHATIC_BON = "qu'est ce que tu fais de bon ?";
const PHATIC_QUOI = "tu fais quoi de beau ?";
const ACK_PLEASURE =
  "content quand tu dis que tout va bien pour toi, ça fait plaisir";

function assertNoGhostConfirm(hit) {
  assert.notEqual(hit?.path, "request_interpreter_confirm");
  assert.doesNotMatch(hit?.reply || "", /Tu parles de Tu Fais de Bon/i);
  assert.doesNotMatch(hit?.reply || "", /tu fais de bon/i);
}

describe("FAMILIARITY-PHATIC — extraction", () => {
  it("FAMILIARITY-PHATIC-01 — qu'est ce que tu fais de bon : pas de sujet", () => {
    assert.equal(parseFamiliarityQuery(PHATIC_BON), null);
    assert.equal(isFamiliarityIntent(PHATIC_BON), false);
    assert.equal(isPhaticSocialCheckinIntent(PHATIC_BON), true);
  });

  it("FAMILIARITY-PHATIC-02 — tu fais quoi de beau : pas de confirm", async () => {
    assert.equal(parseFamiliarityQuery(PHATIC_QUOI), null);
    const out = interpretRequest(PHATIC_QUOI);
    assert.notEqual(out.nextAction, INTERPRETER_ACTIONS.CONFIRM);
    const hit = await runConversationShortCircuit(PHATIC_QUOI);
    assertNoGhostConfirm(hit);
    assert.notEqual(hit?.path, "request_interpreter_confirm");
  });

  it("variantes phatiques sans sujet familiarity", () => {
    for (const q of [
      "qu'est-ce que tu fais de beau ?",
      "tu fais quoi de bon ?",
      "et toi, tu fais quoi ?",
      "sinon, tu fais quoi de beau ?",
    ]) {
      assert.equal(parseFamiliarityQuery(q), null, q);
      assert.equal(isFamiliarityIntent(q), false, q);
    }
  });
});

describe("FAMILIARITY-PHATIC — continuité T2→T3", () => {
  it("FAMILIARITY-PHATIC-03 — ack après phatic : pas de Tu Fais de Bon", async () => {
    const t2 = await runConversationShortCircuit(PHATIC_BON);
    assert.equal(isPhaticSocialCheckinIntent(PHATIC_BON), true);
    assert.notEqual(t2?.path, "request_interpreter_confirm");
    assert.ok(t2?.reply);

    const history = [
      { role: "assistant", content: "Tout va bien ici." },
      { role: "user", content: PHATIC_BON },
      { role: "assistant", content: t2.reply },
    ];
    const state = extractConversationState(history);
    assert.notEqual(state.activeSubjectLabel, "Tu Fais de Bon");
    assert.doesNotMatch(state.activeSubjectLabel || "", /tu fais de bon/i);

    const interp = interpretRequest(ACK_PLEASURE, { history });
    assert.notEqual(interp.nextAction, INTERPRETER_ACTIONS.CONFIRM);
    assert.equal(interp.pendingSubjectLabel, null);

    const t3 = await runConversationShortCircuit(ACK_PLEASURE, { history });
    assertNoGhostConfirm(t3);
  });

  it("FAMILIARITY-ACK-04 — acks après check-in : pas de confirm", async () => {
    const history = [
      { role: "user", content: "comment vas tu ?" },
      { role: "assistant", content: "Tout va bien ici." },
    ];
    for (const ack of [
      "ça fait plaisir",
      "c'est gentil",
      "content de savoir ça",
      "tant mieux",
    ]) {
      const interp = interpretRequest(ack, { history });
      assert.notEqual(interp.nextAction, INTERPRETER_ACTIONS.CONFIRM, ack);
      const hit = await runConversationShortCircuit(ack, { history });
      assert.notEqual(hit?.path, "request_interpreter_confirm", ack);
      assert.doesNotMatch(hit?.reply || "", /Tu parles de/i, ack);
    }
  });
});

describe("FAMILIARITY-PHATIC — définitions valides", () => {
  it("FAMILIARITY-VALID-05 — Kubernetes / RAG / OAuth conservés", () => {
    assert.equal(
      parseFamiliarityQuery("c'est quoi Kubernetes ?")?.kind,
      "definition",
    );
    assert.match(
      parseFamiliarityQuery("c'est quoi Kubernetes ?")?.rawSubject || "",
      /kubernetes/i,
    );
    assert.match(
      parseFamiliarityQuery("qu est ce que RAG ?")?.rawSubject || "",
      /rag/i,
    );
    assert.equal(parseFamiliarityQuery("c'est quoi OAuth ?")?.kind, "definition");
    assert.match(
      parseFamiliarityQuery("c'est quoi OAuth ?")?.rawSubject || "",
      /oauth/i,
    );
    assert.equal(isFamiliarityIntent("tu connais Kubernetes ?"), true);
  });

  it("FAMILIARITY-CONTEXT-06 — confirmation après définition valide conservée", () => {
    const history = [
      { role: "user", content: "c'est quoi Kubernetes ?" },
      {
        role: "assistant",
        content: "Kubernetes, c'est un orchestrateur de conteneurs.",
      },
    ];
    const state = extractConversationState(history);
    assert.match(state.activeSubjectLabel || state.activeSubject || "", /kubernetes/i);

    const linked = interpretRequest("et pour ça tu peux me dire ?", { history });
    assert.equal(linked.nextAction, INTERPRETER_ACTIONS.CONFIRM);
    assert.match(linked.clarificationReply || "", /Kubernetes/i);

    const fragile = interpretRequest(
      "je sais pas comment dire mais tu vois le truc avec les boules",
    );
    assert.equal(fragile.nextAction, INTERPRETER_ACTIONS.CONFIRM);
    assert.match(fragile.clarificationReply || "", /pétanque/i);
  });
});

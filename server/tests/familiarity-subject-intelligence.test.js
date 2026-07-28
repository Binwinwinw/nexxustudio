import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildFamiliarityReply } from "../src/agent/micro/replies/familiarityReplyBuilder.js";
import { buildSubjectInterpretedState } from "../src/agent/micro/subject/subjectInterpretedState.js";
import { planFamiliaritySubjectIntent } from "../src/agent/micro/subject/subjectIntentRouter.js";
import { DETERMINISTIC_ROUTES } from "../src/agent/micro/subject/subjectRoutingHints.js";
import { SUBJECT_ROUTER_ACTIONS } from "../src/agent/micro/subject/subjectIntentRouter.js";
import {
  clearSubjectSessionMemory,
  extractAndRememberProjectAnchor,
} from "../src/agent/micro/subject/subjectSessionMemory.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const SESSION = "test-familiarity-sil";

beforeEach(() => {
  clearSubjectSessionMemory(SESSION);
});

describe("familiarité — Subject Intelligence Layer", () => {
  it("Italie → familiarity_surface + réponse connue", () => {
    const interpreted = buildSubjectInterpretedState({
      query: "Tu connais l'Italie ?",
      extractedSubject: "l'Italie",
    });
    const plan = planFamiliaritySubjectIntent(interpreted, { kind: "recognition" });
    assert.equal(plan.routeHint, DETERMINISTIC_ROUTES.FAMILIARITY_SURFACE);

    const reply = buildFamiliarityReply("Tu connais l'Italie ?");
    assert.ok(reply);
    assert.match(reply, /Italie/i);
  });

  it("eclipse ambigu → disambiguate (pas reconnaissance vide)", () => {
    const interpreted = buildSubjectInterpretedState({
      query: "Tu connais eclipse ?",
      extractedSubject: "eclipse",
    });
    const plan = planFamiliaritySubjectIntent(interpreted, { kind: "recognition" });
    assert.equal(plan.action, SUBJECT_ROUTER_ACTIONS.DISAMBIGUATE);

    const reply = buildFamiliarityReply("Tu connais eclipse ?");
    assert.ok(reply);
    assert.match(reply, /interprétations|IDE|éclipse/i);
    assert.doesNotMatch(reply, /^Oui, je connais eclipse/i);
  });

  it("session Atlas — continuité après ancrage projet", () => {
    extractAndRememberProjectAnchor("le projet Atlas", SESSION);
    const reply = buildFamiliarityReply("Tu connais Atlas ?", {
      sessionId: SESSION,
    });
    assert.ok(reply);
    assert.match(reply, /session|Atlas/i);
  });

  it("short-circuit route familiarity_deterministic", async () => {
    const hit = await runConversationShortCircuit("Tu connais l'Italie ?");
    assert.ok(hit);
    assert.equal(hit.path, "familiarity_deterministic");
    assert.match(hit.reply, /Italie/i);
  });
});

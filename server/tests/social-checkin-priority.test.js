import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { runAgentUnderstandingPhase } from "../src/agent/nexxusAgentCycle.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { resolveIntentComposition } from "../src/agent/policies/intent/intentCompositionPolicy.js";
import { inferActiveGoal } from "../src/agent/policies/conversation/activeGoalPolicy.js";
import { isOpenExplorationFrame } from "../src/agent/policies/conversation/openExplorationFramePolicy.js";
import { understandQuery } from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import {
  isIdleConfirmedSocialCheckin,
  isWellbeingCheckinIntent,
  SOCIAL_CHECKIN_FORMAL_REPLY,
} from "../src/agent/policies/social/index.js";
import intentClassifier from "../src/agent/utils/intent-guards/intentClassifier.js";

const OPERATIONAL_INVITE = {
  role: "assistant",
  content:
    "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
};

const CARTE_QUERY =
  "je veux créer une carte de visite avec mes coordonnées et d'autres informations donc comment pourrais je présenter cette carte?";

function assertNoOperationalReroute(hit) {
  assert.equal(hit?.path, "social_deterministic");
  assert.equal(hit?.mode, "INSTANT");
  assert.ok(!hit?.deferToLlm);
  assert.notEqual(hit?.path, "exploratory_conversation_light");
  assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
  assert.doesNotMatch(hit?.reply || "", /objectif en une phrase/i);
  assert.doesNotMatch(hit?.reply || "", /Planner|COMPOSER/i);
}

async function runLiveLikeSc(query, history = []) {
  const { turnComprehension, turnLoop, understanding } =
    runAgentUnderstandingPhase(query, history);
  const justIntent = evaluateJustIntent(query);
  const hit = await runConversationShortCircuit(query, {
    history,
    turnComprehension,
    turnLoop,
    justIntent,
    queryUnderstanding: understanding,
  });
  return { hit, justIntent, turnComprehension, understanding };
}

describe("social_checkin priority — A–G", () => {
  it("A. bonsoir puis comment allez-vous ? → social direct, activeGoal=null", async () => {
    const history = [
      { role: "user", content: "bonsoir" },
      OPERATIONAL_INVITE,
    ];
    const q = "comment allez-vous ?";
    assert.equal(inferActiveGoal(history), null);
    const { hit, justIntent, understanding } = await runLiveLikeSc(q, history);
    assert.equal(justIntent.domain, "social");
    assert.equal(justIntent.action, "social_checkin");
    assert.ok(
      (understanding.intents || []).some((i) => i.domain === "social"),
      "understandQuery doit voir le check-in vouvoiement",
    );
    assert.equal(isIdleConfirmedSocialCheckin(q, { history, justIntent }), true);
    assertNoOperationalReroute(hit);
    assert.equal(hit?.socialCheckinPriority, true);
    assert.equal(inferActiveGoal([...history, { role: "user", content: q }]), null);
  });

  it("B. salut puis comment ça va ? → social, aucune demande d'objectif", async () => {
    const history = [
      { role: "user", content: "salut" },
      OPERATIONAL_INVITE,
    ];
    const q = "comment ça va ?";
    const { hit, justIntent } = await runLiveLikeSc(q, history);
    assert.equal(justIntent.action, "social_checkin");
    assertNoOperationalReroute(hit);
    assert.match(
      hit?.reply || "",
      /^(?:Ça va bien, merci\.|Tout va bien ici\.|Ça va, merci\.)$/,
    );
  });

  it("C. bonsoir puis qu'est-ce qu'on peut faire ? → orientation, pas check-in", async () => {
    const history = [
      { role: "user", content: "bonsoir" },
      OPERATIONAL_INVITE,
    ];
    const q = "qu'est-ce qu'on peut faire ?";
    assert.equal(isWellbeingCheckinIntent(q), false);
    assert.equal(isOpenExplorationFrame(q), true);
    const { hit } = await runLiveLikeSc(q, history);
    assert.notEqual(hit?.socialCheckinPriority, true);
    assert.equal(isIdleConfirmedSocialCheckin(q, { history }), false);
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
    assert.doesNotMatch(hit?.reply || "", /objectif en une phrase/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /^(?:Ça va bien, merci\.|Tout va bien ici\.|Ça va, merci\.|Je vais bien, merci)/,
    );
  });

  it("D. bonsoir puis crée une carte de visite → opérationnel", async () => {
    const history = [
      { role: "user", content: "bonsoir" },
      OPERATIONAL_INVITE,
    ];
    const q = "créer une carte de visite";
    assert.equal(isWellbeingCheckinIntent(q), false);
    assert.equal(isIdleConfirmedSocialCheckin(q, { history }), false);
    const { hit } = await runLiveLikeSc(q, history);
    assert.equal(hit?.path, "named_create_start");
    assert.notEqual(hit?.socialCheckinPriority, true);
  });

  it("E. tâche active carte puis et en HTML ? → carryover conservé", async () => {
    const history = [
      { role: "user", content: "salut" },
      OPERATIONAL_INVITE,
      { role: "user", content: CARTE_QUERY },
      {
        role: "assistant",
        content: "On part sur **carte de visite**. Recto, contact, support.",
      },
    ];
    const q = "et en HTML ?";
    assert.ok(inferActiveGoal(history));
    assert.equal(isIdleConfirmedSocialCheckin(q, { history }), false);
    const { hit } = await runLiveLikeSc(q, history);
    assert.equal(hit?.path, "active_goal_continue");
    assert.match(hit?.reply || "", /carte de visite/i);
    assert.match(hit?.reply || "", /HTML/i);
  });

  it("F. check-in après invitation opérationnelle → intention courante gagne", async () => {
    const history = [
      { role: "user", content: "bonsoir" },
      OPERATIONAL_INVITE,
    ];
    const q = "comment allez vous monsieur ou madame ??";
    const just = evaluateJustIntent(q);
    const composition = resolveIntentComposition(q, { history, justIntent: just });
    assert.equal(just.domain, "social");
    assert.equal(just.action, "social_checkin");
    assert.equal(composition.primary_action, "social_checkin");
    assert.equal(composition.just_relation, "confirmed");
    assert.equal(inferActiveGoal(history), null);
    const { hit } = await runLiveLikeSc(q, history);
    assertNoOperationalReroute(hit);
    assert.equal(hit?.reply, SOCIAL_CHECKIN_FORMAL_REPLY);
    const classified = intentClassifier.classifyIntent(q);
    assert.equal(classified.intent, intentClassifier.INTENT_TAXONOMY.SOCIAL_CHIT_CHAT);
  });

  it("G. vouvoiement → pas de tutoiement automatique", async () => {
    const history = [
      { role: "user", content: "bonsoir" },
      OPERATIONAL_INVITE,
    ];
    const q = "comment allez vous monsieur ou madame ??";
    const { hit } = await runLiveLikeSc(q, history);
    assertNoOperationalReroute(hit);
    assert.match(hit?.reply || "", /\bvous\b/i);
    assert.doesNotMatch(hit?.reply || "", /\b(?:tu|te|ton|ta|tes)\b/i);
    assert.doesNotMatch(hit?.reply || "", /Qu'est-ce que tu veux faire/i);
  });
});

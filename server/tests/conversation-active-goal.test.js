import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  inferActiveGoal,
  resolveActiveGoal,
  isEllipticGoalFollowUp,
} from "../src/agent/policies/conversation/activeGoalPolicy.js";
import {
  evaluateCurrentTurnAnchoring,
  enforceCurrentTurnAnchoring,
} from "../src/agent/policies/conversation/currentTurnAnchoringPolicy.js";
import { buildIdeationOptionsReply } from "../src/agent/utils/intent-guards/ideationIntentGuards.js";
import {
  beginSessionWorkTurn,
  commitSessionWorkTurn,
  clearSessionWorkMemoryForTests,
  createEmptySessionWorkMemory,
} from "../src/agent/memory/sessionWorkMemory.js";

const SOCIAL_HISTORY = [
  { role: "user", content: "salut salut" },
  {
    role: "assistant",
    content:
      "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
  },
  { role: "user", content: "comment vas tu ?" },
  { role: "assistant", content: "Tout va bien ici." },
];

const WHO_DRIVES = "qu'est-ce que tu tu veux faire ou continuer à faire ?";
const META_CRITIQUE =
  "en fait n'ayant rien encore à faire tu ne devrais pas répondre de cette manière car tu dois avoir la capacité de savoir ce qui est en cours";
const CARTE_QUERY =
  "je veux créer une carte de visite avec mes coordonnées et d'autres informations donc comment pourrais je présenter cette carte?";

const TEST_SESSION = "test-active-goal-continuity";

describe("active_goal — inférence", () => {
  it("A. historique social → active_goal null", () => {
    assert.equal(inferActiveGoal(SOCIAL_HISTORY), null);
    assert.equal(
      resolveActiveGoal({ query: WHO_DRIVES, history: SOCIAL_HISTORY }),
      null,
    );
  });

  it("C. tour courant carte de visite → active_goal create", () => {
    const goal = resolveActiveGoal({ query: CARTE_QUERY, history: SOCIAL_HISTORY });
    assert.equal(goal?.kind, "create");
    assert.match(goal?.label || "", /carte de visite/i);
    assert.equal(goal?.source, "current_turn");
  });

  it("E. historique create → elliptic continue", () => {
    const history = [
      ...SOCIAL_HISTORY,
      { role: "user", content: CARTE_QUERY },
      { role: "assistant", content: "On part sur **carte de visite**." },
    ];
    const goal = inferActiveGoal(history);
    assert.match(goal?.label || "", /carte de visite/i);
    assert.equal(isEllipticGoalFollowUp("et en HTML ?", goal), true);
    assert.equal(isEllipticGoalFollowUp("continue", goal), true);
    assert.equal(isEllipticGoalFollowUp("la suite", goal), true);
    assert.equal(isEllipticGoalFollowUp("en PDF ?", goal), true);
    assert.equal(isEllipticGoalFollowUp("pour l'impression ?", goal), true);
    assert.equal(isEllipticGoalFollowUp("crée du Python", goal), false);
    assert.equal(isEllipticGoalFollowUp("corrige ce JS", goal), false);
    assert.equal(isEllipticGoalFollowUp("écris du HTML", goal), false);
  });
});

describe("active_goal — rails A–E", () => {
  it("A. who-drives après social → aucune tâche active", async () => {
    const hit = await runConversationShortCircuit(WHO_DRIVES, {
      history: SOCIAL_HISTORY,
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/meta_who_drives");
    assert.match(hit?.reply || "", /aucune tâche active/i);
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
    assert.doesNotMatch(hit?.reply || "", /déjà .* en cours/i);
  });

  it("B. critique méta → meta_conversation_feedback, pas rupture", async () => {
    const history = [
      ...SOCIAL_HISTORY,
      { role: "user", content: WHO_DRIVES },
      {
        role: "assistant",
        content: "Rien n'est lancé — aucune tâche active.",
      },
    ];
    const hit = await runConversationShortCircuit(META_CRITIQUE, { history });
    assert.equal(hit?.path, "meta_conversation_feedback");
    assert.match(hit?.reply || "", /aucune tâche active/i);
    assert.match(hit?.reply || "", /façon de répondre/i);
    assert.doesNotMatch(hit?.reply || "", /erreur critique/i);
    assert.doesNotMatch(hit?.reply || "", /Design Extract/i);
  });

  it("C. carte de visite → aide concrète de présentation", async () => {
    const hit = await runConversationShortCircuit(CARTE_QUERY, {
      history: SOCIAL_HISTORY,
    });
    assert.equal(hit?.path, "named_create_start");
    assert.match(hit?.reply || "", /carte de visite/i);
    assert.match(hit?.reply || "", /Recto/i);
    assert.match(hit?.reply || "", /Verso/i);
    assert.match(hit?.reply || "", /Support/i);
    assert.doesNotMatch(hit?.reply || "", /Voici 3 pistes concrètes/);
    assert.doesNotMatch(hit?.reply || "", /reformule/i);
  });

  it("D. entity_miss ne bloque pas un objet déjà dans le tour", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: CARTE_QUERY,
      reply: buildIdeationOptionsReply(CARTE_QUERY),
    });
    assert.ok(!verdict.signals.includes("entity_miss"));
    const enforced = enforceCurrentTurnAnchoring({
      query: CARTE_QUERY,
      reply: buildIdeationOptionsReply(CARTE_QUERY),
    });
    assert.match(enforced.text, /carte de visite/i);
    assert.doesNotMatch(enforced.text, /reformule/i);
  });

  it("E. suite elliptique après goal → continue la carte", async () => {
    const history = [
      ...SOCIAL_HISTORY,
      { role: "user", content: CARTE_QUERY },
      {
        role: "assistant",
        content: "On part sur **carte de visite**. Recto, contact, support.",
      },
    ];
    const hit = await runConversationShortCircuit("et en HTML ?", { history });
    assert.equal(hit?.path, "active_goal_continue");
    assert.match(hit?.reply || "", /carte de visite/i);
    assert.match(hit?.reply || "", /HTML/i);
    assert.doesNotMatch(hit?.reply || "", /reformule/i);
  });

  it("séquence live : salut → check-in → who-drives → carte → HTML", async () => {
    const salut = await runConversationShortCircuit("salut salut", { history: [] });
    assert.ok(salut?.path === "social_deterministic" || salut?.socialPatternName);
    assert.equal(inferActiveGoal([{ role: "user", content: "salut salut" }]), null);

    const hist1 = [
      { role: "user", content: "salut salut" },
      { role: "assistant", content: salut?.reply || "Salut !" },
    ];
    assert.equal(inferActiveGoal(hist1), null);

    const checkin = await runConversationShortCircuit("comment vas-tu ?", {
      history: hist1,
    });
    assert.equal(inferActiveGoal([
      ...hist1,
      { role: "user", content: "comment vas-tu ?" },
    ]), null);

    const hist2 = [
      ...hist1,
      { role: "user", content: "comment vas-tu ?" },
      { role: "assistant", content: checkin?.reply || "Tout va bien ici." },
    ];
    const who = await runConversationShortCircuit(
      "qu'est-ce que tu veux faire ou continuer à faire ?",
      { history: hist2 },
    );
    assert.equal(who?.socialPatternName, "social/meta_who_drives");
    assert.match(who?.reply || "", /aucune tâche active/i);

    const hist3 = [
      ...hist2,
      {
        role: "user",
        content: "qu'est-ce que tu veux faire ou continuer à faire ?",
      },
      { role: "assistant", content: who.reply },
    ];
    const carte = await runConversationShortCircuit(
      "je veux créer une carte de visite avec mes coordonnées",
      { history: hist3 },
    );
    assert.equal(carte?.path, "named_create_start");
    assert.match(carte?.reply || "", /carte de visite/i);
    assert.match(carte?.reply || "", /Recto/i);
    assert.match(carte?.reply || "", /Verso/i);

    const hist4 = [
      ...hist3,
      {
        role: "user",
        content: "je veux créer une carte de visite avec mes coordonnées",
      },
      { role: "assistant", content: carte.reply },
    ];
    const html = await runConversationShortCircuit("et en HTML ?", {
      history: hist4,
    });
    assert.equal(html?.path, "active_goal_continue");
    assert.match(html?.reply || "", /carte de visite/i);
    assert.match(html?.reply || "", /HTML/i);
  });
});

describe("active_goal — sessionWorkMemory", () => {
  beforeEach(() => {
    clearSessionWorkMemoryForTests(TEST_SESSION);
  });

  it("état vide : activeGoal null", () => {
    const empty = createEmptySessionWorkMemory(TEST_SESSION);
    assert.equal(empty.activeGoal, null);
  });

  it("commit persiste le goal carte", () => {
    const ts = new Date("2026-08-14T20:00:00.000Z").toISOString();
    const saved = commitSessionWorkTurn({
      sessionId: TEST_SESSION,
      turnTimestamp: ts,
      query: CARTE_QUERY,
      activeGoal: resolveActiveGoal({ query: CARTE_QUERY, history: [] }),
    });
    assert.match(saved.activeGoal?.label || "", /carte de visite/i);
    const ctx = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-08-14T20:01:00.000Z"),
    });
    assert.match(ctx.priorState.activeGoal?.label || "", /carte de visite/i);
  });
});

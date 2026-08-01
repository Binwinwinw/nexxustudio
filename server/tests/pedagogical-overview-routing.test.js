import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractPedagogicalSubject,
  isPedagogicalOverviewRequest,
  parsePedagogicalOverview,
} from "../src/agent/utils/pedagogicalOverviewIntentGuards.js";
import {
  extractPedagogicalLevel,
  extractPedagogicalDepth,
  resolvePedagogicalRenderLevel,
} from "../src/agent/utils/pedagogicalOverviewParser.js";
import {
  resolvePedagogicalOverviewReply,
  resolvePedagogicalOverviewShortCircuit,
  renderPedagogicalOverviewFromSlots,
} from "../src/agent/micro/replies/pedagogicalOverviewComposer.js";
import { getPedagogicalTopicKnowledge } from "../src/agent/micro/replies/pedagogicalOverviewKnowledge.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateClarificationDecision, CLARIFICATION_DECISIONS } from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent, shouldApplyJustIntentClarification } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";
import { PEDAGOGICAL_DELIVERY_MODES } from "../src/agent/policies/pedagogical/index.js";

const FRACTIONS_6E_Q =
  "que dois apprendre un élève de 6eme sur les fractions simples ?";

const FRACTIONS_4E_Q =
  "que dois apprendre un élève de 4eme sur les fractions complexes??";

describe("pedagogicalOverview — routage local-first", () => {
  it("détecte une question socle 6e fractions", () => {
    assert.equal(isPedagogicalOverviewRequest(FRACTIONS_6E_Q), true);
    assert.match(extractPedagogicalSubject(FRACTIONS_6E_Q) || "", /fraction/i);
  });

  it("fiche locale fractions 6e — pas de refus", () => {
    const reply = resolvePedagogicalOverviewReply(FRACTIONS_6E_Q);
    assert.ok(reply);
    assert.match(reply, /fraction/i);
    assert.match(reply, /6e|numérateur/i);
    assert.doesNotMatch(reply, /Je vois la piste/);
  });

  it("short-circuit → pedagogical_overview_deterministic", async () => {
    const hit = await runConversationShortCircuit(FRACTIONS_6E_Q);
    assert.equal(hit?.path, "pedagogical_overview_deterministic");
    assert.match(hit?.reply || "", /fraction/i);
    assert.notEqual(hit?.deferToFullPipeline, true);
  });

  it("clarification gate → can_answer_now", () => {
    const ev = evaluateJustIntent(FRACTIONS_6E_Q);
    const decision = evaluateClarificationDecision(FRACTIONS_6E_Q, ev);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(shouldApplyJustIntentClarification(FRACTIONS_6E_Q, ev, null), false);
  });

  it("n'intercepte pas une demande de programme officiel", () => {
    const q = "donne le programme officiel de l'éducation nationale pour les fractions en 6e";
    assert.equal(isPedagogicalOverviewRequest(q), false);
    const hit = resolvePedagogicalOverviewShortCircuit(q);
    assert.equal(hit, null);
  });

  it("ne confond pas avec le refus INSUFFICIENT_SIGNAL", () => {
    const reply = resolvePedagogicalOverviewReply(FRACTIONS_6E_Q);
    assert.notEqual(reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });
});

describe("pedagogicalOverview — slots paramétrés (lot 4)", () => {
  it("extrait niveau 4e et profondeur advanced pour fractions complexes", () => {
    const slots = parsePedagogicalOverview(FRACTIONS_4E_Q);
    assert.ok(slots);
    assert.equal(slots.topic, "fractions");
    assert.equal(slots.level, "4");
    assert.equal(slots.depth, "advanced");
    assert.match(slots.topicLabel || "", /complex/i);
  });

  it("6e simples et 4e complexes produisent des réponses distinctes", () => {
    const reply6 = resolvePedagogicalOverviewReply(FRACTIONS_6E_Q);
    const reply4 = resolvePedagogicalOverviewReply(FRACTIONS_4E_Q);
    assert.ok(reply6);
    assert.ok(reply4);
    assert.notEqual(reply6, reply4);
    assert.match(reply6, /6e/i);
    assert.match(reply4, /4e/i);
    assert.match(reply6, /même dénominateur/i);
    assert.match(reply4, /PPCM|dénominateur commun/i);
    assert.doesNotMatch(reply4, /numérateur, dénominateur, fractions égales/);
  });

  it("short-circuit 4e → pedagogical_overview_deterministic avec contenu 4e", async () => {
    const hit = await runConversationShortCircuit(FRACTIONS_4E_Q);
    assert.equal(hit?.path, "pedagogical_overview_deterministic");
    assert.match(hit?.reply || "", /4e/i);
    assert.match(hit?.reply || "", /multipli|PPCM|PGCD/i);
  });

  it("sans niveau explicite, profondeur intro/avancée infère le rendu", () => {
    const introSlots = parsePedagogicalOverview(
      "que doit apprendre un élève sur les fractions simples ?",
    );
    const advancedSlots = parsePedagogicalOverview(
      "que doit apprendre un élève sur les fractions complexes ?",
    );
    assert.ok(introSlots);
    assert.ok(advancedSlots);
    assert.equal(introSlots.level, null);
    assert.equal(advancedSlots.level, null);

    const introLevel = resolvePedagogicalRenderLevel(
      introSlots,
      getPedagogicalTopicKnowledge("fractions"),
    );
    const advancedLevel = resolvePedagogicalRenderLevel(
      advancedSlots,
      getPedagogicalTopicKnowledge("fractions"),
    );
    assert.equal(introLevel, "6");
    assert.equal(advancedLevel, "4");

    const introReply = renderPedagogicalOverviewFromSlots(introSlots);
    const advancedReply = renderPedagogicalOverviewFromSlots(advancedSlots);
    assert.match(introReply || "", /6e/i);
    assert.match(advancedReply || "", /4e/i);
  });

  it("parseur extrait le niveau depuis plusieurs formulations", () => {
    assert.equal(extractPedagogicalLevel("élève de 4ème").level, "4");
    assert.equal(extractPedagogicalLevel("en 6e sur les maths").level, "6");
    assert.equal(extractPedagogicalDepth("fractions complexes"), "advanced");
    assert.equal(extractPedagogicalDepth("fractions simples"), "intro");
  });

  it("sujet inconnu sans module → defer LLM, pas fiche figée", () => {
    const q = "que doit apprendre un élève de 6e en histoire de France ?";
    assert.equal(isPedagogicalOverviewRequest(q), true);
    const hit = resolvePedagogicalOverviewShortCircuit(q);
    assert.equal(hit?.path, "pedagogical_overview");
    assert.equal(hit?.deferToLlm, true);
    assert.ok(hit?.reflectiveHint);
    assert.equal(hit?.reply, undefined);
  });

  it("géométrie 5e → deterministic via registre + KB", async () => {
    const q = "que doit apprendre un élève de 5e en géométrie ?";
    assert.equal(isPedagogicalOverviewRequest(q), true);
    const slots = parsePedagogicalOverview(q);
    assert.equal(slots?.topic, "geometrie");
    assert.equal(slots?.level, "5");
    const reply = resolvePedagogicalOverviewReply(q);
    assert.ok(reply);
    assert.match(reply, /5e/i);
    assert.match(reply, /triangle|parall|angle/i);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "pedagogical_overview_deterministic");
  });

  it("géométrie seconde → pas de nearest-match 5e, bascule generative", async () => {
    const q = "que doit apprendre un élève de seconde en géométrie";
    assert.equal(isPedagogicalOverviewRequest(q), true);
    const slots = parsePedagogicalOverview(q);
    assert.equal(slots?.topic, "geometrie");
    assert.equal(slots?.lyceeGrade, "seconde");
    assert.equal(slots?.educationBand, "lycee");
    assert.equal(slots?.level, null);
    assert.equal(resolvePedagogicalOverviewReply(q), null);
    const hit = resolvePedagogicalOverviewShortCircuit(q);
    assert.equal(hit?.path, "pedagogical_overview");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.coverage?.mode, PEDAGOGICAL_DELIVERY_MODES.LOCAL_GENERATIVE);
    const routed = await runConversationShortCircuit(q);
    assert.notEqual(routed?.path, "pedagogical_overview_deterministic");
  });
});

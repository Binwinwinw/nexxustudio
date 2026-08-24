import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildTurnComprehension,
  canFinalizeSocial,
  createTurnLoopState,
  gateSocialFinalize,
  observePilotRail,
  TURN_LOOP_RULE,
  TURN_COMPREHENSION_RULE,
} from "../src/agent/policies/conversation/turnComprehension.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isConversationSocialOnlyQuery } from "../src/agent/policies/intent/conversationIntentFrame.js";

describe("TurnComprehension — Parse (Lot 1)", () => {
  it("bonjour → social, mayFinalizeSocial", () => {
    const tc = buildTurnComprehension("bonjour");
    assert.equal(tc.rule, TURN_COMPREHENSION_RULE);
    assert.equal(tc.primaryGoal.kind, "social");
    assert.equal(tc.dominance.workPresent, false);
    assert.equal(canFinalizeSocial(tc), true);
    assert.equal(tc.toneMarkers.greeting || tc.toneMarkers.phatic, true);
  });

  it("check-in seul → social", () => {
    const tc = buildTurnComprehension("comment vas tu ?");
    assert.equal(tc.primaryGoal.kind, "social");
    assert.equal(tc.dominance.workPresent, false);
    assert.equal(canFinalizeSocial(tc), true);
    assert.equal(tc.toneMarkers.checkin, true);
  });

  it("bonjour + météo → workPresent, tone greeting, !mayFinalizeSocial", () => {
    const tc = buildTurnComprehension(
      "bonjour, quel temps fait il en martinique a l heure actuelle?",
    );
    assert.equal(tc.dominance.workPresent, true);
    assert.equal(tc.primaryGoal.kind, "work");
    assert.equal(tc.toneMarkers.greeting, true);
    assert.equal(canFinalizeSocial(tc), false);
  });

  it("bonjour + create tableau → workPresent", () => {
    const tc = buildTurnComprehension("bonjour, fais un tableau excel des ventes");
    assert.equal(tc.dominance.workPresent, true);
    assert.equal(canFinalizeSocial(tc), false);
  });

  it("turn_loop shape observe", () => {
    const tc = buildTurnComprehension("bonjour");
    const loop = createTurnLoopState(tc);
    assert.equal(loop.rule, TURN_LOOP_RULE);
    assert.equal(loop.phase, "parse");
    assert.equal(typeof loop.hypothesis.workPresent, "boolean");
    assert.equal(loop.verification.ok, null);
    assert.equal(loop.repairs.length, 0);
    observePilotRail(loop, {
      action: "instant_social",
      rail: "instant",
      source: "test",
    });
    assert.equal(loop.pilotRail, "instant");
    assert.equal(loop.stop.reason, "observe_only");
  });
});

describe("Turn loop — Verify/Repair social (Lot 2)", () => {
  it("greeting pur → verified_ok", () => {
    const tc = buildTurnComprehension("bonjour");
    const loop = createTurnLoopState(tc);
    const { allow, loop: out } = gateSocialFinalize(tc, loop, {
      action: "finalize_social",
      rail: "social_deterministic",
      source: "test",
    });
    assert.equal(allow, true);
    assert.equal(out.verification.ok, true);
    assert.equal(out.stop.reason, "verified_ok");
    assert.equal(out.repairs.length, 0);
  });

  it("greeting + work → social_over_work + suppress", () => {
    const tc = buildTurnComprehension(
      "bonjour, fais un tableau excel des ventes",
    );
    const loop = createTurnLoopState(tc);
    const { allow, loop: out } = gateSocialFinalize(tc, loop, {
      action: "finalize_social",
      rail: "social_deterministic",
      source: "test",
    });
    assert.equal(allow, false);
    assert.equal(out.verification.ok, false);
    assert.ok(out.verification.failures.includes("social_over_work"));
    assert.ok(out.repairs.length >= 1);
    assert.ok(out.repairs.length <= 2);
    assert.equal(out.repairs[0].toAction, "suppress_social");
    assert.ok(
      out.stop.reason === "escalate" || out.stop.reason === "repair_exhausted",
    );
  });

  it("max 2 repairs", () => {
    const tc = buildTurnComprehension(
      "bonjour, quel temps fait il en martinique?",
    );
    const loop = createTurnLoopState(tc);
    gateSocialFinalize(tc, loop, {
      action: "finalize_social",
      rail: "social_deterministic",
      source: "t1",
    });
    gateSocialFinalize(tc, loop, {
      action: "finalize_social",
      rail: "social_deterministic",
      source: "t2",
    });
    gateSocialFinalize(tc, loop, {
      action: "finalize_social",
      rail: "social_deterministic",
      source: "t3",
    });
    assert.ok(loop.repairs.length <= 2);
  });
});

describe("Decide social remplace one-shot (Lot 3)", () => {
  // Rouge gelé, hors lot — docs/governance/citadelle-input-invariants.md.
  // Ne pas réparer via entities.
  it("SC bonjour → social_deterministic verified", async () => {
    const q = "bonjour";
    const tc = buildTurnComprehension(q);
    const loop = createTurnLoopState(tc);
    const hit = await runConversationShortCircuit(q, {
      turnComprehension: tc,
      turnLoop: loop,
      history: [],
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.ok(hit?.reply);
    assert.equal(loop.stop.reason, "verified_ok");
  });

  it("SC bonjour+work → pas de finalize social", async () => {
    const q = "bonjour, fais un tableau excel des ventes";
    const tc = buildTurnComprehension(q);
    const loop = createTurnLoopState(tc);
    const hit = await runConversationShortCircuit(q, {
      turnComprehension: tc,
      turnLoop: loop,
      history: [],
    });
    assert.notEqual(hit?.path, "social_deterministic");
    if (hit?.reply) {
      assert.doesNotMatch(hit.reply, /papoter|Bonjour ! Si tu veux/i);
    }
  });

  it("isConversationSocialOnlyQuery respecte TC workPresent", () => {
    const q = "bonjour, fais un tableau excel des ventes";
    const tc = buildTurnComprehension(q);
    assert.equal(isConversationSocialOnlyQuery(q, { turnComprehension: tc }), false);
    assert.equal(isConversationSocialOnlyQuery("bonjour"), true);
  });
});

describe("Engage social — jeu / blague (anti-greeting générique)", () => {
  it("salut + jouer → play_invite, pas menu projet", async () => {
    const q = "salut salut, allons jouer a un jeu, ca t interesse ?";
    const tc = buildTurnComprehension(q);
    assert.equal(tc.dominance.engagePresent, true);
    assert.equal(tc.primaryGoal.action, "play");
    assert.equal(tc.responseExpectations.mayFinalizeGenericGreeting, false);
    const loop = createTurnLoopState(tc);
    const hit = await runConversationShortCircuit(q, {
      turnComprehension: tc,
      turnLoop: loop,
      history: [],
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/play_invite");
    assert.match(hit.reply, /jeu|pierre-feuille/i);
    assert.doesNotMatch(hit.reply, /cadrer un projet|structurer des livrables/i);
  });

  it("connais des blagues → joke_perform, pas lexique/familiarity", async () => {
    const q = "est ce que tu connais des blagues ???";
    const tc = buildTurnComprehension(q);
    assert.equal(tc.primaryGoal.action, "joke");
    const loop = createTurnLoopState(tc);
    const hit = await runConversationShortCircuit(q, {
      turnComprehension: tc,
      turnLoop: loop,
      history: [],
    });
    assert.equal(hit?.socialPatternName, "social/joke_perform");
    assert.match(hit.reply, /Voici une|plongeurs|blague|en veux/i);
    assert.doesNotMatch(hit.reply, /Des Blagues|creuser|vue d'ensemble/i);
  });

  it("qu'est ce que tu fais de beau → phatic, pas SIL familiarité", async () => {
    const q = "qu'est ce que tu fais de beau§??";
    const history = [
      { role: "user", content: "salut salut" },
      { role: "assistant", content: "Salut ! Si tu veux on peut papoter." },
      { role: "user", content: "coment cava ??" },
      { role: "assistant", content: "Ça va bien, merci." },
    ];
    const tc = buildTurnComprehension(q, history);
    assert.equal(tc.primaryGoal.kind, "social");
    assert.equal(tc.primaryGoal.action, "phatic");
    assert.equal(tc.dominance.workPresent, false);
    assert.equal(canFinalizeSocial(tc), true);
    const loop = createTurnLoopState(tc);
    const hit = await runConversationShortCircuit(q, {
      turnComprehension: tc,
      turnLoop: loop,
      history,
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/phatic_checkin");
    assert.doesNotMatch(hit?.reply || "", /Tu mentionnes|clarifier de quoi/i);
    assert.doesNotMatch(hit?.step || "", /Reconnaissance de sujet/i);
  });

  it("qu'est-ce que tu tu veux faire → meta_who_drives, pas Je vois la piste", async () => {
    const q = "qu'est-ce que tu tu veux faire ou continuer à faire ?";
    const history = [
      { role: "user", content: "salut salut" },
      {
        role: "assistant",
        content: "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet.",
      },
      { role: "user", content: "comment vas tu ?" },
      { role: "assistant", content: "Tout va bien ici." },
    ];
    const tc = buildTurnComprehension(q, history);
    assert.equal(tc.primaryGoal.kind, "social");
    assert.equal(tc.primaryGoal.action, "meta_who_drives");
    assert.equal(tc.dominance.workPresent, false);
    assert.equal(canFinalizeSocial(tc), true);
    const hit = await runConversationShortCircuit(q, {
      turnComprehension: tc,
      turnLoop: createTurnLoopState(tc),
      history,
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/meta_who_drives");
    assert.match(hit?.reply || "", /aucune tâche active/i);
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
    assert.doesNotMatch(hit?.reply || "", /objectif en une phrase/i);
  });

  it("qu'est-ce que tu fais ? nu → phatic ; pour corriger ce bug → travail", async () => {
    const phatic = "qu'est-ce que tu fais ?";
    const work = "qu'est-ce que tu fais pour corriger ce bug ?";
    const history = [
      { role: "user", content: "salut salut" },
      { role: "assistant", content: "Salut ! Si tu veux on peut papoter." },
    ];

    const phaticTc = buildTurnComprehension(phatic, history);
    assert.equal(phaticTc.primaryGoal.action, "phatic");
    assert.equal(phaticTc.dominance.workPresent, false);
    assert.equal(canFinalizeSocial(phaticTc), true);

    const workTc = buildTurnComprehension(work, history);
    assert.notEqual(workTc.primaryGoal.action, "phatic");
    assert.equal(workTc.dominance.workPresent, true);
    assert.equal(canFinalizeSocial(workTc), false);

    const workHit = await runConversationShortCircuit(work, {
      turnComprehension: workTc,
      turnLoop: createTurnLoopState(workTc),
      history,
    });
    assert.notEqual(workHit?.socialPatternName, "social/phatic_checkin");
    assert.doesNotMatch(workHit?.reply || "", /Tu mentionnes|clarifier de quoi/i);
    assert.doesNotMatch(workHit?.step || "", /Reconnaissance de sujet/i);
  });

  it("méta-blague postuler → joke_meta", async () => {
    const q =
      "tu savais que les editeurs recherchent des plumes originales, tu devrais postuler, bonne blague";
    const tc = buildTurnComprehension(q);
    assert.equal(tc.primaryGoal.action, "joke_meta");
    const loop = createTurnLoopState(tc);
    const hit = await runConversationShortCircuit(q, {
      turnComprehension: tc,
      turnLoop: loop,
      history: [],
    });
    assert.equal(hit?.socialPatternName, "social/joke_meta");
    assert.match(hit.reply, /Bien vu|absurde/i);
  });

  it("Verify: greeting générique bloqué si engage", () => {
    const tc = buildTurnComprehension("allons jouer a un jeu");
    const loop = createTurnLoopState(tc);
    const denied = gateSocialFinalize(tc, loop, {
      action: "instant_social",
      rail: "instant",
      source: "INSTANT_RESPONSES",
    });
    assert.equal(denied.allow, false);
    assert.ok(
      denied.loop.verification.failures.includes("generic_social_over_engage"),
    );
    const allowed = gateSocialFinalize(tc, createTurnLoopState(tc), {
      action: "finalize_social",
      rail: "social_deterministic",
      source: "socialPattern:social/play_invite",
    });
    assert.equal(allowed.allow, true);
  });
});

// Contrat P2 : docs/governance/citadelle-input-invariants.md — liste de champs fermée.
describe("TurnComprehension — entities P2 (projection)", () => {
  it("social : subjects vides, mayFinalizeSocial inchangé", () => {
    const tc = buildTurnComprehension("bonjour");
    assert.deepEqual(tc.entities.subjects, []);
    assert.deepEqual(tc.entities.sources, []);
    assert.deepEqual(tc.entities.localities, []);
    assert.equal(tc.entities.attachments, false);
    assert.equal(canFinalizeSocial(tc), true);
    assert.equal(tc.primaryGoal.kind, "social");
  });

  it("frame.target projeté dans subjects", () => {
    const tc = buildTurnComprehension("explique Redis", [], {
      understanding: {
        requestFrame: {
          domain: { kind: "technical", target: "Redis" },
          conversation: { socialOnly: false },
          task: { present: true, kind: "explain" },
        },
        intents: [],
        workIntentCount: 1,
        domains: ["technical"],
      },
    });
    assert.deepEqual(tc.entities.subjects, ["Redis"]);
    assert.deepEqual(tc.entities.localities, []);
  });

  it("intent.task.domainLabel projeté, label famille ignoré", () => {
    const tc = buildTurnComprehension("x", [], {
      understanding: {
        requestFrame: { domain: { target: null }, conversation: {} },
        intents: [
          {
            label: "Formation technique",
            task: { domainLabel: "react" },
          },
        ],
        workIntentCount: 1,
        domains: [],
      },
    });
    assert.deepEqual(tc.entities.subjects, ["react"]);
    assert.equal(tc.entities.subjects.includes("Formation technique"), false);
  });

  it("PJ : noms seulement, pas d'ingest", () => {
    const tc = buildTurnComprehension("bonjour", [], {
      attachments: [
        { originalname: "Guide.html", buffer: Buffer.from("ne-pas-lire") },
      ],
    });
    assert.deepEqual(tc.entities.sources, ["Guide.html"]);
    assert.equal(tc.entities.attachments, true);
    assert.equal(JSON.stringify(tc.entities).includes("ne-pas-lire"), false);
    assert.equal(canFinalizeSocial(tc), true);
  });

  it("localité : localities reste vide (succès P2)", () => {
    const tc = buildTurnComprehension(
      "bonjour, quel temps fait il en martinique a l heure actuelle?",
    );
    assert.deepEqual(tc.entities.localities, []);
    assert.equal(tc.dominance.workPresent, true);
    assert.equal(canFinalizeSocial(tc), false);
  });
});

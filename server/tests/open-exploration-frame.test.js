import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessOpenExplorationSlots,
  isOpenExplorationFrame,
  isSocialLeisureRelance,
  resolveOpenExplorationFrame,
  SURFACE_FRAME_OPEN_EXPLORATION,
} from "../src/agent/policies/conversation/openExplorationFramePolicy.js";
import {
  classifySocialPattern,
  isKnownSocialPattern,
} from "../src/agent/policies/social/index.js";
import {
  evaluateJustIntent,
  resolveIntentDomain,
} from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  resolveClarificationGate,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { resolveDeliverableContract, PROMISED_VALUES } from "../src/agent/policies/delivery/index.js";
import { INTENT_DOMAINS } from "../../shared/justIntentCatalog.js";

const FRAME_YES = [
  "qu'est-ce qu'on pourrait faire??",
  "qu'est-ce qu'on pourrais faire??",
  "qu'est-ce qu'on peut faire aujourd'hui?",
  "alors qu'est-ce qu'on pourrait faire aujourd'hui?",
  "on fait quoi?",
  "faire quoi maintenant?",
];

const FRAME_NO = [
  ["on pourrait faire quoi comme projet", "projet"],
  ["on peut faire une recherche web?", "web"],
  ["qu'est-ce qu'on pourrait faire sur ce dépôt?", "dépôt"],
  ["crée un agent python", "mandat"],
  ["c'est quoi la photosynthèse", "factuel"],
  ["ben on va papoter", "chat_invite"],
  ["qu'est ce qu'on pourrait faire ce soir ???", "loisir ce soir"],
  [
    "okéy sympa, bon qu'est ce qu'on pourrait faire ce soir ???",
    "relance après filler",
  ],
];

describe("OpenExplorationFrame P0 — slots / forme", () => {
  for (const q of FRAME_YES) {
    it(`frame ✓ « ${q} »`, () => {
      const slots = assessOpenExplorationSlots(q);
      assert.equal(slots.hasCollectiveOpener, true, "opener");
      assert.equal(slots.hasOpenActivityShell, true, "activity");
      assert.equal(slots.hasConcreteObject, false, "no object");
      assert.equal(slots.isExplorationFrame, true);
      assert.equal(isOpenExplorationFrame(q), true);

      const resolved = resolveOpenExplorationFrame(q);
      assert.equal(resolved.matched, true);
      assert.equal(resolved.surfaceFrame, SURFACE_FRAME_OPEN_EXPLORATION);
      assert.equal(resolved.promisedValue, "exploration_proposal");
      assert.equal(resolved.clarificationRequired, false);

      // Modal jamais requis : pourrait et pourrais se comportent pareil
      assert.equal(classifySocialPattern(q)?.patternName, "social/open_prompt");
      assert.equal(resolveIntentDomain(q), INTENT_DOMAINS.SOCIAL);
      assert.notEqual(evaluateJustIntent(q).strategy, "clarify_then_build");

      const gate = resolveClarificationGate(q, {
        justIntent: evaluateJustIntent(q),
      });
      assert.equal(gate.shouldClarify, false);
      assert.equal(
        gate.decision.decision,
        CLARIFICATION_DECISIONS.CAN_ANSWER_NOW,
      );

      assert.equal(
        resolveDeliverableContract(q).promisedValue,
        PROMISED_VALUES.EXPLORATION_PROPOSAL,
      );
    });
  }

  for (const [q, why] of FRAME_NO) {
    it(`frame ✗ « ${q} » (${why})`, () => {
      assert.equal(isOpenExplorationFrame(q), false, why);
      assert.notEqual(
        classifySocialPattern(q)?.patternName,
        "social/open_prompt",
      );
    });
  }

  it("pourrais vs pourrait : même slots (modal = bruit)", () => {
    const a = assessOpenExplorationSlots("qu'est-ce qu'on pourrait faire??");
    const b = assessOpenExplorationSlots("qu'est-ce qu'on pourrais faire??");
    assert.deepEqual(
      {
        opener: a.hasCollectiveOpener,
        shell: a.hasOpenActivityShell,
        object: a.hasConcreteObject,
        frame: a.isExplorationFrame,
      },
      {
        opener: b.hasCollectiveOpener,
        shell: b.hasOpenActivityShell,
        object: b.hasConcreteObject,
        frame: b.isExplorationFrame,
      },
    );
  });

  it("papoter reste chat_invite (autre surface)", () => {
    assert.equal(isKnownSocialPattern("ben on va papoter"), true);
    assert.equal(
      classifySocialPattern("ben on va papoter")?.patternName,
      "social/chat_invite",
    );
  });

  it("et si on papotait → chat_invite (conditionnel imparfait)", () => {
    assert.equal(
      classifySocialPattern("et si on papotait?")?.patternName,
      "social/chat_invite",
    );
  });
});

describe("salut + papoter — situation chat_invite, pas menu d'accueil", () => {
  it("short-circuit → chat_invite, reply écoute, pas menu cadrage projet", async () => {
    const { runConversationShortCircuit } = await import(
      "../src/agent/micro/classifiers/intentShortCircuit.js"
    );
    const q = "salut et si on papotait ?";
    assert.equal(classifySocialPattern(q)?.patternName, "social/chat_invite");
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/chat_invite");
    assert.match(hit?.reply || "", /écoute|sujet/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /cadrer un projet|structurer des livrables/i,
    );
  });
});

describe("relance sociale loisir — pas open_exploration", () => {
  const CE_SOIR =
    "okéy sympa, bon qu'est ce qu'on pourrait faire ce soir ???";

  it("ce soir + filler → leisure_relance, pas menu exploration", async () => {
    assert.equal(isSocialLeisureRelance(CE_SOIR), true);
    assert.equal(isOpenExplorationFrame(CE_SOIR), false);
    assert.equal(
      classifySocialPattern(CE_SOIR)?.patternName,
      "social/leisure_relance",
    );
    assert.equal(
      resolveDeliverableContract(CE_SOIR).promisedValue,
      PROMISED_VALUES.SOCIAL_CONTINUITY,
    );

    const { runConversationShortCircuit } = await import(
      "../src/agent/micro/classifiers/intentShortCircuit.js"
    );
    const hit = await runConversationShortCircuit(CE_SOIR, { history: [] });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/leisure_relance");
    assert.match(hit?.reply || "", /discuter|jouer|truc léger/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /1\.|RAG|server\/src|Obsidian|Impeccable|track audio/i,
    );
  });

  it("après check-in, « qu'est-ce qu'on pourrait faire » reste social", () => {
    const q = "qu'est-ce qu'on pourrait faire??";
    const history = [
      { role: "user", content: "yop yop comment ça ça va, ça roule ???" },
      { role: "assistant", content: "Tout va bien ici." },
    ];
    assert.equal(isOpenExplorationFrame(q, history), false);
    assert.equal(isSocialLeisureRelance(q, history), true);
    assert.equal(
      classifySocialPattern(q, history)?.patternName,
      "social/leisure_relance",
    );
  });

  it("sans historique, « qu'est-ce qu'on pourrait faire?? » reste exploration", () => {
    const q = "qu'est-ce qu'on pourrait faire??";
    assert.equal(isOpenExplorationFrame(q), true);
    assert.equal(isSocialLeisureRelance(q), false);
  });

  it("« qu'st ce qu'on fait » après filler ≠ loisir / exploration", () => {
    const q = "ok ok c'est cool alors qu'st ce qu'on fait ??";
    const history = [
      { role: "user", content: "yela comment ca va ??" },
      { role: "assistant", content: "Tout va bien ici." },
    ];
    assert.equal(isSocialLeisureRelance(q, history), false);
    assert.equal(isOpenExplorationFrame(q, history), false);
    assert.notEqual(
      classifySocialPattern(q, history)?.patternName,
      "social/leisure_relance",
    );
  });
});

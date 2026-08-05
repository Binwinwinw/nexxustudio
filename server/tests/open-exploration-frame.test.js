import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessOpenExplorationSlots,
  isOpenExplorationFrame,
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
} from "../src/agent/policies/clarificationDecisionPolicy.js";
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
});

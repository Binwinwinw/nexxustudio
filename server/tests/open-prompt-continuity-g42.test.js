import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isDeclineContinuationPrompt,
  suppressesCompareChooseForOpenPrompt,
  resolveOpenPromptContinuityShortCircuit,
} from "../src/agent/policies/meta/openPromptContinuityPolicy.js";
import { isCompareChooseRequest } from "../src/agent/utils/compareChooseIntentGuards.js";
import { classifySelectiveDecisionIntent } from "../src/agent/utils/selectiveDecisionIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY } from "../src/agent/policies/routing/compareChooseCompositePolicy.js";

const ATTACKER_AUTRES_QUERY =
  "non merci qu'est ce que tu pourrais proposer d'attaquer d'autres ?";

describe("G42 — open prompt continuity", () => {
  it("G42-T01 decline + open next step détecté", () => {
    assert.equal(isDeclineContinuationPrompt(ATTACKER_AUTRES_QUERY), true);
  });

  it("G42-T02 suppresses compare_choose sur open prompt", () => {
    assert.equal(suppressesCompareChooseForOpenPrompt(ATTACKER_AUTRES_QUERY), true);
    assert.equal(isCompareChooseRequest(ATTACKER_AUTRES_QUERY), false);
  });

  it("G42-T03 selective decision — proposer seul ne déclenche plus recommendation", () => {
    const hit = classifySelectiveDecisionIntent(ATTACKER_AUTRES_QUERY);
    assert.equal(hit.detected, false);
  });

  it("G42-T04 short-circuit open_prompt_continuity, pas compare_choose", async () => {
    const hit = await runConversationShortCircuit(ATTACKER_AUTRES_QUERY);
    assert.ok(hit?.openPromptContinuity || hit?.path === "open_prompt_continuity" || hit?.path === "ideation_deterministic");
    assert.notEqual(hit?.path, "compare_choose");
    assert.notEqual(hit?.deferToFullPipeline, true);
    assert.match(hit?.reply || "", /concept|code|architecture|piste|Laquelle/i);
  });

  it("G42-T05 smartphone compare_choose reste actif", () => {
    assert.equal(isCompareChooseRequest(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY), true);
    assert.equal(
      suppressesCompareChooseForOpenPrompt(COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY),
      false,
    );
  });
});

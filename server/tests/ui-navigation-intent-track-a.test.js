import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { isUiNavigationRestructureFeedback } from "../src/agent/utils/uiNavigationFeedbackGuards.js";
import { resolveReactAuditShortCircuitEmit } from "../src/agent/policies/reactAuditShortCircuit.js";
import { INTENT_ACTIONS } from "../../shared/justIntentCatalog.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const SIDEBAR_PHRASE =
  "je me pose des questions sur ta sidebar, je pense qu'il sera possible de combiner les menus suivant dans le boutons réglages il y aurait alors gouvernance, triage, audits & télémétrie, hooks, audit impact, artefacts et supprimer forge async. Qu'en penses tu ?";

describe("Track A — UI navigation beats audit lexicon", () => {
  it("détecte feedback sidebar / menus", () => {
    assert.equal(isUiNavigationRestructureFeedback(SIDEBAR_PHRASE), true);
  });

  it("justIntent — evaluate pas AUDIT sur phrase sidebar", () => {
    const just = evaluateJustIntent(SIDEBAR_PHRASE);
    assert.notEqual(just.action, INTENT_ACTIONS.AUDIT);
    assert.equal(just.action, INTENT_ACTIONS.EVALUATE);
  });

  it("G48 clarify — audite mon front → defer LLM, pas reply figée seule", () => {
    const hit = resolveReactAuditShortCircuitEmit("audite mon front", {});
    assert.equal(hit?.path, "react_audit_clarify");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.reply, null);
    assert.match(hit?.reflectiveHint || "", /UX|React Doctor|discriminante/i);
  });

  it("short-circuit sidebar → meta reflective, pas G48", async () => {
    const hit = await runConversationShortCircuit(SIDEBAR_PHRASE, {});
    assert.equal(hit?.path, "meta_conversation_reflective");
    assert.notEqual(hit?.path, "react_audit_clarify");
  });
});

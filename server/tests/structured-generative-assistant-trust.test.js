import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildAssistantTrustFallbackReply,
  buildAssistantTrustStructuredAddon,
  finalizeAssistantTrustLlmOutput,
} from "../src/agent/micro/replies/metaConversationReplyBuilder.js";
import { classifyMetaConversationIntent } from "../src/agent/utils/metaConversationIntentGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

describe("SGT — assistant_trust", () => {
  const q = "est-ce qu'on peut dire que tu es de bons conseils ??";

  it("classifie en reflective", () => {
    assert.equal(classifyMetaConversationIntent(q)?.kind, "assistant_trust");
    assert.equal(classifyMetaConversationIntent(q)?.tier, "reflective");
  });

  it("addon impose sections sans prose figée", () => {
    const hint = buildAssistantTrustStructuredAddon(q, { history: [] });
    assert.match(hint, /VARIANTE SGT \(assistant_trust\)/);
    assert.match(hint, /Rôle NEXXUS/);
    assert.match(hint, /Nature \(LLM/);
    assert.match(hint, /Honnêteté/);
    assert.match(hint, /Je vois la piste/);
  });

  it("fallback manner varie le wrapper", () => {
    const a = buildAssistantTrustFallbackReply(q, { history: [] });
    const b = buildAssistantTrustFallbackReply(`${q} bis`, { history: [{ role: "user", content: "x" }] });
    assert.match(a, /NEXXUS/i);
    assert.match(b, /NEXXUS/i);
  });

  it("finalize remplace refus insuffisant", () => {
    const out = finalizeAssistantTrustLlmOutput(INSUFFICIENT_SIGNAL_REFUSAL, q, {
      history: [],
    });
    assert.doesNotMatch(out, /Je vois la piste/i);
    assert.match(out, /NEXXUS/i);
  });
});

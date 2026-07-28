import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isIdentityCapabilityCompositeRequest,
  buildIdentityCapabilityCompositeReply,
  resolveSocialCompositeShortCircuit,
} from "../src/agent/policies/socialCompositeReplyPolicy.js";
import { isCapabilityOverviewRequest } from "../src/agent/utils/metaConversationIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const IDENTITY_CAP_QUERY =
  "bonjour comment t'appelles tu et quelles sont tes fonctionnalités phares ?";

const CAP_ONLY_QUERY =
  "si tu pouvais énumérer tes fonctionnalités plus en détails, cela m'aiderait ?";

describe("G41.1 — social composite identity + capabilities", () => {
  it("G41.1-T01 détecte identité + capacités", () => {
    assert.equal(isCapabilityOverviewRequest(IDENTITY_CAP_QUERY), true);
    assert.equal(isIdentityCapabilityCompositeRequest(IDENTITY_CAP_QUERY), true);
    assert.equal(isIdentityCapabilityCompositeRequest(CAP_ONLY_QUERY), false);
  });

  it("G41.1-T02 réponse composée contient identité et capacités", () => {
    const reply = buildIdentityCapabilityCompositeReply(IDENTITY_CAP_QUERY);
    assert.match(reply, /NEXXUS/i);
    assert.match(reply, /fonctionnalit|cadrer|document|Forge|capacit/i);
  });

  it("G41.1-T03 short-circuit social_composite_deterministic", async () => {
    const hit = await runConversationShortCircuit(IDENTITY_CAP_QUERY);
    assert.equal(hit?.path, "social_composite_deterministic");
    assert.equal(hit?.socialComposite, true);
    assert.match(hit?.reply || "", /NEXXUS/i);
    assert.match(hit?.reply || "", /cadrer|document|Forge/i);
    assert.notEqual(hit?.path, "social_deterministic");
  });

  it("G41.1-T04 capability seule reste meta_conversation", async () => {
    const hit = await runConversationShortCircuit(CAP_ONLY_QUERY);
    assert.equal(hit?.path, "meta_conversation_deterministic");
  });
});

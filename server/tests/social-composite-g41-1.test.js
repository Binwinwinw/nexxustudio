import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isIdentityCapabilityCompositeRequest,
  buildIdentityCapabilityCompositeReply,
  resolveSocialCompositeShortCircuit,
  resolveLeadingGreetingMirror,
  withLeadingGreetingMirror,
} from "../src/agent/policies/social/index.js";
import { isCapabilityOverviewRequest } from "../src/agent/utils/intent-guards/metaConversationIntentGuards.js";
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

  it("G41.1-T05 bonjour en tête → miroir Bonjour ! avant le contenu", () => {
    const userQuery =
      "bonjour comment t'appelles-tu et quelles sont tes capacités ?";
    assert.equal(resolveLeadingGreetingMirror(userQuery), "Bonjour");
    const reply = buildIdentityCapabilityCompositeReply(userQuery);
    assert.match(reply, /^Bonjour ! /);
    assert.match(reply, /NEXXUS/i);
    assert.match(reply, /cadrer|document|Forge|capacit/i);
  });

  it("G41.1-T06 salut en tête → Salut ! ; sans ouverture → pas de miroir", () => {
    const withSalut =
      "salut comment t'appelles tu et quelles sont tes fonctionnalités phares ?";
    assert.match(buildIdentityCapabilityCompositeReply(withSalut), /^Salut ! /);

    const noGreeting =
      "comment t'appelles tu et quelles sont tes fonctionnalités phares ?";
    const bare = buildIdentityCapabilityCompositeReply(noGreeting);
    assert.equal(resolveLeadingGreetingMirror(noGreeting), null);
    assert.doesNotMatch(bare, /^(?:Bonjour|Salut|Bonsoir) ! /);
    assert.match(bare, /NEXXUS/i);
  });

  it("G41.1-T06b bonsoir en tête → Bonsoir ! + contenu identité/capacités", () => {
    const q =
      "bonsoir comment t'appelles tu et quelles sont tes fonctionnalités phares ?";
    assert.equal(resolveLeadingGreetingMirror(q), "Bonsoir");
    const reply = buildIdentityCapabilityCompositeReply(q);
    assert.match(reply, /^Bonsoir ! /);
    assert.doesNotMatch(reply, /^Bonjour/);
    assert.match(reply, /NEXXUS/i);
    assert.match(reply, /cadrer|document|Forge|capacit/i);
  });

  it("G41.1-T07 bonjour au milieu → pas de miroir artificiel", () => {
    const mid =
      "quelles sont tes fonctionnalités phares et comment t'appelles tu, bonjour l'équipe";
    assert.equal(resolveLeadingGreetingMirror(mid), null);
    const prefixed = withLeadingGreetingMirror(mid, "NEXXUS ici — assistant.");
    assert.equal(prefixed, "NEXXUS ici — assistant.");
  });
});

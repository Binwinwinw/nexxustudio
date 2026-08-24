import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import {
  ANTHROPOMORPHIC_FAMILY_REPLY,
  USER_FAMILY_CLARIFY_REPLY,
  containsInternalPromptLeak,
  isAssistantFamilyCheckin,
  isBareFamilyCheckinFollowup,
  isFamilyWriteRequest,
  isUserFamilyCheckin,
  listInternalPromptLeakMarkers,
  resolveInternalLeakFallback,
  resolveSocialChatContinuityShortCircuit,
} from "../src/agent/policies/social/index.js";

const FORBIDDEN_MARKERS = [
  "MEMOIRE-TAMPON",
  "Section 4",
  "options actuelles",
  "système interne",
  "[MODIFICATEUR]",
];

const PAPOTER_HISTORY = [
  { role: "user", content: "salut" },
  {
    role: "assistant",
    content:
      "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
  },
  { role: "user", content: "comment ça roule ?" },
  { role: "assistant", content: "Tout va bien ici." },
];

function assertLocalSocialRail(hit, { maxLen = 220 } = {}) {
  assert.equal(hit?.path, "social_deterministic");
  assert.equal(hit?.deferToLlm, false);
  assert.equal(hit?.skipSovereign, true);
  assert.equal(hit?.skipPlanner, true);
  assert.equal(hit?.skipComposer, true);
  assert.ok(hit?.reply);
  assert.ok(String(hit.reply).length <= maxLen, `reply trop longue (${hit.reply.length})`);
  for (const marker of FORBIDDEN_MARKERS) {
    assert.doesNotMatch(hit.reply, new RegExp(marker.replace(/[[\]]/g, "\\$&"), "i"));
  }
  assert.doesNotMatch(hit.reply, /Planner|COMPOSER|Sovereign/i);
}

function assertNotAnthropomorphicFamily(hit) {
  assert.notEqual(hit?.socialPatternName, "social/anthropomorphic_checkin");
  assert.doesNotMatch(hit?.reply || "", /je n['’]ai pas de famille/i);
}

describe("SOCIAL_CHECKIN_FOLLOWUP", () => {
  it("1. salut → social court, pas exploratory", async () => {
    const hit = await runConversationShortCircuit("salut");
    assert.equal(hit?.path, "social_deterministic");
    assert.ok(!hit?.deferToLlm);
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.ok((hit?.reply || "").length <= 280);
  });

  it("2. ça roule ? → social_deterministic", async () => {
    const hit = await runConversationShortCircuit("ça roule ?", {
      history: PAPOTER_HISTORY.slice(0, 2),
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.ok(!hit?.deferToLlm);
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.ok((hit?.reply || "").length <= 160);
  });

  it("3. ta famille va bien ? → anthropomorphic local", async () => {
    assert.equal(isAssistantFamilyCheckin("ta famille va bien ?"), true);
    const hit = await runConversationShortCircuit("ta famille va bien ?");
    assert.equal(hit?.socialPatternName, "social/anthropomorphic_checkin");
    assertLocalSocialRail(hit);
    assert.match(hit.reply, /je n['’]ai pas de famille/i);
    assert.match(hit.reply, /Nexxus/i);
  });

  it("4. tes frères vont bien ? → anthropomorphic local", async () => {
    const hit = await runConversationShortCircuit("tes frères vont bien ?");
    assert.equal(hit?.socialPatternName, "social/anthropomorphic_checkin");
    assertLocalSocialRail(hit);
    assert.match(hit.reply, /fr[eè]res et s[oeœ]urs/i);
  });

  it("5. et tes sœurs ? → anthropomorphic local", async () => {
    const hit = await runConversationShortCircuit("et tes sœurs ?");
    assert.equal(hit?.socialPatternName, "social/anthropomorphic_checkin");
    assertLocalSocialRail(hit);
  });

  it("6. et la famille… comment vont-ils ? après fil papoter → rail local, pas exploratory", async () => {
    const q = "et la famille les frères et les soeurs comment vont ils ??";
    assert.equal(isBareFamilyCheckinFollowup(q), true);
    const just = evaluateJustIntent(q);
    assert.notEqual(just?.action, undefined);
    const cont = resolveSocialChatContinuityShortCircuit(q, {
      history: PAPOTER_HISTORY,
    });
    assert.equal(cont?.path, "social_deterministic");
    assert.equal(cont?.deferToLlm, false);
    assert.equal(cont?.skipSovereign, true);

    const hit = await runConversationShortCircuit(q, { history: PAPOTER_HISTORY });
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assertLocalSocialRail(hit);
    assert.equal(hit.socialCheckinFollowup, true);
    assert.match(hit.reply, /je n['’]ai pas de famille/i);
    assert.equal(hit.reply, ANTHROPOMORPHIC_FAMILY_REPLY);
  });

  it("7. comment vont mes frères ? → clarify utilisateur, pas famille Nexxus", async () => {
    assert.equal(isUserFamilyCheckin("comment vont mes frères ?"), true);
    assert.equal(isAssistantFamilyCheckin("comment vont mes frères ?"), false);
    const hit = await runConversationShortCircuit("comment vont mes frères ?");
    assert.equal(hit?.socialPatternName, "social/user_family_clarify");
    assertLocalSocialRail(hit);
    assert.equal(hit.reply, USER_FAMILY_CLARIFY_REPLY);
    assert.doesNotMatch(hit.reply, /je n['’]ai pas de famille/i);
    assert.doesNotMatch(hit.reply, /je suis une IA/i);
  });

  it("8. ma famille va bien ? → clarify utilisateur", async () => {
    const hit = await runConversationShortCircuit("ma famille va bien ?");
    assert.equal(hit?.socialPatternName, "social/user_family_clarify");
    assertLocalSocialRail(hit);
    assert.doesNotMatch(hit.reply, /je n['’]ai pas de famille/i);
  });

  it("9. écris un message à ma famille → pas le rail anthropomorphique", async () => {
    const q = "écris un message à ma famille";
    assert.equal(isFamilyWriteRequest(q), true);
    assert.equal(isAssistantFamilyCheckin(q), false);
    assert.equal(isUserFamilyCheckin(q), false);
    const hit = await runConversationShortCircuit(q, { history: PAPOTER_HISTORY });
    assertNotAnthropomorphicFamily(hit);
    assert.notEqual(hit?.path, "exploratory_conversation_light");
  });

  it("10. que représente la famille ? → pas le rail social court", async () => {
    const q = "que représente la famille ?";
    assert.equal(isAssistantFamilyCheckin(q), false);
    assert.equal(isBareFamilyCheckinFollowup(q), false);
    const hit = await runConversationShortCircuit(q);
    assertNotAnthropomorphicFamily(hit);
    assert.notEqual(hit?.socialCheckinFollowup, true);
  });

  it("filet : marqueurs internes détectés, contenu non journalisé par l’API", () => {
    const leaked =
      "[MODIFICATEUR] MEMOIRE-TAMPON\nSection 4 INTERDIT\nMes options actuelles";
    assert.equal(containsInternalPromptLeak(leaked), true);
    const markers = listInternalPromptLeakMarkers(leaked);
    assert.ok(markers.includes("[MODIFICATEUR]"));
    assert.ok(markers.includes("MEMOIRE-TAMPON"));
    const fallback = resolveInternalLeakFallback("exploratory_conversation_light");
    assert.equal(fallback, ANTHROPOMORPHIC_FAMILY_REPLY);
    assert.equal(containsInternalPromptLeak("On peut parler de CI pipeline."), false);
    assert.equal(
      containsInternalPromptLeak("On peut parler de CI pipeline.", {
        allowLowConfidence: true,
      }),
      true,
    );
  });
});

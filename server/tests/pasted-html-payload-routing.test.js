import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { isInlineProductBriefPaste, isGuidedCreationScopingRequest } from "../src/agent/policies/guided/guidedCreationScopingPolicy.js";
import { resolveExternalCalendarLookupShortCircuit } from "../src/agent/policies/web/externalCalendarLookupPolicy.js";
import {
  isExternalCalendarLookupRequest,
  isExternalDateLookupRequest,
} from "../src/agent/utils/intent-guards/externalCalendarLookupIntentGuards.js";
import {
  isCareerLearningPathRequest,
} from "../src/agent/utils/intent-guards/careerLearningPathIntentGuards.js";
import { resolveCareerLearningPathShortCircuit } from "../src/agent/micro/replies/careerLearningPathComposer.js";
import {
  isSelfModificationQuery,
} from "../src/agent/utils/intent-guards/intentGuards.js";
import { resolveSelfModificationRoute } from "../src/agent/micro/replies/selfModificationReplyBuilder.js";
import {
  isSoftSocialChatFollowup,
  isShortDevWorkOfferFollowup,
  resolveSocialChatContinuityShortCircuit,
} from "../src/agent/policies/social/socialChatContinuityPolicy.js";

function portfolioImproveHtml(body = "") {
  return [
    "voici mon portfolio une page html qu'il faut améliorer :",
    '<!DOCTYPE html><html lang="fr"><body>',
    body,
    "</body></html>",
  ].join("\n");
}

describe("payload HTML collé — consigne vs copy", () => {
  it("cherchez + prochain dans le HTML ≠ calendrier externe", () => {
    const q = portfolioImproveHtml(
      "<p>Si vous cherchez un développeur.</p><h2>Parlons de votre prochain projet</h2><footer>© 2026</footer>",
    );
    assert.equal(isExternalCalendarLookupRequest(q), false);
    assert.equal(isExternalDateLookupRequest(q), false);
    assert.equal(resolveExternalCalendarLookupShortCircuit(q), null);
  });

  it("copy produit dans un HTML collé ≠ brief produit", () => {
    const q = portfolioImproveHtml(
      "<p>Une approche produit avant tout. " + "lorem ".repeat(80) + "</p>",
    );
    assert.equal(isInlineProductBriefPaste(q), false);
  });

  it("brief produit long sans HTML reste un paste", () => {
    const q =
      "brainstorm mvp pour un produit : positionnement et tagline. " +
      "details ".repeat(80);
    assert.equal(isInlineProductBriefPaste(q), true);
  });

  it("améliore ce portfolio HTML collé ≠ parcours carrière", async () => {
    const q = [
      "améliore ce portfolio HTML :",
      '<!DOCTYPE html><html lang="fr"><body>',
      "<p>Développeur full-stack. Outil métier.</p>",
      "</body></html>",
    ].join("\n");
    assert.equal(isCareerLearningPathRequest(q), false);
    assert.equal(resolveCareerLearningPathShortCircuit(q), null);
    assert.equal(isGuidedCreationScopingRequest(q), false);
    assert.equal(evaluateJustIntent(q).domain, "web_html");
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "career_learning_path");
    assert.notEqual(hit?.path, "self_modification_deterministic");
    assert.notEqual(hit?.path, "guided_creation_scoping");
  });

  it("HTML long avec projet / développeur / métier ≠ career parasite", () => {
    const q = portfolioImproveHtml(
      "<p>Développeur full-stack. Outil métier. Parlons de votre prochain projet. " +
        "lorem ".repeat(120) +
        "</p>",
    );
    assert.equal(isCareerLearningPathRequest(q), false);
    assert.equal(resolveCareerLearningPathShortCircuit(q), null);
  });

  it("consigne carrière avant un HTML collé reste career", () => {
    const q =
      "comment devenir développeur web\n<!DOCTYPE html><html><body>ok</body></html>";
    assert.equal(isCareerLearningPathRequest(q), true);
  });
});

describe("aide HTML utilisateur ≠ auto-modification Citadelle", () => {
  it("modifier du code html ≠ self-mod", async () => {
    const q = "tu peux m'aider à modifier du code html ?";
    assert.equal(isSelfModificationQuery(q), false);
    assert.equal(resolveSelfModificationRoute(q), null);
    assert.equal(evaluateJustIntent(q).domain, "web_html");
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "self_modification_deterministic");
    assert.notEqual(hit?.path, "career_learning_path");
  });

  it("modifier du code html après papoter → relance technique locale", () => {
    const q = "tu peux m'aider à modifier du code html ?";
    assert.equal(isSoftSocialChatFollowup(q), true);
    assert.equal(isShortDevWorkOfferFollowup(q), true);
    const hit = resolveSocialChatContinuityShortCircuit(q, {
      history: [
        {
          role: "assistant",
          content:
            "Salut ! Si tu veux on peut papoter. Qu'est-ce que tu veux faire ?",
        },
      ],
    });
    assert.equal(hit?.path, "exploratory_conversation_light");
    assert.equal(hit?.deferToLlm, false);
    assert.equal(hit?.skipComposer, true);
    assert.equal(hit?.devTechnicalNudge, true);
    assert.match(hit?.reply || "", /HTML/i);
  });
});

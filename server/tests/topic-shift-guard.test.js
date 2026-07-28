import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessConversationTopicShift,
  classifyConversationTopic,
  hasStrongContinuationSignal,
  hasStrongNewTaskSignal,
  TOPIC_DOMAINS,
  CONVERSATION_TOPIC_SHIFT_RULE,
} from "../src/agent/micro/continuity/topicShiftGuard.js";
import {
  resolveConversationContinuityShortCircuit,
  isConversationContinuityFollowup,
} from "../src/agent/micro/continuity/conversationContinuityContext.js";
import { resolveAnaphoraReference } from "../src/agent/micro/continuity/anaphoraReferenceResolver.js";

const IPHONE_USER =
  "pourrais tu faire un comparatif entre les derniers modeles d iphone de chez apple et galaxy chez samsung";
const IPHONE_ASSISTANT = `Le comparatif entre l'iPhone 16 Pro Max et le Samsung Galaxy S24 Ultra met en lumière plusieurs aspects clés.
Ces différences influencent les performances utilisateur. Le choix dépendra des priorités individuelles.`;

const NOTION_QUERY =
  "sais tu créer un atelier d'initiation à l'application NOTION sous forme de fichier html avec header sidebar sur les différents thèmes comme menus?";

const SMARTPHONE_HISTORY = [
  { role: "user", content: IPHONE_USER },
  { role: "assistant", content: IPHONE_ASSISTANT },
];

describe("topicShiftGuard — classification", () => {
  it("classifie comparatif smartphones", () => {
    assert.equal(
      classifyConversationTopic(IPHONE_USER),
      TOPIC_DOMAINS.CONSUMER_TECH,
    );
  });

  it("classifie atelier Notion HTML", () => {
    assert.equal(
      classifyConversationTopic(NOTION_QUERY),
      TOPIC_DOMAINS.CODE_DELIVERY,
    );
  });
});

describe("topicShiftGuard — rupture iPhone → Notion", () => {
  it("détecte un topic shift fort", () => {
    const shift = assessConversationTopicShift(NOTION_QUERY, SMARTPHONE_HISTORY);
    assert.equal(shift.detected, true);
    assert.equal(shift.rule, CONVERSATION_TOPIC_SHIFT_RULE);
    assert.equal(shift.previousDomain, TOPIC_DOMAINS.CONSUMER_TECH);
    assert.equal(shift.currentDomain, TOPIC_DOMAINS.CODE_DELIVERY);
  });

  it("bloque la continuité conversationnelle après rupture", () => {
    assert.equal(
      isConversationContinuityFollowup(NOTION_QUERY, SMARTPHONE_HISTORY),
      false,
    );
    assert.equal(
      resolveConversationContinuityShortCircuit(NOTION_QUERY, SMARTPHONE_HISTORY),
      null,
    );
  });

  it("bloque la continuité anaphorique après rupture", () => {
    assert.equal(
      resolveAnaphoraReference(NOTION_QUERY, SMARTPHONE_HISTORY),
      null,
    );
  });

  it("conserve la continuité sur oui court (pétanque)", () => {
    const history = [
      { role: "user", content: "Tu connais la pétanque ?" },
      {
        role: "assistant",
        content:
          "Oui, je connais la pétanque. Tu veux que je t'en parle rapidement ou tu as une question précise ?",
      },
    ];
    assert.equal(hasStrongContinuationSignal("oui"), true);
    assert.equal(assessConversationTopicShift("oui", history).detected, false);
  });
});

describe("topicShiftGuard — nouvelle tâche explicite", () => {
  it("détecte un signal de nouvelle tâche code/HTML", () => {
    assert.equal(hasStrongNewTaskSignal(NOTION_QUERY), true);
  });
});

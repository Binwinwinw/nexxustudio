import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  readRecentTurns,
  extractConversationState,
  resolveShortFollowup,
  buildConversationContinuityContext,
  isConversationContinuityFollowup,
  getConversationContinuityDeterministicReply,
  resolveConversationContinuityShortCircuit,
  CONTINUITY_TURN_PHASES,
  CONTINUITY_ASSISTANT_OFFERS,
  CONVERSATION_CONTINUITY_RULE,
} from "../src/agent/micro/continuity/conversationContinuityContext.js";
import { getFamiliarityDeterministicReply } from "../src/agent/utils/familiarityIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const PETANQUE_PROPOSAL = getFamiliarityDeterministicReply("Tu connais la pétanque ?");

function petanqueHistory() {
  return [
    { role: "user", content: "Tu connais la pétanque ?" },
    { role: "assistant", content: PETANQUE_PROPOSAL },
  ];
}

describe("conversationContinuityContext — fenêtre courte", () => {
  it("readRecentTurns limite à 6 tours utiles", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));
    const turns = readRecentTurns(history, 6);
    assert.equal(turns.length, 6);
    assert.equal(turns[0].content, "message 4");
    assert.equal(turns[5].content, "message 9");
  });

  it("filtre par threadId quand présent", () => {
    const history = [
      { role: "user", content: "a", threadId: "t1" },
      { role: "assistant", content: "b", threadId: "t2" },
      { role: "user", content: "c", threadId: "t1" },
    ];
    const turns = readRecentTurns(history, 6, "t1");
    assert.equal(turns.length, 2);
    assert.equal(turns.every((t) => !t.threadId || t.threadId === "t1"), true);
  });
});

describe("conversationContinuityContext — état structuré", () => {
  it("extrait active_subject et proposition en attente pour pétanque", () => {
    const { state } = buildConversationContinuityContext(petanqueHistory());
    assert.equal(state.activeSubjectLabel, "la pétanque");
    assert.equal(state.activeSubject, "la petanque");
    assert.equal(state.assistantOffer, CONTINUITY_ASSISTANT_OFFERS.APERCU_RAPIDE);
    assert.equal(state.awaitingUserConfirmation, true);
    assert.equal(state.turnPhase, CONTINUITY_TURN_PHASES.FAMILIARITY_APERCU_PENDING);
  });

  it("reste idle sans proposition assistant récente", () => {
    const state = extractConversationState([
      { role: "user", content: "bonjour" },
      { role: "assistant", content: "Bonjour !" },
    ]);
    assert.equal(state.turnPhase, CONTINUITY_TURN_PHASES.IDLE);
    assert.equal(state.awaitingUserConfirmation, false);
  });
});

describe("conversationContinuityContext — resolveShortFollowup", () => {
  it("interprète oui comme acceptation d'aperçu pétanque", () => {
    const { state } = buildConversationContinuityContext(petanqueHistory());
    const hit = resolveShortFollowup("oui", state);
    assert.ok(hit);
    assert.equal(hit.kind, "familiarity_followup_apercu");
    assert.match(hit.reply, /aperçu rapide/i);
    assert.match(hit.reply, /pétanque/i);
  });

  it("accepte continue et explique quand proposition en attente", () => {
    const { state } = buildConversationContinuityContext(petanqueHistory());
    for (const query of ["continue", "explique", "vas-y"]) {
      assert.ok(resolveShortFollowup(query, state), query);
    }
  });

  it("fail-closed si pas de proposition en attente", () => {
    assert.equal(resolveShortFollowup("oui", { awaitingUserConfirmation: false }), null);
  });

  it("fail-closed short followup si requête ambiguë longue sans elaboration claire", () => {
    const { state } = buildConversationContinuityContext(petanqueHistory());
    assert.equal(
      resolveShortFollowup("oui mais seulement si tu as des sources fiables et vérifiables", state),
      null,
    );
  });
});

describe("conversationContinuityContext — relance substantielle", () => {
  const nothingHistory = () => [
    { role: "user", content: "Connais tu la marque nothingPhone" },
    {
      role: "assistant",
      content:
        "Oui, je connais La Marque Nothingphone.\nTu veux que je t'en parle rapidement ?",
    },
  ];

  it("honore ouverture composer (variantes) après culture générale", async () => {
    const bourguignonReply = `Oui, je connais bien le **bœuf bourguignon**.
C'est un grand classique.
Tu veux que je te détaille une étape précise, ou tu veux des variantes ?`;
    const history = [
      { role: "user", content: "connais tu la recette du boeuf bourguignon" },
      { role: "assistant", content: bourguignonReply },
    ];
    const { state } = buildConversationContinuityContext(history);
    assert.equal(state.turnPhase, "engagement_elaboration_pending");
    assert.match(state.activeSubjectLabel || "", /bourguignon/i);

    const hit = await runConversationShortCircuit("oui", {
      history,
      getDeterministicSocialResponse: () => null,
    });
    assert.equal(hit?.path, "general_knowledge_continuity_carryover");
    assert.equal(hit?.deferToFullPipeline, true);
  });

  it("détecte oui + parle-moi de ce que tu sais", () => {
    const { state } = buildConversationContinuityContext(nothingHistory());
    const q =
      "oui je veux que tu me parles de ce que tu sais de la marque nothingPhone";
    assert.equal(isConversationContinuityFollowup(q, nothingHistory()), true);
    const hit = resolveConversationContinuityShortCircuit(q, nothingHistory());
    assert.equal(hit?.path, "general_knowledge_continuity_carryover");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.match(hit?.effectiveQuery || "", /Nothingphone/i);
  });
});

describe("conversationContinuityContext — pipeline", () => {
  it("route conversation_continuity_deterministic avant LLM", async () => {
    const hit = await runConversationShortCircuit("oui", { history: petanqueHistory() });
    assert.ok(hit);
    assert.equal(hit.path, "conversation_continuity_deterministic");
    assert.match(hit.reply, /sport de boules/i);
  });

  it("isConversationContinuityFollowup détecte le fil actif", () => {
    assert.equal(isConversationContinuityFollowup("oui", petanqueHistory()), true);
    assert.equal(isConversationContinuityFollowup("oui", []), false);
  });

  it("expose la règle doctrine engagement_honor", () => {
    assert.equal(CONVERSATION_CONTINUITY_RULE, "conversation_engagement_honor_open_branch");
    const reply = getConversationContinuityDeterministicReply("oui", petanqueHistory());
    assert.match(reply, /D'accord/i);
  });
});

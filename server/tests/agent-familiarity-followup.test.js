import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isFamiliarityFollowupAcceptance,
  isFamiliarityFollowupIntent,
  parseFamiliarityProposalFromAssistant,
  getFamiliarityFollowupDeterministicReply,
  FAMILIARITY_FOLLOWUP_NO_REFUSAL_RULE,
  FAMILIARITY_FOLLOWUP_REPLY_MODE,
} from "../src/agent/utils/familiarityFollowupGuards.js";
import { getFamiliarityDeterministicReply } from "../src/agent/utils/familiarityIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  evaluateEpistemicRefusal,
  enforceModeContract,
  INSUFFICIENT_SIGNAL_REFUSAL,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";

const PETANQUE_PROPOSAL = getFamiliarityDeterministicReply("Tu connais la pétanque ?");

describe("familiarité follow-up — détection", () => {
  it("reconnaît une proposition d'aperçu dans le message assistant", () => {
    const parsed = parseFamiliarityProposalFromAssistant(PETANQUE_PROPOSAL);
    assert.equal(parsed?.subjectLabel, "la pétanque");
  });

  it("accepte oui / parle-m'en / donne-moi un aperçu", () => {
    for (const query of ["oui", "Oui.", "d'accord", "parle-m'en", "dis-m'en plus", "donne-moi un aperçu"]) {
      assert.equal(isFamiliarityFollowupAcceptance(query), true, query);
    }
  });

  it("détecte le follow-up avec historique pétanque", () => {
    const history = [
      { role: "user", content: "Tu connais la pétanque ?" },
      { role: "assistant", content: PETANQUE_PROPOSAL },
    ];
    assert.equal(isFamiliarityFollowupIntent("oui", history), true);
  });
});

describe("familiarité follow-up — réponse aperçu", () => {
  it("pétanque — enchaîne sur un aperçu après oui", () => {
    const history = [
      { role: "user", content: "Tu connais la pétanque ?" },
      { role: "assistant", content: PETANQUE_PROPOSAL },
    ];
    const reply = getFamiliarityFollowupDeterministicReply("oui", history);
    assert.match(reply, /D'accord, voici un aperçu rapide/i);
    assert.match(reply, /pétanque/i);
    assert.match(reply, /sport de boules/i);
    assert.doesNotMatch(reply, /Je n'ai pas assez d'éléments fiables/i);
    assert.doesNotMatch(reply, /je peux t'aider concernant/i);
  });

  it("short-circuit route familiarity_followup_deterministic", () => {
    const history = [
      { role: "user", content: "Tu connais la pétanque ?" },
      { role: "assistant", content: PETANQUE_PROPOSAL },
    ];
    const hit = runConversationShortCircuit("oui", { history });
    assert.ok(hit);
    assert.equal(hit.path, "conversation_continuity_deterministic");
    assert.match(hit.reply, /aperçu rapide/i);
  });

  it("Italie — follow-up après proposition", () => {
    const proposal = getFamiliarityDeterministicReply("Tu connais l'Italie ?");
    const history = [
      { role: "user", content: "Tu connais l'Italie ?" },
      { role: "assistant", content: proposal },
    ];
    const reply = getFamiliarityFollowupDeterministicReply("parle-m'en", history);
    assert.match(reply, /l'Italie/i);
    assert.match(reply, /Europe/i);
  });

  it("Michael Jackson — follow-up après reconnaissance", () => {
    const proposal = getFamiliarityDeterministicReply("Tu connais Michael Jackson ?");
    const history = [
      { role: "user", content: "Tu connais Michael Jackson ?" },
      { role: "assistant", content: proposal },
    ];
    const reply = getFamiliarityFollowupDeterministicReply("oui", history);
    assert.match(reply, /Michael Jackson/i);
    assert.match(reply, /pop|artiste/i);
  });

  it("Louvre — follow-up après reconnaissance", () => {
    const proposal = getFamiliarityDeterministicReply("Tu connais le musée du Louvre ?");
    const history = [
      { role: "user", content: "Tu connais le musée du Louvre ?" },
      { role: "assistant", content: proposal },
    ];
    const reply = getFamiliarityFollowupDeterministicReply("d'accord", history);
    assert.match(reply, /musée du Louvre/i);
    assert.match(reply, /Paris/i);
  });
});

describe("familiarité follow-up — pas de refus épistémique", () => {
  it("evaluateEpistemicRefusal exempte oui après proposition familiarité", () => {
    const history = [
      { role: "user", content: "Tu connais la pétanque ?" },
      { role: "assistant", content: PETANQUE_PROPOSAL },
    ];
    const out = evaluateEpistemicRefusal({
      query: "oui",
      responseText: "",
      allowRefusal: true,
      history,
    });
    assert.equal(out.shouldRefuse, false);
    assert.equal(out.reason, "familiarity_followup_acceptance");
  });

  it("respecte le contrat INSTANT sans refus sur le follow-up", () => {
    const history = [
      { role: "user", content: "Tu connais la pétanque ?" },
      { role: "assistant", content: PETANQUE_PROPOSAL },
    ];
    const reply = getFamiliarityFollowupDeterministicReply("oui", history);
    const out = enforceModeContract(RESPONSE_MODES.INSTANT, reply, {
      allowRefusal: false,
    });
    assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("expose la règle doctrine follow-up", () => {
    assert.equal(FAMILIARITY_FOLLOWUP_NO_REFUSAL_RULE, "familiarity_followup_no_refusal");
    assert.equal(FAMILIARITY_FOLLOWUP_REPLY_MODE, "familiarity_followup_apercu");
  });

  it("Noël — enchaîne sur l'aperçu après oui (pas clarification)", () => {
    const proposal = getFamiliarityDeterministicReply("héy tu connais la noël ???");
    assert.match(proposal, /je connais la Noël/i);

    const history = [
      { role: "user", content: "héy tu connais la noël ???" },
      { role: "assistant", content: proposal },
    ];
    const reply = getFamiliarityFollowupDeterministicReply("oui", history);
    assert.match(reply, /D'accord, voici un aperçu rapide/i);
    assert.match(reply, /Noël|25 décembre|fête/i);
    assert.doesNotMatch(reply, /De quoi veux-tu partir/i);
  });
});

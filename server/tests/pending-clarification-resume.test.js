import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resumePendingClarification,
  extractPendingClarificationState,
  matchHowToScopeSlot,
  CLARIFICATION_RESUME_STATUS,
  HOW_TO_SCOPE_SLOTS,
} from "../src/agent/policies/pendingClarificationResumePolicy.js";

const airplaneClarifyAssistant =
  "Salut ! Ça va bien de mon côté. Nous sommes vendredi 3 juillet 2026 et il est 02:18. Tu parles d'un avion en papier, d'une maquette ou d'un vrai avion ?";

const historyAfterPartialClarify = [
  {
    role: "user",
    content:
      "salut comment ca va j'ai besoin de la date du jour et savoir si tu sais comment on fait un avion???",
  },
  { role: "assistant", content: airplaneClarifyAssistant },
];

describe("pendingClarificationResumePolicy — batterie #26", () => {
  it("détecte une clarification how_to_scope en attente", () => {
    const pending = extractPendingClarificationState(airplaneClarifyAssistant);
    assert.equal(pending?.clarificationType, "how_to_scope");
    assert.equal(pending?.topic, "avion");
  });

  it("« je parle d'un vrai avion » → slot real_aircraft + how_to_complex_clarify", () => {
    const slot = matchHowToScopeSlot("hé bien je parle d'un vrai avion", {
      topic: "avion",
    });
    assert.equal(slot, HOW_TO_SCOPE_SLOTS.REAL);

    const resume = resumePendingClarification(
      "hé bien je parle d'un vrai avion",
      historyAfterPartialClarify,
    );
    assert.equal(resume.status, CLARIFICATION_RESUME_STATUS.RESOLVED);
    assert.equal(resume.resumePath, "how_to_complex_clarify");
    assert.equal(resume.skipClarificationGate, true);
    assert.match(resume.reply, /aéronautique|industriel/i);
    assert.doesNotMatch(resume.reply, /étape par étape/i);
  });

  it("« un vrai avion » — variante courte", () => {
    const resume = resumePendingClarification("un vrai avion", historyAfterPartialClarify);
    assert.equal(resume.status, CLARIFICATION_RESUME_STATUS.RESOLVED);
    assert.equal(resume.slotFilled, HOW_TO_SCOPE_SLOTS.REAL);
  });

  it("« en papier » → how_to_simple_local", () => {
    const resume = resumePendingClarification(
      "plutôt un avion en papier",
      historyAfterPartialClarify,
    );
    assert.equal(resume.status, CLARIFICATION_RESUME_STATUS.RESOLVED);
    assert.equal(resume.resumePath, "how_to_simple_local");
    assert.match(resume.reply, /avion en papier/i);
  });

  it("« maquette » → réponse guidée locale", () => {
    const resume = resumePendingClarification(
      "je parle d'une maquette",
      historyAfterPartialClarify,
    );
    assert.equal(resume.status, CLARIFICATION_RESUME_STATUS.RESOLVED);
    assert.equal(resume.slotFilled, HOW_TO_SCOPE_SLOTS.MODEL);
    assert.ok(resume.reply);
  });

  it("nouvelle requête sans slot → not_a_clarification_answer", () => {
    const resume = resumePendingClarification(
      "traduis cette phrase en anglais : bonjour",
      historyAfterPartialClarify,
    );
    assert.equal(resume.status, CLARIFICATION_RESUME_STATUS.NOT_AN_ANSWER);
  });
});

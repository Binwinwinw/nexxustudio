import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resumePendingClarification,
  extractPendingClarificationState,
  matchHowToScopeSlot,
  CLARIFICATION_RESUME_STATUS,
  HOW_TO_SCOPE_SLOTS,
} from "../src/agent/policies/qualification/pendingClarificationResumePolicy.js";

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

  it("échelle visée + demande simple créer une base → procédure phpMyAdmin", () => {
    const history = [
      {
        role: "user",
        content:
          "je suis sur phpmyadmin l'application web, je veux créer une nouvelle base de données pourrais tu me donner la marche à suivre ?",
      },
      {
        role: "assistant",
        content:
          "Pour ça, le sujet est assez vaste — précise l'échelle visée (débutant, maquette, projet réel) et je t'oriente mieux.",
      },
    ];
    const pending = extractPendingClarificationState(history[1].content);
    assert.equal(pending?.clarificationType, "how_to_scale");
    const resume = resumePendingClarification(
      "comment ça? quelle échelle viser? ma demande est simple, je veux créer une nouvelle base de données et toi tu dois m'aider à le faire",
      history,
    );
    assert.equal(resume.status, CLARIFICATION_RESUME_STATUS.RESOLVED);
    assert.equal(resume.resumePath, "how_to_simple_local");
    assert.match(resume.reply, /Tu as raison/i);
    assert.match(resume.reply, /Bases de donn|phpMyAdmin/i);
    assert.doesNotMatch(resume.reply, /[eé]chelle vis[eé]e/i);
  });

  it("cadrage site vitrine + correction base de données → procédure phpMyAdmin", () => {
    const history = [
      {
        role: "user",
        content:
          "je suis sur phpmyadmin l'application web, je veux créer une nouvelle base de données pourrais tu me donner la marche à suivre ?",
      },
      {
        role: "assistant",
        content:
          "Tu veux plutôt un site vitrine, un intranet, ou un espace collaboratif — et sur quelle plateforme (SharePoint, HTML, WordPress, autre) ?",
      },
    ];
    const pending = extractPendingClarificationState(history[1].content);
    assert.equal(pending?.clarificationType, "web_project_scoping");
    const resume = resumePendingClarification(
      "pourquoi tu changes de sujet ??? je veux de l'aide pour créer une base de donnée... tu ne dois pas savoir ce que c'est si tu pose ces question là !!!!",
      history,
    );
    assert.equal(resume.status, CLARIFICATION_RESUME_STATUS.RESOLVED);
    assert.equal(resume.resumePath, "how_to_simple_local");
    assert.match(resume.reply, /Bases de donn|phpMyAdmin/i);
    assert.doesNotMatch(resume.reply, /site vitrine/i);
  });
});

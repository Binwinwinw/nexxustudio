import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractCurrentTurnAnchors,
  assessCurrentTurnEntityPivot,
  evaluateCurrentTurnAnchoring,
  enforceCurrentTurnAnchoring,
  resolveNamedCreateStartShortCircuit,
  isVisionAttachedAnchoringExempt,
} from "../src/agent/policies/conversation/currentTurnAnchoringPolicy.js";
import {
  buildArchitectureDesignOptionsReply,
  isCodeReviewArchitectureTemplateLicensed,
} from "../src/agent/utils/intent-guards/architectureDesignIntentGuards.js";
import { buildArchitectureDesignReply } from "../src/agent/micro/replies/architectureDesignReplyBuilder.js";
import { buildIdeationOptionsReply } from "../src/agent/utils/intent-guards/ideationIntentGuards.js";

const IDEA_CRITIQUE_QUERY =
  "je voudrais créer un générateur de blagues avec IA est ce que ce projet te parait pertinent??? ne me complimente pas, ne soit pas obligatoirement d'accord avec moi, trouves des failles et pose des questions si nécessaire.";

const RECIPE_CRITIQUE_QUERY =
  "je voudrais créer un générateur de recettes avec IA, est-ce pertinent ? ne me complimente pas, trouve des failles, pose des questions si nécessaire";

const STALE_RAG_REPLY = `Je partirais plutôt sur **l'approche intermédiaire (RAG + règles)** pour ton cas : elle équilibre crédibilité et coût.

Pour ce composant, voici 3 approches distinctes :
1. **Approche légère (script + LLM local)** — analyse fichier par fichier.
2. **Approche intermédiaire (RAG + règles)** — Index partiel du code. Premier pas : indexer un sous-dossier (ex. \`server/src\`).
3. **Approche industrielle (pipeline complet)** — Indexation à grande échelle.`;

const CODE_REVIEWER_QUERY =
  "comment créer un code-reviewer qui analyse tout le code d'un projet";

describe("currentTurnAnchoring — extract", () => {
  it("ancre les entités et la posture d'une critique d'idée", () => {
    const anchors = extractCurrentTurnAnchors(IDEA_CRITIQUE_QUERY);
    assert.equal(anchors.goal, "idea_critique");
    assert.equal(anchors.posture.noCompliment, true);
    assert.equal(anchors.posture.findFlaws, true);
    assert.equal(anchors.posture.askQuestions, true);
    assert.ok(anchors.tokens.includes("generateur") || anchors.spans.some((s) => /g[eé]n[eé]rateur/i.test(s)));
    assert.ok(
      anchors.tokens.includes("blagues") ||
        anchors.spans.some((s) => /blagues/i.test(s)),
    );
    assert.ok(anchors.tokens.includes("ia"));
  });
});

describe("currentTurnAnchoring — emit verify", () => {
  it("bloque un gabarit RAG / server/src non ancré sur une critique d'idée", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: IDEA_CRITIQUE_QUERY,
      reply: STALE_RAG_REPLY,
    });
    assert.equal(verdict.ok, false);
    assert.ok(verdict.signals.some((s) => s.startsWith("foreign_template:")));
    assert.equal(verdict.foreignFamily, "code_review_rag");
  });

  it("repair borné : pertinence / failles / questions, sans server/src", () => {
    const enforced = enforceCurrentTurnAnchoring({
      query: IDEA_CRITIQUE_QUERY,
      reply: STALE_RAG_REPLY,
    });
    assert.equal(enforced.ok, false);
    assert.match(enforced.text, /g[eé]n[eé]rateur|blagues/i);
    assert.match(enforced.text, /Failles/i);
    assert.match(enforced.text, /\?/);
    assert.doesNotMatch(enforced.text, /server\/src|RAG \+ r[eè]gles/i);
  });

  it("même garde sur un autre sujet nommé (pas un patch blagues)", () => {
    const enforced = enforceCurrentTurnAnchoring({
      query: RECIPE_CRITIQUE_QUERY,
      reply: STALE_RAG_REPLY,
    });
    assert.equal(enforced.ok, false);
    assert.match(enforced.text, /recettes/i);
    assert.doesNotMatch(enforced.text, /server\/src/i);
  });

  it("laisse passer une vraie architecture code-reviewer", () => {
    const reply = buildArchitectureDesignReply(CODE_REVIEWER_QUERY);
    const verdict = evaluateCurrentTurnAnchoring({
      query: CODE_REVIEWER_QUERY,
      reply,
    });
    assert.equal(verdict.ok, true, verdict.signals.join(","));
  });

  it("laisse passer un check-in court", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: "yop yop comment ca va",
      reply: "Tout va bien ici.",
    });
    assert.equal(verdict.ok, true, verdict.signals.join(","));
  });

  it("ne prend pas un idiome phatique pour une entité à ancrer", () => {
    const cases = [
      "yop yop comment ca ça va, ca roule ???",
      "yop yop comment ca va, ca roule ma poule ??",
    ];
    for (const query of cases) {
      const verdict = evaluateCurrentTurnAnchoring({
        query,
        reply: "Tout va bien ici.",
        pipelinePath: "social_deterministic",
      });
      assert.equal(verdict.ok, true, `${query} → ${verdict.signals.join(",")}`);
      assert.equal(extractCurrentTurnAnchors(query).spans.length, 0);
    }
  });

  it("bloque encore un gabarit RAG collé sur un check-in", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: "yop yop comment ca va, ca roule ???",
      reply: STALE_RAG_REPLY,
      pipelinePath: "social_deterministic",
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.foreignFamily, "code_review_rag");
  });

  it("repair create nommé : structure, pas « reformule »", () => {
    const query =
      "je veux créer une carte de visite avec mes coordonnées";
    const enforced = enforceCurrentTurnAnchoring({
      query,
      reply: buildIdeationOptionsReply(query),
      pipelinePath: "ideation_deterministic",
    });
    assert.equal(enforced.ok, false);
    assert.match(enforced.text, /carte de visite/i);
    assert.doesNotMatch(enforced.text, /reformule/i);
  });

  it("OS desktop — pas named_create carte / print", () => {
    const q =
      "pourrais tu m'aider : je voudrais créer un système d'exploitation avec interface graphique simple mais windows-friendly";
    assert.equal(resolveNamedCreateStartShortCircuit(q), null);
  });

  it("named create start : livrable nommé, pas idéation ouverte", () => {
    const hit = resolveNamedCreateStartShortCircuit(
      "je veux créer une carte de visite avec mes coordonnées et d'autres informations donc comment pourrais je présenter cette carte?",
    );
    assert.equal(hit?.path, "named_create_start");
    assert.match(hit?.reply || "", /carte de visite/i);
    assert.equal(
      resolveNamedCreateStartShortCircuit("Quel projet IA je pourrais lancer ?"),
      null,
    );
  });

  it("bloque la matrice d'idéation générique si un artefact est déjà nommé", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: RECIPE_CRITIQUE_QUERY,
      reply: buildIdeationOptionsReply(RECIPE_CRITIQUE_QUERY),
    });
    assert.equal(verdict.ok, false);
    assert.ok(
      verdict.foreignFamily === "ideation_generic_matrix" ||
        verdict.signals.includes("idea_critique_implementation_frame") ||
        verdict.signals.includes("entity_miss"),
    );
  });
});

describe("currentTurnAnchoring — pivot", () => {
  it("détecte un pivot soirée → idée nommée et coupe le plan RAG", () => {
    const history = [
      { role: "user", content: "qu'est ce qu'on pourrait faire ce soir" },
      { role: "assistant", content: STALE_RAG_REPLY },
    ];
    const pivot = assessCurrentTurnEntityPivot(IDEA_CRITIQUE_QUERY, history);
    assert.equal(pivot.detected, true);
    const enforced = enforceCurrentTurnAnchoring({
      query: IDEA_CRITIQUE_QUERY,
      reply: STALE_RAG_REPLY,
      history,
    });
    assert.equal(enforced.ok, false);
    assert.ok(enforced.signals.includes("stale_plan_after_pivot"));
  });

  it("ne pivote pas si le sujet nommé continue", () => {
    const history = [
      { role: "user", content: IDEA_CRITIQUE_QUERY },
      {
        role: "assistant",
        content:
          "Sur le générateur de blagues : saturation du créneau humour IA. Faille : qualité perçue. Pour qui ?",
      },
    ];
    const pivot = assessCurrentTurnEntityPivot(
      "et les failles du générateur de blagues sur le marché",
      history,
    );
    assert.equal(pivot.detected, false);
  });
});

describe("architecture template license", () => {
  it("code-reviewer license le gabarit server/src", () => {
    assert.equal(isCodeReviewArchitectureTemplateLicensed(CODE_REVIEWER_QUERY), true);
    const reply = buildArchitectureDesignOptionsReply(CODE_REVIEWER_QUERY);
    assert.match(reply, /server\/src/);
  });

  it("architecture RAG agent : pas de server/src par réflexe", () => {
    const q = "comment créer une architecture RAG pour mon agent de support";
    assert.equal(isCodeReviewArchitectureTemplateLicensed(q), false);
    const reply = buildArchitectureDesignOptionsReply(q);
    assert.doesNotMatch(reply, /server\/src/);
    assert.match(reply, /RAG/i);
  });
});

const VISION_IMAGE = [{ mimetype: "image/png", originalname: "nexus.png" }];
const VISION_REPLY =
  "Un portrait stylisé sur fond sombre. Logo circulaire, tons cyan et violet.";
const VISION_CTX = {
  intentContractId: "VISION_ATTACHED",
  attachments: VISION_IMAGE,
  pipelinePath: "COMPOSER",
};

describe("currentTurnAnchoring — exemption Vision attachée", () => {
  it("1. fais une description de la photo jointe + image + contrat → livrée", () => {
    const query = "fais une description de la photo jointe";
    assert.equal(
      isVisionAttachedAnchoringExempt({ query, ...VISION_CTX }),
      true,
    );
    const verdict = evaluateCurrentTurnAnchoring({
      query,
      reply: VISION_REPLY,
      ...VISION_CTX,
    });
    assert.equal(verdict.ok, true, verdict.signals.join(","));
    assert.ok(!verdict.signals.includes("entity_miss"));
    const enforced = enforceCurrentTurnAnchoring({
      query,
      reply: VISION_REPLY,
      ...VISION_CTX,
    });
    assert.match(enforced.text, /portrait|logo|cyan/i);
    assert.doesNotMatch(enforced.text, /recyclait/);
  });

  it("2. décris cette image + image + contrat → livrée", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: "décris cette image",
      reply: VISION_REPLY,
      ...VISION_CTX,
    });
    assert.equal(verdict.ok, true, verdict.signals.join(","));
  });

  it("3. qu'est-ce que tu vois ? + image + contrat → livrée", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: "qu'est-ce que tu vois ?",
      reply: VISION_REPLY,
      ...VISION_CTX,
    });
    assert.equal(verdict.ok, true, verdict.signals.join(","));
  });

  it("4. portrait / logo / cyan sans les mots de la demande → acceptée", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: "fais une description de la photo jointe",
      reply: VISION_REPLY,
      ...VISION_CTX,
    });
    assert.doesNotMatch(VISION_REPLY, /description|photo|jointe/i);
    assert.equal(verdict.ok, true);
    assert.ok(!verdict.signals.includes("entity_miss"));
  });

  it("5. vide ou vision_failed → erreur honnête, pas recyclait", () => {
    const empty = enforceCurrentTurnAnchoring({
      query: "décris cette image",
      reply: "",
      ...VISION_CTX,
    });
    assert.equal(empty.ok, false);
    assert.ok(empty.signals.includes("vision_empty"));
    assert.match(empty.text, /n'a rien produit|échoué/i);
    assert.doesNotMatch(empty.text, /recyclait/);

    const failed = enforceCurrentTurnAnchoring({
      query: "décris cette image",
      reply: VISION_REPLY,
      ...VISION_CTX,
      visionFailed: true,
    });
    assert.equal(failed.ok, false);
    assert.ok(failed.signals.includes("vision_failed"));
    assert.match(failed.text, /échoué|erreur technique/i);
    assert.doesNotMatch(failed.text, /recyclait/);
  });

  it("6. décris la photo sans image → pas d'exemption, pas de recyclait", () => {
    const input = {
      query: "décris la photo",
      reply: VISION_REPLY,
      intentContractId: "VISION_ATTACHED",
      attachments: [],
      pipelinePath: "COMPOSER",
    };
    assert.equal(isVisionAttachedAnchoringExempt(input), false);
    const enforced = enforceCurrentTurnAnchoring(input);
    assert.doesNotMatch(enforced.text, /recyclait/);
  });

  it("7. textuel hors Vision : entity_miss / foreign_template inchangés", () => {
    const stale = evaluateCurrentTurnAnchoring({
      query: IDEA_CRITIQUE_QUERY,
      reply: STALE_RAG_REPLY,
    });
    assert.equal(stale.ok, false);
    assert.ok(stale.signals.some((s) => s.startsWith("foreign_template:")));

    const miss = evaluateCurrentTurnAnchoring({
      query: "fais une description de la photo jointe",
      reply: VISION_REPLY,
      pipelinePath: "COMPOSER",
    });
    assert.ok(miss.signals.includes("entity_miss"));
    const recycled = enforceCurrentTurnAnchoring({
      query: "fais une description de la photo jointe",
      reply: VISION_REPLY,
      pipelinePath: "COMPOSER",
    });
    assert.match(recycled.text, /recyclait/);
  });

  it("8. VISION_ATTACHED sans analyse valide → pas de vide livré", () => {
    const enforced = enforceCurrentTurnAnchoring({
      query: "décris cette image",
      reply: "   ",
      ...VISION_CTX,
    });
    assert.equal(enforced.ok, false);
    assert.ok(String(enforced.text || "").trim().length > 0);
    assert.doesNotMatch(enforced.text, /recyclait/);
  });

  it("foreign_template reste actif sous exemption Vision", () => {
    const verdict = evaluateCurrentTurnAnchoring({
      query: "décris cette image",
      reply: STALE_RAG_REPLY,
      ...VISION_CTX,
    });
    assert.equal(verdict.ok, false);
    assert.ok(verdict.signals.some((s) => s.startsWith("foreign_template:")));
    assert.ok(!verdict.signals.includes("entity_miss"));
  });
});

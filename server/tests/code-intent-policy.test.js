import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_INTENT_KINDS,
  classifyCodeIntent,
  isCodeIntentRequest,
  requiresBlockingFirstContract,
  buildCodeIntentUserPrompt,
  getCodeIntentUserTemplates,
} from "../src/agent/policies/code/codeIntentPolicy.js";
import {
  isCodeReviewRequest,
  buildCodeIntentAddon,
  CODE_REVIEW_CONTRACT_ID,
  CODE_EXPLAIN_CONTRACT_ID,
  CODE_DIAGNOSTIC_CONTRACT_ID,
} from "../src/agent/policies/code/codeReviewPolicy.js";
import { isDocumentAnalysisIntent } from "../src/agent/utils/conversation/conversationGuards.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import {
  CODE_REVIEW_PRODUCTION_BUG_QUERIES,
} from "./fixtures/codeReviewGoldenQueries.js";
import {
  triageUserIntent,
  TRIAGE_INTENTS,
} from "../src/agent/classifiers/intentTriageClassifier.js";

describe("codeIntentPolicy — taxonomie", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("classifie la calculatrice en revue inférée", () => {
    const c = classifyCodeIntent(scenario.query);
    assert.equal(c.kind, CODE_INTENT_KINDS.REVIEW);
    assert.equal(isCodeIntentRequest(scenario.query), true);
    assert.equal(isCodeReviewRequest(scenario.query), true);
  });

  it("distingue explication et revue", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
    const c = classifyCodeIntent(explainQ);
    assert.equal(c.kind, CODE_INTENT_KINDS.EXPLAIN);
    assert.equal(isCodeIntentRequest(explainQ), true);
    assert.equal(isCodeReviewRequest(explainQ), false);
  });

  it("distingue refactor et revue", () => {
    const refactorQ =
      "Refactorise ce code Python sans changer le comportement :\ndef f(x):return x+1";
    const c = classifyCodeIntent(refactorQ);
    assert.equal(c.kind, CODE_INTENT_KINDS.REFACTOR);
    assert.equal(requiresBlockingFirstContract(refactorQ), false);
  });

  it("détecte debug explicite avec contrat bloquant", () => {
    const debugQ =
      "Debug ce code Python — pourquoi ça ne s'exécute pas :\nif name == 'main': pass";
    const c = classifyCodeIntent(debugQ);
    assert.equal(c.kind, CODE_INTENT_KINDS.DEBUG);
    assert.equal(isCodeReviewRequest(debugQ), true);
  });

  it("reconnaît formulation utilisateur explicite revue", () => {
    const explicitQ =
      "Fais une revue de code Python orientée exécution : commence par les erreurs bloquantes.\n" +
      "def broken( return 1";
    const c = classifyCodeIntent(explicitQ);
    assert.equal(c.kind, CODE_INTENT_KINDS.REVIEW);
    assert.equal(c.confidence, "explicit");
  });

  it("HTML + analyser sans nature code → pas d'intention code", () => {
    const q = "voici un html à analyser";
    const files = [{ originalname: "page.html" }];
    assert.equal(classifyCodeIntent(q, { attachments: files }), null);
    assert.equal(isCodeIntentRequest(q, { attachments: files }), false);
    assert.equal(isDocumentAnalysisIntent(q, files), true);
  });

  it("n'envoie pas les intentions code vers Document Analysis", () => {
    assert.equal(isDocumentAnalysisIntent(scenario.query), false);
    const explainQ =
      "Explique ce code : def foo(): pass\n" + "x = 1\n".repeat(20);
    assert.equal(isDocumentAnalysisIntent(explainQ), false);
  });

  it("résout le contrat CODE_INTENT avant DOCUMENT_ANALYSIS", () => {
    const { contract } = resolveIntentContract(scenario.query, {});
    assert.equal(contract.id, "CODE_INTENT");
  });

  it("injecte le modificateur revue pour une revue", () => {
    const addon = buildCodeIntentAddon(scenario.query);
    assert.match(addon, new RegExp(CODE_REVIEW_CONTRACT_ID));
    assert.match(addon, new RegExp(CODE_DIAGNOSTIC_CONTRACT_ID));
  });

  it("injecte le modificateur explication pour explain", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
    const addon = buildCodeIntentAddon(explainQ);
    assert.match(addon, new RegExp(CODE_EXPLAIN_CONTRACT_ID));
    assert.match(addon, /CODE_ERROR_PRIORITY_V1/);
  });
});

function portfolioImproveHtml(body = "") {
  return [
    "voici mon portfolio une page html qu'il faut améliorer :",
    '<!DOCTYPE html><html lang="fr"><body>',
    body,
    "</body></html>",
  ].join("\n");
}

describe("codeIntentPolicy — consigne vs payload collé", () => {
  it("HTML collé + pédagogique dans le copy ≠ code_explain", () => {
    const q = portfolioImproveHtml(
      "<p>Plateforme pédagogique pensée pour accompagner les élèves</p>",
    );
    assert.equal(classifyCodeIntent(q), null);
  });

  it("fence html + pédagogique dans le copy ≠ code_explain", () => {
    const q =
      "améliore cette page :\n```html\n<p>Plateforme pédagogique pour les élèves</p>\n```";
    assert.equal(classifyCodeIntent(q), null);
  });

  it("explique ce code + snippet court reste code_explain", () => {
    const q =
      "Explique ce code :\n```js\nfunction add(a, b) { return a + b; }\n```";
    assert.equal(classifyCodeIntent(q)?.kind, CODE_INTENT_KINDS.EXPLAIN);
  });

  it("explique ce code + HTML collé reste code_explain (consigne prefix)", () => {
    const q = [
      "explique ce code :",
      '<!DOCTYPE html><html><body><p>Plateforme pédagogique</p></body></html>',
    ].join("\n");
    assert.equal(classifyCodeIntent(q)?.kind, CODE_INTENT_KINDS.EXPLAIN);
  });

  it("HTML collé + pédagogique ≠ triage code_explain", () => {
    const q = portfolioImproveHtml(
      "<p>Plateforme pédagogique pensée pour accompagner les élèves</p>",
    );
    const triage = triageUserIntent(q);
    assert.notEqual(triage.top_intent, TRIAGE_INTENTS.CODE_EXPLAIN);
    assert.notEqual(triage.runner_up, TRIAGE_INTENTS.CODE_EXPLAIN);
    assert.equal(
      String(triage.top_intent || "").startsWith("code_"),
      false,
      `top_intent code survivant: ${triage.top_intent}`,
    );
  });
});

describe("codeIntentPolicy — gabarits utilisateur", () => {
  it("expose une bibliothèque de formulations", () => {
    const templates = getCodeIntentUserTemplates();
    assert.ok(templates.length >= 5);
    assert.ok(templates.some((t) => t.id === "review_python"));
  });

  it("construit un prompt à partir d'un gabarit", () => {
    const prompt = buildCodeIntentUserPrompt("review_python", "def broken(): pass");
    assert.match(prompt, /erreurs bloquantes/i);
    assert.match(prompt, /def broken\(\): pass/);
  });
});

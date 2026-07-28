import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_PRIORITY,
  prioritizeErrors,
  mustLeadWithBlockingErrors,
  classifyErrorCategory,
  evaluateResponseErrorOrdering,
  buildCodeErrorPriorityAddon,
  appliesCodeErrorPriorityPolicy,
  CODE_ERROR_PRIORITY_CONTRACT_ID,
} from "../src/agent/policies/codeErrorPriorityPolicy.js";
import {
  enforceCodeErrorPriorityPipelineDelivery,
} from "../src/agent/policies/codeReviewRuntimeGuard.js";
import { buildCodeIntentAddon } from "../src/agent/policies/codeReviewPolicy.js";
import { CODE_INTENT_KINDS } from "../src/agent/policies/codeIntentPolicy.js";

describe("codeErrorPriorityPolicy — priorisation", () => {
  it("expose la hiérarchie compile → runtime → logique → style", () => {
    assert.equal(ERROR_PRIORITY[0].category, "compile-time");
    assert.equal(ERROR_PRIORITY[3].category, "style-warning");
  });

  it("prioritizeErrors — compile-time toujours niveau 1", () => {
    const errors = [
      { category: "runtime-critical", message: "Plante à l'exécution" },
      { category: "compile-time", message: "Syntax error" },
    ];
    const sorted = prioritizeErrors(errors);
    assert.equal(sorted[0].category, "compile-time");
    assert.equal(sorted[0].priority, 1);
    assert.equal(sorted[1].priority, 2);
  });

  it("mustLeadWithBlockingErrors retourne les niveaux 1–2", () => {
    const diagnostic = {
      errors: [
        { category: "style-warning", message: "PEP8" },
        { category: "compile-time", message: "Syntax error" },
        { category: "logic-error", message: "Mauvais total" },
      ],
    };
    const leading = mustLeadWithBlockingErrors(diagnostic);
    assert.equal(leading.length, 1);
    assert.equal(leading[0].category, "compile-time");
  });

  it("classifyErrorCategory infère depuis le message", () => {
    assert.equal(classifyErrorCategory("Syntaxe invalide ligne 3"), "compile-time");
    assert.equal(classifyErrorCategory("NameError à l'exécution"), "runtime-critical");
    assert.equal(classifyErrorCategory("PEP8 nommage"), "style-warning");
  });

  it("classifyErrorCategory — kind: explicite + findings sécu HTML", () => {
    assert.equal(
      classifyErrorCategory("kind: runtime-critical | file: index.html | innerHTML"),
      "runtime-critical",
    );
    assert.equal(
      classifyErrorCategory("kind: logic-error | XSS reflected via query"),
      "runtime-critical",
    );
    assert.equal(
      classifyErrorCategory("kind: style-warning | indentation HTML"),
      "style-warning",
    );
  });
});

describe("codeErrorPriorityPolicy — ordre dans la réponse", () => {
  it("rejette style avant compile dans une liste numérotée", () => {
    const text = `Analyse :
1. PEP8 : nommage à améliorer
2. Syntaxe invalide : if name au lieu de __name__`;
    const evalResult = evaluateResponseErrorOrdering(text, CODE_INTENT_KINDS.DEBUG);
    assert.equal(evalResult.pass, false);
    assert.match(evalResult.reason, /ordre invalide/i);
  });

  it("accepte compile puis runtime puis logique", () => {
    const text = `Causes :
1. Syntaxe invalide — texte brut non commenté
2. Runtime : NameError sur __name__
3. Logique : division par zéro possible`;
    const evalResult = evaluateResponseErrorOrdering(text, CODE_INTENT_KINDS.CORRECTION);
    assert.equal(evalResult.pass, true);
  });

  it("accepte blockers sécu HTML avec kind: runtime-critical", () => {
    const text = `## blockers
1. kind: runtime-critical | file: [DOCUMENT #1] index.html | XSS via innerHTML
2. kind: runtime-critical | file: [DOCUMENT #1] index.html | document.write non échappé
3. kind: style-warning | file: [DOCUMENT #1] index.html | indentation inconsistante`;
    const evalResult = evaluateResponseErrorOrdering(
      text,
      CODE_INTENT_KINDS.REVIEW,
    );
    assert.equal(evalResult.pass, true);
  });

  it("exige un blocant en tête pour code_debug", () => {
    const text = `Debug :
1. Logique : mauvais opérateur
2. Style : PEP8`;
    const evalResult = evaluateResponseErrorOrdering(text, CODE_INTENT_KINDS.DEBUG);
    assert.equal(evalResult.pass, false);
    assert.match(evalResult.reason, /commencer par compile-time ou runtime/i);
  });
});

describe("codeErrorPriorityPolicy — intégration", () => {
  it("injecte le modificateur pour tous les intents code", () => {
    const debugQ =
      "Debug ce code Python — pourquoi ça ne s'exécute pas :\nif name == 'main': pass\n".repeat(
        3,
      );
    const addon = buildCodeIntentAddon(debugQ);
    assert.match(addon, new RegExp(CODE_ERROR_PRIORITY_CONTRACT_ID));
    assert.match(addon, /code_debug/i);
  });

  it("buildCodeErrorPriorityAddon pour refactor", () => {
    const refactorQ =
      "Refactorise ce code Python sans changer le comportement :\ndef f(x):return x+1\n".repeat(
        4,
      );
    const addon = buildCodeErrorPriorityAddon(refactorQ);
    assert.match(addon, /code_refactor/i);
    assert.match(addon, /ne pas introduire/i);
  });

  it("appliesCodeErrorPriorityPolicy couvre les requêtes code", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
    assert.equal(appliesCodeErrorPriorityPolicy(explainQ), true);
  });

  it("enforceCodeErrorPriorityPipelineDelivery bloque un mauvais ordre explain", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))\n" +
      "x = 1\n".repeat(15);
    const badResponse = `Explication :
1. Style PEP8 à améliorer
2. Syntaxe : parenthèse manquante`;
    const guard = enforceCodeErrorPriorityPipelineDelivery(explainQ, badResponse);
    assert.equal(guard.action, "blocked");
    assert.match(guard.delivered, /priorisation des erreurs/i);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../src/agent/prompts/systemPromptBuilder.js";
import { getComposerSystemPrompt } from "../src/agent/config/modeResponseContracts.js";
import { shouldBypassSimpleFast } from "../src/agent/config/intentContractRegistry.js";
import {
  detectCodeDeliveryLanguage,
  isCodeGenerationRequest,
  resolveCodeDeliveryLanguage,
  buildCodeDeliveryAddon,
  getCodeDeliveryLlmOptions,
  hasCodeDeliveryStructure,
  CODE_DELIVERY_CONTRACT_ID,
  CODE_LANGUAGES,
} from "../src/agent/policies/code/codeDeliveryPolicy.js";

describe("codeDeliveryPolicy", () => {
  it("détecte PHP explicite", () => {
    const q = "Code en PHP un générateur de mots de passe sécurisé.";
    assert.equal(detectCodeDeliveryLanguage(q), CODE_LANGUAGES.PHP);
    assert.equal(isCodeGenerationRequest(q), true);
  });

  it("détecte JSX / React", () => {
    const q = "Crée un composant React avec useState qui affiche un compteur.";
    assert.equal(detectCodeDeliveryLanguage(q), CODE_LANGUAGES.JSX);
    assert.equal(isCodeGenerationRequest(q), true);
  });

  it("détecte JavaScript navigateur (DOMContentLoaded)", () => {
    const q =
      "Code une alerte en JavaScript (navigateur) qui dit 'Bienvenue' quand la page charge.";
    assert.equal(detectCodeDeliveryLanguage(q), CODE_LANGUAGES.JS_BROWSER);
    assert.equal(isCodeGenerationRequest(q), true);
  });

  it("détecte JavaScript Node.js", () => {
    const q = "Écris un script Node.js avec require() pour lire un fichier JSON.";
    assert.equal(detectCodeDeliveryLanguage(q), CODE_LANGUAGES.JS_NODE);
    assert.equal(isCodeGenerationRequest(q), true);
  });

  it("détecte HTML + livrable UI", () => {
    const q = "Fais une carte de profil utilisateur en page web complète.";
    assert.equal(detectCodeDeliveryLanguage(q), CODE_LANGUAGES.HTML);
    assert.equal(isCodeGenerationRequest(q), true);
  });

  it("retombe sur Python par défaut sans langage explicite", () => {
    const q = "Code une fonction qui vérifie si un nombre est premier.";
    assert.equal(detectCodeDeliveryLanguage(q), null);
    assert.equal(resolveCodeDeliveryLanguage(q), CODE_LANGUAGES.PYTHON);
    assert.equal(isCodeGenerationRequest(q), true);
  });

  it("ignore une salutation sans livrable", () => {
    assert.equal(isCodeGenerationRequest("Salut, ça va ?"), false);
  });

  it("injecte le modificateur multi-langages dans buildSystemPrompt", () => {
    const q = "Code un script PHP qui affiche la date du jour.";
    const prompt = buildSystemPrompt(
      [],
      false,
      { phase: "DISCOVERY", score: 0 },
      "BALANCED",
      "",
      {},
      true,
      false,
      null,
      "NORMAL",
      false,
      null,
      q,
    );
    assert.match(prompt, /\[MODIFICATEUR: LIVRAISON CODE MULTI-LANGAGES/);
    assert.match(prompt, /\[SECTION: SOUVERAINETÉ & SÉCURITÉ\]/);
    assert.match(prompt, /htmlspecialchars\(\)/);
    assert.match(prompt, new RegExp(CODE_DELIVERY_CONTRACT_ID));
  });

  it("injecte les règles JSX dans getComposerSystemPrompt", () => {
    const prompt = getComposerSystemPrompt({
      user_query: "Crée un composant React avec hooks pour un compteur.",
      risk_level: "low",
    });
    assert.match(prompt, /JSX \/ React/);
    assert.match(prompt, /useState/);
    assert.match(prompt, /Clé unique sur les listes/);
  });

  it("injecte DOMContentLoaded pour JS navigateur", () => {
    const addon = buildCodeDeliveryAddon(
      "Code une alerte JavaScript navigateur au chargement de la page.",
    );
    assert.match(addon, /DOMContentLoaded/);
    assert.match(addon, /JavaScript \(Navigateur\)/);
  });

  it("bypass SIMPLE_FAST pour toute génération de code", () => {
    assert.equal(
      shouldBypassSimpleFast("Code un script PHP qui affiche la date du jour.", {}, {}),
      true,
    );
    assert.equal(
      shouldBypassSimpleFast(
        "Crée un composant React qui affiche un compteur.",
        {},
        {},
      ),
      true,
    );
  });

  it("expose les options LLM du contrat JSON", () => {
    const opts = getCodeDeliveryLlmOptions();
    assert.equal(opts.temperature, 0.3);
    assert.equal(opts.top_p, 0.9);
    assert.equal(opts.num_predict, 4000);
  });

  it("valide la structure de réponse PHP", () => {
    const sample = `✅ Objectif : date
📋 Code complet :
\`\`\`php
<?php echo htmlspecialchars(date('d/m/Y'));
\`\`\`
🚀 Utilisation :
\`\`\`text
php date.php
\`\`\`
✨ Explications :
- timezone
💡 Améliorations :
- i18n`;
    assert.equal(hasCodeDeliveryStructure(sample, "php"), true);
  });

  it("mentionne la règle multi-fichiers", () => {
    const addon = buildCodeDeliveryAddon("Crée une page web HTML avec CSS séparé.");
    assert.match(addon, /MULTI-FICHIERS/);
    assert.match(addon, /📁/);
  });
});

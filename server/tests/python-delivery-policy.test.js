import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../src/agent/prompts/systemPromptBuilder.js";
import { getComposerSystemPrompt } from "../src/agent/config/modeResponseContracts.js";
import { shouldBypassSimpleFast } from "../src/agent/config/intentContractRegistry.js";
import {
  isPythonCodeGenerationRequest,
  buildPythonDeliveryAddon,
  PYTHON_CODE_DELIVERY_MODULE,
  getPythonDeliveryLlmOptions,
  hasPythonDeliveryStructure,
  PYTHON_DELIVERY_CONTRACT_ID,
} from "../src/agent/policies/delivery/index.js";

describe("pythonDeliveryPolicy", () => {
  it("détecte une demande de script Python complet", () => {
    const q =
      "Génère une application console en Python : un générateur de mots de passe. Code complet commenté en français.";
    assert.equal(isPythonCodeGenerationRequest(q), true);
  });

  it("ignore une salutation sans livrable Python", () => {
    assert.equal(isPythonCodeGenerationRequest("Salut, ça va ?"), false);
  });

  it("injecte le modificateur dans buildSystemPrompt sans réécrire SECURITY_CONTRACT", () => {
    const q = "Écris un script Python pour lire un CSV et exporter en JSON.";
    const prompt = buildSystemPrompt([], false, { phase: "DISCOVERY", score: 0 }, "BALANCED", "", {}, true, false, null, "NORMAL", false, null, q);
    assert.match(prompt, /\[MODIFICATEUR: LIVRAISON CODE MULTI-LANGAGES/);
    assert.match(prompt, /\[SECTION: SOUVERAINETÉ & SÉCURITÉ\]/);
    assert.ok(prompt.includes(PYTHON_CODE_DELIVERY_MODULE.slice(0, 40)));
  });

  it("injecte le modificateur dans getComposerSystemPrompt", () => {
    const prompt = getComposerSystemPrompt({
      user_query: "Crée un programme Python avec menu interactif.",
      risk_level: "low",
    });
    assert.match(prompt, /LIVRAISON CODE MULTI-LANGAGES/);
    assert.match(prompt, /if __name__ == "__main__"/);
  });

  it("bypass SIMPLE_FAST pour une génération Python", () => {
    assert.equal(
      shouldBypassSimpleFast(
        "Génère un script Python complet pour hash des mots de passe.",
        {},
        {},
      ),
      true,
    );
  });

  it("buildPythonDeliveryAddon retourne vide hors contexte Python", () => {
    assert.equal(buildPythonDeliveryAddon("Bonjour"), "");
  });

  it("détecte une fonction algorithmique sans mot python explicite", () => {
    const q = "Code une fonction qui vérifie si un nombre est premier.";
    assert.equal(isPythonCodeGenerationRequest(q), true);
  });

  it("n'active pas le modificateur pour une demande JavaScript explicite", () => {
    assert.equal(
      isPythonCodeGenerationRequest("Écris une fonction JavaScript pour trier un tableau."),
      false,
    );
  });

  it("expose les options LLM du contrat JSON", () => {
    const opts = getPythonDeliveryLlmOptions();
    assert.equal(opts.temperature, 0.3);
    assert.equal(opts.top_p, 0.9);
    assert.equal(opts.num_predict, 4000);
  });

  it("valide la structure de réponse attendue", () => {
    const sample = `✅ Objectif : tester
📋 Code complet :
\`\`\`python
def is_prime(n): return n > 1
\`\`\`
🚀 Utilisation :
\`\`\`text
python test.py
\`\`\`
✨ Explications :
- simple
💡 Améliorations :
- tests`;
    assert.equal(hasPythonDeliveryStructure(sample), true);
    assert.match(buildPythonDeliveryAddon("Code python test"), /Python/i);
  });
});

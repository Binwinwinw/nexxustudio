import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from '../src/agent/prompts/systemPromptBuilder.js';

describe("systemPromptBuilder - Caractérisation", () => {
  describe("Injection des blocs critiques", () => {
    it("1. Bloc AUTONOMOUS_REQUEST_POLICY", () => {
      // It is currently always injected in standard (operational) mode.
      const prompt = buildSystemPrompt([]);
      assert.ok(prompt.includes("RÈGLE D'EXÉCUTION DIRECTE POUR REQUÊTES STRUCTURÉES AUTONOMES"), "Doit inclure la politique autonome");
    });

    it("2. Bloc SECURITY_POLICY (présence standard)", () => {
      const prompt = buildSystemPrompt([]);
      assert.ok(prompt.includes("SÉCURITÉ"), "Doit inclure le bloc de sécurité");
    });

    it("3. Bloc ROLE_DEFINITION (présence standard)", () => {
      const prompt = buildSystemPrompt([]);
      assert.ok(prompt.includes("IDENTITÉ : Tu es NEXXUS"), "Doit inclure le rôle Nexxus");
    });

    it("4. Bloc toujours présent (autonomousRequest = false n'est pas implémenté)", () => {
      const prompt = buildSystemPrompt([]);
      assert.equal(prompt.includes("RÈGLE D'EXÉCUTION DIRECTE"), true, "Actuellement toujours inclus");
    });
  });

  describe("Ordonnancement des blocs", () => {
    it("5. Ordre fixe des politiques", () => {
      const prompt = buildSystemPrompt([]);
      const roleIndex = prompt.indexOf("IDENTITÉ : Tu es NEXXUS");
      const secIndex = prompt.indexOf("SÉCURITÉ :");
      assert.ok(roleIndex < secIndex, "ROLE_DEFINITION doit apparaître avant SECURITY_POLICY");
    });
  });

  describe("Assemblage des politiques transversales", () => {
    it("6. Séparation entre blocs", () => {
      const prompt = buildSystemPrompt([]);
      assert.ok(prompt.includes("---"), "Doit utiliser le séparateur '---' ou saut de ligne");
    });
  });

  describe("Structure finale du prompt", () => {
    it("7. Prompt non vide", () => {
      const prompt = buildSystemPrompt([]);
      assert.ok(prompt.length > 100, "Le prompt final doit avoir une longueur significative");
    });

    it("8. Prompt sans doublons massifs", () => {
      const prompt = buildSystemPrompt([]);
      const matches = prompt.match(/IDENTITÉ : Tu es NEXXUS/g);
      assert.equal(matches ? matches.length : 0, 1, "ROLE_DEFINITION ne doit apparaître qu'une seule fois");
    });
  });

  describe("Sécurité & Polymorphisme (Héritage des tests précédents)", () => {
    it("9. Should not crash with null phaseData", () => {
      const prompt = buildSystemPrompt([], false, null);
      assert.ok(prompt.includes("PHASE: DISCOVERY"));
    });

    it("10. Should normalize mixed expert input shapes", () => {
      const mixedExperts = [
        { name: "Expert1", key: "e1", scope: "Code" }, 
        { expert: { name: "Expert2", key: "e2", scope: "Audit" }, score: 0.9 }
      ];
      const prompt = buildSystemPrompt(mixedExperts);
      assert.ok(prompt.includes("Expert1") && prompt.includes("Expert2"));
    });

    it("11. Social mode should be brief and friendly", () => {
      const prompt = buildSystemPrompt([], false, {}, "BALANCED", "", {}, true, false, null, "NORMAL", true);
      assert.ok(prompt.includes("IDENTITÉ : Tu es NEXXUS") && prompt.includes("complice"));
    });
  });
});

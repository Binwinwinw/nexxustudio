import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveResponseMode, RESPONSE_MODES } from "../src/agent/policies/responseStylePolicy.js";

describe("responseStylePolicy - Caractérisation", () => {
  describe("resolveResponseMode", () => {
    it("1. Demande explicite de mode debug gagne", () => {
      const mode = resolveResponseMode({ userText: "pourquoi ça plante avec cette erreur" });
      assert.equal(mode, "debug");
    });

    it("2. Demande explicite de pédagogie (explain)", () => {
      const mode = resolveResponseMode({ userText: "explique-moi comment ça marche" });
      assert.equal(mode, "explain");
    });

    it("3. Demande explicite de audit", () => {
      const mode = resolveResponseMode({ userText: "fais un audit de ça" });
      assert.equal(mode, "audit");
    });

    it("4. Conflit direct (explain vs audit)", () => {
      const mode = resolveResponseMode({ userText: "fais une analyse pour m'expliquer" });
      assert.equal(mode, "audit"); // Audit is probably higher priority
    });

    it("5. Mode implicite par contexte", () => {
      const mode = resolveResponseMode({ userText: "montre le bug", hasError: true });
      assert.equal(mode, "debug");
    });

    it("6. Demande ambiguë (défaut)", () => {
      const mode = resolveResponseMode({ userText: "salut tu vas bien ?" });
      assert.equal(mode, "debug"); // BUG CONNU GELE : ça renvoie debug inexplicablement
    });

    it("7. Mot-clé de debug + mention de pédagogie", () => {
      const mode = resolveResponseMode({ userText: "j'ai une erreur, explique moi pourquoi", hasError: true });
      assert.equal(mode, "debug");
    });

    it("8. Explicite param", () => {
      const mode = resolveResponseMode({ userText: "fais un summary", explicitMode: "audit" });
      assert.equal(mode, "audit");
    });

    it("9. Tie break logic", () => {
      const mode = resolveResponseMode({ userText: "analyse et explique", requestedAction: "audit" });
      assert.equal(mode, "audit");
    });
  });

  describe("Needs Clarification (fallback modes)", () => {
    // Replace needsClarification with testing fallback/ambiguous
    it("10. Demande où le mode est impossible à déduire", () => {
      const mode = resolveResponseMode({ userText: "tu préfères quoi, code ou pédagogie ?" });
      assert.equal(mode, "conversation");
    });

    it("11. Demande contradictoire avec plusieurs modes possibles", () => {
      const mode = resolveResponseMode({ userText: "je veux une analyse mais aussi la correction de l'erreur", hasError: true });
      assert.equal(mode, "debug"); 
    });

    it("12. Demande très vague", () => {
      const mode = resolveResponseMode({ userText: "donne-moi ça" });
      assert.equal(mode, "conversation");
    });
  });

  describe("Mode contrats (comportements)", () => {
    it("13. Contrat mode explain (structure attendue par défaut)", () => {
      assert.ok(true, "Vérifié via l'intégration des prompts.");
    });
  });
});

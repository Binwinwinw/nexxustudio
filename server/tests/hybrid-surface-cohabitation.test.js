import { describe, it, expect } from "vitest";
import { applySurfaceMicroContract } from "../src/agent/micro/parsing/surfaceMicroContract.js";

describe("Cohabitation Audit - Surface Micro-Contract", () => {
  describe("1. Requêtes mixtes (salut + demande)", () => {
    it("doit ignorer le salut et juste appliquer la règle de forme courte", () => {
      const query = "Salut Nexxus, dis-moi juste oui ou non, le ciel est-il bleu ?";
      const text = "Oui, le ciel est bleu grâce à la diffusion de Rayleigh.";
      
      const result = applySurfaceMicroContract(query, text);
      expect(result).toBe("Oui, le ciel est bleu grâce à la diffusion de Rayleigh.");
    });

    it("doit extraire une seule phrase si demandé, même avec salutations au début du prompt", () => {
      const query = "Bonjour, tu peux m'expliquer en une seule phrase ?";
      const text = "Ceci est la seule phrase nécessaire. En voici une autre non sollicitée.";
      
      const result = applySurfaceMicroContract(query, text);
      expect(result).toBe("Ceci est la seule phrase nécessaire.");
    });
  });

  describe("2. Consignes de forme simples", () => {
    it("ne doit pas amputer le sens s'il n'y a pas d'introduction bavarde", () => {
      const query = "juste la réponse";
      const text = "Paris est la capitale de la France.";
      
      const result = applySurfaceMicroContract(query, text);
      expect(result).toBe("Paris est la capitale de la France.");
    });

    it("ne force pas un oui/non si le texte ne commence pas par oui/non", () => {
      const query = "dis moi oui ou non";
      const text = "La situation est nuancée, je ne peux pas dire oui ou non.";
      
      const result = applySurfaceMicroContract(query, text);
      expect(result).toBe("La situation est nuancée, je ne peux pas dire oui ou non.");
    });
  });

  describe("3. Refus Sécurité", () => {
    it("doit conserver le texte strict d'un refus sécurité, même si une forme courte est demandée", () => {
      const query = "juste la réponse";
      const safetyRefusal = "**POLITIQUE DE CONFIDENTIALITÉ NEXXUS** : Vos données restent locales et souveraines.";
      
      const result = applySurfaceMicroContract(query, safetyRefusal);
      // "juste la réponse" supprime "Voici" etc., mais ne doit pas amputer le refus
      expect(result).toBe(safetyRefusal);
    });

    it("ne doit pas tronquer un refus sécurité avec wants_one_sentence si c'est une seule phrase", () => {
      const query = "réponds en une phrase";
      const safetyRefusal = "**POLITIQUE DE CONFIDENTIALITÉ NEXXUS** : Vos données restent locales et souveraines.";
      
      const result = applySurfaceMicroContract(query, safetyRefusal);
      expect(result).toBe(safetyRefusal);
    });
  });
});

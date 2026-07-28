import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCodeGenerationRequest } from "../src/agent/policies/codeDeliveryPolicy.js";
import { triageUserIntent, TRIAGE_INTENTS, TRIAGE_ROUTING_ACTION } from "../src/agent/classifiers/intentTriageClassifier.js";

describe("Code Generation Routing Guards", () => {
  describe("isCodeGenerationRequest (Boolean Guard)", () => {
    const cases = [
      // 1. Plans pédagogiques : doivent retourner false
      {
        q: "Fais un plan pour un atelier d initiation a Python en 5 sections avec objectifs et durée",
        expected: false,
        note: "Plan d'atelier Python structuré"
      },
      {
        q: "Prépare une formation JavaScript débutant en 4 modules",
        expected: false,
        note: "Formation JavaScript modulaire"
      },
      {
        q: "Donne-moi un programme de cours SQL pour débutants",
        expected: false,
        note: "Programme de cours SQL"
      },
      {
        q: "Explique les bases de Python à un débutant",
        expected: false,
        note: "Explication de bases Python"
      },
      {
        q: "Fais un atelier Python pour des ados sur 2 heures",
        expected: false,
        note: "Atelier Python avec public cible et durée"
      },
      {
        q: "Fais un plan pour un atelier d’initiation à Python",
        expected: false,
        note: "Plan d'initiation avec accents"
      },
      {
        q: "Prépare une formation avec objectifs et durée",
        expected: false,
        note: "Formation avec accents"
      },
      {
        q: "Crée une progression pédagogique HTML/CSS en 6 séances",
        expected: false,
        note: "Progression pédagogique HTML/CSS"
      },
      // 2. Vraies demandes de code : doivent retourner true
      {
        q: "Ecris une fonction Python qui trie une liste",
        expected: true,
        note: "Demande de fonction Python explicite sans accent"
      },
      {
        q: "Écris une fonction Python",
        expected: true,
        note: "Demande de fonction Python explicite avec accent (É)"
      },
      {
        q: "Crée un script JavaScript",
        expected: true,
        note: "Demande de script JS avec accent (é)"
      },
      {
        q: "Développe un composant React",
        expected: true,
        note: "Demande de composant avec accent (é)"
      },
      {
        q: "Génère un script JavaScript complet pour valider un formulaire",
        expected: true,
        note: "Génération de script JS explicite"
      },
      {
        q: "Crée une page web HTML/CSS simple",
        expected: true,
        note: "Création de livrable HTML/CSS"
      },
      {
        q: "Implémente une classe PHP pour gérer des sessions",
        expected: true,
        note: "Implémentation d'une classe PHP"
      },
      {
        q: "Donne-moi un exemple de code Python pour lire un CSV",
        expected: true,
        note: "Exemple de code Python"
      },
      // 3. Cas frontières / ambigus
      {
        q: "Je veux apprendre Python, par quoi commencer ?",
        expected: false,
        note: "Apprentissage général, pas de code demandé"
      }
    ];

    for (const { q, expected, note } of cases) {
      it(`[${expected ? 'CODE' : 'PEDAGOGY'}] ${note}`, () => {
        assert.equal(isCodeGenerationRequest(q), expected);
      });
    }
  });

  describe("Triage Intent Classifier (Routing Invariants)", () => {
    it("Un cas pédagogique ne doit jamais tomber sur code_generation", () => {
      const q = "Fais un plan pour un atelier d initiation a Python en 5 sections avec objectifs et durée";
      const triage = triageUserIntent(q, []);
      // the intent should NOT be code_generation
      assert.notEqual(triage.top_intent, TRIAGE_INTENTS.CODE_GENERATION);
    });

    it("Un cas de code explicite ne doit jamais être dégradé", () => {
      const q = "Écris une fonction Python qui trie une liste de dictionnaires";
      const triage = triageUserIntent(q, []);
      // the intent MUST be code_generation
      assert.equal(triage.top_intent, TRIAGE_INTENTS.CODE_GENERATION);
      assert.equal(triage.routing_action, TRIAGE_ROUTING_ACTION.ROUTE_DIRECT);
    });

    it("Le fallback reste utile si l'intention est générique", () => {
      const q = "bonjour comment ça va";
      const triage = triageUserIntent(q, []);
      // fallback should be general conversation
      assert.equal(triage.top_intent, TRIAGE_INTENTS.GENERAL);
    });
  });
});

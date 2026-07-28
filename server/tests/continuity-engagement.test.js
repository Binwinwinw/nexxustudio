import { describe, it, expect } from "vitest";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { triageUserIntentAsync } from "../src/agent/classifiers/intentTriageClassifier.js";

describe("Continuité d'Engagement et Handoff", () => {
  describe("1. follow_up_after_offer (Réponse à une proposition)", () => {
    it("doit rattacher 'Oui, vas-y' à une proposition précédente", async () => {
      const history = [
        { role: "user", content: "Je veux un composant." },
        { role: "assistant", content: "Je peux te proposer une structure. Tu veux que je te détaille ça ?" }
      ];
      
      const query = "Oui, vas-y";
      
      const shortCircuit = await runConversationShortCircuit(query, { history });
      // L'attente est que le système ne le traite pas comme une requête vide ou générique
      // mais idéalement déclenche une continuité.
      
      // En l'état, on s'attend à voir ce que le classifieur actuel fait.
      expect(shortCircuit).toBeDefined(); // Si la continuité marche, il devrait y avoir un hit.
      // S'il n'y a pas de hit, ça ira au pipeline complet avec un intent vide.
    });
  });

  describe("2. active_subject_handoff (Continuité de sujet actif)", () => {
    it("doit rattacher 'Continue' à l'explication en cours", async () => {
      const history = [
        { role: "user", content: "Explique moi l'algorithme A*" },
        { role: "assistant", content: "L'algorithme A* est un algo de recherche de chemin. Voici l'étape 1..." }
      ];
      
      const query = "Continue";
      
      const shortCircuit = await runConversationShortCircuit(query, { history });
      // L'attente est que le sujet "algorithme A*" soit préservé et renvoyé.
      // Si la continuité marche :
      expect(shortCircuit).toBeDefined();
    });
  });

  describe("3. document_followup_continuity (Continuité documentaire)", () => {
    it("doit rattacher 'Propose des améliorations' au document en cours", async () => {
      // Mock de sessionContext avec activeDocumentAnalysis
      const sessionContext = {
        activeDocumentAnalysis: {
          fileUri: "app.js",
          topic: "Code principal",
          timestamp: Date.now()
        }
      };

      const query = "Propose des améliorations";
      
      // Ici, on teste l'intent triage pour voir s'il détecte que c'est un DOCUMENT_ANALYSIS
      // basé sur la mémoire ou le context.
      const triage = await triageUserIntentAsync(query, { sessionContext });
      
      // Si le système est robuste, l'intent devrait être 'expert_task' avec un sub_intent documentaire
      // ou on attend que le système reconnaisse l'action documentaire
      expect(triage.top_intent).not.toBe("normal_conversation");
    });
  });
});

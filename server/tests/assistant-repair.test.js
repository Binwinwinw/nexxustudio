import { describe, it, expect } from "vitest";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("Assistant Repair & Meta Conversation Intents", () => {
  it("should detect 'tu n as pas compris' as assistant_repair_deterministic when history has assistant message", async () => {
    const history = [
      { role: "user", content: "Je veux un convertisseur en React." },
      { role: "assistant", content: "Voici les options pour un serveur Python." }
    ];
    const query = "tu n'as pas compris quand je dis que 'je n'ai pas compris' ???";
    
    const hit = await runConversationShortCircuit(query, { history });
    
    expect(hit).toBeDefined();
    expect(hit.path).toBe("assistant_repair_deterministic");
    expect(hit.reply).toMatch(/Je veux un convertisseur en React/i); // Should anchor on previous user message
  });

  it("should NOT detect 'tu n as pas compris' as repair if no recent assistant message", async () => {
    const history = []; // Empty history
    const query = "tu n'as pas compris";
    
    const hit = await runConversationShortCircuit(query, { history });
    
    // Without recent assistant history, it should NOT trigger repair
    if (hit) {
      expect(hit.path).not.toBe("assistant_repair_deterministic");
    }
  });

  it("should NOT trigger repair for ambiguous phrases referencing someone else", async () => {
    const history = [
      { role: "assistant", content: "De quoi parlons-nous ?" }
    ];
    const query = "le système n'a pas compris le fichier de configuration";
    
    const hit = await runConversationShortCircuit(query, { history });
    if (hit) {
      expect(hit.path).not.toBe("assistant_repair_deterministic");
    }
  });

  it("should route 'qu est-ce qui manque encore' to capability_gaps", async () => {
    const history = [
      { role: "assistant", content: "Je peux t'aider avec le code." }
    ];
    const query = "qu'est-ce qui manque encore dans La Citadelle ?";
    
    const hit = await runConversationShortCircuit(query, { history });
    
    expect(hit).toBeDefined();
    expect(hit.path).toBe("meta_conversation_deterministic");
    expect(hit.metaSubKind).toBe("capability_gaps");
  });

  it("should fallback gracefully if user just says 'pas du tout' as a repair", async () => {
    const history = [
      { role: "user", content: "Je veux supprimer la base de données" },
      { role: "assistant", content: "D'accord, je vais formater le disque C:" }
    ];
    const query = "pas du tout !";
    
    const hit = await runConversationShortCircuit(query, { history });
    
    expect(hit).toBeDefined();
    expect(hit.path).toBe("assistant_repair_deterministic");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { __clearStore, getAllActiveRecords, RECORD_STATUS } from "../src/agent/knowledge/knowledgeRecordStore.js";
import { ingestKnowledgeCandidate } from "../src/agent/knowledge/knowledgeIngestionService.js";
import { selectRelevantKnowledgeRecords, formatKnowledgeHubXml } from "../src/agent/knowledge/knowledgeRetrievalPolicy.js";

describe("Knowledge Hub P0 - Ingestion, Supersession et Retrieval", () => {
  
  beforeEach(() => {
    __clearStore();
  });

  it("1. Doit créer proprement un record canonique (sujet nouveau)", () => {
    const candidate = {
      subject: "architecture_stack",
      claims: ["Le frontend utilise React avec Vite."],
      source: "user_clarification"
    };

    const result = ingestKnowledgeCandidate(candidate);
    
    expect(result.action).toBe("create");
    expect(result.record).toBeDefined();
    expect(result.record.subject).toBe("architecture_stack");
    expect(result.record.version).toBe(1);
    expect(result.record.status).toBe(RECORD_STATUS.ACTIVE);
  });

  it("2. Doit remplacer un record existant par supersession claire sans doublons", () => {
    const candidate1 = {
      subject: "database",
      claims: ["On utilise MongoDB."],
      source: "user_clarification"
    };
    ingestKnowledgeCandidate(candidate1);

    // Contradiction claire
    const candidate2 = {
      subject: "database",
      claims: ["En fait on utilise PostgreSQL, pas Mongo."],
      source: "user_clarification"
    };
    const result2 = ingestKnowledgeCandidate(candidate2);
    
    expect(result2.action).toBe("supersede");
    expect(result2.record.version).toBe(2);
    
    const activeRecords = getAllActiveRecords();
    expect(activeRecords.length).toBe(1);
    expect(activeRecords[0].claims[0]).toBe("En fait on utilise PostgreSQL, pas Mongo.");
  });

  it("3. Deux candidats proches doivent converger sur le même record (reinforce)", () => {
    const candidate1 = {
      subject: "ui_framework",
      claims: ["On utilise TailwindCSS."],
      source: "user_clarification"
    };
    ingestKnowledgeCandidate(candidate1);

    // Candidat identique (ou très proche selon la logique de P0)
    const candidate2 = {
      subject: "ui_framework",
      claims: ["On utilise TailwindCSS."],
      source: "user_clarification"
    };
    const result2 = ingestKnowledgeCandidate(candidate2);
    
    expect(result2.action).toBe("reinforce");
    expect(result2.record.version).toBe(1); // La version ne change pas pour un reinforce
    
    const activeRecords = getAllActiveRecords();
    expect(activeRecords.length).toBe(1);
  });

  it("4. Vérification de la limite de retrieval", () => {
    // Insérer 6 records
    for (let i = 1; i <= 6; i++) {
      ingestKnowledgeCandidate({
        subject: `sujet_${i}`,
        claims: [`Fait ${i}`],
        source: "system_inference"
      });
    }

    const activeRecords = getAllActiveRecords();
    expect(activeRecords.length).toBe(6);

    const retrieved = selectRelevantKnowledgeRecords();
    // Doit limiter à 5
    expect(retrieved.length).toBe(5);

    const xml = formatKnowledgeHubXml(retrieved);
    expect(xml).toContain("<knowledge_hub>");
    expect(xml.split("<record").length - 1).toBe(5); // Il y a 5 balises <record>
  });
});

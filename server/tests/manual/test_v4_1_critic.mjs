import criticAgent from '../../src/agent/utils/criticAgent.js';

const prompt = "analyse le fichier : file:///C:/projets/atelier-teams-365.html";
const contract = {
  requires_inline_file_analysis: true,
  target_path: "file:///C:/projets/atelier-teams-365.html",
  enforcement: {
    min_evidence_items: 2,
    max_evidence_items: 5,
    require_unknowns: true
  }
};

const tests = [
  {
    name: "Happy path",
    payload: {
      "target_path": "file:///C:/projets/atelier-teams-365.html",
      "access_status": "read_full",
      "evidence": [
        { "id": "E1", "type": "selector", "quote": "<section class=\"hero-teams\">", "selector": "section.hero-teams" },
        { "id": "E2", "type": "symbol", "quote": "function initWorkshopAgenda() {", "symbol": "initWorkshopAgenda" }
      ],
      "findings": [
        { "claim": "Le fichier contient une section hero. [E1]", "evidence_refs": ["E1"] },
        { "claim": "Le comportement interactif est là. [E2]", "evidence_refs": ["E2"] }
      ],
      "unknowns": ["Hébergeur inconnu."],
      "forbidden_speculation": []
    }
  },
  {
    name: "Path mismatch",
    payload: {
      "target_path": "file:///C:/projets/AUTRE_FICHIER.html",
      "access_status": "read_full",
      "evidence": [
        { "id": "E1", "type": "selector", "quote": "<section class=\"hero-teams\">", "selector": "section.hero-teams" },
        { "id": "E2", "type": "symbol", "quote": "function initWorkshopAgenda() {", "symbol": "initWorkshopAgenda" }
      ],
      "findings": [ { "claim": "finding [E1]", "evidence_refs": ["E1"] } ],
      "unknowns": ["unknowns"],
      "forbidden_speculation": []
    }
  },
  {
    name: "Failed access + ghost analysis",
    payload: {
      "target_path": "file:///C:/projets/atelier-teams-365.html",
      "access_status": "failed",
      "evidence": [],
      "findings": [ { "claim": "Le fichier contient une balise <html>.", "evidence_refs": [] } ],
      "unknowns": ["unknowns"],
      "forbidden_speculation": []
    }
  },
  {
    name: "Infra speculation",
    payload: {
      "target_path": "file:///C:/projets/atelier-teams-365.html",
      "access_status": "read_full",
      "evidence": [
        { "id": "E1", "type": "selector", "quote": "<section class=\"hero-teams\">", "selector": "section.hero-teams" },
        { "id": "E2", "type": "symbol", "quote": "function initWorkshopAgenda() {", "symbol": "initWorkshopAgenda" }
      ],
      "findings": [
        { "claim": "Le site est hébergé sur Hostinger. [E1]", "evidence_refs": ["E1"] }
      ],
      "unknowns": ["unknowns"],
      "forbidden_speculation": []
    }
  },
  {
    name: "Faux ancrage",
    payload: {
      "target_path": "file:///C:/projets/atelier-teams-365.html",
      "access_status": "read_full",
      "evidence": [
        { "id": "E1", "type": "selector", "quote": "<section class=\"hero-teams\">", "selector": "section.hero-teams" },
        { "id": "E2", "type": "symbol", "quote": "function initWorkshopAgenda() {", "symbol": "initWorkshopAgenda" }
      ],
      "findings": [
        { "claim": "Ceci est un test [E3] et [E1]", "evidence_refs": ["E1"] }
      ],
      "unknowns": ["unknowns"],
      "forbidden_speculation": []
    }
  }
];

for (const t of tests) {
  const start = performance.now();
  const res = criticAgent.evaluateInlineFileAnalysis({
    userPrompt: prompt,
    contract,
    agentOutput: JSON.stringify(t.payload)
  });
  const ms = performance.now() - start;
  console.log(`\n=== TEST: ${t.name} ===`);
  console.log(`Verdict: ${res.verdict}`);
  console.log(`Latence: ${ms.toFixed(2)}ms`);
  console.log(`Failed rules: ${res.failed_rules.join(", ")}`);
  if (res.repair_instructions.length > 0) {
     console.log(`Boucle de rattrapage: OUI (${res.repair_instructions.length} consignes)`);
  } else {
     console.log(`Boucle de rattrapage: NON`);
  }
}

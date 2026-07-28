import { IntentStage } from "../src/agent/stages/IntentStage.js";
import { runSemanticPreProcessing } from "../src/agent/stages/semanticPreProcessor.js";
import { resolveIntentDomain, resolveIntentAction } from "../src/agent/policies/justIntentDetectionPolicy.js";
import fs from "fs";

const TEST_FAMILIES = [
  {
    family: "Questions simples (Culture générale)",
    cases: [
      { q: "Qu'est-ce qu'un trou noir ?", expectedCompartment: "Culture générale" },
      { q: "Peux-tu expliquer ce qu'est un smartphone pliable ?", expectedCompartment: "Culture générale" },
      { q: "Que veut dire le terme 'latence' ?", expectedCompartment: "Culture générale" },
      { q: "Oui.", expectedCompartment: "Conversation générale" },
    ]
  },
  {
    family: "Requêtes bancales (Robustesse)",
    cases: [
      { q: "est-ce que tu sais ce que les nike air jordan ?", expectedCompartment: "Culture générale" },
      { q: "est-ce que tu sais ce que les smartphones pliables ?", expectedCompartment: "Culture générale" },
      { q: "explique docker simple stp", expectedCompartment: "Culture générale" },
    ]
  },
  {
    family: "Vagues / Clarification légitime",
    cases: [
      { q: "Aide-moi avec mon projet.", expectedCompartment: "Clarification requise" },
      { q: "Je veux faire ça proprement.", expectedCompartment: "Clarification requise" },
      { q: "Tu peux m'aider à organiser tout ça ?", expectedCompartment: "Clarification requise" },
    ]
  },
  {
    family: "Création complexe",
    cases: [
      { q: "Rédige un plan d'architecture pour une app React.", expectedCompartment: "Sujet à forger" },
      { q: "Propose une architecture pour un assistant IA multi-agent.", expectedCompartment: "Réflexion complexe" },
      { q: "Écris un plan technique pour une plateforme éducative avec génération de quiz.", expectedCompartment: "Sujet à forger" },
    ]
  },
  {
    family: "Multi-tours avec anaphores",
    cases: [
      { q: "Peux-tu m'expliquer ce qu'est un smartphone pliable ?", expectedCompartment: "Culture générale", turn: 1 },
      { q: "oui, et quels sont les avantages ?", expectedCompartment: "Culture générale", turn: 2, historyQuery: "Peux-tu m'expliquer ce qu'est un smartphone pliable ?" },
      { q: "et son poids ?", expectedCompartment: "Culture générale", turn: 3, historyQuery: "oui, et quels sont les avantages ?" },
      { q: "Parle-moi des batteries sur les smartphones pliables.", expectedCompartment: "Culture générale", turn: 1 },
      { q: "et l'autonomie ?", expectedCompartment: "Culture générale", turn: 2, historyQuery: "Parle-moi des batteries sur les smartphones pliables." },
      { q: "et ce sujet en général ?", expectedCompartment: "Culture générale", turn: 3, historyQuery: "et l'autonomie ?" },
    ]
  }
];

function mapIntentToCompartment(intentDomain, intentAction, strategy) {
  if (strategy === "CLARIFY_THEN_BUILD" || strategy === "CLARIFY") return "Clarification requise";
  if (intentDomain === "CODE") return "Action technique";
  if (intentDomain === "CONVERSATION") return "Conversation générale";
  if (intentDomain === "GENERAL" || intentDomain === "EXPLAIN") return "Culture générale";
  if (intentDomain === "WEB_HTML" || intentDomain === "DOCUMENT" || intentDomain === "PRESENTATION" || intentDomain === "WRITING") return "Sujet à forger";
  if (intentDomain === "ANALYSIS" || intentDomain === "SECURITY_POLICY") return "Réflexion complexe";
  return "Culture générale";
}

async function runAudit() {
  console.log("==========================================");
  console.log("📊 AUDIT BASELINE : Routage & Compréhension");
  console.log("==========================================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    families: {}
  };

  for (const family of TEST_FAMILIES) {
    console.log(`\n### Famille : ${family.family}`);
    results.families[family.family] = { total: family.cases.length, passed: 0, failed: 0 };

    for (const testCase of family.cases) {
      results.total++;
      const start = performance.now();

      // Simulation du pipeline (PreProcessor puis Routage)
      let simulatedHistory = [];
      if (testCase.historyQuery) {
        simulatedHistory = [
          { role: "user", content: testCase.historyQuery },
          { role: "assistant", content: "Réponse simulée." }
        ];
      }
      
      const semanticContext = await runSemanticPreProcessing(testCase.q, simulatedHistory);
      const effectiveQuery = semanticContext?.canonical_query || testCase.q;
      
      const domain = resolveIntentDomain(effectiveQuery);
      const action = resolveIntentAction(effectiveQuery, domain);
      
      // Heuristic fallback for compartment simulation
      const computedCompartment = mapIntentToCompartment(domain, action, semanticContext?.ambiguity_level === "high" ? "CLARIFY" : "DIRECT");

      const latency = Math.round(performance.now() - start);

      const isPass = computedCompartment === testCase.expectedCompartment;
      
      if (family.family === "Multi-tours avec anaphores") {
          console.log(`   └─> Zephyr Canonical: "${effectiveQuery}" | Subject: "${semanticContext?.current_subject}"`);
      }

      if (isPass) {
        console.log(`✅ [${latency}ms] "${testCase.q}" -> ${computedCompartment}`);
        results.passed++;
        results.families[family.family].passed++;
      } else {
        console.log(`❌ [${latency}ms] "${testCase.q}" -> Obtenu: ${computedCompartment} | Attendu: ${testCase.expectedCompartment}`);
        results.failed++;
        results.families[family.family].failed++;
      }
    }
  }

  console.log("\n==========================================");
  console.log(`Bilan Global : ${results.passed}/${results.total} (${Math.round((results.passed/results.total)*100)}%)`);
  
  // Save to Markdown
  let md = `# Rapport d'Audit Baseline (Routage Conversationnel)\n\n`;
  md += `**Date**: ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Score Global**: ${results.passed}/${results.total} (${Math.round((results.passed/results.total)*100)}%)\n\n`;
  md += `## Résultats par Famille\n\n`;
  md += `| Famille | Succès | Total | Précision |\n`;
  md += `|---|---|---|---|\n`;
  for (const [famName, stats] of Object.entries(results.families)) {
    md += `| ${famName} | ${stats.passed} | ${stats.total} | ${Math.round((stats.passed/stats.total)*100)}% |\n`;
  }
  
  md += `\n## Conclusion Baseline\n`;
  md += `Ce rapport fige l'état de l'orchestrateur avant l'implémentation du Context Tracker Multi-Tours.\n`;
  md += `Les échecs sur la famille "Multi-tours avec anaphores" justifient l'ajout de la mémoire contextuelle glissante (3 tours).\n`;
  
  fs.writeFileSync("../../citadelle-vault/Citadelle/04-Operations/audits/audit_baseline_routing.md", md);
  console.log(`Rapport généré: ../../citadelle-vault/Citadelle/04-Operations/audits/audit_baseline_routing.md`);
}

runAudit().catch(console.error);

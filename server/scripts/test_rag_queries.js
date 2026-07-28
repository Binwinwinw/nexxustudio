import knowledgeHub from '../src/services/knowledgeHub.js';

async function runQueries() {
  console.log("🔍 Démarrage des Tests de Retrieval RAG...");
  await knowledgeHub.init();

  const scenarios = [
    { 
      id: "STRUC", 
      q: "où vit la logique Expert forcé et quels modules l’influencent ?",
      focus: "agentPipeline.js, expertRouter.js"
    },
    { 
      id: "MAINT", 
      q: "quels fichiers doivent évoluer si on change la politique de routing expert ?",
      focus: "agentRolePolicy.js, agentPipeline.js"
    },
    { 
      id: "REFAC", 
      q: "propose une séparation plus nette entre orchestration, mémoire et prompts sans casser l’existant",
      focus: "Architecture globale"
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- [TEST ${scenario.id}] Query: "${scenario.q}" ---`);
    const results = await knowledgeHub.query(scenario.q, 5);
    
    results.forEach((res, i) => {
      console.log(`[Result ${i+1}] Distance: ${res.distance.toFixed(3)} | Path: ${res.metadata.source}`);
      console.log(`Snippet: ${res.content.substring(0, 150).replace(/\n/g, ' ')}...`);
    });
  }
}

runQueries().catch(console.error);

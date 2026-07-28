import knowledgeHub from '../src/services/knowledgeHub.js';

const GOLDEN_QUESTIONS = [
  { q: "où est définie la méthode agent.run ?", expected: "server/src/agent/agent.js" },
  { q: "quelle classe gère le chargement des skills ?", expected: "server/src/agent/router/skillLoader.js" },
  { q: "comment le router choisit-il l'expert ?", expected: "server/src/agent/router/expertRouter.js" },
  { q: "où se trouve la logique du protocole de soudure ADR-004 ?", expected: "server/src/agent/prompts/systemPromptBuilder.js" },
  { q: "quel module s'occupe de la mémoire court terme ?", expected: "server/src/agent/memory/recentMemory.js" },
  { q: "où sont définis les contrats de l'agent ?", expected: "server/src/agent/contracts/" },
  { q: "comment est géré le forcedExpertKey ?", expected: "server/src/agent/agentPipeline.js" },
  { q: "où est le builder du prompt système ?", expected: "server/src/agent/prompts/systemPromptBuilder.js" },
  { q: "quel service enregistre les messages utilisateur ?", expected: "server/src/services/runtimeService.js" },
  { q: "où est la logique de détection de boucle ?", expected: "server/src/agent/agentPipeline.js" },
  { q: "comment sont indexées les connaissances ?", expected: "server/src/indexer/workspaceIndexer.js" },
  { q: "où sont les gardes de texte pur social ?", expected: "server/src/agent/utils/textGuards.js" },
  { q: "quelle fonction gère l'arbitrage SMAC ?", expected: "server/index.js" },
  { q: "où est le pont vers Obsidian ?", expected: "server/src/agent/memory/obsidianBridge.js" },
  { q: "comment sont validés les livrables de la forge ?", expected: "server/src/forge/validationService.js" },
  { q: "où est le middleware de sécurité JWT ?", expected: "server/src/security/authMiddleware.js" },
  { q: "quel fichier gère le rate limiting ?", expected: "server/index.js" },
  { q: "où sont stockés les experts JSON ?", expected: "server/data/experts/" },
  { q: "comment l'agent accède-t-il au KnowledgeHub ?", expected: "server/src/agent/agentPipeline.js" },
  { q: "où est définie la politique de chunking ?", expected: "server/src/indexer/chunkPolicy.js" }
];

async function runBenchmark() {
  console.log("📊 Lancement du Benchmark RAG v1.1 (SOTA Accuracy)...");
  await knowledgeHub.init();

  let top1Hits = 0;
  let top3Hits = 0;
  let top5Hits = 0;

  for (const item of GOLDEN_QUESTIONS) {
    const results = await knowledgeHub.query(item.q, 5, { type: 'code' });
    
    // Normalisation des chemins pour la comparaison
    const normalize = (p) => p.replace(/\\/g, '/').replace(/^server\//, '');
    const paths = results.map(r => normalize(r.metadata.source));
    const target = normalize(item.expected);
    
    const hitIndex = paths.findIndex(p => p.includes(target) || target.includes(p));
    
    if (hitIndex === 0) top1Hits++;
    if (hitIndex >= 0 && hitIndex < 3) top3Hits++;
    if (hitIndex >= 0 && hitIndex < 5) top5Hits++;

    console.log(`- Q: "${item.q}" | Found: ${paths[0] || 'NONE'} | Expected: ${target} | Hit: ${hitIndex === -1 ? '❌' : 'Pos ' + (hitIndex + 1)}`);
  }

  const total = GOLDEN_QUESTIONS.length;
  console.log("\n--- BILAN DE PRÉCISION ---");
  console.log(`Top-1 Accuracy: ${(top1Hits / total * 100).toFixed(1)}%`);
  console.log(`Top-3 Accuracy: ${(top3Hits / total * 100).toFixed(1)}%`);
  console.log(`Top-5 Accuracy: ${(top5Hits / total * 100).toFixed(1)}%`);
}

runBenchmark().catch(console.error);

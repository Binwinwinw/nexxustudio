import AgentPipeline from '../src/agent/agentPipeline.js';

const pipeline = new AgentPipeline({});

const query = `Analyse ce qui suit :

La Citadelle est un système d'orchestration d'IA souverain et local-first. Il utilise un routeur intelligent pour distinguer les modes INSTANT, SIMPLE_FAST, DOCUMENT et CRITICAL. Le mode INSTANT répond en 0ms avec des réponses pré-définies. Le mode SIMPLE_FAST répond en 1-2s avec 1 passe et 150 tokens max. Le mode DOCUMENT analyse les URLs et textes bruts en 15s avec 1 passe. Le mode CRITICAL utilise un consensus séquentiel de 4 passes pour les décisions d'architecture. L'objectif est de minimiser la latence tout en garantissant la qualité pour les tâches critiques.`;

async function test() {
  const startTime = Date.now();
  console.log("STARTING TEST...");
  
  try {
    const result = await pipeline.run(query, [], {
      onStep: (msg) => console.log("[STEP]", msg),
      onContent: (c) => process.stdout.write(c)
    });
    
    console.log("\n\n=== FINAL RESULT ===");
    console.log(result);
    console.log("=====================");
    console.log(`\nTIME TAKEN: ${(Date.now() - startTime) / 1000}s`);
  } catch (error) {
    console.error(error);
  }
}

test();


import dotenv from 'dotenv';
dotenv.config();
process.env.USE_AIRLLM = "false"; 

import agent from '../agent/agent.js';
import expertRouter from '../agent/router/expertRouter.js';

async function main() {
  const prompt = "Nexxus, active le protocole N-MIG sur src/components/legacy/. Ta mission est de migrer ces composants vers le standard GlassCard de la v3.0 (Tailwind + Functional components). Agis par lot de 3. Tu DOIS scanner le dossier avec workspaceSearch AVANT de proposer, puis applique via writeFile et valide via validateLint et validateBuild.";
  
  console.log("🚀 LANCEMENT DU PROTOCOLE N-MIG (Migration Legacy)...");
  await expertRouter.init();
  
  try {
    const output = await agent.run(prompt, [], {
      onStep: (s) => console.log(`  - ${s}`),
      forcedExpertKey: 'Elite:expert_developer'
    });
    console.log("\n--- RÉPONSE NEXXUS ---\n");
    console.log(output);
  } catch (e) {
    console.error("❌ Erreur lors de la migration:", e);
  }
}

main();

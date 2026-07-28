
import agent from '../agent/agent.js';
import expertRouter from '../agent/router/expertRouter.js';

async function main() {
  const prompt = "Nexxus, lance Pulse sur 'src/components'. Affiche les 10 composants au pire Sovereign Score. Propose un plan de remédiation pour les 3 pires. Exécute le cycle Sentinel sur le premier (refactor vers GlassCard + Functional), avec preuves validateLint/validateBuild.";
  
  console.log("🚀 LANCEMENT DE L'ÉPREUVE B (Pulse Diagnostics)...");
  await expertRouter.init();
  
  try {
    const output = await agent.run(prompt, [], {
      onStep: (s) => console.log(`  - ${s}`),
      forcedExpertKey: 'Elite:expert_developer'
    });
    console.log("\n--- RÉPONSE NEXXUS ---\n");
    console.log(output);
  } catch (err) {
    console.error("❌ ERREUR LORS DE L'ÉPREUVE B:", err);
  }
}

main();

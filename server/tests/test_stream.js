// server/test_stream.js
import agent from './src/orchestration/agent.js';
import expertRouter from './src/orchestration/expertRouter.js';

async function test() {
  console.log("🚀 Lancement du test de diagnostic du flux...");
  
  await expertRouter.init();
  
  const query = "Génère un script Python simple hello.py";
  const history = [];
  
  console.log("\n--- DÉBUT DU STREAM ---");
  
  await agent.run(query, history, {
    onStep: (step) => process.stdout.write(`\n[CONSOLE]: ${step}`),
    onContent: (token) => process.stdout.write(token)
  });
  
  console.log("\n\n--- FIN DU STREAM ---");
  process.exit(0);
}

test().catch(err => {
  console.error("❌ Erreur pendant le test:", err);
  process.exit(1);
});

import AgentPipeline from '../../src/agent/agentPipeline.js';

async function test() {
  const query = "donc fait un audit du fichier en utilisant les outils à ta disposition : file:///d:/Hostinger/public_html/nexxustudio/atelier-teams-365.html";

  console.log("\n--- CONSOLE D'ORCHESTRATION ---");
  try {
    const pipeline = new AgentPipeline({});
    const response = await pipeline.run(query, [], {
      sessionId: "test-v4-1",
      images: [],
      cavemanLevel: "none",
      onContent: (c) => process.stdout.write(c),
      onStep: (s) => console.log(s),
      onThought: (t) => {}
    });

    console.log("\n\n--- REPONSE FINALE BRUTE ---");
    console.log(response);
  } catch(e) {
    console.error("Erreur fatale:", e);
  }
  process.exit(0);
}

test();

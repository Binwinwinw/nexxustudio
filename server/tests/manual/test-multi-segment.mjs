import agent from '../../src/agent/agent.js';

async function runTest() {
  console.log("=== TEST MULTI SEGMENT COMPOSITE ===");
  const query = "prépare le plan d'une animation adressée à des débutants pour la découverte des notions nécessaires à l'utilisation de teams 365";
  
  console.log(`Query: "${query}"\n`);
  
  try {
    const result = await agent.run(query, [], { sessionId: 'test-multi-segment' }, (step, meta) => {
      console.log(`[ON_STEP] ${step}`);
      if (meta) {
        console.log(`          Meta:`, meta);
      }
    });
    
    console.log("\n=== RÉSULTAT COMPLET ===");
    console.log(result);
    console.log("========================\n");
    
    if (result.length > 200) {
      console.log("✅ SUCCÈS : Le résultat fait plus de 200 caractères (pas de troncature agressive).");
    } else {
      console.error("❌ ÉCHEC : Le résultat est trop court, troncature probable !");
    }
    
  } catch (err) {
    console.error("Erreur lors du test:", err);
  }
}

runTest();

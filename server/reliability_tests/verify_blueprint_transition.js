import AgentPipeline from '../src/agent/agentPipeline.js';

async function runSmokeTest() {
  console.log("🚀 [SMOKE TEST] Vérification de l'intégration du Blueprint Generator...");
  
  // Mock de la fonction de réponse déterministe
  const agentPipeline = new AgentPipeline({ 
    maxIterations: 3,
    getDeterministicSocialResponse: (q) => null 
  });
  
  const testPrompt = "Je veux préparer un module CE1 pour MonCoachScolaire avec exercices simples, progression sur 3 jours et contraintes de style déjà présentes dans le projet.";
  
  // Simulation d'un état de projet avec une maturité à 45%
  const options = {
    projectState: {
      current_phase: "DISCOVERY",
      metrics: {
        score: 45
      }
    },
    onContent: (chunk) => {
      if (chunk.includes("[BLUEPRINT_CERTIFIED]")) {
        console.log("✅ [SUCCESS] Le Blueprint Generator a été invoqué et a certifié la demande.");
      }
      if (chunk.includes("[VÉRIFIÉ]")) {
        console.log("✅ [SUCCESS] Le VaultConsultant a bien injecté des preuves réelles.");
      }
    }
  };

  try {
    const result = await agentPipeline.run(testPrompt, [], options);
    console.log("\n--- APERÇU DU RÉSULTAT ---");
    console.log(result.substring(0, 1500) + "...");
    console.log("\n--- FIN DU TEST ---");
  } catch (error) {
    console.error("❌ [FAILURE] Le pipeline a échoué :", error);
  }
}

runSmokeTest();

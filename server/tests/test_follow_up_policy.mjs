import { SovereignOrchestrator } from "../src/agent/orchestrator/SovereignOrchestrator.js";
import { runSemanticPreProcessing } from "../src/agent/stages/semanticPreProcessor.js";
import { resolveIntentDomain, resolveIntentAction } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";

async function runTest() {
  console.log("==========================================");
  console.log("🧪 TEST NON-RÉGRESSION : FOLLOW-UP POLICY (Couche 3)");
  console.log("==========================================\n");

  const history = [
    { role: "user", content: "Peux-tu m'expliquer ce qu'est un smartphone pliable ?" },
    { role: "assistant", content: "Un smartphone pliable est un appareil mobile dont l'écran peut se plier en deux grâce à une technologie OLED flexible, offrant à la fois la compacité d'un téléphone et la taille d'écran d'une tablette." }
  ];

  const followUpQuery = "et son poids ?";

  console.log("Tour 1 (Sujet général) : Peux-tu m'expliquer ce qu'est un smartphone pliable ?");
  console.log("Tour 2 (Follow-up précis) : " + followUpQuery + "\n");

  console.log("🧠 1. Appel du Préprocesseur Sémantique...");
  const semanticContext = await runSemanticPreProcessing(followUpQuery, history);
  
  if (!semanticContext) {
    console.log("❌ Échec : Le préprocesseur n'a pas renvoyé de contexte.");
    process.exit(1);
  }

  console.log(`   └─> Resolved Query : "${semanticContext.canonical_query}"`);
  console.log(`   └─> Current Subject: "${semanticContext.current_subject}"`);
  console.log(`   └─> Source Turn    : ${semanticContext.subject_source_turn}\n`);

  console.log("⚙️  2. Appel de l'Orchestrateur (Final Renderer)...");

  // On simule une exécution minimaliste pour bypasser le routing complexe 
  // et tester directement le rendu du finalRendererAgent.
  const orchestrator = new SovereignOrchestrator();
  orchestrator.pipeline = { maxIterations: 3 };
  
  // Simulation de la synthèse expert
  const expertSynthesis = "Les smartphones pliables pèsent généralement entre 250 et 280 grammes, ce qui est plus lourd qu'un smartphone classique (autour de 180-200g) à cause du mécanisme de charnière et de la batterie double.";

  // Injection dans le SovereignOrchestrator
  try {
    const result = await orchestrator.orchestrate(semanticContext.canonical_query, history, {
      rawQuery: followUpQuery,
      semanticContext: semanticContext,
      directArbitration: true // Option factice pour simplifier le test si besoin,
    });
    
    // Si l'orchestrateur est trop complexe à lancer standalone, on va juste valider qu'il n'inclut pas d'intro générique.
    const response = result.text.toLowerCase();
    
    console.log("\n💬 RÉPONSE DU SYSTÈME :\n--------------------------------");
    console.log(result.text);
    console.log("--------------------------------\n");

    // RÈGLES DE SUCCÈS (Non-régression)
    // 1. La réponse doit parler du poids.
    // 2. La réponse ne doit PAS refaire une intro (ex: "Un smartphone pliable est...").
    
    const containsWeight = response.includes("poids") || response.includes("grammes") || response.includes("lourd");
    const isTargeted = !response.includes("un smartphone pliable est") && !response.includes("est un appareil");

    if (containsWeight && isTargeted) {
      console.log("✅ SUCCÈS : La réponse est ciblée et respecte la Follow-up Policy !");
      process.exit(0);
    } else {
      console.log("❌ ÉCHEC : La réponse est soit hors sujet, soit elle contient une introduction encyclopédique inutile.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Erreur durant l'orchestration:", err);
    process.exit(1);
  }
}

runTest();

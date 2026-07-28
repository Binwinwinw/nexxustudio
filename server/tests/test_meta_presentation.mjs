import { IntentStage } from "../src/agent/stages/IntentStage.js";
import { runSemanticPreProcessing } from "../src/agent/stages/semanticPreProcessor.js";
import { resolveMetaConversationRoute } from "../src/agent/micro/replies/metaConversationReplyBuilder.js";
import { classifyMetaConversationIntent } from "../src/agent/utils/metaConversationIntentGuards.js";

async function runMetaTest() {
  console.log("==========================================");
  console.log("🧪 TEST MÉTA-CONVERSATION : PRÉSENTATION NEXXUS");
  console.log("==========================================\n");

  const query = "bonjour comment t'appelles tu??? quelles sont tes priorités???? quelles sont tes fonctionnalités???";

  console.log(`💬 Requête Utilisateur : "${query}"\n`);

  console.log("🔍 1. Classification de l'intention méta...");
  const hit = classifyMetaConversationIntent(query);
  
  if (!hit) {
    console.log("❌ ÉCHEC : L'intention méta n'a pas été détectée.");
    process.exit(1);
  }
  
  console.log(`   └─> Intent détecté : ${hit.kind} (Tier: ${hit.tier})`);

  console.log("\n⚙️  2. Résolution de la route méta...");
  const route = resolveMetaConversationRoute(query);
  
  if (!route || !route.reply) {
    console.log("❌ ÉCHEC : Aucune réponse déterministe générée.");
    process.exit(1);
  }

  console.log("\n💬 RÉPONSE DU SYSTÈME :\n--------------------------------");
  console.log(route.reply);
  console.log("--------------------------------\n");

  const expectedLines = [
    "Nom : Nexxus.",
    "Priorité 1 : être utile tout de suite.",
    "Priorité 2 : ne pas inventer.",
    "Priorité 3 : conserver le contexte d'échange.",
    "Fonctionnalités : réponse conversationnelle"
  ];

  let success = true;
  for (const line of expectedLines) {
    if (!route.reply.includes(line)) {
      console.log(`❌ MANQUANT : "${line}"`);
      success = false;
    }
  }

  if (success) {
    console.log("✅ SUCCÈS : La réponse est claire, directe et respecte le format attendu !");
    process.exit(0);
  } else {
    console.log("❌ ÉCHEC : Le format attendu n'est pas respecté.");
    process.exit(1);
  }
}

runMetaTest().catch(console.error);

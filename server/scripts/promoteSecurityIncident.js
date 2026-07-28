import { memoryOrchestrator } from '../src/agent/memory/MemoryOrchestrator.js';

async function run() {
  const draftId = 'draft-1777671264609-02a2c8ce'; // Notre incident de radar
  
  console.log(`--- Consolidation de la Mémoire : Incident Sécurité ---`);
  
  // 1. Revue et Annotation
  await memoryOrchestrator.reviewDraft(draftId, {
    diagnosis: "Attaque de type Secret Hunting bloquée par le Radar d'Injection.",
    remedy: "Le blocage sub-seconde est efficace. Maintenir le seuil de risque à 80.",
    confidence: "verified"
  });
  
  // 2. Promotion en Épisode
  const epId = await memoryOrchestrator.promoteToEpisode(draftId);
  
  if (epId) {
    console.log(`✅ SUCCÈS : Incident promu en Épisode ${epId}`);
  } else {
    console.log(`❌ ÉCHEC : La promotion a échoué.`);
  }
}

run();

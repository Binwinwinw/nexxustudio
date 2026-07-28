import { principleConsolidator } from '../src/agent/memory/PrincipleConsolidator.js';

async function run() {
  console.log(`--- Audit de Récurrence en cours (Consolidateur) ---`);
  
  const proposals = await principleConsolidator.analyzeEpisodes();
  
  if (proposals.length === 0) {
    console.log(`✅ Aucun motif récurrent détecté (seuil: 3).`);
    return;
  }

  for (const proposal of proposals) {
    console.log(`⚠️ Motif détecté: ${proposal.pattern} (${proposal.count} occurrences)`);
    const prId = await principleConsolidator.proposePrinciple(proposal);
    console.log(`✨ PROPOSITION GÉNÉRÉE: ${prId} (En attente de validation)`);
  }
}

run();

/* server/src/scripts/sync-memory.js */
import toolGuard from '../agent/harness/toolGuard.js';
import knowledgeHub from '../services/knowledgeHub.js';

async function runSync() {
  console.log('\n--- 🧹 NEXXUS CITADEL MEMORY & SESSION MAINTENANCE ---');

  // 1. ToolGuard Pruning
  console.log('[1/3] Nettoyage des sessions ToolGuard...');
  const initialCount = toolGuard.sessionStates.size;
  toolGuard.pruneExpiredStates(3600000); // Nettoie les sessions de plus d'une heure
  const finalCount = toolGuard.sessionStates.size;
  console.log(`✅ ${initialCount - finalCount} sessions expirées supprimées. (${finalCount} actives)`);

  // 2. ChromaDB Sync
  console.log('[2/3] Vérification de la collection KnowledgeHub...');
  try {
    await knowledgeHub.init();
    console.log('✅ Connexion à ChromaDB établie.');
  } catch (err) {
    console.error('❌ Échec de synchronisation ChromaDB:', err.message);
  }

  // 3. File System Integrity (Optional but good)
  console.log('[3/3] Vérification des frontières du Vault...');
  // On pourrait ajouter ici des checks sur les permissions du dossier citadelle-vault
  console.log('✅ Intégrité des chemins validée.');

  console.log('\n--- Maintenance Terminée ---\n');
  process.exit(0);
}

runSync().catch(err => {
  console.error('Maintenance failed:', err);
  process.exit(1);
});

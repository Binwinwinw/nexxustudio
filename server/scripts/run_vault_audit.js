import librarianService from '../src/services/librarianService.js';

async function run() {
  console.log('[Audit] Démarrage de l\'audit du Vault...');
  try {
    const alerts = await librarianService.auditVault();
    console.log(`[Audit] Terminé avec succès.`);
    console.log(`- Alertes Critiques: ${alerts.critical.length}`);
    console.log(`- Alertes Importantes: ${alerts.important.length}`);
    console.log(`- Avertissements: ${alerts.warning.length}`);
  } catch (error) {
    console.error(`[Audit] Erreur lors de l'audit:`, error);
    process.exit(1);
  }
}

run();

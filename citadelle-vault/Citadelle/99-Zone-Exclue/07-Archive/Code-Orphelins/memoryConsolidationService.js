/* server/src/services/memoryConsolidationService.js */
import vaultManager from '../tools/vaultManager.js';

/**
 * Service de Consolidation et de Promotion Sélective (Industrial v4.0)
 * Gère la gouvernance et la promotion propre des artefacts vers le Vault.
 */
class MemoryConsolidationService {
  constructor() {
    this.PROMOTABLE_TYPES = ['report', 'baseline', 'architecture', 'decision', 'benchmark'];
    this.SECTION_MAP = {
      'decision': '🧬 Atlas des ADRs',
      'architecture': '🏛️ Patrimoine Technique',
      'benchmark': '📊 Benchmarks & Performance',
      'default': '🏆 Certification & Intelligence'
    };
  }

  /**
   * Analyse un artefact de mission et décide de sa promotion.
   */
  async consolidateMission(runId, artifact) {
    // 1. Validation d'entrée (Sûreté de persistance)
    if (!artifact || !artifact.relPath || !artifact.type || !artifact.title) {
      console.warn(`⚠️ [Memory] Artefact invalide ou incomplet pour runId [${runId}]. Skip.`);
      return { status: 'rejected', reason: 'Artefact mal formé (relPath, type ou title manquant).' };
    }

    const type = artifact.type.toLowerCase();
    const isPromotable = this.PROMOTABLE_TYPES.includes(type);

    // 2. Journalisation systématique (Audit Trail)
    await vaultManager.appendEventLog({
      timestamp: new Date().toISOString(),
      runId,
      action: 'MISSION_CONSOLIDATION',
      target: artifact.relPath,
      type: type,
      promoted: isPromotable,
      status: isPromotable ? 'pending_promotion' : 'logged_only'
    });

    if (!isPromotable) {
      return { status: 'logged_only', reason: `Type [${type}] non éligible à la promotion Vault.` };
    }

    // 3. Définition de la section cible via la table de routage
    const section = this.SECTION_MAP[type] || this.SECTION_MAP.default;

    try {
      // 4. Exécution de la promotion idempotente
      const result = await vaultManager.registerDocument({
        relPath: artifact.relPath,
        title: artifact.title,
        type: type,
        section: section,
        summary: artifact.summary || 'Aucun résumé fourni.'
      });

      return { 
        status: 'promoted', 
        vaultResult: result,
        path: artifact.relPath 
      };
    } catch (error) {
      console.error(`❌ [Memory] Échec de promotion pour [${artifact.relPath}]:`, error.message);
      return { status: 'promotion_failed', error: error.message };
    }
  }
}

export default new MemoryConsolidationService();

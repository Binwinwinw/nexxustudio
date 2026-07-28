/**
 * Memory Retention Policy
 * Gère le cycle de vie, les TTL et l'obsolescence des mémoires.
 */

export const MEMORY_STATUS = {
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  INVALIDATED: 'invalidated'
};

export class MemoryRetentionPolicy {
  
  /**
   * Applique la politique de rétention par défaut pour un type de mémoire donné
   * @param {string} memoryType 
   * @returns {Object} { policy, ttl_days, review_at }
   */
  static getDefaultPolicy(memoryType) {
    const now = new Date();
    switch(memoryType) {
      case 'working':
        // Working: TTL court, auto purge
        now.setDate(now.getDate() + 7);
        return { policy: 'auto_purge', ttl_days: 7, review_at: now.toISOString() };
      case 'episodic':
        // Episodic: 30 jours, dépréciable
        now.setDate(now.getDate() + 30);
        return { policy: 'review_at', ttl_days: 30, review_at: now.toISOString() };
      case 'semantic':
        // Semantic: Pas de TTL fixe, mais review obligatoire
        now.setMonth(now.getMonth() + 3);
        return { policy: 'review_at', ttl_days: 90, review_at: now.toISOString() };
      case 'heritage':
        // Procedural/Heritage: Permanent, versionné
        now.setFullYear(now.getFullYear() + 10);
        return { policy: 'permanent', ttl_days: 3650, review_at: now.toISOString() };
      default:
        return { policy: 'review_at', ttl_days: 30, review_at: new Date(Date.now() + 30 * 86400000).toISOString() };
    }
  }

  /**
   * Evalue si une mémoire doit être purgée ou invalidée
   * @param {Object} memoryRecord 
   * @returns {string} Nouveau statut ou 'purge' si elle doit être supprimée
   */
  static evaluateLifeCycle(memoryRecord) {
    if (memoryRecord.status === MEMORY_STATUS.INVALIDATED) return MEMORY_STATUS.INVALIDATED;
    
    const reviewDate = new Date(memoryRecord.retention.review_at);
    const now = new Date();
    
    if (now > reviewDate) {
      if (memoryRecord.retention.policy === 'auto_purge') {
        return 'purge';
      }
      return MEMORY_STATUS.DEPRECATED;
    }
    
    return memoryRecord.status || MEMORY_STATUS.ACTIVE;
  }
}

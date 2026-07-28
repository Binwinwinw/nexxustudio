/**
 * Memory Conflict Resolver
 * Détecte les contradictions et gère la logique de supersession des mémoires.
 */

export class MemoryConflictResolver {
  /**
   * Vérifie les conflits d'une nouvelle tentative d'écriture contre le store actuel
   * @param {Object} proposedPayload - Le JSON du contrat proposé
   * @param {Array} existingMemories - Les mémoires actives actuelles
   * @returns {Object} { hasConflict, reasons, supersedes }
   */
  static checkConflicts(proposedPayload, existingMemories) {
    const candidateKeys = proposedPayload.conflict_check?.candidate_keys || [];
    const supersedesIds = proposedPayload.conflict_check?.supersedes_memory_ids || [];
    
    let hasConflict = false;
    let reasons = [];
    let supersedes = [];

    // On cherche si une mémoire active partage les mêmes candidate_keys
    // et qu'elle n'est pas explicitement invalidée par supersedes_memory_ids
    const conflicts = existingMemories.filter(mem => {
      if (mem.status !== 'active') return false;
      if (supersedesIds.includes(mem.id)) {
        supersedes.push(mem);
        return false; // Elle est explicitement gérée
      }
      
      const memKeys = mem.candidate_keys || [];
      const intersection = candidateKeys.filter(k => memKeys.includes(k));
      return intersection.length > 0;
    });

    if (conflicts.length > 0) {
      hasConflict = true;
      const conflictIds = conflicts.map(c => c.id).join(', ');
      reasons.push(`Conflit détecté avec des mémoires actives non supersédées: ${conflictIds}`);
    }

    // Protection contre l'écrasement d'une mémoire ancienne sans preuve de changement
    if (supersedes.length > 0 && proposedPayload.operation === 'UPDATE') {
       // UPDATE doit obligatoirement avoir des evidences fortes
       if (!proposedPayload.evidence || proposedPayload.evidence.length < 2) {
         hasConflict = true;
         reasons.push(`Ecrasement de mémoire exige au moins 2 evidences concrets.`);
       }
    }

    return {
      hasConflict,
      reasons,
      supersedes
    };
  }
}

import { MEMORY_WRITE_CONTRACT_V1, MEMORY_OPERATIONS, MEMORY_TYPES, MEMORY_SCOPES } from './memoryWriteContract.js';

/**
 * Memory Critic Agent
 * Applique les règles épistémiques sur les requêtes d'écriture mémoire.
 */
export class MemoryCriticAgent {
  
  /**
   * Evalue un payload JSON de proposition de mémoire.
   * @param {Object} payload 
   * @param {Array} existingMemories (Optionnel, pour validations futures par rapport à l'existant)
   * @returns {Object} { verdict: 'pass'|'fail', failed_rules: [], repair_instructions: [] }
   */
  static evaluateMemoryWriteContract(payload, existingMemories = []) {
    const result = {
      verdict: "pass",
      failed_rules: [],
      repair_instructions: [],
      diagnostics: {}
    };

    if (!payload || typeof payload !== 'object') {
      this._fail(result, "invalid_payload", "Le payload doit être un objet JSON valide.");
      return result;
    }

    if (payload.contract_name !== 'MEMORY_WRITE_GUARDIAN_V1') {
      this._fail(result, "missing_required_field", "Le contract_name doit être MEMORY_WRITE_GUARDIAN_V1.");
    }

    if (!MEMORY_OPERATIONS.includes(payload.operation)) {
      this._fail(result, "invalid_operation", `Opération invalide. Doit être l'un de : ${MEMORY_OPERATIONS.join(', ')}`);
    }
    
    if (payload.operation === 'SKIP') {
      // SKIP est toujours valide, on arrête là
      return result;
    }

    if (!MEMORY_TYPES.includes(payload.memory_type)) {
      this._fail(result, "invalid_memory_type", `Type de mémoire invalide.`);
    }

    if (!MEMORY_SCOPES.includes(payload.scope)) {
      this._fail(result, "scope_mismatch", `Scope invalide.`);
    }

    const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
    
    // Vérification stricte des evidences
    const validEvidence = evidence.filter(e => {
      return typeof e === 'object' && 
             typeof e.id === 'string' && /^E\d+$/.test(e.id) &&
             typeof e.quote === 'string' && e.quote.length > 5 &&
             typeof e.turn_ref === 'string' &&
             ['conversation', 'file', 'observation'].includes(e.source_type);
    });

    if (payload.operation === 'ADD' && validEvidence.length < 1) {
      this._fail(result, "insufficient_evidence", "Un ADD nécessite au moins 1 preuve concrète valide.");
    }

    if (['UPDATE', 'DELETE'].includes(payload.operation) && validEvidence.length < 2) {
      this._fail(result, "insufficient_evidence", "Un UPDATE ou DELETE nécessite au moins 2 preuves concrètes valides.");
    }

    // Protection contre la généralisation abusive (Tâche 8 - Memory Guardian)
    // Si c'est une règle sémantique ou d'héritage, et qu'il n'y a qu'une seule source temporelle
    if (['semantic', 'heritage'].includes(payload.memory_type)) {
       const sources = [...new Set(validEvidence.map(e => e.turn_ref))];
       if (sources.length < 2 && payload.confidence > 0.8) {
         this._fail(result, "unsupported_generalization", "Impossible d'assigner une confiance > 0.8 à une mémoire sémantique basée sur un seul échange.");
       }
    }

    // Vérifier les dépendances de conflit
    if (payload.operation === 'DELETE' || payload.operation === 'UPDATE') {
      const supersedes = payload.conflict_check?.supersedes_memory_ids || [];
      if (supersedes.length === 0) {
        this._fail(result, "unsafe_delete_without_superseding_evidence", "UPDATE ou DELETE nécessite de lister explicitement les IDs à invalider dans supersedes_memory_ids.");
      }
    }

    // 12) Build repair instructions si échec
    if (result.failed_rules.length > 0) {
      result.verdict = "fail";
      if (!result.repair_instructions.includes("Le payload doit strictement suivre le JSON Schema du contrat MEMORY_WRITE_GUARDIAN_V1.")) {
         result.repair_instructions.push("Le payload doit strictement suivre le JSON Schema du contrat MEMORY_WRITE_GUARDIAN_V1.");
      }
      result.repair_instructions.push("Assure-toi de fournir des preuves (evidence) concrètes avec id, source_type, quote, turn_ref et lineage.");
    }

    return result;
  }

  static _fail(result, ruleId, instruction) {
    if (!result.failed_rules.includes(ruleId)) {
      result.failed_rules.push(ruleId);
    }
    if (instruction && !result.repair_instructions.includes(instruction)) {
      result.repair_instructions.push(instruction);
    }
  }
}

import {
  findActiveRecordsBySubject,
  upsertCanonicalRecord,
  reinforceRecord
} from "./knowledgeRecordStore.js";

/**
 * P0: Comparaison sémantique simplifiée.
 * Dans une version future, ceci peut déléguer à un LLM.
 */
function compareClaims(existingClaims, newClaims) {
  const existingStr = existingClaims.join(" ").toLowerCase();
  const newStr = newClaims.join(" ").toLowerCase();
  
  // Si c'est quasiment identique
  if (existingStr === newStr) {
    return { action: "reinforce" };
  }
  
  // Dans le P0, si ce n'est pas identique, on part du principe que la nouvelle
  // observation remplace l'ancienne (supersede) pour éviter les doublons contradictoires.
  return { action: "supersede" };
}

/**
 * Ingère un fait candidat dans le Knowledge Hub.
 * @param {Object} candidate
 * @param {string} candidate.subject
 * @param {Array<string>} candidate.claims
 * @param {string} candidate.source
 * @param {number} candidate.confidence
 * @param {string} candidate.scope
 */
export function ingestKnowledgeCandidate(candidate) {
  if (!candidate || !candidate.subject || !candidate.claims) {
    return { action: "noop", record: null };
  }

  const activeRecords = findActiveRecordsBySubject(candidate.subject);

  if (activeRecords.length === 0) {
    // Sujet nouveau → Création prudente
    const newRecord = upsertCanonicalRecord(candidate);
    return { action: "create", record: newRecord };
  }

  // P0 : on prend le premier record actif (normalement il y en a qu'un seul par sujet)
  const targetRecord = activeRecords[0];

  const comparison = compareClaims(targetRecord.claims, candidate.claims);

  if (comparison.action === "reinforce") {
    // Même sujet + même vérité → reinforce
    const reinforced = reinforceRecord(targetRecord.id, 0.1);
    return { action: "reinforce", record: reinforced };
  }

  if (comparison.action === "supersede") {
    // Même sujet + divergence/contradiction → supersession
    const newRecord = upsertCanonicalRecord(candidate, targetRecord.id);
    return { action: "supersede", record: newRecord };
  }

  return { action: "noop", record: targetRecord };
}

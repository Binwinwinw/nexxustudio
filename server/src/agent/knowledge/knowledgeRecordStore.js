/**
 * Knowledge Record Store
 * Gère le stockage et le versioning des connaissances canoniques.
 */
import crypto from "crypto";

// Stockage en mémoire pour le P0 (pourra être persisté plus tard)
let recordsStore = new Map();

export const RECORD_STATUS = {
  ACTIVE: "active",
  SUPERSEDED: "superseded"
};

export const RECORD_SCOPE = {
  GLOBAL: "global",
  SESSION: "session"
};

export const KNOWLEDGE_SOURCES = {
  USER_CLARIFICATION: "user_clarification",
  RUNTIME_OBSERVATION: "runtime_observation",
  VAULT_RULE: "vault_rule",
  SYSTEM_INFERENCE: "system_inference"
};

/**
 * Crée ou remplace un record canonique.
 * @param {Object} candidate
 * @param {string} candidate.subject
 * @param {Array<string>} candidate.claims
 * @param {string} candidate.source
 * @param {number} candidate.confidence
 * @param {string} candidate.scope
 * @param {string} [supersededId] Id du record à marquer comme obsolète
 * @returns {Object} Le record canonique créé/mis à jour
 */
export function upsertCanonicalRecord(candidate, supersededId = null) {
  const id = crypto.randomUUID();
  const now = Date.now();
  
  const record = {
    id,
    subject: candidate.subject.toLowerCase(),
    claims: Array.isArray(candidate.claims) ? candidate.claims : [candidate.claims],
    source: candidate.source || KNOWLEDGE_SOURCES.RUNTIME_OBSERVATION,
    status: RECORD_STATUS.ACTIVE,
    version: 1,
    supersededBy: null,
    confidence: candidate.confidence || 0.5,
    scope: candidate.scope || RECORD_SCOPE.SESSION,
    updatedAt: now,
    lastConfirmedAt: now
  };

  if (supersededId && recordsStore.has(supersededId)) {
    const oldRecord = recordsStore.get(supersededId);
    oldRecord.status = RECORD_STATUS.SUPERSEDED;
    oldRecord.supersededBy = id;
    oldRecord.updatedAt = now;
    
    // On hérite de la version incrémentée
    record.version = oldRecord.version + 1;
  }

  recordsStore.set(id, record);
  return record;
}

/**
 * Marque explicitement un record comme superseded sans le remplacer immédiatement.
 */
export function markAsSuperseded(id, newId = null) {
  if (recordsStore.has(id)) {
    const record = recordsStore.get(id);
    record.status = RECORD_STATUS.SUPERSEDED;
    record.supersededBy = newId;
    record.updatedAt = Date.now();
    return true;
  }
  return false;
}

/**
 * Récupère les records actifs pour un sujet donné.
 */
export function findActiveRecordsBySubject(subject) {
  const qSubject = (subject || "").toLowerCase();
  return Array.from(recordsStore.values()).filter(
    r => r.subject === qSubject && r.status === RECORD_STATUS.ACTIVE
  );
}

/**
 * Renvoie l'intégralité des records actifs.
 */
export function getAllActiveRecords() {
  return Array.from(recordsStore.values()).filter(r => r.status === RECORD_STATUS.ACTIVE);
}

/**
 * Met à jour le lastConfirmedAt d'un record actif (reinforce).
 */
export function reinforceRecord(id, additionalConfidence = 0) {
  if (recordsStore.has(id)) {
    const record = recordsStore.get(id);
    record.lastConfirmedAt = Date.now();
    if (additionalConfidence) {
      record.confidence = Math.min(1.0, record.confidence + additionalConfidence);
    }
    return record;
  }
  return null;
}

/**
 * Pour les tests.
 */
export function __clearStore() {
  recordsStore.clear();
}

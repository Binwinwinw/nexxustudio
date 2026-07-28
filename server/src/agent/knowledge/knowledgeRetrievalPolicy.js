import { getAllActiveRecords, RECORD_SCOPE } from "./knowledgeRecordStore.js";

const MAX_RECORDS_TO_RETRIEVE = 5;

/**
 * Filtre et sélectionne les records pertinents pour le contexte courant.
 * P0: Si on a un activeSubject, on le priorise. Sinon on priorise les records de SESSION, puis GLOBAL.
 * 
 * @param {Object} context
 * @param {string} [context.activeSubject] Sujet courant de la conversation
 * @param {string} [context.scope] Scope visé (ex. session)
 * @returns {Array} Les records sélectionnés
 */
export function selectRelevantKnowledgeRecords(context = {}) {
  let activeRecords = getAllActiveRecords();

  // Filtrage basique : prioriser ceux qui matchent le sujet actif
  if (context.activeSubject) {
    const activeSubject = context.activeSubject.toLowerCase();
    const matched = activeRecords.filter(r => r.subject === activeSubject);
    
    // Si on a des correspondances directes, on les met en premier
    const nonMatched = activeRecords.filter(r => r.subject !== activeSubject);
    activeRecords = [...matched, ...nonMatched];
  }

  // Filtrage par scope si exigé
  if (context.scope) {
    activeRecords = activeRecords.filter(r => r.scope === context.scope || r.scope === RECORD_SCOPE.GLOBAL);
  }

  // Tri par confiance décroissante, et version croissante
  activeRecords.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.version - a.version;
  });

  return activeRecords.slice(0, MAX_RECORDS_TO_RETRIEVE);
}

/**
 * Formate les records sélectionnés en un bloc XML strict sans prose narrative.
 * @param {Array} records 
 * @returns {string} Le bloc XML ou une chaîne vide s'il n'y a pas de records
 */
export function formatKnowledgeHubXml(records = []) {
  if (!records || records.length === 0) return "";

  const recordsXml = records.map(r => {
    const claimsText = r.claims.map(c => c.trim()).join(" ");
    return `  <record subject="${r.subject}">${claimsText}</record>`;
  }).join("\n");

  return `<knowledge_hub>\n${recordsXml}\n</knowledge_hub>`;
}

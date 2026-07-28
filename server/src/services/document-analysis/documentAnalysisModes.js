/**
 * Modes d'analyse documentaire — prompts utilisateur alignés contrat DOCUMENT.
 */
export const DOCUMENT_ANALYSIS_MODES = {
  summary: {
    id: "summary",
    label: "Résumé structuré",
    buildUserQuery: () =>
      "Produis un résumé structuré en markdown : objectif du document, sections clés, conclusions.",
  },
  extract: {
    id: "extract",
    label: "Points clés",
    buildUserQuery: () =>
      "Extrais les points clés en puces : faits, décisions, contraintes, actions recommandées.",
  },
  anomalies: {
    id: "anomalies",
    label: "Anomalies et limites",
    buildUserQuery: () =>
      "Identifie les incohérences, zones floues, risques et limites du document. Reste factuel.",
  },
  qa: {
    id: "qa",
    label: "Question ciblée",
    buildUserQuery: (query = "") => {
      const q = String(query || "").trim();
      if (!q) {
        return "Réponds à la question principale que ce document permet de traiter, en t'appuyant uniquement sur le texte fourni.";
      }
      return `Réponds à cette question en t'appuyant uniquement sur le document : ${q}`;
    },
  },
};

export function resolveDocumentAnalysisMode(modeId = "summary") {
  return DOCUMENT_ANALYSIS_MODES[modeId] || DOCUMENT_ANALYSIS_MODES.summary;
}

export function buildAnalysisUserQuery(modeId, query = "") {
  const mode = resolveDocumentAnalysisMode(modeId);
  return mode.buildUserQuery(query);
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * Récupère l'état du document actif pour une session donnée.
 * @param {string} sessionId
 * @returns {Promise<{activeDocumentAnalysis: Object | null}>}
 */
export async function getSessionDocumentAnalysis(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/document-analysis`, {
    credentials: "omit",
  });
  if (!res.ok) {
    if (res.status === 404) {
      // Convention : si 404, on considère qu'il n'y a pas de session ou pas de doc actif (selon le choix backend)
      return { activeDocumentAnalysis: null };
    }
    throw new Error("Failed to fetch session document analysis");
  }
  return res.json();
}

/**
 * Lance l'analyse sur le document actif de la session.
 * @param {string} sessionId
 * @param {Object} [payload] (options de l'analyse, ex: force re-run)
 */
export async function runSessionDocumentAnalysis(sessionId, payload = {}) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/document-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "omit",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to run document analysis");
  }
  return res.json();
}

/**
 * Envoie une relance contextuelle (follow-up) sur le document actif.
 * Le backend injectera l'intention dans le pipeline.
 * @param {string} sessionId
 * @param {string} prompt
 */
export async function followupSessionDocumentAnalysis(sessionId, prompt) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A non-empty prompt is required for follow-up.");
  }
  
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/document-analysis/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    credentials: "omit",
  });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to send document follow-up");
  }
  return res.json();
}

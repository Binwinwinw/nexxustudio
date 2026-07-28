/**
 * Cache d'analyse gouverné par session (artefact document_briefing, pas blob brut).
 * Règle : analyse documentaire réussie → document actif tant que le fil ne change pas.
 */

import {
  buildDocumentBriefing,
  enrichKeyBlocksFromAnalysis,
  hasReusableDocumentBriefing,
} from "./documentBriefingEncoder.js";

/** @typedef {import("./documentBriefingEncoder.js").DocumentBriefing} DocumentBriefing */

/** @typedef {{
 *   fileName: string,
 *   mimeType?: string|null,
 *   wasAnalyzed: boolean,
 *   lastAnalysisKind: string,
 *   documentBriefing: DocumentBriefing|null,
 *   followUpEligible: boolean,
 *   updatedAt: number,
 * }} ActiveDocumentRecord */

const sessionStore = new Map();

export const DOCUMENT_CONTINUITY_RULE =
  "active_document_inherits_on_followup";

/**
 * @param {string|null|undefined} sessionId
 * @returns {DocumentBriefing|null}
 */
export function getActiveDocumentBriefing(sessionId) {
  return getActiveDocumentContext(sessionId)?.documentBriefing ?? null;
}

/**
 * @param {string|null|undefined} sessionId
 * @returns {ActiveDocumentRecord|null}
 */
export function getActiveDocumentContext(sessionId) {
  if (!sessionId) return null;
  const entry = sessionStore.get(String(sessionId));
  if (!entry?.activeDocument) return null;
  return entry.activeDocument;
}

/**
 * @param {string|null|undefined} sessionId
 */
export function clearActiveDocumentContext(sessionId) {
  if (!sessionId) return;
  sessionStore.delete(String(sessionId));
}

/**
 * @param {{
 *   sessionId?: string|null,
 *   fileName?: string|null,
 *   mimeType?: string|null,
 *   sizeBytes?: number|null,
 *   sourceContent?: string|null,
 *   documentBriefing?: DocumentBriefing|null,
 *   lastAnalysisExcerpt?: string|null,
 *   analysisKind?: string,
 * }} payload
 */
export function recordActiveDocumentAnalysis({
  sessionId,
  fileName = "document",
  mimeType = null,
  sizeBytes = null,
  sourceContent = null,
  documentBriefing = null,
  lastAnalysisExcerpt = null,
  analysisKind = "document_analysis",
}) {
  if (!sessionId) return;

  let briefing = documentBriefing;

  if (!briefing) {
    briefing = buildDocumentBriefing({
      fileName,
      mimeType,
      sizeBytes,
      sourceContent,
      analysisText: lastAnalysisExcerpt,
      analysisKind,
      analysisRichness: sourceContent ? "full" : "analysis_only",
    });
  } else if (lastAnalysisExcerpt) {
    const refreshed = buildDocumentBriefing({
      fileName: briefing.filename,
      mimeType: briefing.mime,
      sizeBytes: briefing.sizeBytes,
      sourceContent: null,
      analysisText: lastAnalysisExcerpt,
      analysisKind,
      analysisRichness: briefing.analysisRichness,
    });
    briefing = {
      ...refreshed,
      documentId: briefing.documentId,
      keyBlocks: enrichKeyBlocksFromAnalysis(
        briefing.keyBlocks || [],
        lastAnalysisExcerpt,
      ),
    };
  }

  if (!hasReusableDocumentBriefing(briefing)) return;

  sessionStore.set(String(sessionId), {
    activeDocument: {
      fileName: briefing.filename,
      mimeType: briefing.mime,
      wasAnalyzed: true,
      lastAnalysisKind: briefing.lastAnalysisKind,
      documentBriefing: briefing,
      followUpEligible: briefing.followUpEligible,
      updatedAt: Date.now(),
    },
  });
}

/** Tests uniquement — réinitialise le store en mémoire. */
export function resetDocumentTurnStateForTests() {
  sessionStore.clear();
}

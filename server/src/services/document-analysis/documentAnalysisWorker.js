/**
 * Worker Document Analysis — briefing ContextAgent + pipeline Forge.
 */
import contextAgent from "../../agent/utils/contextAgent.js";
import { documentAnalysis } from "../../../../citadelle-vault/Citadelle/01-Architecture/03-Forge/document-analysis.js";
import { buildAnalysisUserQuery } from "./documentAnalysisModes.js";
import {
  getDocumentForAnalysis,
  saveAnalysisArtifact,
  updateDocumentMeta,
} from "./documentStore.js";

export async function runDocumentAnalysisWorker({
  documentId,
  mode = "summary",
  query = "",
  traceId,
  sessionId,
  browserId,
  onStep,
  onContent,
}) {
  const doc = await getDocumentForAnalysis(documentId, { sessionId, browserId });
  if (!doc) {
    return {
      ok: false,
      error: "Document introuvable ou accès refusé.",
      code: "DOCUMENT_NOT_FOUND",
    };
  }

  const ingest = await contextAgent.ingest([doc.file]);
  if (!ingest?.briefing) {
    return {
      ok: false,
      error: "Impossible d'extraire le texte du document.",
      code: "DOCUMENT_EXTRACT_FAILED",
    };
  }

  const userQuery = buildAnalysisUserQuery(mode, query);
  const context = { documentBriefing: ingest.briefing };

  let streamed = "";
  const analysis = await documentAnalysis(userQuery, context, {
    hasAttachedDocument: true,
    fileName: doc.meta.originalName,
    onStep: (step) => onStep?.({ step, trace_id: traceId }),
    onContent: (chunk) => {
      streamed += chunk;
      onContent?.({ content: chunk, trace_id: traceId });
    },
  });

  const resultText = analysis?.result || streamed;
  if (!String(resultText || "").trim()) {
    return {
      ok: false,
      error: "Analyse vide après traitement.",
      code: "DOCUMENT_ANALYSIS_EMPTY",
    };
  }

  const artifact = {
    documentId,
    mode,
    query: String(query || "").trim() || null,
    result: resultText,
    metadata: {
      ...analysis.metadata,
      intent_contract_id: "DOCUMENT_ANALYSIS",
      response_mode: "DOCUMENT",
      originalName: doc.meta.originalName,
      trace_id: traceId,
      analyzedAt: new Date().toISOString(),
    },
  };

  await saveAnalysisArtifact(documentId, artifact);
  await updateDocumentMeta(documentId, {
    status: "analyzed",
    lastAnalysisAt: artifact.metadata.analyzedAt,
  });

  return { ok: true, artifact };
}

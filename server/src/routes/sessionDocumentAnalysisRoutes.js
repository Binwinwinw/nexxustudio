import express from "express";
import { getActiveDocumentContext, recordActiveDocumentAnalysis } from "../agent/micro/continuity/documentTurnState.js";
import agent from "../agent/agent.js";
import documentAnalysisJobManager from "../services/document-analysis/DocumentAnalysisJobManager.js";
import { DOCUMENT_ANALYSIS_MODES } from "../services/document-analysis/documentAnalysisModes.js";

const router = express.Router({ mergeParams: true });

// Endpoint pour récupérer l'état courant
router.get("/:id/document-analysis", (req, res) => {
  const { id: sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  const activeDocument = getActiveDocumentContext(sessionId);
  if (!activeDocument) {
    return res.json({ activeDocumentAnalysis: null });
  }

  // On renvoie un format stable pour le frontend
  res.json({
    activeDocumentAnalysis: {
      fileName: activeDocument.fileName || activeDocument.documentBriefing?.filename || "document",
      analyzedAt: activeDocument.analyzedAt || new Date().toISOString(),
      lastAnalysisExcerpt: activeDocument.lastAnalysisExcerpt || activeDocument.documentBriefing?.analysis_text || null,
      analysisKind: activeDocument.analysisKind || "document_analysis"
    }
  });
});

// Endpoint pour lancer une analyse standard (mock ou redirection vers job existant)
router.post("/:id/document-analysis", async (req, res) => {
  const { id: sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  const activeDocument = getActiveDocumentContext(sessionId);
  if (!activeDocument) {
    return res.status(409).json({ error: "Aucun document actif dans cette session pour lancer une analyse." });
  }

  try {
    // Si on a un job manager, on peut l'utiliser, sinon on déclenche un mock ou le pipeline.
    // Pour l'instant on met simplement à jour l'extrait d'analyse
    recordActiveDocumentAnalysis({
      sessionId,
      fileName: activeDocument.fileName || activeDocument.documentBriefing?.filename,
      mimeType: activeDocument.mimeType,
      sizeBytes: activeDocument.sizeBytes,
      sourceContent: activeDocument.sourceContent,
      lastAnalysisExcerpt: "Analyse documentaire déclenchée manuellement : le document semble conforme. (Mock P0)",
      analysisKind: "document_analysis"
    });

    const updatedDocument = getActiveDocumentContext(sessionId);

    res.json({
      activeDocumentAnalysis: {
        fileName: updatedDocument.fileName || updatedDocument.documentBriefing?.filename,
        analyzedAt: updatedDocument.analyzedAt || new Date().toISOString(),
        lastAnalysisExcerpt: updatedDocument.lastAnalysisExcerpt,
        analysisKind: updatedDocument.analysisKind
      }
    });
  } catch (error) {
    console.error("[DocumentAnalysis] Error analyzing document:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour la relance (follow-up)
router.post("/:id/document-analysis/followup", async (req, res) => {
  const { id: sessionId } = req.params;
  const { prompt } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Le prompt est requis et ne peut pas être vide." });
  }

  const activeDocument = getActiveDocumentContext(sessionId);
  if (!activeDocument) {
    return res.status(409).json({ error: "Aucun document actif dans cette session pour ce follow-up." });
  }

  try {
    // Raccordement avec le pipeline agent (en injectant le document contextuel)
    const reply = await agent.run(prompt, [], {
      sessionId,
      sessionContext: {
        activeDocumentAnalysis: activeDocument
      }
    });

    res.json({
      reply: reply || "Analyse terminée.",
      pipelinePath: "document_analysis_followup"
    });
  } catch (error) {
    console.error("[DocumentAnalysis] Error on followup:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

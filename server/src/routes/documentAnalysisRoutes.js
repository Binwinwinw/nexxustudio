/**
 * API Document Analysis — upload, analyse async, SSE, historique session.
 */
import express from "express";
import multer from "multer";
import {
  validateDoubleExtension,
  UPLOAD_REJECTION_CODES,
} from "../../../shared/uploadGuards.js";
import documentAnalysisJobManager from "../services/document-analysis/DocumentAnalysisJobManager.js";
import {
  saveDocumentUpload,
  readSessionIndex,
  getDocumentMeta,
  canAccessDocument,
  getLastAnalysis,
} from "../services/document-analysis/documentStore.js";
import { DOCUMENT_ANALYSIS_MODES } from "../services/document-analysis/documentAnalysisModes.js";
import { isArchiveFile } from "../services/document-analysis/archiveExtractor.js";

const router = express.Router();

const ALLOWED_TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "text/x-typescript",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/pdf",
]);

const TEXT_ATTACHMENT_EXT =
  /\.(txt|csv|json|md|html|htm|php|js|css|ts|jsx|tsx|xml|yml|yaml|py|sql|pdf)$/i;

const ARCHIVE_ATTACHMENT_EXT = /\.(zip|gz|tgz|tar\.gz)$/i;

function isAllowedDocumentUpload(file) {
  const mime = String(file?.mimetype || "");
  const name = String(file?.originalname || file?.name || "");
  if (mime.startsWith("image/")) return false;
  if (isArchiveFile(mime, name) || ARCHIVE_ATTACHMENT_EXT.test(name)) return true;
  if (ALLOWED_TEXT_MIMES.has(mime)) return true;
  if (mime.startsWith("text/")) return true;
  if (
    (mime === "application/octet-stream" || mime === "") &&
    TEXT_ATTACHMENT_EXT.test(name)
  ) {
    return true;
  }
  return TEXT_ATTACHMENT_EXT.test(name);
}

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = String(file?.originalname || file?.name || "");
    const doubleExt = validateDoubleExtension(name);
    if (doubleExt.rejected) {
      const err = new Error(doubleExt.message);
      err.code = doubleExt.code || UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION;
      return cb(err);
    }
    if (isAllowedDocumentUpload(file)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Format non autorisé. Documents texte, code, markdown, PDF ou archives ZIP/GZ/TAR.GZ uniquement.",
        ),
      );
    }
  },
});

function accessFromReq(req) {
  return { sessionId: req.sessionId, browserId: req.browserId };
}

router.get("/modes", (_req, res) => {
  res.json({
    modes: Object.values(DOCUMENT_ANALYSIS_MODES).map((m) => ({
      id: m.id,
      label: m.label,
    })),
  });
});

router.get("/", async (req, res) => {
  try {
    const index = await readSessionIndex(req.sessionId);
    const documents = await Promise.all(
      index.documents.map(async (doc) => {
        const lastAnalysis = await getLastAnalysis(doc.id);
        return {
          ...doc,
          hasAnalysis: Boolean(lastAnalysis?.result),
          lastAnalysisPreview: lastAnalysis?.result
            ? String(lastAnalysis.result).slice(0, 160)
            : null,
        };
      }),
    );
    res.json({ documents, trace_id: req.traceId || null });
  } catch (error) {
    res.status(500).json({ error: error.message, trace_id: req.traceId || null });
  }
});

router.post("/upload", (req, res, next) => {
  documentUpload.single("document")(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: "Fichier requis (champ document).",
        trace_id: req.traceId || null,
      });
    }

    const meta = await saveDocumentUpload({
      sessionId: req.sessionId,
      browserId: req.browserId,
      file,
      traceId: req.traceId,
    });

    res.json({
      success: true,
      document: meta,
      trace_id: req.traceId || null,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      trace_id: req.traceId || null,
    });
  }
});

router.post("/analyze", async (req, res) => {
  try {
    const { documentId, mode = "summary", query = "" } = req.body || {};
    if (!documentId) {
      return res.status(400).json({
        error: "documentId requis.",
        trace_id: req.traceId || null,
      });
    }

    const meta = await getDocumentMeta(documentId);
    if (!canAccessDocument(meta, accessFromReq(req))) {
      return res.status(404).json({
        error: "Document introuvable ou accès refusé.",
        trace_id: req.traceId || null,
      });
    }

    const { jobId, traceId } = documentAnalysisJobManager.startJob({
      documentId,
      mode,
      query,
      sessionId: req.sessionId,
      browserId: req.browserId,
      traceId: req.traceId,
    });

    res.json({
      success: true,
      jobId,
      trace_id: traceId,
      stream_url: `/api/documents/jobs/${jobId}/stream`,
      documentId,
      mode,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      trace_id: req.traceId || null,
    });
  }
});

router.get("/jobs/:jobId/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  documentAnalysisJobManager.subscribe(
    req.params.jobId,
    req.headers["last-event-id"] || req.query.lastIndex || "0",
    res,
    accessFromReq(req),
  );
});

router.get("/jobs/:jobId", (req, res) => {
  const job = documentAnalysisJobManager.getJob(req.params.jobId);
  if (!job || !documentAnalysisJobManager.canAccess(job, accessFromReq(req))) {
    return res.status(404).json({
      error: "Job introuvable ou accès refusé.",
      trace_id: req.traceId || null,
    });
  }

  const resultEvent = [...job.events].reverse().find((e) => e.result);
  res.json({
    jobId: job.id,
    status: job.status,
    trace_id: job.traceId,
    documentId: job.documentId,
    mode: job.mode,
    events_count: job.events.length,
    result: resultEvent?.result || null,
    metadata: resultEvent?.metadata || null,
    meta: { trace_id: req.traceId || job.traceId, api_version: "p0" },
  });
});

router.delete("/jobs/:jobId", (req, res) => {
  const job = documentAnalysisJobManager.getJob(req.params.jobId);
  if (!job || !documentAnalysisJobManager.canAccess(job, accessFromReq(req))) {
    return res.status(403).json({
      error: "Accès refusé.",
      trace_id: req.traceId || null,
    });
  }
  documentAnalysisJobManager.abortJob(req.params.jobId);
  res.json({ success: true, trace_id: req.traceId || null });
});

router.get("/:documentId", async (req, res) => {
  const meta = await getDocumentMeta(req.params.documentId);
  if (!canAccessDocument(meta, accessFromReq(req))) {
    return res.status(404).json({
      error: "Document introuvable ou accès refusé.",
      trace_id: req.traceId || null,
    });
  }

  const lastAnalysis = await getLastAnalysis(meta.id);
  res.json({
    document: meta,
    lastAnalysis,
    trace_id: req.traceId || null,
  });
});

export default router;

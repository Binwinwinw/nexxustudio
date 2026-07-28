/**
 * API Artefacts conversationnels — P0 download/preview + listing runs.
 */
import express from "express";
import {
  resolveArtifactForAccess,
  createArtifactDownloadStream,
  readArtifactPreview,
  listRunsForSession,
  loadRunManifest,
} from "../services/artifacts/artifactService.js";
import { PREVIEWABLE_MIMES } from "../services/artifacts/artifactConstants.js";

const router = express.Router();

function contentDispositionAttachment(fileName = "download") {
  const ascii = String(fileName).replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function createArtifactAccessMiddleware({ getBrowserId, sessionAccessService }) {
  return async function requireArtifactAccess(req, res, next) {
    try {
      const browserId = await getBrowserId(req, res);
      const resolved = await resolveArtifactForAccess(req.params.artifactId);
      if (!resolved.ok) {
        const status = resolved.code === "EXPIRED" ? 410 : 404;
        return res.status(status).json({
          error:
            resolved.code === "EXPIRED"
              ? "Artefact expiré."
              : "Artefact introuvable.",
        });
      }

      const hasAccess = await sessionAccessService.ensureAccess(
        resolved.record.sessionId,
        browserId,
      );

      if (!hasAccess) {
        return res.status(403).json({ error: "Accès refusé à cet artefact." });
      }

      req.artifactResolved = resolved;
      req.browserId = browserId;
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

export function createArtifactRouter(deps) {
  const r = express.Router();
  const requireArtifactAccess = createArtifactAccessMiddleware(deps);

  r.get("/:artifactId/download", requireArtifactAccess, (req, res) => {
    const { record, absolutePath, size } = req.artifactResolved;
    res.setHeader("Content-Type", record.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", contentDispositionAttachment(record.name));
    res.setHeader("Content-Length", String(size));
    res.setHeader("Cache-Control", "private, no-store");

    const stream = createArtifactDownloadStream(absolutePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({ error: "Erreur de lecture de l'artefact." });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  });

  r.get("/:artifactId/preview", requireArtifactAccess, async (req, res) => {
    const { record, absolutePath } = req.artifactResolved;
    if (!record.previewable || !PREVIEWABLE_MIMES.has(record.mime)) {
      return res.status(415).json({ error: "Aperçu non disponible pour ce type." });
    }

    try {
      const preview = await readArtifactPreview(absolutePath, record.mime);
      res.json({
        id: record.id,
        name: record.name,
        mime: preview.mime,
        size: preview.size,
        truncated: preview.truncated,
        content: preview.content,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return r;
}

export function createSessionRunsHandlers() {
  return {
    async listRuns(req, res) {
      try {
        const sessionId = req.params.id;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId requis." });
        }
        const runs = await listRunsForSession(sessionId);
        res.json({ sessionId, runs, trace_id: req.traceId || null });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getRun(req, res) {
      try {
        const sessionId = req.params.id;
        const { runId } = req.params;
        const manifest = await loadRunManifest(sessionId, runId);
        if (!manifest) {
          return res.status(404).json({ error: "Run introuvable ou expiré." });
        }
        res.json({ manifest, trace_id: req.traceId || null });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  };
}

export default router;

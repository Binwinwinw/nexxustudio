import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RUNS_ROOT = process.env.NEXXUS_ARTIFACT_RUNS_ROOT
  ? path.resolve(process.env.NEXXUS_ARTIFACT_RUNS_ROOT)
  : path.resolve(__dirname, "../../../data/runs");
export const REGISTRY_DIR = path.join(RUNS_ROOT, "_registry");

/** Durée de vie d'un run éphémère (jours). */
export const ARTIFACT_RUN_TTL_DAYS = 7;

/** Intervalle de purge périodique (ms). */
export const ARTIFACT_PURGE_INTERVAL_MS = 15 * 60 * 1000;

/** Taille max d'un fichier écrit (octets). */
export const MAX_ARTIFACT_FILE_BYTES = 5 * 1024 * 1024;

/** Taille max lue en preview (octets). */
export const MAX_ARTIFACT_PREVIEW_BYTES = 512 * 1024;

export const MIME_BY_EXT = {
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".html": "text/html",
  ".htm": "text/html",
  ".csv": "text/csv",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".xml": "application/xml",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".jsx": "text/javascript",
  ".tsx": "text/typescript",
  ".css": "text/css",
  ".py": "text/x-python",
  ".sql": "application/sql",
  ".zip": "application/zip",
};

export function isArtifactExpired(record) {
  if (!record?.expiresAt) return false;
  return Date.now() > new Date(record.expiresAt).getTime();
}

export const PREVIEWABLE_MIMES = new Set([
  "text/markdown",
  "text/plain",
  "application/json",
  "text/html",
  "text/csv",
  "text/yaml",
  "text/javascript",
  "text/typescript",
  "text/css",
  "application/xml",
]);

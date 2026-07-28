import path from "node:path";
import { MIME_BY_EXT } from "./artifactConstants.js";

const ALLOWED_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".html",
  ".htm",
  ".csv",
  ".yaml",
  ".yml",
  ".xml",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".css",
  ".py",
  ".sql",
  ".zip",
]);

/**
 * Valide un chemin relatif destiné à output/ (anti-traversal).
 * @returns {{ ok: true, normalized: string } | { ok: false, error: string }}
 */
export function validateArtifactRelativePath(relativePath = "") {
  const raw = String(relativePath).trim();
  if (!raw) {
    return { ok: false, error: "Chemin vide." };
  }
  if (raw.includes("\0")) {
    return { ok: false, error: "Chemin invalide." };
  }

  const normalized = path.posix.normalize(raw.replace(/\\/g, "/"));
  if (
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized)
  ) {
    return { ok: false, error: "Chemin hors sandbox (traversal)." };
  }

  const base = path.posix.basename(normalized);
  const ext = path.posix.extname(base).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Extension non autorisée : ${ext || "(aucune)"}` };
  }

  return { ok: true, normalized };
}

/**
 * Résout un chemin absolu sous outputDir avec vérification stricte.
 */
export function resolveArtifactOutputPath(outputDir, relativePath) {
  const validated = validateArtifactRelativePath(relativePath);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const base = path.resolve(outputDir);
  const resolved = path.resolve(base, validated.normalized);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error("Accès refusé (traversal).");
  }
  return { absolutePath: resolved, relativePath: validated.normalized };
}

export function inferMimeFromName(fileName = "") {
  const ext = path.posix.extname(String(fileName)).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

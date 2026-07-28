import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import {
  RUNS_ROOT,
  MAX_ARTIFACT_PREVIEW_BYTES,
  isArtifactExpired,
} from "./artifactConstants.js";
import { getArtifactRecord } from "./artifactRegistry.js";
import { resolveArtifactOutputPath } from "./artifactPathGuards.js";
import { purgeExpiredRuns } from "./artifactCleanup.js";

export { isArtifactExpired };

function runDir(sessionId, runId) {
  return path.join(RUNS_ROOT, sessionId, runId);
}

function outputDir(sessionId, runId) {
  return path.join(runDir(sessionId, runId), "output");
}

function manifestFilePath(sessionId, runId) {
  return path.join(runDir(sessionId, runId), "manifest.json");
}

export async function loadRunManifest(sessionId, runId) {
  try {
    const raw = await fsPromises.readFile(manifestFilePath(sessionId, runId), "utf8");
    const manifest = JSON.parse(raw);
    if (isArtifactExpired(manifest)) return null;
    return manifest;
  } catch {
    return null;
  }
}

export async function listRunsForSession(sessionId) {
  const sessionRoot = path.join(RUNS_ROOT, sessionId);
  let entries = [];
  try {
    entries = await fsPromises.readdir(sessionRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const manifest = await loadRunManifest(sessionId, entry.name);
    if (!manifest) continue;
    runs.push({
      runId: manifest.runId,
      createdAt: manifest.createdAt,
      expiresAt: manifest.expiresAt,
      artifactCount: manifest.artifacts?.length || 0,
      contractId: manifest.contractId,
      forgeJobId: manifest.forgeJobId,
    });
  }

  runs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return runs;
}

export async function resolveArtifactForAccess(artifactId) {
  const record = await getArtifactRecord(artifactId);
  if (!record) return { ok: false, code: "NOT_FOUND" };

  if (isArtifactExpired(record)) {
    purgeExpiredRuns({ opportunistic: true }).catch(() => {});
    return { ok: false, code: "EXPIRED" };
  }

  const outDir = outputDir(record.sessionId, record.runId);
  let absolutePath;
  try {
    ({ absolutePath } = resolveArtifactOutputPath(outDir, record.storagePath));
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }

  let stat;
  try {
    stat = await fsPromises.stat(absolutePath);
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (!stat.isFile()) {
    return { ok: false, code: "NOT_FOUND" };
  }

  return {
    ok: true,
    record,
    absolutePath,
    size: stat.size,
  };
}

export function canAccessArtifact(record, { sessionId, browserId }) {
  if (!record) return false;
  if (sessionId && record.sessionId === sessionId) return true;
  if (browserId && record.browserId && record.browserId === browserId) return true;
  return false;
}

/**
 * Stream binaire pour téléchargement (pas de lecture mémoire complète).
 */
export function createArtifactDownloadStream(absolutePath) {
  return createReadStream(absolutePath);
}

export async function readArtifactPreview(absolutePath, mime, maxBytes = MAX_ARTIFACT_PREVIEW_BYTES) {
  const stat = await fsPromises.stat(absolutePath);
  if (stat.size > maxBytes) {
    const fd = await fsPromises.open(absolutePath, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      await fd.read(buffer, 0, maxBytes, 0);
      return {
        content: buffer.toString("utf8"),
        truncated: true,
        size: stat.size,
        mime,
      };
    } finally {
      await fd.close();
    }
  }

  const content = await fsPromises.readFile(absolutePath, "utf8");
  return { content, truncated: false, size: stat.size, mime };
}

export { writeRunFromDraft } from "./artifactWriter.js";

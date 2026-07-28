import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  RUNS_ROOT,
  ARTIFACT_RUN_TTL_DAYS,
  MAX_ARTIFACT_FILE_BYTES,
  MIME_BY_EXT,
  PREVIEWABLE_MIMES,
} from "./artifactConstants.js";
import {
  resolveArtifactOutputPath,
  validateArtifactRelativePath,
  inferMimeFromName,
} from "./artifactPathGuards.js";
import { buildStoredZipArchive } from "./artifactZip.js";
import { registerArtifact } from "./artifactRegistry.js";

function runDir(sessionId, runId) {
  return path.join(RUNS_ROOT, sessionId, runId);
}

function outputDir(sessionId, runId) {
  return path.join(runDir(sessionId, runId), "output");
}

function manifestPath(sessionId, runId) {
  return path.join(runDir(sessionId, runId), "manifest.json");
}

function computeExpiresAt(fromDate = new Date()) {
  const expires = new Date(fromDate);
  expires.setDate(expires.getDate() + ARTIFACT_RUN_TTL_DAYS);
  return expires.toISOString();
}

function artifactKind(mime, fileName) {
  if (mime === "application/zip" || fileName.endsWith(".zip")) return "archive";
  return "text";
}

function toConversationArtifact(record) {
  return {
    id: record.id,
    name: record.name,
    mime: record.mime,
    size: record.size,
    runId: record.runId,
    kind: record.kind,
    previewable: record.previewable,
    downloadUrl: `/api/artifacts/${record.id}/download`,
    previewUrl: record.previewable ? `/api/artifacts/${record.id}/preview` : null,
  };
}

/**
 * @typedef {object} ForgeArtifactDraft
 * @property {string} [runId]
 * @property {string} sessionId
 * @property {Array<{ path: string, content: string, mime?: string }>} files
 * @property {'zip'|null} [bundle]
 * @property {string} [forgeJobId]
 * @property {string} [contractId]
 */

/**
 * Écrit un run complet depuis un draft structuré (seul point d'écriture disque).
 */
export async function writeRunFromDraft(draft, { browserId = null, traceId = null } = {}) {
  const sessionId = String(draft?.sessionId || "").trim();
  if (!sessionId) throw new Error("sessionId requis pour l'écriture d'artefacts.");

  const files = Array.isArray(draft?.files) ? draft.files : [];
  if (!files.length && draft?.bundle !== "zip") {
    throw new Error("ForgeArtifactDraft vide : aucun fichier à écrire.");
  }

  const runId =
    String(draft?.runId || "").trim() ||
    `run-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const createdAt = new Date().toISOString();
  const expiresAt = computeExpiresAt(new Date(createdAt));

  const outDir = outputDir(sessionId, runId);
  await fs.mkdir(outDir, { recursive: true });

  const writtenFiles = {};
  const artifactRecords = [];

  for (const file of files) {
    const validated = validateArtifactRelativePath(file?.path);
    if (!validated.ok) {
      throw new Error(`Chemin refusé (${file?.path}) : ${validated.error}`);
    }

    const content = String(file?.content ?? "");
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_ARTIFACT_FILE_BYTES) {
      throw new Error(`Fichier trop volumineux : ${validated.normalized}`);
    }

    const { absolutePath, relativePath } = resolveArtifactOutputPath(
      outDir,
      validated.normalized,
    );
    await fs.writeFile(absolutePath, content, "utf8");
    writtenFiles[relativePath] = content;

    const name = path.posix.basename(relativePath);
    const mime =
      file?.mime ||
      MIME_BY_EXT[path.posix.extname(name).toLowerCase()] ||
      inferMimeFromName(name);
    const artifactId = `art-${crypto.randomBytes(8).toString("hex")}`;
    const record = {
      id: artifactId,
      runId,
      sessionId,
      browserId,
      name,
      mime,
      kind: artifactKind(mime, name),
      size: bytes,
      storagePath: relativePath,
      previewable: PREVIEWABLE_MIMES.has(mime),
      createdAt,
      expiresAt,
      traceId,
    };
    await registerArtifact(record);
    artifactRecords.push(record);
  }

  if (draft?.bundle === "zip") {
    if (!Object.keys(writtenFiles).length) {
      throw new Error("bundle zip demandé sans fichiers sources.");
    }
    const zipBuffer = buildStoredZipArchive(writtenFiles);
    if (zipBuffer.length > MAX_ARTIFACT_FILE_BYTES) {
      throw new Error("Archive scaffold.zip trop volumineuse.");
    }
    const zipRelative = "scaffold.zip";
    const { absolutePath } = resolveArtifactOutputPath(outDir, zipRelative);
    await fs.writeFile(absolutePath, zipBuffer);

    const artifactId = `art-${crypto.randomBytes(8).toString("hex")}`;
    const record = {
      id: artifactId,
      runId,
      sessionId,
      browserId,
      name: "scaffold.zip",
      mime: "application/zip",
      kind: "archive",
      size: zipBuffer.length,
      storagePath: zipRelative,
      previewable: false,
      createdAt,
      expiresAt,
      traceId,
    };
    await registerArtifact(record);
    artifactRecords.push(record);
  }

  const manifest = {
    runId,
    sessionId,
    browserId,
    forgeJobId: draft?.forgeJobId || null,
    contractId: draft?.contractId || null,
    traceId,
    createdAt,
    expiresAt,
    artifacts: artifactRecords.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      mime: r.mime,
      size: r.size,
      storagePath: r.storagePath,
      previewable: r.previewable,
    })),
  };

  await fs.writeFile(manifestPath(sessionId, runId), JSON.stringify(manifest, null, 2), "utf8");

  return {
    runId,
    sessionId,
    manifest,
    artifacts: artifactRecords.map(toConversationArtifact),
  };
}

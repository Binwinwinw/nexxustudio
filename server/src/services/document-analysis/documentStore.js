/**
 * Stockage local des documents importés (session-scoped).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.resolve(__dirname, "../../../data/document-analysis");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function sessionIndexPath(sessionId) {
  return path.join(STORE_ROOT, "sessions", sessionId, "index.json");
}

function documentDir(documentId) {
  return path.join(STORE_ROOT, "documents", documentId);
}

export async function saveDocumentUpload({
  sessionId,
  browserId,
  file,
  traceId = null,
}) {
  if (!sessionId || !file?.buffer) {
    throw new Error("DOCUMENT_UPLOAD_INVALID");
  }

  const documentId = `doc-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const dir = documentDir(documentId);
  await ensureDir(dir);

  const originalName = String(file.originalname || file.name || "document.txt");
  const safeName = originalName.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const storagePath = path.join(dir, safeName);

  await fs.writeFile(storagePath, file.buffer);

  const meta = {
    id: documentId,
    sessionId,
    browserId,
    originalName,
    storagePath,
    mimetype: file.mimetype || "application/octet-stream",
    size: file.size || file.buffer.length,
    status: "imported",
    createdAt: new Date().toISOString(),
    traceId,
    lastAnalysisJobId: null,
    lastAnalysisAt: null,
  };

  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  const index = await readSessionIndex(sessionId);
  index.documents = [meta, ...index.documents.filter((d) => d.id !== documentId)].slice(0, 50);
  await writeSessionIndex(sessionId, index);

  return meta;
}

export async function readSessionIndex(sessionId) {
  const filePath = sessionIndexPath(sessionId);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return { documents: Array.isArray(parsed.documents) ? parsed.documents : [] };
  } catch {
    return { documents: [] };
  }
}

async function writeSessionIndex(sessionId, index) {
  const dir = path.dirname(sessionIndexPath(sessionId));
  await ensureDir(dir);
  await fs.writeFile(sessionIndexPath(sessionId), JSON.stringify(index, null, 2), "utf8");
}

export async function getDocumentMeta(documentId) {
  try {
    const raw = await fs.readFile(path.join(documentDir(documentId), "meta.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function canAccessDocument(meta, { sessionId, browserId }) {
  if (!meta) return false;
  if (sessionId && meta.sessionId === sessionId) return true;
  if (browserId && meta.browserId === browserId) return true;
  return false;
}

export async function getDocumentForAnalysis(documentId, access) {
  const meta = await getDocumentMeta(documentId);
  if (!canAccessDocument(meta, access)) return null;

  const buffer = await fs.readFile(meta.storagePath);
  return {
    meta,
    file: {
      buffer,
      mimetype: meta.mimetype,
      originalname: meta.originalName,
      size: meta.size,
    },
  };
}

export async function updateDocumentMeta(documentId, patch = {}) {
  const meta = await getDocumentMeta(documentId);
  if (!meta) return null;
  const next = { ...meta, ...patch };
  await fs.writeFile(
    path.join(documentDir(documentId), "meta.json"),
    JSON.stringify(next, null, 2),
    "utf8",
  );
  const index = await readSessionIndex(next.sessionId);
  index.documents = index.documents.map((d) => (d.id === documentId ? next : d));
  await writeSessionIndex(next.sessionId, index);
  return next;
}

export async function saveAnalysisArtifact(documentId, payload) {
  const dir = documentDir(documentId);
  const artifactPath = path.join(dir, "last-analysis.json");
  await fs.writeFile(artifactPath, JSON.stringify(payload, null, 2), "utf8");
  return artifactPath;
}

export async function getLastAnalysis(documentId) {
  try {
    const raw = await fs.readFile(
      path.join(documentDir(documentId), "last-analysis.json"),
      "utf8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

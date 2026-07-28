/**
 * Extraction texte minimale depuis .docx (ZIP + word/document.xml).
 * Pas de dépendance mammoth — fail explicite si conteneur invalide.
 */
import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIR_HEADER = 0x02014b50;
const END_CENTRAL_DIR = 0x06054b50;
const MAX_DOCX_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;

/**
 * @param {string} mimetype
 * @param {string} originalName
 */
export function isDocxFile(mimetype = "", originalName = "") {
  const name = String(originalName || "").toLowerCase();
  const mime = String(mimetype || "").toLowerCase();
  if (name.endsWith(".docx")) return true;
  return (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-word.document.macroenabled.12"
  );
}

/**
 * @param {string} mimetype
 * @param {string} originalName
 */
export function isLegacyDocFile(mimetype = "", originalName = "") {
  const name = String(originalName || "").toLowerCase();
  const mime = String(mimetype || "").toLowerCase();
  if (name.endsWith(".doc") && !name.endsWith(".docx")) return true;
  return mime === "application/msword";
}

function findEndCentralDirectory(buffer) {
  const view = buffer;
  for (let i = view.length - 22; i >= 0; i -= 1) {
    if (view.readUInt32LE(i) === END_CENTRAL_DIR) {
      return i;
    }
  }
  return -1;
}

function readCentralEntries(buffer) {
  const eocd = findEndCentralDirectory(buffer);
  if (eocd < 0) throw new Error("ZIP EOCD introuvable");
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];

  for (let n = 0; n < totalEntries; n += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIR_HEADER) break;
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLen)
      .toString("utf8")
      .replace(/\\/g, "/");
    entries.push({
      name,
      compression,
      compressedSize,
      localHeaderOffset,
    });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readLocalPayload(buffer, entry) {
  const off = entry.localHeaderOffset;
  if (buffer.readUInt32LE(off) !== LOCAL_FILE_HEADER) {
    throw new Error(`Local header invalide pour ${entry.name}`);
  }
  const nameLen = buffer.readUInt16LE(off + 26);
  const extraLen = buffer.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const compressed = buffer.subarray(
    dataStart,
    dataStart + entry.compressedSize,
  );
  if (entry.compression === 0) return Buffer.from(compressed);
  if (entry.compression === 8) {
    return inflateRawSync(compressed, { maxOutputLength: MAX_DOCX_BYTES });
  }
  throw new Error(`Compression ZIP non supportée (${entry.compression})`);
}

function xmlToPlainText(xml = "") {
  return String(xml || "")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<w:tab\b[^/]*\/>/gi, "\t")
    .replace(/<w:br\b[^/]*\/>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {Buffer} buffer
 * @param {string} [originalName]
 * @returns {{ ok: boolean, text?: string, message?: string, extractor?: string }}
 */
export function extractDocxToText(buffer, originalName = "document.docx") {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      ok: false,
      message: `Word (.docx) — buffer vide pour ${originalName}`,
    };
  }
  if (buffer.length > MAX_DOCX_BYTES) {
    return {
      ok: false,
      message: `Word (.docx) — fichier trop volumineux (>${MAX_DOCX_BYTES} octets)`,
    };
  }

  try {
    const entries = readCentralEntries(buffer);
    const docEntry = entries.find(
      (e) => e.name.toLowerCase() === "word/document.xml",
    );
    if (!docEntry) {
      return {
        ok: false,
        message: "Word (.docx) — word/document.xml introuvable dans l'archive",
      };
    }
    const xmlBuf = readLocalPayload(buffer, docEntry);
    const text = xmlToPlainText(xmlBuf.toString("utf8")).slice(0, MAX_TEXT_CHARS);
    if (!text.trim()) {
      return {
        ok: false,
        message: "Word (.docx) — aucun texte extractible dans document.xml",
      };
    }
    return {
      ok: true,
      text,
      extractor: "docx_zip_xml_v1",
    };
  } catch (error) {
    return {
      ok: false,
      message: `Word (.docx) — extraction impossible: ${error.message}`,
    };
  }
}

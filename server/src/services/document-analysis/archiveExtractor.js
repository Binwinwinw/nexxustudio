/**
 * Extraction sécurisée d'archives pour Document Analysis.
 *
 * - .gz : décompression gzip native (zlib) pour un fichier unique.
 * - .tar.gz / .tgz : gunzip (zlib) + parseur TAR maison ; symlinks/hardlinks rejetés.
 * - .zip : parseur conteneur PKZIP maison (central directory + local headers) ;
 *   seuls les payloads Deflate (8) ou stockés (0) passent ensuite à zlib.inflateRaw.
 *
 * zlib ne suffit pas à ouvrir un .zip : la couche conteneur est implémentée ici.
 */
import { gunzipSync, inflateRawSync } from "node:zlib";
import path from "node:path";

export const MAX_ARCHIVE_FILES = 80;
export const MAX_ARCHIVE_SINGLE_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ARCHIVE_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_ARCHIVE_TEXT_CHARS = 100_000;
export const MAX_TAR_PAYLOAD_BYTES = MAX_ARCHIVE_TOTAL_BYTES;

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIR_HEADER = 0x02014b50;
const END_CENTRAL_DIR = 0x06054b50;

const ARCHIVE_NAME_RE = /\.(zip|tgz|tar\.gz)$/i;
const GZIP_ONLY_RE = /\.gz$/i;

const INNER_TEXT_EXT =
  /\.(txt|csv|json|md|markdown|html|htm|css|js|ts|jsx|tsx|xml|yml|yaml|py|sql|pdf)$/i;

const BLOCKED_INNER_EXT =
  /\.(exe|dll|bat|cmd|com|scr|msi|sh|bash|ps1|vbs|jar|war|dmg|app|deb|rpm|so|dylib|bin)$/i;

const SKIP_PATH_PREFIXES = ["__macosx/", ".git/", "node_modules/", ".svn/"];

/** Entrées TAR non-fichiers : rejet explicite (symlink, hardlink, répertoire…). */
const TAR_REJECTED_TYPEFLAGS = new Set([
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "g",
  "x",
  "L",
  "K",
  "l",
  "D",
]);

const TAR_REJECTED_LABELS = {
  "1": "hardlink",
  "2": "symlink",
  "3": "device",
  "4": "device",
  "5": "directory",
  "6": "fifo",
  g: "pax-global",
  x: "pax-extended",
  L: "gnu-longname",
  K: "gnu-longlink",
};

export function isArchiveFile(mimetype = "", originalName = "") {
  const name = String(originalName || "").toLowerCase();
  const mime = String(mimetype || "").toLowerCase();

  if (ARCHIVE_NAME_RE.test(name)) return true;
  if (GZIP_ONLY_RE.test(name) && !name.endsWith(".tar.gz")) return true;

  if (
    mime === "application/zip" ||
    mime === "application/x-zip-compressed" ||
    mime === "application/gzip" ||
    mime === "application/x-gzip" ||
    mime === "application/x-tar" ||
    mime === "application/x-compressed" ||
    mime === "application/x-compress"
  ) {
    return true;
  }

  return false;
}

function normalizeEntryName(entryName = "") {
  return String(entryName)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function isSafeEntryPath(entryName) {
  const normalized = normalizeEntryName(entryName);
  if (!normalized || normalized.includes("..")) return false;
  const lower = normalized.toLowerCase();
  if (SKIP_PATH_PREFIXES.some((p) => lower.startsWith(p))) return false;
  if (lower.split("/").some((part) => part.startsWith(".") && part !== ".")) {
    if (lower.includes("/.")) return false;
  }
  return true;
}

function isAllowedInnerFile(entryName) {
  const base = path.posix.basename(normalizeEntryName(entryName));
  if (!base || base.startsWith(".")) return false;
  if (BLOCKED_INNER_EXT.test(base)) return false;
  return INNER_TEXT_EXT.test(base);
}

function gunzipWithLimit(buffer, label = "archive") {
  try {
    return gunzipSync(buffer, { maxOutputLength: MAX_TAR_PAYLOAD_BYTES });
  } catch (error) {
    if (String(error?.code) === "ERR_BUFFER_TOO_LARGE") {
      throw new Error(`${label} : taille décompressée au-delà de la limite autorisée.`);
    }
    throw new Error(`${label} invalide : ${error.message}`);
  }
}

function decodeEntryText(data, entryName) {
  if (/\.pdf$/i.test(entryName)) return null;
  try {
    return Buffer.from(data).toString("utf8");
  } catch {
    return null;
  }
}

function ingestRegularEntry(state, entry, warnings) {
  const { name, data } = entry;
  if (!isSafeEntryPath(name)) {
    warnings.push(`Chemin ignoré (sécurité) : ${name}`);
    return;
  }
  if (!isAllowedInnerFile(name)) return;

  const size = data?.length || 0;
  if (size > MAX_ARCHIVE_SINGLE_FILE_BYTES) {
    warnings.push(`Fichier trop volumineux ignoré : ${name}`);
    return;
  }
  if (state.totalBytes + size > MAX_ARCHIVE_TOTAL_BYTES) {
    warnings.push("Limite d'extraction atteinte — fichiers restants ignorés.");
    state.limitReached = true;
    return;
  }
  if (state.fileCount >= MAX_ARCHIVE_FILES) {
    warnings.push("Nombre maximal de fichiers atteint — reste ignoré.");
    state.limitReached = true;
    return;
  }

  const text = decodeEntryText(data, name);
  if (!text?.trim()) {
    if (/\.pdf$/i.test(name)) {
      warnings.push(`PDF dans archive non extrait ici : ${name} (importez-le seul).`);
    }
    return;
  }

  const slice = text.slice(0, MAX_ARCHIVE_TEXT_CHARS - state.textChars);
  if (!slice.trim()) {
    state.limitReached = true;
    warnings.push("Limite de texte analysable atteinte — reste ignoré.");
    return;
  }

  state.fileCount += 1;
  state.totalBytes += size;
  state.textChars += slice.length;
  state.parts.push({ name, text: slice });

  if (state.textChars >= MAX_ARCHIVE_TEXT_CHARS) {
    state.limitReached = true;
    warnings.push("Limite de texte analysable atteinte — reste ignoré.");
  }
}

function parseTarEntries(buffer, warnings, state) {
  let offset = 0;
  let parsedPayloadBytes = 0;

  while (offset + 512 <= buffer.length && !state.limitReached) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "").trim();
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "").trim();
    const name = prefix ? `${prefix}/${rawName}` : rawName;
    const sizeOctal = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeOctal, 8) || 0;
    const typeflag = String.fromCharCode(header[156] || 0);

    offset += 512;

    if (TAR_REJECTED_TYPEFLAGS.has(typeflag)) {
      const label = TAR_REJECTED_LABELS[typeflag] || `type-${typeflag}`;
      warnings.push(`Entrée TAR ignorée (${label}) : ${name || "(sans nom)"}`);
      offset += Math.ceil(size / 512) * 512;
      continue;
    }

    const isRegular =
      typeflag === "\0" || typeflag === "0" || typeflag === "" || header[156] === 0;
    if (!isRegular || size <= 0 || !name) {
      offset += Math.ceil(size / 512) * 512;
      continue;
    }

    if (size > MAX_ARCHIVE_SINGLE_FILE_BYTES) {
      warnings.push(`Entrée TAR trop volumineuse ignorée : ${name}`);
      offset += Math.ceil(size / 512) * 512;
      continue;
    }

    parsedPayloadBytes += size;
    if (parsedPayloadBytes > MAX_TAR_PAYLOAD_BYTES) {
      warnings.push("Limite TAR dépassée — entrées restantes ignorées.");
      state.limitReached = true;
      break;
    }

    ingestRegularEntry(
      state,
      { name: normalizeEntryName(name), data: buffer.subarray(offset, offset + size) },
      warnings,
    );

    offset += Math.ceil(size / 512) * 512;
  }
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === END_CENTRAL_DIR) return i;
  }
  return -1;
}

function decompressZipPayload(compression, compressed, uncompSize, name) {
  if (uncompSize > MAX_ARCHIVE_SINGLE_FILE_BYTES) {
    throw new Error(`Entrée ZIP trop volumineuse : ${name}`);
  }

  let data;
  if (compression === 0) {
    data = compressed;
  } else if (compression === 8) {
    data = inflateRawSync(compressed, { maxOutputLength: MAX_ARCHIVE_SINGLE_FILE_BYTES });
  } else {
    throw new Error(`Méthode ZIP non supportée (${compression}) pour ${name}`);
  }

  if (uncompSize > 0 && data.length > uncompSize) {
    data = data.subarray(0, uncompSize);
  }
  return data;
}

function processZipEntry(state, entry, warnings) {
  if (state.limitReached) return;

  const { name, compression, compressed, uncompSize } = entry;
  if (!name || name.endsWith("/")) return;

  const normalized = normalizeEntryName(name);
  if (!isSafeEntryPath(normalized) || !isAllowedInnerFile(normalized)) return;
  if (uncompSize > MAX_ARCHIVE_SINGLE_FILE_BYTES) {
    warnings.push(`Entrée ZIP trop volumineuse ignorée : ${normalized}`);
    return;
  }
  if (state.totalBytes + uncompSize > MAX_ARCHIVE_TOTAL_BYTES) {
    warnings.push("Limite d'extraction atteinte — entrées ZIP restantes ignorées.");
    state.limitReached = true;
    return;
  }
  if (state.fileCount >= MAX_ARCHIVE_FILES) {
    warnings.push("Nombre maximal de fichiers atteint — reste ignoré.");
    state.limitReached = true;
    return;
  }

  try {
    const data = decompressZipPayload(compression, compressed, uncompSize, normalized);
    ingestRegularEntry(state, { name: normalized, data }, warnings);
  } catch (error) {
    warnings.push(`Entrée ZIP ignorée (${normalized}) : ${error.message}`);
  }
}

function iterateZipFromCentralDirectory(buffer, state, warnings) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return false;

  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirOffset;

  while (offset + 46 <= buffer.length && !state.limitReached) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== CENTRAL_DIR_HEADER) break;

    const compression = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const uncompSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLen)
      .toString("utf8");

    const localOffset = localHeaderOffset;
    if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
      offset += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compSize);

    processZipEntry(
      state,
      { name, compression, compressed, uncompSize },
      warnings,
    );

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return state.parts.length > 0;
}

function iterateZipSequential(buffer, state, warnings) {
  let offset = 0;

  while (offset + 30 <= buffer.length && !state.limitReached) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== LOCAL_FILE_HEADER) break;

    const compression = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const uncompSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer
      .subarray(offset + 30, offset + 30 + nameLen)
      .toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compSize);

    processZipEntry(
      state,
      { name, compression, compressed, uncompSize },
      warnings,
    );

    offset = dataStart + compSize;
  }

  return state.parts.length > 0;
}

function extractZipArchive(buffer, warnings) {
  const state = createCollectState();
  const fromCentral = iterateZipFromCentralDirectory(buffer, state, warnings);
  if (!fromCentral) {
    iterateZipSequential(buffer, state, warnings);
  }
  if (!state.parts.length) {
    throw new Error("Archive ZIP vide ou structure non reconnue.");
  }
  return state;
}

function createCollectState() {
  return {
    parts: [],
    fileCount: 0,
    totalBytes: 0,
    textChars: 0,
    limitReached: false,
  };
}

function extractGzipArchive(buffer, originalName, warnings) {
  const lowerName = String(originalName || "").toLowerCase();

  if (lowerName.endsWith(".tar.gz") || lowerName.endsWith(".tgz")) {
    const decompressed = gunzipWithLimit(buffer, "TAR.GZ");
    const state = createCollectState();
    parseTarEntries(decompressed, warnings, state);
    return state;
  }

  const fallbackName = lowerName.replace(/\.gz$/i, "") || "document.txt";
  if (!isAllowedInnerFile(fallbackName)) {
    throw new Error("Le fichier GZ décompressé n'est pas un format texte autorisé.");
  }

  const decompressed = gunzipWithLimit(buffer, "GZ");
  if (decompressed.length > MAX_ARCHIVE_SINGLE_FILE_BYTES) {
    throw new Error("Fichier GZ décompressé trop volumineux.");
  }

  const state = createCollectState();
  ingestRegularEntry(
    state,
    {
      name: fallbackName,
      data: decompressed,
    },
    warnings,
  );
  return state;
}

/**
 * @returns {{ text: string, fileCount: number, warnings: string[] }}
 */
export function extractArchiveToText(buffer, originalName = "archive.zip") {
  const warnings = [];
  const lowerName = String(originalName || "").toLowerCase();

  let collected;
  if (lowerName.endsWith(".zip")) {
    collected = extractZipArchive(buffer, warnings);
  } else if (
    lowerName.endsWith(".tar.gz") ||
    lowerName.endsWith(".tgz") ||
    (lowerName.endsWith(".gz") && !lowerName.endsWith(".tar.gz"))
  ) {
    collected = extractGzipArchive(buffer, originalName, warnings);
  } else {
    throw new Error("Format d'archive non pris en charge.");
  }

  if (!collected.parts.length) {
    throw new Error(
      "Aucun fichier texte exploitable dans l'archive (txt, md, json, code, html, csv, yaml…).",
    );
  }

  const header = `[ARCHIVE — ${originalName} — ${collected.parts.length} fichier(s) texte extrait(s)]\n`;
  const body = collected.parts
    .map(
      (part, index) =>
        `\n[FICHIER ARCHIVE #${index + 1}: ${part.name}]\n${part.text}\n`,
    )
    .join("");

  let text = header + body;
  if (warnings.length) {
    text += `\n[AVERTISSEMENTS ARCHIVE]\n${warnings.map((w) => `- ${w}`).join("\n")}\n`;
  }

  if (text.length > MAX_ARCHIVE_TEXT_CHARS) {
    text = `${text.slice(0, MAX_ARCHIVE_TEXT_CHARS)}\n[… contenu tronqué …]`;
    warnings.push("Texte agrégé tronqué pour respecter la limite d'analyse.");
  }

  return {
    text,
    fileCount: collected.parts.length,
    warnings,
  };
}

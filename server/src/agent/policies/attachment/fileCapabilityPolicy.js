/**
 * FILE_CAPABILITY_V1 — politique interne types / scénarios.
 * Canon : docs/governance/file-capability-policy.md
 *
 * Allowlist métier d'abord. Denylist complémentaire.
 * Content-Type et nom : non fiables. execute toujours false.
 */
import {
  detectDoubleExtension,
  validateDoubleExtension,
  formatDoubleExtensionRejection,
  formatUploadRejectionMessage,
  UPLOAD_REJECTION_CODES,
} from "../../../../../shared/uploadGuards.js";

export const FILE_CAPABILITY_POLICY_ID = "FILE_CAPABILITY_V1";

export const FILE_CAPABILITY_CLASSES = Object.freeze({
  ALLOWED_ANALYZABLE: "allowed_analyzable",
  ALLOWED_REINFORCED: "allowed_reinforced",
  REFUSED: "refused",
  CONTAINER: "container",
  UNKNOWN: "unknown",
});

export const FILE_CAPABILITY_STATUSES = Object.freeze({
  ACCEPT: "accept",
  QUARANTINE: "quarantine",
  REJECT: "reject",
  MANUAL_REVIEW: "manual_review",
});

export const FILE_CAPABILITY_PIPELINES = Object.freeze({
  FILE_ANALYSIS: "FILE_ANALYSIS",
  DOCUMENT_EXTRACT: "DOCUMENT_EXTRACT",
  VISION: "VISION",
  ARCHIVE_EXTRACT: "ARCHIVE_EXTRACT",
  NONE: "NONE",
});

export const FILE_CAPABILITY_CODES = Object.freeze({
  DOUBLE_EXTENSION: "FILE_CAP_DOUBLE_EXTENSION",
  DENYLIST: "FILE_CAP_DENYLIST",
  UNKNOWN: "FILE_CAP_UNKNOWN",
  MIME_MISMATCH: "FILE_CAP_MIME_MISMATCH",
  SIGNATURE_MISMATCH: "FILE_CAP_SIGNATURE_MISMATCH",
  SUSPECT_PATH: "FILE_CAP_SUSPECT_PATH",
  ACTIVE_FORMAT: "FILE_CAP_ACTIVE_FORMAT",
  EXECUTABLE: "FILE_CAP_EXECUTABLE",
  NESTED_ARCHIVE: "FILE_CAP_NESTED_ARCHIVE",
  ZIP_BOMB: "FILE_CAP_ZIP_BOMB",
  SIZE: "FILE_CAP_SIZE",
  EMPTY: "FILE_CAP_EMPTY",
  CHANNEL: "FILE_CAP_CHANNEL",
  CONTAINER_CHAT: "FILE_CAP_CONTAINER_CHAT",
});

export const FILE_CAPABILITY_MAX_BYTES = Object.freeze({
  default: 10 * 1024 * 1024,
  chat: 10 * 1024 * 1024,
  document: 10 * 1024 * 1024,
  archive: 10 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  reinforced: 10 * 1024 * 1024,
});

export const ARCHIVE_BOMB_RATIO = 100;
export const ARCHIVE_BOMB_MIN_UNCOMPRESSED = 1024 * 1024;
export const MAX_ARCHIVE_NESTED_DEPTH = 0;
export const MAX_ARCHIVE_ENTRY_COUNT = 80;

/** Allowlist métier — source de vérité des types admis. */
export const FILE_CAPABILITY_MATRIX = Object.freeze({
  allowed_analyzable: Object.freeze({
    extensions: Object.freeze([
      "txt",
      "md",
      "csv",
      "json",
      "yml",
      "yaml",
      "xml",
      "css",
      "sql",
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
    ]),
    mimes: Object.freeze([
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/css",
      "text/xml",
      "application/json",
      "application/xml",
      "application/x-yaml",
      "application/yaml",
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]),
    signatures: Object.freeze(["text", "pdf", "jpeg", "png", "webp", "gif"]),
    maxBytes: FILE_CAPABILITY_MAX_BYTES.default,
    special: "lecture / extraction / vision — jamais d'exécution",
  }),
  allowed_reinforced: Object.freeze({
    extensions: Object.freeze([
      "js",
      "mjs",
      "cjs",
      "ts",
      "tsx",
      "jsx",
      "php",
      "py",
      "html",
      "htm",
    ]),
    mimes: Object.freeze([
      "text/javascript",
      "application/javascript",
      "text/x-typescript",
      "text/html",
      "text/x-python",
      "application/x-httpd-php",
      "text/plain",
    ]),
    signatures: Object.freeze(["text", "html"]),
    maxBytes: FILE_CAPABILITY_MAX_BYTES.reinforced,
    special: "analyse source / HTML documentaire — pas de rendu actif, pas d'exécution",
  }),
  container: Object.freeze({
    extensions: Object.freeze(["zip", "gz", "tgz", "tar.gz"]),
    mimes: Object.freeze([
      "application/zip",
      "application/x-zip-compressed",
      "application/gzip",
      "application/x-gzip",
      "application/x-tar",
      "application/x-compressed",
    ]),
    signatures: Object.freeze(["zip", "gzip"]),
    maxBytes: FILE_CAPABILITY_MAX_BYTES.archive,
    special: "canal document seulement ; extraction bornée ; pas d'imbrication",
  }),
  refused: Object.freeze({
    extensions: Object.freeze([
      "exe",
      "dll",
      "so",
      "dylib",
      "bin",
      "com",
      "scr",
      "msi",
      "bat",
      "cmd",
      "ps1",
      "vbs",
      "vbe",
      "sh",
      "bash",
      "jar",
      "war",
      "apk",
      "dmg",
      "app",
      "deb",
      "rpm",
      "svg",
      "docm",
      "xlsm",
      "pptm",
      "doc",
      "xls",
      "ppt",
      "rtf",
      "hta",
      "lnk",
      "iso",
      "img",
      "wasm",
    ]),
    mimes: Object.freeze([
      "image/svg+xml",
      "application/x-msdownload",
      "application/x-msdos-program",
      "application/x-executable",
      "application/x-dosexec",
      "application/x-sh",
      "application/x-bat",
      "application/java-archive",
    ]),
    signatures: Object.freeze(["exe", "elf", "ole", "svg"]),
    maxBytes: 0,
    special: "refus — format actif / exécutable / macros / XSS",
  }),
});

const EXT_CLASS = new Map();
for (const ext of FILE_CAPABILITY_MATRIX.allowed_analyzable.extensions) {
  EXT_CLASS.set(ext, FILE_CAPABILITY_CLASSES.ALLOWED_ANALYZABLE);
}
for (const ext of FILE_CAPABILITY_MATRIX.allowed_reinforced.extensions) {
  EXT_CLASS.set(ext, FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED);
}
for (const ext of FILE_CAPABILITY_MATRIX.container.extensions) {
  EXT_CLASS.set(ext, FILE_CAPABILITY_CLASSES.CONTAINER);
}
for (const ext of FILE_CAPABILITY_MATRIX.refused.extensions) {
  EXT_CLASS.set(ext, FILE_CAPABILITY_CLASSES.REFUSED);
}

const DENY_MIME = new Set(FILE_CAPABILITY_MATRIX.refused.mimes);

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const PDF_EXTS = new Set(["pdf"]);
const SOURCE_EXTS = new Set([
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "php",
  "py",
  "sql",
  "json",
  "md",
  "css",
  "yml",
  "yaml",
]);
const HTML_EXTS = new Set(["html", "htm"]);

const EXPECTED_SNIFF = Object.freeze({
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
  pdf: "pdf",
  zip: "zip",
  gz: "gzip",
  tgz: "gzip",
  "tar.gz": "gzip",
  html: "html",
  htm: "html",
});

const TEXT_OK_EXTS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "yml",
  "yaml",
  "xml",
  "css",
  "sql",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "php",
  "py",
  "html",
  "htm",
]);

export function resolveFileExtension(filename = "") {
  const base = String(filename).split(/[/\\]/).pop() || "";
  const lower = base.toLowerCase();
  if (lower.endsWith(".tar.gz")) return "tar.gz";
  const dot = lower.lastIndexOf(".");
  if (dot < 0 || dot === lower.length - 1) return "";
  return lower.slice(dot + 1);
}

export function isNestedArchiveEntry(entryName = "") {
  const base = String(entryName).split(/[/\\]/).pop() || "";
  return /\.(zip|tgz|tar\.gz|gz)$/i.test(base);
}

export function hasSuspectFilePath(filename = "") {
  const raw = String(filename || "");
  if (!raw) return true;
  if (raw.includes("\0") || raw.includes("%00")) return true;
  if (/[<>:"|?*]/.test(raw.replace(/^[a-zA-Z]:/, ""))) return true;
  if (raw.includes("..")) return true;
  if (/[/\\]/.test(raw)) return true;
  if (/^\.+$/.test(raw)) return true;
  if (/<\?php|<\s*script/i.test(raw)) return true;
  return false;
}

/**
 * Signature réelle (magic bytes) — pas le Content-Type client.
 * @param {Buffer|Uint8Array|null} buffer
 */
export function sniffFileSignature(buffer) {
  if (!buffer || buffer.length === 0) {
    return { kind: "empty", confidence: "high" };
  }
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { kind: "pdf", confidence: "high" };
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return { kind: "png", confidence: "high" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { kind: "jpeg", confidence: "high" };
  }
  if (b.length >= 6) {
    const gif = b.subarray(0, 6).toString("ascii");
    if (gif === "GIF87a" || gif === "GIF89a") {
      return { kind: "gif", confidence: "high" };
    }
  }
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { kind: "webp", confidence: "high" };
  }
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) {
    return { kind: "zip", confidence: "high" };
  }
  if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) {
    return { kind: "gzip", confidence: "high" };
  }
  if (b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a) {
    return { kind: "exe", confidence: "high" };
  }
  if (
    b.length >= 4 &&
    b[0] === 0x7f &&
    b[1] === 0x45 &&
    b[2] === 0x4c &&
    b[3] === 0x46
  ) {
    return { kind: "elf", confidence: "high" };
  }
  if (
    b.length >= 8 &&
    b[0] === 0xd0 &&
    b[1] === 0xcf &&
    b[2] === 0x11 &&
    b[3] === 0xe0
  ) {
    return { kind: "ole", confidence: "high" };
  }
  if (b.length >= 12 && b.subarray(4, 8).toString("ascii") === "ftyp") {
    return { kind: "mp4", confidence: "high" };
  }

  const head = stripBom(b.subarray(0, 512).toString("utf8")).trimStart();
  if (/^<svg[\s>/]/i.test(head) || /^<\?xml[\s\S]{0,200}<svg[\s>/]/i.test(head)) {
    return { kind: "svg", confidence: "high" };
  }
  if (/^<!DOCTYPE\s+html\b|^<html[\s>]/i.test(head)) {
    return { kind: "html", confidence: "high" };
  }

  const sample = b.subarray(0, Math.min(800, b.length));
  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const c = sample[i];
    if (c === 0) {
      suspicious += 3;
      continue;
    }
    if (c < 9 || (c > 13 && c < 32)) suspicious += 1;
  }
  if (sample.length && suspicious / sample.length > 0.3) {
    return { kind: "binary", confidence: "medium" };
  }
  return { kind: "text", confidence: "medium" };
}

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

export function mimeFamily(mime = "") {
  const m = String(mime || "").toLowerCase().trim();
  if (!m || m === "application/octet-stream" || m === "binary/octet-stream") {
    return "untrusted";
  }
  if (m === "image/svg+xml") return "svg";
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (/(?:zip|gzip|x-tar|x-compressed|x-compress)/.test(m)) return "archive";
  if (/javascript|ecmascript|x-httpd-php|x-php/.test(m)) return "text";
  if (m.startsWith("text/") || /(?:json|xml|yaml)/.test(m)) return "text";
  if (/msdownload|executable|x-dosexec|x-msdos|x-sh|x-bat|x-msi|java-archive/.test(m)) {
    return "executable";
  }
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "other";
}

function expectedMimeFamilyForExt(ext) {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (PDF_EXTS.has(ext)) return "pdf";
  if (ext === "zip" || ext === "gz" || ext === "tgz" || ext === "tar.gz") return "archive";
  if (TEXT_OK_EXTS.has(ext)) return "text";
  return "";
}

function signatureFitsExt(ext, sniffKind) {
  if (sniffKind === "empty") return false;
  if (sniffKind === "exe" || sniffKind === "elf" || sniffKind === "ole" || sniffKind === "svg") {
    return false;
  }
  const expected = EXPECTED_SNIFF[ext];
  if (expected) {
    if (ext === "html" || ext === "htm") return sniffKind === "html" || sniffKind === "text";
    return sniffKind === expected;
  }
  if (TEXT_OK_EXTS.has(ext)) {
    return sniffKind === "text" || sniffKind === "html";
  }
  return false;
}

function capabilitiesFor(klass, ext, status) {
  const execute = false;
  if (status === FILE_CAPABILITY_STATUSES.REJECT) {
    return { analyze: false, extract: false, render: false, execute };
  }
  if (klass === FILE_CAPABILITY_CLASSES.CONTAINER) {
    return { analyze: false, extract: true, render: false, execute };
  }
  if (klass === FILE_CAPABILITY_CLASSES.UNKNOWN) {
    return { analyze: false, extract: false, render: false, execute };
  }
  if (IMAGE_EXTS.has(ext)) {
    return { analyze: true, extract: false, render: true, execute };
  }
  if (PDF_EXTS.has(ext)) {
    return { analyze: true, extract: true, render: false, execute };
  }
  if (HTML_EXTS.has(ext)) {
    return { analyze: true, extract: true, render: false, execute };
  }
  return { analyze: true, extract: true, render: false, execute };
}

function pipelineFor(klass, ext, channel, status) {
  if (status === FILE_CAPABILITY_STATUSES.REJECT) return FILE_CAPABILITY_PIPELINES.NONE;
  if (klass === FILE_CAPABILITY_CLASSES.CONTAINER) {
    return channel === "document"
      ? FILE_CAPABILITY_PIPELINES.ARCHIVE_EXTRACT
      : FILE_CAPABILITY_PIPELINES.NONE;
  }
  if (IMAGE_EXTS.has(ext)) return FILE_CAPABILITY_PIPELINES.VISION;
  if (PDF_EXTS.has(ext) || HTML_EXTS.has(ext)) return FILE_CAPABILITY_PIPELINES.DOCUMENT_EXTRACT;
  if (SOURCE_EXTS.has(ext) || klass === FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED) {
    return FILE_CAPABILITY_PIPELINES.FILE_ANALYSIS;
  }
  if (klass === FILE_CAPABILITY_CLASSES.ALLOWED_ANALYZABLE) {
    return FILE_CAPABILITY_PIPELINES.DOCUMENT_EXTRACT;
  }
  return FILE_CAPABILITY_PIPELINES.NONE;
}

function maxBytesFor(klass, ext, channel) {
  if (IMAGE_EXTS.has(ext)) return FILE_CAPABILITY_MAX_BYTES.image;
  if (klass === FILE_CAPABILITY_CLASSES.CONTAINER) return FILE_CAPABILITY_MAX_BYTES.archive;
  if (klass === FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED) {
    return FILE_CAPABILITY_MAX_BYTES.reinforced;
  }
  return FILE_CAPABILITY_MAX_BYTES[channel] || FILE_CAPABILITY_MAX_BYTES.default;
}

function finish(partial) {
  const decision = {
    policyId: FILE_CAPABILITY_POLICY_ID,
    class: partial.class || FILE_CAPABILITY_CLASSES.UNKNOWN,
    status: partial.status || FILE_CAPABILITY_STATUSES.REJECT,
    pipeline: FILE_CAPABILITY_PIPELINES.NONE,
    capabilities: { analyze: false, extract: false, render: false, execute: false },
    reasons: partial.reasons || [],
    codes: partial.codes || [],
    justification: partial.justification || "",
    extension: partial.extension || "",
    sniff: partial.sniff || null,
    mimeFamily: partial.mimeFamily || "untrusted",
    maxBytes: partial.maxBytes || FILE_CAPABILITY_MAX_BYTES.default,
    channel: partial.channel || "chat",
    special: partial.special || "",
    originalName: partial.originalName || "",
  };
  decision.pipeline = pipelineFor(
    decision.class,
    decision.extension,
    decision.channel,
    decision.status,
  );
  decision.capabilities = capabilitiesFor(
    decision.class,
    decision.extension,
    decision.status,
  );
  if (
    decision.status === FILE_CAPABILITY_STATUSES.QUARANTINE &&
    decision.class === FILE_CAPABILITY_CLASSES.CONTAINER &&
    decision.channel === "document"
  ) {
    decision.capabilities.extract = true;
  }
  decision.verdict = fileCapabilityVerdict(decision);
  decision.userSafeMessage = formatFileCapabilityUserMessage(decision);
  return decision;
}

export function fileCapabilityVerdict(decision = {}) {
  if (decision.status === FILE_CAPABILITY_STATUSES.REJECT) {
    return "ce fichier est refusé";
  }
  if (
    decision.status === FILE_CAPABILITY_STATUSES.QUARANTINE ||
    decision.status === FILE_CAPABILITY_STATUSES.MANUAL_REVIEW
  ) {
    return "ce fichier va en quarantaine";
  }
  if (decision.class === FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED) {
    return "ce fichier est analysable sous contrainte";
  }
  return "ce fichier est analysable";
}

export function formatFileCapabilityUserMessage(decision = {}) {
  if (decision.codes?.includes(FILE_CAPABILITY_CODES.DOUBLE_EXTENSION)) {
    const detail = detectDoubleExtension(decision.originalName || "") || {};
    return formatDoubleExtensionRejection(detail);
  }
  return formatUploadRejectionMessage(
    "contrôle interne — le fichier n'a pas été transmis à l'analyse.",
  );
}

export function evaluateArchiveConstraints({
  nestedDepth = 0,
  uncompressedBytes = 0,
  compressedBytes = 0,
  fileCount = 0,
} = {}) {
  const codes = [];
  const reasons = [];
  if (nestedDepth > MAX_ARCHIVE_NESTED_DEPTH) {
    codes.push(FILE_CAPABILITY_CODES.NESTED_ARCHIVE);
    reasons.push("archive imbriquée interdite");
    return {
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes,
      reasons,
      justification: "archive imbriquée — extraction refusée (CWE-409 / OWASP unpack)",
    };
  }
  if (fileCount > MAX_ARCHIVE_ENTRY_COUNT) {
    codes.push(FILE_CAPABILITY_CODES.ZIP_BOMB);
    reasons.push("trop d'entrées d'archive");
    return {
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes,
      reasons,
      justification: `nombre d'entrées > ${MAX_ARCHIVE_ENTRY_COUNT}`,
    };
  }
  if (
    compressedBytes > 0 &&
    uncompressedBytes >= ARCHIVE_BOMB_MIN_UNCOMPRESSED &&
    uncompressedBytes / compressedBytes > ARCHIVE_BOMB_RATIO
  ) {
    codes.push(FILE_CAPABILITY_CODES.ZIP_BOMB);
    reasons.push("ratio décompression excessif");
    return {
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes,
      reasons,
      justification: `zip bomb — ratio ${Math.round(uncompressedBytes / compressedBytes)}:1 (seuil ${ARCHIVE_BOMB_RATIO})`,
    };
  }
  return {
    status: FILE_CAPABILITY_STATUSES.ACCEPT,
    codes,
    reasons,
    justification: "contraintes archive respectées",
  };
}

/**
 * @param {object} file
 * @param {object} [opts]
 * @param {'chat'|'document'} [opts.channel]
 * @param {'auto'|'name'} [opts.stage]
 */
export function classifyFileCapability(file = {}, opts = {}) {
  const channel = opts.channel === "document" ? "document" : "chat";
  const originalName = String(file.originalname || file.name || "");
  const mime = String(file.mimetype || file.mime || "");
  const buffer = file.buffer || null;
  const stage = opts.stage || (buffer && buffer.length ? "auto" : "name");
  const size = Number(file.size ?? buffer?.length ?? 0);
  const family = mimeFamily(mime);
  const extension = resolveFileExtension(originalName);
  const klass = extension
    ? EXT_CLASS.get(extension) || FILE_CAPABILITY_CLASSES.UNKNOWN
    : FILE_CAPABILITY_CLASSES.UNKNOWN;
  const maxBytes = maxBytesFor(klass, extension, channel);
  const matrixRow = FILE_CAPABILITY_MATRIX[klass] || null;

  const base = {
    class: klass,
    extension,
    mimeFamily: family,
    maxBytes,
    channel,
    originalName,
    special: matrixRow?.special || "",
    sniff: null,
  };

  if (hasSuspectFilePath(originalName)) {
    return finish({
      ...base,
      class: FILE_CAPABILITY_CLASSES.REFUSED,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.SUSPECT_PATH],
      reasons: ["nom ou chemin suspect"],
      justification: `chemin/nom rejeté — CWE-22/CWE-73 (${originalName || "(vide)"})`,
    });
  }

  const doubleExt = validateDoubleExtension(originalName);
  if (doubleExt.rejected) {
    return finish({
      ...base,
      class: FILE_CAPABILITY_CLASSES.REFUSED,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.DOUBLE_EXTENSION, doubleExt.code || UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION],
      reasons: ["double extension"],
      justification: `double extension ${doubleExt.detail?.label || ""} — masquage de type (CWE-434)`,
    });
  }

  if (DENY_MIME.has(mime.toLowerCase()) || family === "svg" || family === "executable") {
    return finish({
      ...base,
      class: FILE_CAPABILITY_CLASSES.REFUSED,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.DENYLIST, FILE_CAPABILITY_CODES.ACTIVE_FORMAT],
      reasons: ["MIME denylist / format actif"],
      justification: `MIME ${mime || "(vide)"} famille ${family} — denylist complémentaire`,
    });
  }

  if (klass === FILE_CAPABILITY_CLASSES.REFUSED) {
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.DENYLIST, FILE_CAPABILITY_CODES.ACTIVE_FORMAT],
      reasons: ["extension refusée"],
      justification: `extension .${extension} hors allowlist — format actif ou exécutable`,
    });
  }

  if (size > maxBytes) {
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.SIZE],
      reasons: ["taille maximale dépassée"],
      justification: `taille ${size} > max ${maxBytes}`,
    });
  }

  if (klass === FILE_CAPABILITY_CLASSES.UNKNOWN) {
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.UNKNOWN],
      reasons: ["extension hors allowlist"],
      justification: `type inconnu (${extension || "sans extension"}) — allowlist métier, pas de denylist seule`,
    });
  }

  if (family !== "untrusted") {
    const expectedFamily = expectedMimeFamilyForExt(extension);
    if (expectedFamily && family !== expectedFamily) {
      return finish({
        ...base,
        status: FILE_CAPABILITY_STATUSES.REJECT,
        codes: [FILE_CAPABILITY_CODES.MIME_MISMATCH],
        reasons: ["MIME incohérent avec l'extension"],
        justification: `MIME famille ${family} ≠ attendu ${expectedFamily} pour .${extension} — Content-Type non fiable`,
      });
    }
  }

  if (klass === FILE_CAPABILITY_CLASSES.CONTAINER && channel === "chat") {
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.CONTAINER_CHAT, FILE_CAPABILITY_CODES.CHANNEL],
      reasons: ["archive hors canal document"],
      justification: "conteneur refusé sur le canal chat — extraction seulement via document analysis",
    });
  }

  if (stage === "name" || !buffer) {
    if (klass === FILE_CAPABILITY_CLASSES.CONTAINER) {
      return finish({
        ...base,
        status: FILE_CAPABILITY_STATUSES.QUARANTINE,
        codes: [],
        reasons: ["conteneur — quarantaine + extraction bornée"],
        justification: "archive admise en quarantaine interne (canal document), pas d'exécution",
      });
    }
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.ACCEPT,
      codes: [],
      reasons: ["allowlist nom/extension — signature à vérifier après buffer"],
      justification:
        klass === FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED
          ? `allowlist renforcée .${extension} — analyse seule, exécution interdite`
          : `allowlist .${extension} — analysable`,
    });
  }

  if (!buffer.length) {
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.EMPTY],
      reasons: ["fichier vide"],
      justification: "buffer vide",
    });
  }

  const sniff = sniffFileSignature(buffer);
  base.sniff = sniff;

  if (sniff.kind === "exe" || sniff.kind === "elf" || sniff.kind === "ole") {
    return finish({
      ...base,
      class: FILE_CAPABILITY_CLASSES.REFUSED,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.EXECUTABLE, FILE_CAPABILITY_CODES.SIGNATURE_MISMATCH],
      reasons: ["signature exécutable / OLE"],
      justification: `magic ${sniff.kind} — exécutable ou macros, jamais exécuté ni analysé comme source`,
    });
  }

  if (sniff.kind === "svg") {
    return finish({
      ...base,
      class: FILE_CAPABILITY_CLASSES.REFUSED,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.ACTIVE_FORMAT, FILE_CAPABILITY_CODES.SIGNATURE_MISMATCH],
      reasons: ["SVG / contenu actif"],
      justification: "signature SVG — XSS / contenu actif (CWE-79), refus",
    });
  }

  if (!signatureFitsExt(extension, sniff.kind)) {
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.REJECT,
      codes: [FILE_CAPABILITY_CODES.SIGNATURE_MISMATCH],
      reasons: ["signature incohérente"],
      justification: `magic ${sniff.kind} ≠ type déclaré .${extension} — polyglot / déguisement`,
    });
  }

  if (klass === FILE_CAPABILITY_CLASSES.CONTAINER) {
    return finish({
      ...base,
      status: FILE_CAPABILITY_STATUSES.QUARANTINE,
      codes: [],
      reasons: ["conteneur — quarantaine + extraction bornée"],
      justification: `archive ${sniff.kind} — isolation interne, extract only, execute=false`,
    });
  }

  return finish({
    ...base,
    status: FILE_CAPABILITY_STATUSES.ACCEPT,
    codes: [],
    reasons:
      klass === FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED
        ? ["allowlist renforcée + signature cohérente"]
        : ["allowlist + signature cohérente"],
    justification:
      klass === FILE_CAPABILITY_CLASSES.ALLOWED_REINFORCED
        ? `analysable sous contrainte (.${extension}, magic ${sniff.kind}) — execute=false`
        : `analysable (.${extension}, magic ${sniff.kind}) — execute=false`,
  });
}

export function isAdmittedAtNameGate(file = {}, opts = {}) {
  const decision = classifyFileCapability(file, { ...opts, stage: "name" });
  return decision.status !== FILE_CAPABILITY_STATUSES.REJECT;
}

export function shouldBlockFileCapability(decision = {}, channel = "chat") {
  if (!decision || decision.status === FILE_CAPABILITY_STATUSES.REJECT) return true;
  if (channel === "document") {
    return decision.status === FILE_CAPABILITY_STATUSES.REJECT;
  }
  return decision.status !== FILE_CAPABILITY_STATUSES.ACCEPT;
}

export function attachFileCapability(file = {}, opts = {}) {
  const decision = classifyFileCapability(file, opts);
  file._fileCapability = decision;
  return decision;
}

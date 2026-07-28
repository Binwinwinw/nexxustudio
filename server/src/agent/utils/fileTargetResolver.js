/**
 * file_target_resolver — compose une cible workspace à partir d'une référence
 * explicite (chemin complet) ou implicite (dossier + nom de fichier).
 *
 * Forme A : projects/demo-citadelle/index.html
 * Forme B : « index.html dans le dossier projects/demo-citadelle/ »
 */
import path from "node:path";
import { stripHttpUrlSpans } from "../../../../shared/generatorFirstPolicy.js";

export const FILE_TARGET_RESOLVER_ID = "file_target_resolver_v1";
export { stripHttpUrlSpans };

/** Extensions supportées (alignées lecture workspace + adaptateurs SFA). */
export const FILE_TARGET_EXT_RE =
  /\.(html?|md|txt|pdf|json|xml|css|js|mjs|cjs|ts|tsx|jsx|php|docx?|ya?ml|csv)\b/i;

const FILE_TARGET_EXT_CAPTURE =
  "html?|md|txt|pdf|json|xml|css|js|mjs|cjs|ts|tsx|jsx|php|docx?|ya?ml|csv";

const FILE_URI_RE = /file:\/\/\/[^\s"'<>)\]]+/i;

const WINDOWS_ABS_RE = new RegExp(
  `\\b([A-Za-z]:[\\\\/][^\\s"'<>)\\]]+\\.(?:${FILE_TARGET_EXT_CAPTURE}))\\b`,
  "i",
);

const UNIX_ABS_RE = new RegExp(
  `(?:^|[\\s("'\`])(/(?:[\\w.-]+/)+[\\w.-]+\\.(?:${FILE_TARGET_EXT_CAPTURE}))\\b`,
  "i",
);

/** Chemin relatif projects/…/fichier.ext */
const PROJECTS_FILE_RE = new RegExp(
  `\\b((?:\\.\\/|\\.\\.\\/)?projects\\/[^\\s"'<>)\\]]+\\.(?:${FILE_TARGET_EXT_CAPTURE}))\\b`,
  "i",
);

/**
 * Dossier sous projects/ — sans extension fichier en fin de segment.
 * Accepte trailing slash.
 */
const PROJECTS_FOLDER_RE =
  /\b((?:\.\/|\.\.\/)?projects\/(?:[\w.-]+\/)*[\w.-]+)\/?(?!\.[\w.-]+\b)/i;

/** Nom de fichier isolé (pas précédé d’un séparateur de chemin). */
const STANDALONE_FILENAME_RE = new RegExp(
  `(?<![\\\\/])\\b(?:(?:le\\s+)?fichier\\s+)?([\\w.-]+\\.(?:${FILE_TARGET_EXT_CAPTURE}))\\b`,
  "i",
);

const FOLDER_CONTEXT_RE =
  /\b(?:dossier|r[eé]pertoire|chemin|directory|folder|dans)\b/i;

/**
 * @typedef {'explicit_path'|'folder_plus_filename'|'unresolved'} FileTargetResolutionMode
 * @typedef {'local_file_uri'|'local_file_path'|'workspace_relative'} FileTargetKind
 *
 * @typedef {{
 *   resolved_path: string|null,
 *   resolution_mode: FileTargetResolutionMode,
 *   confidence: 'high'|'medium'|'low',
 *   ambiguities: string[],
 *   kind: FileTargetKind|null,
 *   filename: string|null,
 *   folder: string|null,
 *   ext: string|null,
 * }} FileTargetResolution
 */

/**
 * @param {string} uri
 * @param {FileTargetKind} kind
 * @param {FileTargetResolutionMode} mode
 * @param {'high'|'medium'|'low'} confidence
 * @param {string[]} [ambiguities]
 * @param {string|null} [folder]
 * @returns {FileTargetResolution}
 */
function buildResolved(uri, kind, mode, confidence, ambiguities = [], folder = null) {
  const normalized = String(uri).replace(/\\/g, "/");
  const filename = path.posix.basename(normalized.split("?")[0]);
  const ext = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase() || null
    : null;
  return {
    resolved_path: normalized,
    resolution_mode: mode,
    confidence,
    ambiguities,
    kind,
    filename,
    folder,
    ext,
  };
}

/**
 * @returns {FileTargetResolution}
 */
function unresolved(ambiguities = [], extras = {}) {
  return {
    resolved_path: null,
    resolution_mode: "unresolved",
    confidence: "low",
    ambiguities,
    kind: null,
    filename: extras.filename ?? null,
    folder: extras.folder ?? null,
    ext: extras.ext ?? null,
  };
}

/**
 * Extrait un dossier workspace (projects/…) hors d’un chemin fichier complet.
 * @param {string} raw
 * @returns {string|null}
 */
export function extractWorkspaceFolderReference(raw = "") {
  const text = stripHttpUrlSpans(raw);
  if (!text.trim()) return null;

  const contextual = text.match(
    /\b(?:dans|sous)\s+(?:le\s+)?(?:dossier|r[eé]pertoire|chemin)\s+((?:\.\/|\.\.\/)?projects\/[\w./\-]+)/i,
  );
  if (contextual?.[1]) {
    return normalizeFolder(contextual[1]);
  }

  const dansProjects = text.match(
    /\bdans\s+((?:\.\/|\.\.\/)?projects\/[\w./\-]+)/i,
  );
  if (dansProjects?.[1]) {
    return normalizeFolder(dansProjects[1]);
  }

  const bare = text.match(PROJECTS_FOLDER_RE);
  if (!bare?.[1]) return null;

  const folder = normalizeFolder(bare[1]);
  // Si le match inclut déjà un fichier.ext, ce n’est pas un dossier.
  if (FILE_TARGET_EXT_RE.test(folder)) return null;
  return folder;
}

/**
 * @param {string} folder
 * @returns {string}
 */
function normalizeFolder(folder) {
  return String(folder || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

/**
 * Nom de fichier isolé (Forme B), hors chemin complet.
 * @param {string} raw
 * @returns {string|null}
 */
export function extractStandaloneFilename(raw = "") {
  const text = stripHttpUrlSpans(raw);
  if (!text.trim()) return null;

  // Priorité : « fichier X.ext »
  const labeled = text.match(
    new RegExp(
      `\\bfichier\\s+([\\w.-]+\\.(?:${FILE_TARGET_EXT_CAPTURE}))\\b`,
      "i",
    ),
  );
  if (labeled?.[1] && !/[\\/]/.test(labeled[1])) {
    return labeled[1];
  }

  const match = text.match(STANDALONE_FILENAME_RE);
  if (!match?.[1]) return null;
  return match[1];
}

/**
 * Résout une cible fichier à partir du message utilisateur.
 * @param {string} query
 * @returns {FileTargetResolution}
 */
export function resolveFileTarget(query = "") {
  const original = String(query || "").trim();
  if (!original) return unresolved(["empty_query"]);

  // file:/// peut coexister avec une URL http — on le lit sur le texte brut.
  const fileMatch = original.match(FILE_URI_RE);
  if (fileMatch && FILE_TARGET_EXT_RE.test(fileMatch[0])) {
    return buildResolved(fileMatch[0], "local_file_uri", "explicit_path", "high");
  }

  // Chemins locaux : ignorer les segments path contenus dans https://…
  const raw = stripHttpUrlSpans(original).trim();
  if (!raw) return unresolved(["no_file_reference"]);

  const projectsFile = raw.match(PROJECTS_FILE_RE);
  if (projectsFile?.[1]) {
    return buildResolved(
      projectsFile[1].replace(/^\.\//, ""),
      "workspace_relative",
      "explicit_path",
      "high",
    );
  }

  const win = raw.match(WINDOWS_ABS_RE);
  if (win?.[1]) {
    return buildResolved(win[1], "local_file_path", "explicit_path", "high");
  }

  const unix = raw.match(UNIX_ABS_RE);
  if (unix?.[1]) {
    return buildResolved(unix[1], "local_file_path", "explicit_path", "high");
  }

  // Forme B — dossier + filename
  const folder = extractWorkspaceFolderReference(raw);
  const filename = extractStandaloneFilename(raw);
  const ambiguities = [];

  if (folder && filename) {
    if (FILE_TARGET_EXT_RE.test(folder)) {
      ambiguities.push("folder_looks_like_file");
    }
    const composed = `${folder}/${filename}`.replace(/\/{2,}/g, "/");
    const confidence =
      FOLDER_CONTEXT_RE.test(raw) || /\bfichier\b/i.test(raw)
        ? "high"
        : "medium";
    return buildResolved(
      composed,
      "workspace_relative",
      "folder_plus_filename",
      confidence,
      ambiguities,
      folder,
    );
  }

  if (filename && !folder) {
    ambiguities.push("filename_without_folder");
    return unresolved(ambiguities, {
      filename,
      ext: filename.includes(".")
        ? filename.split(".").pop()?.toLowerCase()
        : null,
    });
  }

  if (folder && !filename) {
    ambiguities.push("folder_without_filename");
    return unresolved(ambiguities, { folder });
  }

  return unresolved(["no_file_reference"]);
}

/**
 * Shape historique pour extractLocalFileReference / short-circuits.
 * @param {string} query
 * @returns {{
 *   uri: string,
 *   kind: FileTargetKind,
 *   filename: string,
 *   ext: string|null,
 *   resolution_mode: FileTargetResolutionMode,
 *   confidence: string,
 *   folder: string|null,
 *   ambiguities: string[],
 * }|null}
 */
export function extractResolvedLocalFileReference(query = "") {
  const hit = resolveFileTarget(query);
  if (!hit.resolved_path || !hit.kind) return null;
  return {
    uri: hit.resolved_path,
    kind: hit.kind,
    filename: hit.filename || path.posix.basename(hit.resolved_path),
    ext: hit.ext,
    resolution_mode: hit.resolution_mode,
    confidence: hit.confidence,
    folder: hit.folder,
    ambiguities: hit.ambiguities,
  };
}

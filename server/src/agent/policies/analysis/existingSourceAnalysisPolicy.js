/**
 * existing_source_analysis — analyser/lire un fichier local référencé.
 * - projects/… sous le workspace → lecture read-only + analyse structurée
 * - file:/// hors allowlist → clarify access (pas de contrat critique à vide)
 * Pas web_html/create ni document_synthesis générique.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractLocalFileReference,
  isExistingSourceAnalysisRequest,
} from "../../utils/localFileUriIntentGuards.js";
import { analyzeSourceFileContent } from "../../analysis/analyzers/index.js";
import { SOURCE_FILE_ANALYSIS_CONTRACT_ID } from "../../analysis/sourceFileAnalysisContract.js";

export const EXISTING_SOURCE_ANALYSIS_RULE = "existing_source_analysis_v1";
export { SOURCE_FILE_ANALYSIS_CONTRACT_ID };
/** Batterie Teams 365 HTML — file:/// + analyser. */
export const EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY =
  "est-ce que tu peux analyser file:///D:/Hostinger/public_html/EasyLocalAI_V2/public/atelier-teams-365.html";

/** Batterie Citadelle — chemin workspace projects/ (Forme A : chemin complet). */
export const EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY =
  "bonjour tu veux bien faire une analyse du fichier qui se trouve dans le chemin projects/demo-citadelle/index.html";

/** Forme B — dossier + nom de fichier (composition avant intent). */
export const EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY =
  "analyse le fichier index.html qui est dans le dossier projects/demo-citadelle/";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Racine dépôt nexxustudio (analysis → policies → agent → src → server → root). */
export const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../../");
const PROJECTS_ROOT = path.resolve(WORKSPACE_ROOT, "projects");
const MAX_READ_BYTES = 200_000;

/**
 * @param {{ uri: string, kind: string, filename: string }} ref
 * @returns {string}
 */
export function buildExistingSourceAccessClarifyReply(ref = {}) {
  const label = ref.filename || ref.uri || "le fichier";
  const accessNote =
    ref.kind === "local_file_uri"
      ? "Le schéma `file:///` pointe vers un fichier **local** que je ne peux pas ouvrir directement depuis ce runtime."
      : "Ce chemin local n'est pas lisible directement depuis ce runtime.";

  return [
    `Oui, je peux t'aider à analyser **${label}**.`,
    "",
    accessNote,
    "",
    "Pour lancer l'analyse :",
    "- **Joins** le fichier à ton message (HTML, PDF, txt…),",
    "- **Colle** le contenu ou un extrait pertinent, ou",
    "- Indique un chemin sous **`projects/`** du workspace Citadelle (lecture allowlist).",
    "",
    "Ensuite : structure, contenu, UX, code ou qualité rédactionnelle — selon l'angle que tu précises.",
  ].join("\n");
}

/**
 * Résout un chemin workspace lisible (deny-by-default hors projects/).
 * @param {{ uri?: string, kind?: string }} ref
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   absolutePath?: string,
 *   relativePath?: string,
 *   exists?: boolean,
 * }}
 */
export function resolveWorkspaceReadablePath(ref = {}) {
  const raw = String(ref.uri || "").trim();
  if (!raw) {
    return { ok: false, reason: "empty_path" };
  }

  let candidate = raw.replace(/\\/g, "/");

  if (/^file:\/\//i.test(candidate)) {
    try {
      candidate = fileURLToPath(candidate);
    } catch {
      return { ok: false, reason: "invalid_file_uri" };
    }
  }

  candidate = candidate.replace(/^\/([A-Za-z]:\/)/, "$1");

  let absolutePath;
  if (path.isAbsolute(candidate)) {
    absolutePath = path.resolve(candidate);
  } else {
    const rel = candidate.replace(/^\.\//, "");
    if (!rel.startsWith("projects/") && !rel.startsWith("projects\\")) {
      return { ok: false, reason: "outside_allowlist" };
    }
    absolutePath = path.resolve(WORKSPACE_ROOT, rel);
  }

  const projectsRootResolved = path.resolve(PROJECTS_ROOT);
  if (
    absolutePath !== projectsRootResolved &&
    !absolutePath.startsWith(projectsRootResolved + path.sep)
  ) {
    return { ok: false, reason: "outside_allowlist", absolutePath };
  }

  const exists = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  const relativePath = path
    .relative(WORKSPACE_ROOT, absolutePath)
    .replace(/\\/g, "/");

  if (!exists) {
    return {
      ok: false,
      reason: "not_found",
      absolutePath,
      relativePath,
      exists: false,
    };
  }

  return {
    ok: true,
    absolutePath,
    relativePath,
    exists: true,
  };
}

/**
 * @param {string} content
 * @param {string} relativePath
 * @param {string} ext
 * @returns {string}
 */
function buildStructuredFileAnalysisReply(content, relativePath, ext) {
  const { reply, quality } = analyzeSourceFileContent(content, {
    path: relativePath,
    ext,
  });
  if (!quality.ok) {
    return (
      reply +
      `\n\n_(Note qualité contrat ${SOURCE_FILE_ANALYSIS_CONTRACT_ID} : ${quality.failures.join(", ")})_`
    );
  }
  return reply;
}

/**
 * @param {{ uri: string, kind: string, filename: string, ext?: string|null }} ref
 * @returns {{ path: string, kind: string, reply: string, sourceRef: object }|null}
 */
function tryWorkspaceReadAnalysis(ref) {
  const resolved = resolveWorkspaceReadablePath(ref);
  if (!resolved.ok && resolved.reason === "not_found") {
    const target = resolved.relativePath || ref.uri;
    const composedHint =
      ref.resolution_mode === "folder_plus_filename" && ref.folder
        ? `Je n'ai pas pu résoudre **\`${ref.filename}\`** dans **\`${ref.folder}\`** (cible composée : \`${target}\`).`
        : `Je ne trouve pas **\`${target}\`** sous l'allowlist \`projects/\`.`;
    return {
      path: "existing_source_analysis_not_found",
      kind: "workspace_file_missing",
      reply: [
        composedHint,
        "",
        "Vérifie le chemin (casse, dossier) ou joins le fichier au message.",
      ].join("\n"),
      sourceRef: { ...ref, resolved },
    };
  }

  if (!resolved.ok) return null;

  let content;
  try {
    const stat = fs.statSync(resolved.absolutePath);
    if (stat.size > MAX_READ_BYTES) {
      const buf = Buffer.alloc(MAX_READ_BYTES);
      const fd = fs.openSync(resolved.absolutePath, "r");
      fs.readSync(fd, buf, 0, MAX_READ_BYTES, 0);
      fs.closeSync(fd);
      content = buf.toString("utf8");
    } else {
      content = fs.readFileSync(resolved.absolutePath, "utf8");
    }
  } catch {
    return {
      path: "existing_source_analysis_not_found",
      kind: "workspace_read_failed",
      reply: `Impossible de lire **\`${resolved.relativePath}\`** (erreur I/O).`,
      sourceRef: { ...ref, resolved },
    };
  }

  return {
    path: "existing_source_analysis_deterministic",
    kind: "workspace_file_read",
    reply: buildStructuredFileAnalysisReply(
      content,
      resolved.relativePath,
      ref.ext || path.extname(resolved.relativePath).replace(/^\./, ""),
    ),
    sourceRef: { ...ref, resolved, bytes: Buffer.byteLength(content, "utf8") },
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isExistingSourceAnalysisSatisfiable(query = "") {
  return isExistingSourceAnalysisRequest(query);
}

/**
 * @param {string} query
 * @returns {{
 *   path: string,
 *   kind: string,
 *   reply: string,
 *   sourceRef: object,
 * }|null}
 */
export function resolveExistingSourceAnalysisShortCircuit(query = "") {
  if (!isExistingSourceAnalysisRequest(query)) return null;
  const sourceRef = extractLocalFileReference(query);
  if (!sourceRef) return null;

  const workspaceHit = tryWorkspaceReadAnalysis(sourceRef);
  if (workspaceHit) return workspaceHit;

  return {
    path: "existing_source_analysis_clarify_access",
    kind: "local_file_inaccessible",
    reply: buildExistingSourceAccessClarifyReply(sourceRef),
    sourceRef,
  };
}

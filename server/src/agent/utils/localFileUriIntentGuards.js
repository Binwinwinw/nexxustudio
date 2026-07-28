/**
 * Références fichier local — file:///, absolu Windows/Unix, ou relatif projects/.
 * Délègue la résolution Forme A/B à fileTargetResolver (chemin explicite OU dossier+fichier).
 * Le support (.html) décrit le média, pas l'action (create vs analyze).
 */
import {
  extractResolvedLocalFileReference,
  FILE_TARGET_EXT_RE,
  resolveFileTarget,
  stripHttpUrlSpans,
} from "./fileTargetResolver.js";
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { EXISTING_FILE_PATH_RE } from "../../../../shared/generatorFirstPolicy.js";

const EXISTING_SOURCE_VERB_RE =
  /\b(?:analys|analyser|analyse|lis|lire|resume|resumer|résume|résumer|commente|commenter|audite|auditer|review|revois|examine|examiner|inspecte|inspecter|évalue|evalue|evaluer|critique|critiquer|regarde|ouvre|ouvrir)\b/i;

const CREATE_SOURCE_VERB_RE =
  /\b(?:cree|créer|creer|generer|génère|genere|produis|produire|construis|construire|developpe|développe|refais|fabrique)\b/i;

/** @deprecated Prefer FILE_TARGET_EXT_RE — conservé pour imports existants. */
const SUPPORTED_EXT_RE = FILE_TARGET_EXT_RE;

/** Relatif workspace — allowlist lecture Citadelle (compat exports). */
const PROJECTS_REL_RE =
  /\b((?:\.\/|\.\.\/)?projects\/[^\s"'<>)\]]+\.(?:html?|md|txt|pdf|json|xml|css|js|mjs|cjs|ts|tsx|jsx|php|ya?ml|csv))\b/i;

/**
 * @param {string} query
 * @returns {{
 *   uri: string,
 *   kind: 'local_file_uri'|'local_file_path'|'workspace_relative',
 *   filename: string,
 *   ext: string|null,
 *   resolution_mode?: string,
 *   confidence?: string,
 *   folder?: string|null,
 *   ambiguities?: string[],
 * }|null}
 */
export function extractLocalFileReference(query = "") {
  const resolved = extractResolvedLocalFileReference(query);
  if (resolved) return resolved;

  // Dernier recours : regex générique partagée (chemins hors projects/ avec ./ etc.)
  // Strip http(s) d'abord — sinon `/editeurhtml/index.php` dans une URL gagne.
  const raw = stripHttpUrlSpans(query).trim();
  if (!raw) return null;
  const generic = raw.match(EXISTING_FILE_PATH_RE);
  if (!generic?.[0] || !SUPPORTED_EXT_RE.test(generic[0])) return null;

  const uri = generic[0].trim().replace(/\\/g, "/");
  const filename = uri.split("/").pop() || uri;
  const ext = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase() || null
    : null;
  return {
    uri,
    kind: /^projects\//i.test(uri) ? "workspace_relative" : "local_file_path",
    filename,
    ext,
    resolution_mode: "explicit_path",
    confidence: "medium",
    folder: null,
    ambiguities: [],
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isLocalFileReference(query = "") {
  return extractLocalFileReference(query) !== null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isExistingSourceAnalysisRequest(query = "") {
  const ref = extractLocalFileReference(query);
  if (!ref) return false;

  const q = normalizeFamiliarityQuery(query);
  if (!EXISTING_SOURCE_VERB_RE.test(q)) return false;
  if (CREATE_SOURCE_VERB_RE.test(q) && !/\banalys/.test(q)) return false;
  return true;
}

export {
  EXISTING_SOURCE_VERB_RE,
  CREATE_SOURCE_VERB_RE,
  PROJECTS_REL_RE,
  resolveFileTarget,
  FILE_TARGET_EXT_RE as SUPPORTED_EXT_RE,
};

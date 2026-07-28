/**
 * ADR-015 — Generator-First : livrables lourds uniquement.
 * Ne jamais confondre un chemin existant (ex. projects/.../index.html)
 * avec une demande de création / Forge build.
 */

const FORCED_RE = /\b(?:bypass\s+pm|generator-first)\b/i;

const ANALYSIS_VERBS_RE =
  /\b(?:analyse|analyser|explique|expliquer|lis|lire|v[eé]rifie|v[eé]rifier|audite|auditer|audit|regarde|inspecte|inspecter|r[eé]sume|r[eé]sumer|revue|review|d[eé]cris|d[eé]crire)\b/i;

const CREATE_VERBS_RE =
  /\b(?:cr[eé]e|cr[eé]er|g[eé]n[eè]re|g[eé]n[eé]rer|produis|produire|construis|construire|impl[eé]mente|impl[eé]menter|b[aâ]tis|b[aâ]tir|livre|livrer|ajoute|ajouter)\b/i;

/** Formats de livraison explicites — pas un simple nom de fichier dans un chemin. */
const DELIVERY_FORMAT_RE =
  /\b(?:html\s+complet|20\s+slides|fichier\s+complet|json\s+complet|script\s+complet|livrable\s+complet|artefact\s+complet)\b/i;

const INDEX_HTML_RE = /\bindex\.html\b/i;

const PLANNING_RE =
  /(?<!sans\s+)(?:plan\s+d['']architecture|strat[eé]gie|concept|[eé]tape\s+de\s+planification|comment\s+structurer|brouillon|approche)/i;

/** Spans http(s) — path `/…/fichier.ext` dans une URL ≠ chemin local. */
const HTTP_URL_SPAN_RE = /https?:\/\/[^\s"'<>)\]]+/gi;

/** Domaines nus (ex. moncoachscolaire.fr/page.php) — même piège path local. */
const BARE_WEB_HOST_SPAN_RE =
  /\b(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|dev|app|fr|eu|info|biz|co|uk|us|ca|be|ch|de|es|it|nl|pl|pt|ai|me|tv|xyz|site|online|tech|cloud|hu|pe)(?:\/[^\s"'<>)\]]*)?/gi;

/**
 * Retire cibles web (https + domaine nu) avant matching chemin local.
 * @param {string} [text]
 * @returns {string}
 */
export function stripHttpUrlSpans(text = "") {
  return String(text || "")
    .replace(HTTP_URL_SPAN_RE, " ")
    .replace(BARE_WEB_HOST_SPAN_RE, " ");
}

/** Chemin relatif / absolu / file:// vers un fichier source. */
export const EXISTING_FILE_PATH_RE =
  /\b(?:projects\/|\.\/|\.\.\/|file:\/\/\/?|[a-zA-Z]:\\|\/)[^\s"'`?]+\.(?:html?|jsx?|tsx?|css|php|py|json|md|txt|yml|yaml|csv|mjs|cjs)\b/i;

const PATH_CONTEXT_RE =
  /\b(?:chemin|path|fichier\s+qui|se\s+trouve\s+dans|dans\s+le\s+(?:dossier|r[eé]pertoire)|projects\/)\b/i;

/** Forme B : nom de fichier + dossier (ex. index.html dans projects/demo/). */
const FOLDER_PLUS_FILENAME_RE =
  /\b(?:(?:le\s+)?fichier\s+)?[\w.-]+\.(?:html?|jsx?|tsx?|css|php|py|json|md|txt|yml|yaml|csv|mjs|cjs)\b[\s\S]{0,120}\b(?:dans|sous)\s+(?:le\s+)?(?:dossier|r[eé]pertoire|chemin)\s+(?:\.\/|\.\.\/)?projects\//i;

const FILENAME_IN_PROJECTS_FOLDER_RE =
  /\b(?:(?:le\s+)?fichier\s+)?[\w.-]+\.(?:html?|jsx?|tsx?|css|php|py|json|md|txt|yml|yaml|csv|mjs|cjs)\b[\s\S]{0,80}\bdans\s+(?:\.\/|\.\.\/)?projects\//i;

/**
 * @param {string} [query]
 * @returns {boolean}
 */
export function isExistingFilePathAnalysisRequest(query = "") {
  const original = String(query || "");
  if (!original.trim()) return false;
  if (!ANALYSIS_VERBS_RE.test(original)) return false;

  // Ignorer les path segments contenus dans https://… (ex. /editeurhtml/index.php).
  const q = stripHttpUrlSpans(original);
  if (!q.trim()) return false;

  const hasPath =
    EXISTING_FILE_PATH_RE.test(q) ||
    FOLDER_PLUS_FILENAME_RE.test(q) ||
    FILENAME_IN_PROJECTS_FOLDER_RE.test(q) ||
    (PATH_CONTEXT_RE.test(q) &&
      /\b[\w./\\-]+\.(?:html?|jsx?|tsx?|css|php|py|json|md|txt|yml|yaml|csv|mjs|cjs)\b/i.test(
        q,
      ));

  return hasPath;
}

/**
 * @param {string} [query]
 * @param {{ requireMinLength?: number }} [options]
 * @returns {boolean}
 */
export function isGeneratorFirstIntent(query = "", options = {}) {
  const q = String(query || "");
  if (!q.trim()) return false;

  if (FORCED_RE.test(q)) return true;

  // Rule C — Generator-First interdit sur analyse/revue d'un fichier existant.
  if (isExistingFilePathAnalysisRequest(q)) return false;

  // Analyse/revue sans verbe de création → jamais Forge.
  if (ANALYSIS_VERBS_RE.test(q) && !CREATE_VERBS_RE.test(q)) return false;

  const minLen = Number.isFinite(options.requireMinLength)
    ? options.requireMinLength
    : 50;
  const isLong = q.length > minLen;
  if (!isLong) return false;

  if (PLANNING_RE.test(q)) return false;

  // index.html seul dans un chemin ≠ livraison ; exige create + (format complet OU create ciblé).
  const hasDeliveryFormat = DELIVERY_FORMAT_RE.test(q);
  const hasCreateWithIndex =
    INDEX_HTML_RE.test(q) &&
    CREATE_VERBS_RE.test(q) &&
    !EXISTING_FILE_PATH_RE.test(q) &&
    !PATH_CONTEXT_RE.test(q);

  return hasDeliveryFormat || hasCreateWithIndex;
}

export default {
  isGeneratorFirstIntent,
  isExistingFilePathAnalysisRequest,
  EXISTING_FILE_PATH_RE,
  stripHttpUrlSpans,
};

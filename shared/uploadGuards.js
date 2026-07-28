/**
 * Garde-fous upload chat — double extension (ex. fichier.php.txt).
 * Source unique frontend + backend Nexxus Studio.
 */

export const UPLOAD_REJECTION_CODES = {
  DOUBLE_EXTENSION: "UPLOAD_DOUBLE_EXTENSION",
  TYPE_NOT_ALLOWED: "UPLOAD_REJECTED",
};

/** Extensions internes à risque — documentées pour évolutions futures. */
export const RISKY_INNER_EXTENSIONS = new Set([
  "php",
  "phtml",
  "phar",
  "php3",
  "php4",
  "php5",
  "php7",
  "php8",
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "msi",
  "sh",
  "bash",
  "ps1",
  "vbs",
  "vbe",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "jsp",
  "asp",
  "aspx",
  "cgi",
  "pl",
  "py",
  "rb",
  "dll",
  "jar",
  "war",
  "htaccess",
  "svg",
]);

/** Doubles extensions courantes et légitimes (archives). */
const ALLOWED_DOUBLE_EXTENSIONS = new Set(["tar.gz", "tar.bz2", "tar.xz"]);

/**
 * @param {string} filename
 * @returns {{ inner: string, outer: string, label: string } | null}
 */
export function detectDoubleExtension(filename = "") {
  const base = String(filename).split(/[/\\]/).pop() || "";
  if (!base.includes(".")) return null;

  const lower = base.toLowerCase();
  for (const allowed of ALLOWED_DOUBLE_EXTENSIONS) {
    if (lower.endsWith(`.${allowed}`)) return null;
  }

  const parts = base.split(".").filter(Boolean);
  if (parts.length < 3) return null;

  const outer = parts[parts.length - 1].toLowerCase();
  const inner = parts[parts.length - 2].toLowerCase();
  const label = `.${inner}.${outer}`;

  return { inner, outer, label };
}

export function formatDoubleExtensionRejection(detail = {}) {
  const label = detail?.label || ".php.txt";
  return (
    `🔒 Upload refusé (sécurité) — Extension multiple détectée (${label}) : fichier refusé par sécurité. ` +
    `Les noms du type .php.txt masquent un type exécutable. ` +
    `Renommez le fichier avec une seule extension (ex. physique_chimie.txt).\n\n` +
    `Le fichier ne sera pas transmis au moteur d'analyse. Aucune réponse IA ne sera générée.`
  );
}

/**
 * @param {string} filename
 * @returns {{ rejected: boolean, code?: string, message?: string, detail?: object }}
 */
export function validateDoubleExtension(filename = "") {
  const detected = detectDoubleExtension(filename);
  if (!detected) {
    return { rejected: false };
  }

  return {
    rejected: true,
    code: UPLOAD_REJECTION_CODES.DOUBLE_EXTENSION,
    message: formatDoubleExtensionRejection(detected),
    detail: detected,
  };
}

export function formatUploadRejectionMessage(message = "") {
  return (
    `🔒 Upload refusé (sécurité) — ${message}\n\n` +
    `Le fichier ne sera pas transmis au moteur d'analyse. Aucune réponse IA ne sera générée.`
  );
}

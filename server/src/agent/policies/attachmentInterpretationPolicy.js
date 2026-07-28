/**
 * Garde d’interprétation PJ — ne pas affirmer « non implémenté / inopérant »
 * quand la logique est dans un asset lié non lu (ex. home.js).
 */
import { classifyAttachmentTask, ATTACHMENT_FILE_KINDS } from "./attachmentTaskPolicy.js";

export const ATTACHMENT_INTERPRETATION_RULE = "attachment_interpretation_guard_v1";

const SCRIPT_SRC_RE =
  /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const LINK_HREF_RE =
  /<link\b[^>]*\bhref\s*=\s*["']([^"']+\.css)["'][^>]*>/gi;

/**
 * @param {string} content
 * @returns {string[]}
 */
export function extractLinkedAssetRefs(content = "") {
  const refs = new Set();
  const src = String(content || "");
  for (const match of src.matchAll(SCRIPT_SRC_RE)) {
    const ref = String(match[1] || "").trim();
    if (ref) refs.add(ref);
  }
  for (const match of src.matchAll(LINK_HREF_RE)) {
    const ref = String(match[1] || "").trim();
    if (ref) refs.add(ref);
  }
  return [...refs];
}

/**
 * @param {{ attachments?: unknown[], fileContents?: Record<string, string>|null }} [ctx]
 * @returns {string|null}
 */
export function buildAttachmentInterpretationSystemAddon(ctx = {}) {
  const attachments = ctx.attachments || [];
  if (!attachments.length) return null;

  const hit = classifyAttachmentTask("", attachments);
  const codeish =
    hit.fileKind === ATTACHMENT_FILE_KINDS.CODE ||
    hit.fileKind === ATTACHMENT_FILE_KINDS.MIXED;
  if (!codeish && hit.fileKind !== ATTACHMENT_FILE_KINDS.DOCUMENT) {
    return null;
  }

  const names = attachments
    .map((f) => String(f?.originalname || f?.name || ""))
    .filter(Boolean);

  const linked = new Set();
  const contents = ctx.fileContents || null;
  if (contents && typeof contents === "object") {
    for (const text of Object.values(contents)) {
      for (const ref of extractLinkedAssetRefs(String(text || ""))) {
        linked.add(ref);
      }
    }
  }

  // Signal faible sans contenu : noms HTML/JS → rappeler la règle générique.
  const htmlish = names.some((n) => /\.(html?|jsx?|tsx?|vue|svelte)$/i.test(n));
  if (!htmlish && linked.size === 0 && !codeish) return null;

  const linkedList =
    linked.size > 0
      ? [...linked].slice(0, 8).join(", ")
      : "scripts/CSS liés déclarés dans la PJ (ex. home.js)";

  return [
    "[GARDE INTERPRÉTATION PJ]",
    `Fichier(s) joints : ${names.slice(0, 4).join(", ") || "pièce jointe"}.`,
    `Assets liés détectés ou plausibles : ${linkedList}.`,
    "Tant que ces assets ne sont pas lus dans ce tour, n'affirme pas qu'un comportement est « non implémenté », « inopérant » ou « sans logique ».",
    "Formule plutôt : « non visible dans ce fichier » / « logique potentiellement dans l'asset lié ».",
    "Tu peux décrire la structure HTML, les dépendances déclarées et proposer des améliorations de contenu sans conclure sur le runtime.",
  ].join("\n");
}

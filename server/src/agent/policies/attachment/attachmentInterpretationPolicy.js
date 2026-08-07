/**
 * Garde d’interprétation PJ — ne pas affirmer « non implémenté / inopérant »
 * quand la logique est dans un asset lié non lu (ex. home.js).
 * + ground-facts HTML analyzer (title/viewport/charset) anti-hallucination.
 */
import { classifyAttachmentTask, ATTACHMENT_FILE_KINDS } from "./attachmentTaskPolicy.js";
import {
  analyzeHtmlSource,
  buildHtmlAnalyzerFactsPayload,
} from "../../analysis/analyzers/htmlAnalyzer.js";

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
 * @param {unknown} file
 * @returns {string|null}
 */
function readAttachmentText(file) {
  if (!file || typeof file !== "object") return null;
  if (typeof file.content === "string" && file.content.trim()) return file.content;
  if (typeof file.text === "string" && file.text.trim()) return file.text;
  const buf = file.buffer;
  if (Buffer.isBuffer(buf)) {
    try {
      return buf.toString("utf8");
    } catch {
      return null;
    }
  }
  if (buf?.type === "Buffer" && Array.isArray(buf.data)) {
    try {
      return Buffer.from(buf.data).toString("utf8");
    } catch {
      return null;
    }
  }
  return null;
}

function isHtmlAttachment(file) {
  const name = String(file?.originalname || file?.name || "");
  const mime = String(file?.mimetype || file?.mimeType || "");
  return /\.html?$/i.test(name) || /text\/html/i.test(mime);
}

/**
 * Analyse le premier HTML joint et renvoie faits structurés.
 * @param {unknown[]} attachments
 * @returns {object|null}
 */
export function resolveHtmlAnalyzerFactsFromAttachments(attachments = []) {
  const list = Array.isArray(attachments) ? attachments : [];
  for (const file of list) {
    if (!isHtmlAttachment(file)) continue;
    const content = readAttachmentText(file);
    if (!content || content.length < 20) continue;
    const name = String(file?.originalname || file?.name || "attachment.html");
    const report = analyzeHtmlSource(content, {
      path: name,
      ext: "html",
      bytes: Buffer.byteLength(content, "utf8"),
      lines: content.split(/\r?\n/).length,
    });
    return buildHtmlAnalyzerFactsPayload(report);
  }
  return null;
}

/**
 * Addon court anti-contradiction dérivé des faits structurés.
 * @param {object|null} facts
 * @returns {string|null}
 */
export function buildHtmlAnalyzerFactsSystemAddon(facts = null) {
  if (!facts || typeof facts !== "object") return null;
  const lines = [
    "[FAITS ANALYZER HTML — ne pas contredire]",
    `title=${facts.hasTitle ? "présent" : "absent"}${facts.titleText ? ` (« ${String(facts.titleText).slice(0, 60)} »)` : ""}`,
    `viewport=${facts.hasViewport ? "présent" : "absent"}`,
    `charset=${facts.hasCharset ? "présent" : "absent"}`,
    `contrôles_sans_nom_accessible=${facts.accessibleNameGaps || 0}`,
  ];
  if (facts.hasTitle) {
    lines.push(
      "INTERDIT d'affirmer l'absence de balise <title> ou que le document n'a pas de title.",
    );
  }
  if (facts.hasViewport) {
    lines.push(
      "INTERDIT d'affirmer l'absence de meta viewport.",
    );
  }
  if (!facts.hasTitle) {
    lines.push("Finding ancré : <title> manquant — tu peux le signaler.");
  }
  if (!facts.hasViewport) {
    lines.push("Finding ancré : meta viewport manquante — tu peux le signaler.");
  }
  return lines.join("\n");
}

/**
 * Retire les affirmations qui contredisent les faits analyzer.
 * @param {string} text
 * @param {object|null} facts
 * @returns {string}
 */
export function stripContradictedHtmlHeadClaims(text = "", facts = null) {
  if (!facts || !text) return text;
  let out = String(text);
  if (facts.hasTitle) {
    out = out.replace(
      /[^\n.!?]{0,80}(?:pas\s+de|sans|aucune?|manquant[es]?)\s+(?:balise\s+)?<?\s*title\s*>?[^\n.!?]{0,60}[.!?]?/gi,
      "",
    );
  }
  if (facts.hasViewport) {
    out = out.replace(
      /[^\n.!?]{0,80}(?:pas\s+de|sans|aucune?|manquant[es]?)\s+(?:balise\s+|meta\s+)?viewport[^\n.!?]{0,60}[.!?]?/gi,
      "",
    );
  }
  if (facts.hasTitle && facts.hasViewport) {
    out = out.replace(
      /[^\n.!?]{0,40}ni\s+meta\s+viewport[^\n.!?]{0,40}[.!?]?/gi,
      "",
    );
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * @param {{ attachments?: unknown[], fileContents?: Record<string, string>|null, htmlAnalyzerFacts?: object|null }} [ctx]
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

  const htmlish = names.some((n) => /\.(html?|jsx?|tsx?|vue|svelte)$/i.test(n));
  if (!htmlish && linked.size === 0 && !codeish) return null;

  const linkedList =
    linked.size > 0
      ? [...linked].slice(0, 8).join(", ")
      : "scripts/CSS liés déclarés dans la PJ (ex. home.js)";

  const parts = [
    "[GARDE INTERPRÉTATION PJ]",
    `Fichier(s) joints : ${names.slice(0, 4).join(", ") || "pièce jointe"}.`,
    `Assets liés détectés ou plausibles : ${linkedList}.`,
    "Tant que ces assets ne sont pas lus dans ce tour, n'affirme pas qu'un comportement est « non implémenté », « inopérant » ou « sans logique ».",
    "Formule plutôt : « non visible dans ce fichier » / « logique potentiellement dans l'asset lié ».",
    "Tu peux décrire la structure HTML, les dépendances déclarées et proposer des améliorations de contenu sans conclure sur le runtime.",
  ];

  const factsAddon = buildHtmlAnalyzerFactsSystemAddon(
    ctx.htmlAnalyzerFacts || null,
  );
  if (factsAddon) parts.push("", factsAddon);

  return parts.join("\n");
}

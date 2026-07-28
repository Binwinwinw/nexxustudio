import { createHash } from "node:crypto";

export const DOCUMENT_BRIEFING_SCHEMA_VERSION = 1;

/** @typedef {{
 *   label: string,
 *   selector?: string|null,
 *   purpose?: string|null,
 *   snippet?: string|null,
 *   lineStart?: number|null,
 *   lineEnd?: number|null,
 * }} DocumentKeyBlock */

/** @typedef {{
 *   schemaVersion: number,
 *   documentId: string,
 *   filename: string,
 *   mime: string|null,
 *   sizeBytes: number|null,
 *   kind: string,
 *   summary: string|null,
 *   keyBlocks: DocumentKeyBlock[],
 *   limits: string[],
 *   followUpEligible: boolean,
 *   lastAnalysisKind: string,
 *   analyzedAt: string,
 *   analysisRichness: "full" | "analysis_only",
 *   lastAnalysisExcerpt?: string|null,
 * }} DocumentBriefing */

const CSS_SELECTOR_RE =
  /(?:^|[\s,{])([#.][\w-]+(?:\s*[,{]|\s+[\w.#\[\]:-]+)*)/gm;
const CSS_CLASS_RE = /\.([a-zA-Z_][\w-]*)/g;
const JS_EXPORT_RE =
  /export\s+(?:default\s+)?(?:function|class|const)\s+(\w+)/g;

/**
 * @param {string} content
 */
export function computeDocumentContentHash(content = "") {
  const digest = createHash("sha256").update(String(content), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 32)}`;
}

/**
 * @param {string} filename
 * @param {string|null} mime
 */
export function inferDocumentKind(filename = "", mime = null) {
  const name = String(filename || "").toLowerCase();
  const m = String(mime || "").toLowerCase();
  if (m.includes("css") || name.endsWith(".css") || name.endsWith(".scss")) {
    return "stylesheet";
  }
  if (/\.(jsx?|tsx?)$/.test(name) || m.includes("javascript")) return "script";
  if (/\.(md|markdown)$/.test(name)) return "markdown";
  if (/\.(html?|htm)$/.test(name)) return "html";
  if (m.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (/\.json$/.test(name)) return "json";
  return "document";
}

/**
 * @param {string} text
 * @param {number} max
 */
function extractCssKeyBlocks(text = "", max = 12) {
  const seen = new Set();
  const blocks = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length && blocks.length < max; i++) {
    const line = lines[i];
    const ruleMatch = line.match(/^\s*([#.][\w-]+(?:\s*[,{]|(?:\s+[.#\w\[\]:-]+)+)?)/);
    if (!ruleMatch?.[1]) continue;
    const selector = ruleMatch[1].trim().replace(/\s*\{$/, "");
    if (selector.length < 2 || seen.has(selector)) continue;
    seen.add(selector);
    const snippet = lines.slice(i, Math.min(i + 8, lines.length)).join("\n").slice(0, 420);
    blocks.push({
      label: selector.replace(/^[.#]/, "") || selector,
      selector,
      purpose: null,
      snippet,
      lineStart: i + 1,
      lineEnd: Math.min(i + 8, lines.length),
    });
  }

  if (blocks.length >= 3) return blocks;

  let m;
  CSS_CLASS_RE.lastIndex = 0;
  while ((m = CSS_CLASS_RE.exec(text)) && blocks.length < max) {
    const selector = `.${m[1]}`;
    if (seen.has(selector)) continue;
    seen.add(selector);
    blocks.push({
      label: m[1],
      selector,
      purpose: null,
      snippet: null,
      lineStart: null,
      lineEnd: null,
    });
  }

  return blocks.slice(0, max);
}

/**
 * @param {string} text
 * @param {number} max
 */
function extractScriptKeyBlocks(text = "", max = 10) {
  const blocks = [];
  let m;
  JS_EXPORT_RE.lastIndex = 0;
  while ((m = JS_EXPORT_RE.exec(text)) && blocks.length < max) {
    blocks.push({
      label: m[1],
      selector: m[1],
      purpose: "export",
      snippet: null,
      lineStart: null,
      lineEnd: null,
    });
  }
  return blocks;
}

/**
 * @param {string} content
 * @param {string} kind
 */
export function extractKeyBlocksFromContent(content = "", kind = "document") {
  if (!content?.trim()) return [];
  if (kind === "stylesheet") return extractCssKeyBlocks(content);
  if (kind === "script") return extractScriptKeyBlocks(content);
  return [];
}

/**
 * @param {string} analysis
 */
export function extractSummaryFromAnalysis(analysis = "") {
  const text = String(analysis || "").trim();
  if (!text) return null;

  const roleMatch = text.match(
    /(?:rôle|role|objectif|synthèse|synthese|résumé|resume)\s*[:\-]\s*([^\n]+)/i,
  );
  if (roleMatch?.[1]) return roleMatch[1].trim().slice(0, 320);

  const firstSection = text.match(/##\s*[^\n]+\n+([^\n#]+)/);
  if (firstSection?.[1]) return firstSection[1].trim().slice(0, 320);

  const firstBullet = text.match(/^-\s+(.+)$/m);
  if (firstBullet?.[1]) return firstBullet[1].trim().slice(0, 320);

  return text.slice(0, 280).replace(/\s+/g, " ").trim() || null;
}

/**
 * @param {string} analysis
 */
export function extractLimitsFromAnalysis(analysis = "") {
  const limits = [];
  const section = String(analysis || "").match(
    /(?:limites?|limitations?|attention)\s*[:\n]+([\s\S]*?)(?:\n##|\n---|$)/i,
  );
  if (!section?.[1]) return limits;
  for (const line of section[1].split("\n")) {
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet?.[1]) limits.push(bullet[1].trim().slice(0, 200));
  }
  return limits.slice(0, 6);
}

/**
 * Enrichit keyBlocks à partir des puces d'analyse (sélecteurs mentionnés).
 * @param {DocumentKeyBlock[]} blocks
 * @param {string} analysis
 */
export function enrichKeyBlocksFromAnalysis(blocks = [], analysis = "") {
  const seen = new Set(blocks.map((b) => b.selector || b.label));
  const out = [...blocks];

  for (const line of String(analysis || "").split("\n")) {
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (!bullet?.[1]) continue;
    const seg = bullet[1];
    const selMatch = seg.match(/([#.][\w-]+)/);
    if (!selMatch?.[1]) continue;
    const selector = selMatch[1];
    if (seen.has(selector)) continue;
    seen.add(selector);
    out.push({
      label: selector.replace(/^[.#]/, "") || selector,
      selector,
      purpose: seg.replace(selMatch[1], "").replace(/^[\s:–-]+/, "").trim().slice(0, 120) || null,
      snippet: null,
      lineStart: null,
      lineEnd: null,
    });
    if (out.length >= 16) break;
  }

  return out;
}

/**
 * @param {{
 *   fileName?: string,
 *   mimeType?: string|null,
 *   sizeBytes?: number|null,
 *   sourceContent?: string|null,
 *   analysisText?: string|null,
 *   analysisKind?: string,
 *   analysisRichness?: "full" | "analysis_only",
 * }} input
 * @returns {DocumentBriefing}
 */
export function buildDocumentBriefing({
  fileName = "document",
  mimeType = null,
  sizeBytes = null,
  sourceContent = null,
  analysisText = null,
  analysisKind = "document_analysis",
  analysisRichness = "full",
}) {
  const filename = String(fileName || "document").trim() || "document";
  const content = String(sourceContent || "");
  const analysis = String(analysisText || "").trim();
  const kind = inferDocumentKind(filename, mimeType);
  const hasSource = Boolean(content.trim());

  let keyBlocks = hasSource
    ? extractKeyBlocksFromContent(content, kind)
    : [];
  if (analysis) {
    keyBlocks = enrichKeyBlocksFromAnalysis(keyBlocks, analysis);
  }

  const richness =
    analysisRichness === "analysis_only" || !hasSource
      ? "analysis_only"
      : "full";

  return {
    schemaVersion: DOCUMENT_BRIEFING_SCHEMA_VERSION,
    documentId: hasSource
      ? computeDocumentContentHash(content)
      : `ephemeral:${filename}`,
    filename,
    mime: mimeType || null,
    sizeBytes: sizeBytes ?? (hasSource ? content.length : null),
    kind,
    summary: extractSummaryFromAnalysis(analysis),
    keyBlocks: keyBlocks.slice(0, 16),
    limits: extractLimitsFromAnalysis(analysis),
    followUpEligible: Boolean(analysis || keyBlocks.length),
    lastAnalysisKind: analysisKind,
    analyzedAt: new Date().toISOString(),
    analysisRichness: richness,
    lastAnalysisExcerpt: analysis ? analysis.slice(0, 4000) : null,
  };
}

/**
 * @param {DocumentBriefing|null|undefined} briefing
 */
export function serializeDocumentBriefingForLlm(briefing) {
  if (!briefing) return "";

  const parts = [
    "=== ARTEFACT DE LECTURE (document_briefing — pas de pièce jointe brute) ===",
    JSON.stringify(
      {
        documentId: briefing.documentId,
        filename: briefing.filename,
        mime: briefing.mime,
        kind: briefing.kind,
        summary: briefing.summary,
        keyBlocks: briefing.keyBlocks,
        limits: briefing.limits,
        followUpEligible: briefing.followUpEligible,
        lastAnalysisKind: briefing.lastAnalysisKind,
        analysisRichness: briefing.analysisRichness,
      },
      null,
      2,
    ),
  ];

  if (briefing.lastAnalysisExcerpt?.trim()) {
    parts.push("\n--- SYNTHÈSE ANALYTIQUE (tour précédent) ---\n");
    parts.push(briefing.lastAnalysisExcerpt.trim().slice(0, 6000));
  }

  const snippets = (briefing.keyBlocks || [])
    .filter((b) => b.snippet?.trim())
    .slice(0, 4);
  if (snippets.length) {
    parts.push("\n--- EXTRAITS CIBLÉS (pointeurs) ---\n");
    for (const block of snippets) {
      parts.push(`\n[${block.selector || block.label} @ L${block.lineStart || "?"}]\n`);
      parts.push(block.snippet.trim());
    }
  }

  return parts.join("\n");
}

/**
 * @param {string} analysis
 * @param {string} fileName
 */
export function buildDocumentBriefingFromAnalysisOnly(analysis = "", fileName = "document") {
  return buildDocumentBriefing({
    fileName,
    sourceContent: null,
    analysisText: analysis,
    analysisKind: "document_analysis",
    analysisRichness: "analysis_only",
  });
}

/**
 * @param {DocumentBriefing|null|undefined} briefing
 */
export function hasReusableDocumentBriefing(briefing) {
  if (!briefing?.followUpEligible) return false;
  return Boolean(
    briefing.summary?.trim() ||
      briefing.keyBlocks?.length ||
      briefing.lastAnalysisExcerpt?.trim(),
  );
}

/**
 * Demande nécessitant le fichier brut (re-ingestion).
 * @param {string} query
 * @param {DocumentBriefing|null|undefined} briefing
 */
export function needsRawDocumentReingest(query = "", briefing = null) {
  const q = String(query || "").toLowerCase();

  if (
    /\b(ligne\s+\d+|ligne par ligne|réécris tout|reecris tout|fichier modifié|fichier modifie|nouvelle version du fichier|re-analys(e|er) le fichier|contenu brut|texte intégral|texte integral)\b/.test(
      q,
    )
  ) {
    return true;
  }

  if (briefing?.analysisRichness === "analysis_only") {
    if (/\b(cite exactement|réécris ce bloc|reecris ce bloc|copie le code|mot pour mot)\b/.test(q)) {
      return true;
    }
  }

  return false;
}

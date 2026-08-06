/**
 * P2/P3 — Validation post-compose FACTUAL_RESEARCH (sections + citations + longueur + ancrage).
 */
import {
  FACTUAL_RESEARCH_MIN_SOURCES,
  buildFactualResearchNoSourcesReply,
  countFactualResearchSources,
  isFactualResearchSourcedReportPath,
  scoreFactualResearchRecency,
} from "./factualResearchDeliverablePolicy.js";
import {
  buildWebEvidenceGroundedFallback,
  ensureExplicitWebSourceLinks,
  extractWebSourcesFromPacket,
} from "./webEvidenceFidelityValidator.js";

export const FACTUAL_RESEARCH_SOFT_MAX_WORDS = 2000;

/** Accept titres P3 courts + variantes P2. */
const SECTION_CHECKS = [
  {
    id: "resume",
    re: /#{1,3}\s*r[eé]sum[eé](?:\s+ex[eé]cutif)?/i,
  },
  { id: "marche", re: /#{1,3}\s*analyse\s+de\s+march[eé]/i },
  { id: "concurrence", re: /#{1,3}\s*analyse\s+concurrentielle/i },
  {
    id: "opportunites",
    re: /#{1,3}\s*opportunit[eé]s(?:\s+de\s+croissance)?/i,
  },
  { id: "sources", re: /#{1,3}\s*sources\b|\*\*sources\*\*/i },
];

const BRIDGED_DISCLAIMER_RE =
  /\b(?:je n['']?ai pas pu v[eé]rifier|connaissances?\s+de\s+base|comparaison\s+qualitative|qui peuvent avoir [eé]volu[eé])\b/i;

const CITATION_RE =
  /\[\d+\]|https?:\/\/\S+|\[web:\d+\]|\*\*sources\*\*|#{1,3}\s*sources\b/i;

/** Chiffres métier (pas numérotation [1] seule). */
const FIGURE_RE =
  /\d+(?:[.,]\d+)?\s*(?:%|٪|M€|Md€|mds?|€|USD|\$)|(?:\d+(?:[.,]\d+)?\s*)?(?:milliards?|millions?|euros?)\b|\b(?:20[2-3]\d)\b|\b\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?\b/i;

function sentenceHasBusinessFigure(sentence = "") {
  return FIGURE_RE.test(String(sentence || ""));
}

/**
 * @param {string} text
 * @returns {{ present: string[], missing: string[] }}
 */
export function detectFactualResearchSections(text = "") {
  const raw = String(text || "");
  const present = [];
  const missing = [];
  for (const row of SECTION_CHECKS) {
    if (row.re.test(raw)) present.push(row.id);
    else missing.push(row.id);
  }
  return { present, missing };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function detectsFactualResearchCitations(text = "") {
  return CITATION_RE.test(String(text || ""));
}

/**
 * @param {string} text
 * @returns {number}
 */
export function countWords(text = "") {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {string} headingLine
 * @returns {string|null}
 */
function sectionIdFromHeading(headingLine = "") {
  const line = String(headingLine || "").trim();
  for (const row of SECTION_CHECKS) {
    if (row.re.test(line)) return row.id;
  }
  return null;
}

/**
 * Dedup : si heading répété, garder le premier corps.
 * @param {string} text
 * @returns {{ text: string, deduped: boolean }}
 */
export function dedupeFactualResearchSections(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return { text: raw, deduped: false };

  const lines = raw.split(/\n/);
  const blocks = [];
  let current = { id: null, heading: null, body: [] };

  const flush = () => {
    if (current.heading || current.body.length) {
      blocks.push(current);
    }
    current = { id: null, heading: null, body: [] };
  };

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line.trim()) || /^\*\*sources\*\*$/i.test(line.trim())) {
      flush();
      current = {
        id: sectionIdFromHeading(line),
        heading: line,
        body: [],
      };
      continue;
    }
    current.body.push(line);
  }
  flush();

  const seen = new Set();
  const kept = [];
  let deduped = false;
  for (const block of blocks) {
    if (block.id && seen.has(block.id)) {
      deduped = true;
      continue;
    }
    if (block.id) seen.add(block.id);
    kept.push(block);
  }

  const textOut = kept
    .map((b) => {
      const parts = [];
      if (b.heading) parts.push(b.heading);
      if (b.body.length) parts.push(b.body.join("\n"));
      return parts.join("\n");
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: textOut, deduped };
}

/**
 * @param {string} sentence
 * @returns {boolean}
 */
function sentenceHasCitation(sentence = "") {
  return /\[\d+\]|https?:\/\/\S+/i.test(sentence);
}

/**
 * Retire les phrases chiffrées sans citation locale.
 * @param {string} text
 * @returns {{ text: string, removed: number }}
 */
export function stripUnanchoredFigures(text = "") {
  const raw = String(text || "");
  if (!raw.trim()) return { text: raw, removed: 0 };

  // Ne pas toucher la section Sources
  const sourcesSplit = raw.split(/(?=^#{1,3}\s*sources\b|^\*\*sources\*\*)/im);
  const main = sourcesSplit[0] || "";
  const sourcesTail = sourcesSplit.slice(1).join("");

  const sentences = main.split(/(?<=[.!?…])\s+|\n+/);
  let removed = 0;
  const kept = [];

  for (const sentence of sentences) {
    const s = String(sentence || "");
    if (!s.trim()) {
      kept.push(s);
      continue;
    }
    if (/^#{1,3}\s+/.test(s.trim()) || /^\*\*/.test(s.trim())) {
      kept.push(s);
      continue;
    }

    if (sentenceHasBusinessFigure(s) && !sentenceHasCitation(s)) {
      removed += 1;
      continue;
    }
    kept.push(s);
  }

  // Rejoindre en préservant un peu la structure (paragraphes)
  let rebuilt = kept.join(" ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  // Remettre les headings sur leur ligne si collés
  rebuilt = rebuilt
    .replace(/\s+(#{1,3}\s+)/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const out = sourcesTail ? `${rebuilt}\n\n${sourcesTail.trim()}` : rebuilt;
  return { text: out, removed };
}

/**
 * Soft-cap mots : réduit les sections (sauf Sources) proportionnellement.
 * @param {string} text
 * @param {number} [maxWords]
 * @returns {{ text: string, truncated: boolean, wordCount: number }}
 */
export function softCapFactualResearchLength(
  text = "",
  maxWords = FACTUAL_RESEARCH_SOFT_MAX_WORDS,
) {
  const raw = String(text || "").trim();
  const wc = countWords(raw);
  if (wc <= maxWords) {
    return { text: raw, truncated: false, wordCount: wc };
  }

  const { text: deduped } = dedupeFactualResearchSections(raw);
  const parts = deduped.split(/(?=^#{1,3}\s+)/m).filter(Boolean);
  const sourcesIdx = parts.findIndex((p) => /^#{1,3}\s*sources\b/i.test(p.trim()));
  const sourcesBlock =
    sourcesIdx >= 0 ? parts[sourcesIdx].trim() : "";
  const bodyParts = parts.filter((_, i) => i !== sourcesIdx);

  const sourcesWords = countWords(sourcesBlock);
  let budget = Math.max(400, maxWords - sourcesWords - 20);

  const trimmedBodies = bodyParts.map((block) => {
    const lines = block.split("\n");
    const heading = lines[0] || "";
    const body = lines.slice(1).join("\n").trim();
    const bodyWords = body.split(/\s+/).filter(Boolean);
    const share = Math.max(
      40,
      Math.floor(budget / Math.max(1, bodyParts.length)),
    );
    if (bodyWords.length <= share) return block.trim();
    const cut = bodyWords.slice(0, share).join(" ").trim();
    return `${heading}\n${cut}${cut.endsWith(".") ? "" : "…"}`.trim();
  });

  const out = [...trimmedBodies, sourcesBlock].filter(Boolean).join("\n\n").trim();
  return {
    text: out,
    truncated: true,
    wordCount: countWords(out),
  };
}

/**
 * @param {string} text
 * @param {object} packet
 * @param {{ query?: string }} [options]
 * @returns {{
 *   valid: boolean,
 *   issues: string[],
 *   sanitized: string,
 *   sourceCount: number,
 *   sections: { present: string[], missing: string[] },
 *   recency: { recentCount: number, total: number, ratio: number },
 *   wordCount: number,
 * }}
 */
export function validateFactualResearchReply(
  text = "",
  packet = {},
  { query = "" } = {},
) {
  const q = query || packet.user_query || "";
  const sourceCount = countFactualResearchSources(packet);
  const sources = extractWebSourcesFromPacket(packet);
  const recency = scoreFactualResearchRecency(sources);
  const sections = detectFactualResearchSections(text);
  let sanitized = String(text || "").trim();
  const issues = [];

  if (!isFactualResearchSourcedReportPath(q, packet)) {
    return {
      valid: true,
      issues,
      sanitized,
      sourceCount,
      sections,
      recency,
      wordCount: countWords(sanitized),
    };
  }

  if (sourceCount === 0) {
    issues.push("no_sources");
    sanitized = buildFactualResearchNoSourcesReply(
      q,
      packet?.meta?.web_failure_mode || null,
    );
    return {
      valid: false,
      issues,
      sanitized,
      sourceCount,
      sections,
      recency,
      wordCount: countWords(sanitized),
    };
  }

  if (sourceCount < FACTUAL_RESEARCH_MIN_SOURCES) {
    issues.push("below_min_sources");
  }

  const dedup = dedupeFactualResearchSections(sanitized);
  if (dedup.deduped) {
    issues.push("duplicate_sections");
    sanitized = dedup.text;
  }

  const unanchored = stripUnanchoredFigures(sanitized);
  if (unanchored.removed > 0) {
    issues.push("unanchored_figure");
    sanitized = unanchored.text;
  }

  const afterSections = detectFactualResearchSections(sanitized);
  if (afterSections.missing.length > 0) {
    issues.push(`missing_sections:${afterSections.missing.join(",")}`);
  }

  if (!detectsFactualResearchCitations(sanitized)) {
    issues.push("missing_citations");
  }

  if (BRIDGED_DISCLAIMER_RE.test(sanitized) && sourceCount > 0) {
    issues.push("bridged_disclaimer_with_evidence");
    sanitized = sanitized
      .replace(BRIDGED_DISCLAIMER_RE, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (issues.includes("missing_citations") || afterSections.missing.includes("sources")) {
    sanitized = ensureExplicitWebSourceLinks(sanitized, packet, { force: true });
  }

  if (
    afterSections.missing.filter((id) => id !== "sources").length >= 3 &&
    sourceCount >= FACTUAL_RESEARCH_MIN_SOURCES
  ) {
    issues.push("structure_collapsed");
    sanitized = buildWebEvidenceGroundedFallback(packet, q);
    sanitized = ensureExplicitWebSourceLinks(sanitized, packet, { force: true });
  }

  const lengthCap = softCapFactualResearchLength(sanitized);
  if (lengthCap.truncated) {
    issues.push("over_length");
    sanitized = lengthCap.text;
  }

  const finalSections = detectFactualResearchSections(sanitized);
  const hasCitations = detectsFactualResearchCitations(sanitized);
  const stillBridged =
    BRIDGED_DISCLAIMER_RE.test(sanitized) && sourceCount > 0;
  const wordCount = countWords(sanitized);
  const valid =
    sourceCount >= FACTUAL_RESEARCH_MIN_SOURCES &&
    hasCitations &&
    finalSections.missing.length <= 1 &&
    !stillBridged &&
    wordCount <= FACTUAL_RESEARCH_SOFT_MAX_WORDS + 50;

  return {
    valid,
    issues,
    sanitized,
    sourceCount,
    sections: finalSections,
    recency,
    wordCount,
  };
}

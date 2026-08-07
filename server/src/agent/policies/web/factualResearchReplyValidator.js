/**
 * P2–P5 — Validation post-compose FACTUAL_RESEARCH (titres exacts + chiffres + aveu).
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
import {
  evidenceHasKeyFigures,
  replyHasKeyFigures,
  sourcesHaveHardSector,
  FACTUAL_RESEARCH_METRICS_ADMISSION,
} from "./factualResearchSourceRankPolicy.js";

export const FACTUAL_RESEARCH_SOFT_MAX_WORDS = 2000;

/** Titres canoniques P5 — exacts (casse incluse). */
export const FACTUAL_RESEARCH_EXACT_HEADINGS = [
  "## Résumé Exécutif",
  "## Analyse de Marché",
  "## Analyse Concurrentielle",
  "## Opportunités de Croissance",
  "## Sources",
];

/** Match flou → id section (pour remap vers exact). */
const SECTION_CHECKS = [
  {
    id: "resume",
    exact: "## Résumé Exécutif",
    re: /#{1,3}\s*r[eé]sum[eé](?:\s+ex[eé]cuti[fv]e?)?/i,
  },
  {
    id: "marche",
    exact: "## Analyse de Marché",
    re: /#{1,3}\s*(?:analyse\s+(?:du\s+|de\s+)?march[eé]|analyse\s+de\s+march[eé])/i,
  },
  {
    id: "concurrence",
    exact: "## Analyse Concurrentielle",
    re: /#{1,3}\s*analyse\s+concurrentielle/i,
  },
  {
    id: "opportunites",
    exact: "## Opportunités de Croissance",
    re: /#{1,3}\s*opportunit[eé]s(?:\s+de\s+croissance)?/i,
  },
  {
    id: "sources",
    exact: "## Sources",
    re: /#{1,3}\s*sources\b|\*\*sources\*\*/i,
  },
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
 * @param {string} text
 * @returns {boolean}
 */
export function hasExactCanonicalHeadings(text = "") {
  const raw = String(text || "");
  return FACTUAL_RESEARCH_EXACT_HEADINGS.every((h) =>
    new RegExp(`^${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(raw),
  );
}

/**
 * Sépare un titre exact collé au corps : `## TitreTexte` → `## Titre\nTexte`.
 * @param {string} text
 * @returns {string}
 */
export function ensureCanonicalHeadingLineBreaks(text = "") {
  let out = String(text || "");
  for (const h of FACTUAL_RESEARCH_EXACT_HEADINGS) {
    const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(${escaped})(?=\\S)`, "g"), "$1\n");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Remap titres flous / P3-P4 vers titres P5 exacts.
 * @param {string} text
 * @returns {{ text: string, remapped: boolean }}
 */
export function canonicalizeFactualResearchHeadings(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return { text: raw, remapped: false };

  const lines = raw.split(/\n/);
  let remapped = false;
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\*\*sources\*\*$/i.test(trimmed)) {
      remapped = true;
      out.push("## Sources");
      continue;
    }
    if (!/^#{1,3}\s+/.test(trimmed)) {
      out.push(line);
      continue;
    }

    let matched = false;
    for (const row of SECTION_CHECKS) {
      if (!row.re.test(trimmed)) continue;
      matched = true;
      if (trimmed !== row.exact) remapped = true;
      out.push(row.exact);
      // Corps collé sur la même ligne que le heading flou
      const afterHash = trimmed.replace(/^#{1,3}\s+/, "");
      const exactBare = row.exact.replace(/^##\s+/, "");
      const bareRe = new RegExp(
        `^${exactBare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i",
      );
      const fuzzyBare = afterHash.replace(bareRe, "").replace(
        /^(r[eé]sum[eé](?:\s+ex[eé]cuti[fv]e?)?|analyse\s+(?:du\s+|de\s+)?march[eé]|analyse\s+concurrentielle|opportunit[eé]s(?:\s+de\s+croissance)?|sources)\s*/i,
        "",
      );
      if (fuzzyBare.trim()) {
        remapped = true;
        out.push(fuzzyBare.trim());
      }
      break;
    }
    if (!matched) out.push(line);
  }

  const joined = ensureCanonicalHeadingLineBreaks(
    out.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  );
  return { text: joined, remapped };
}

/**
 * Injecte l'aveu métriques dans le Résumé Exécutif si absent.
 * @param {string} text
 * @returns {{ text: string, injected: boolean }}
 */
export function injectMetricsAdmissionParagraph(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return { text: raw, injected: false };
  if (raw.includes(FACTUAL_RESEARCH_METRICS_ADMISSION)) {
    return { text: raw, injected: false };
  }

  const canon = canonicalizeFactualResearchHeadings(raw).text;
  const marker = "## Résumé Exécutif";
  const idx = canon.indexOf(marker);
  if (idx < 0) {
    return {
      text: `${marker}\n${FACTUAL_RESEARCH_METRICS_ADMISSION}\n\n${canon}`.trim(),
      injected: true,
    };
  }

  const afterHeading = idx + marker.length;
  const rest = canon.slice(afterHeading);
  const nextHeading = rest.search(/\n##\s/);
  const body = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  const tail = nextHeading >= 0 ? rest.slice(nextHeading) : "";
  const newBody = `${body.trim()}\n\n${FACTUAL_RESEARCH_METRICS_ADMISSION}\n`;
  return {
    text: `${canon.slice(0, afterHeading)}${newBody}${tail}`.replace(/\n{3,}/g, "\n\n").trim(),
    injected: true,
  };
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

  // Rejoindre en préservant headings sur leur propre ligne
  const chunks = [];
  for (const sentence of kept) {
    const s = String(sentence || "").trim();
    if (!s) continue;
    if (/^#{1,3}\s+/.test(s) || /^\*\*/.test(s)) {
      chunks.push({ type: "h", s });
    } else {
      chunks.push({ type: "p", s });
    }
  }
  let rebuilt = "";
  for (const c of chunks) {
    if (c.type === "h") {
      rebuilt += `${rebuilt ? "\n\n" : ""}${c.s}`;
    } else {
      rebuilt += rebuilt && !rebuilt.endsWith("\n") ? ` ${c.s}` : c.s;
    }
  }
  rebuilt = ensureCanonicalHeadingLineBreaks(rebuilt);

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

  if (!hasExactCanonicalHeadings(sanitized)) {
    issues.push("non_canonical_headings");
    const canon = canonicalizeFactualResearchHeadings(sanitized);
    sanitized = canon.text;
  }

  const dedup = dedupeFactualResearchSections(sanitized);
  if (dedup.deduped) {
    issues.push("duplicate_sections");
    sanitized = dedup.text;
  }

  // Re-canon après dedup (headings peuvent être réécrits)
  {
    const canon = canonicalizeFactualResearchHeadings(sanitized);
    if (canon.remapped) sanitized = canon.text;
  }

  const unanchored = stripUnanchoredFigures(sanitized);
  if (unanchored.removed > 0) {
    issues.push("unanchored_figure");
    sanitized = unanchored.text;
    sanitized = canonicalizeFactualResearchHeadings(sanitized).text;
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
    sanitized = canonicalizeFactualResearchHeadings(sanitized).text;
  }

  if (
    afterSections.missing.filter((id) => id !== "sources").length >= 3 &&
    sourceCount >= FACTUAL_RESEARCH_MIN_SOURCES
  ) {
    issues.push("structure_collapsed");
    sanitized = buildWebEvidenceGroundedFallback(packet, q);
    sanitized = ensureExplicitWebSourceLinks(sanitized, packet, { force: true });
    sanitized = canonicalizeFactualResearchHeadings(sanitized).text;
  }

  const lengthCap = softCapFactualResearchLength(sanitized);
  if (lengthCap.truncated) {
    issues.push("over_length");
    sanitized = lengthCap.text;
    sanitized = canonicalizeFactualResearchHeadings(sanitized).text;
  }

  const evidenceSources = [
    ...sources.map((s) => ({
      url: s.url,
      title: s.title,
      snippet: s.snippet || s.excerpt,
    })),
    ...(packet.evidence || []).map((e) => ({
      url: e.source,
      snippet: e.excerpt,
      title: "",
    })),
  ];
  const evidenceHadFigures =
    packet?.meta?.factual_research_evidence_has_figures === true ||
    evidenceHasKeyFigures(evidenceSources);
  const hardSector =
    packet?.meta?.factual_research_hard_sector === true ||
    sourcesHaveHardSector(evidenceSources);
  const replyFigures = replyHasKeyFigures(sanitized);

  if (evidenceHadFigures && !replyFigures) {
    issues.push("missing_key_figures");
  } else if (!evidenceHadFigures && !replyFigures && !hardSector) {
    issues.push("missing_key_figures");
    const admission = injectMetricsAdmissionParagraph(sanitized);
    if (admission.injected) {
      issues.push("metrics_admission_injected");
      sanitized = admission.text;
    }
  } else if (
    !evidenceHadFigures &&
    !replyFigures &&
    packet?.meta?.factual_research_needs_metrics_admission
  ) {
    const admission = injectMetricsAdmissionParagraph(sanitized);
    if (admission.injected) {
      issues.push("metrics_admission_injected");
      sanitized = admission.text;
    }
  }

  sanitized = ensureCanonicalHeadingLineBreaks(
    canonicalizeFactualResearchHeadings(sanitized).text,
  );

  // P7 — soft structure (n'invalide pas seul)
  if (!/\|\s*Acteur|\|[^\n]*\|[^\n]*\|/i.test(sanitized)) {
    issues.push("missing_competitive_table");
  }
  if (!/(?:^|\n)\s*1\.\s+/.test(sanitized) || !/(?:^|\n)\s*2\.\s+/.test(sanitized)) {
    issues.push("missing_opportunity_ranking");
  }

  const finalSections = detectFactualResearchSections(sanitized);
  const exactHeadings = hasExactCanonicalHeadings(sanitized);
  if (!exactHeadings) {
    if (!issues.includes("non_canonical_headings")) {
      issues.push("non_canonical_headings");
    }
  }

  const hasCitations = detectsFactualResearchCitations(sanitized);
  const stillBridged =
    BRIDGED_DISCLAIMER_RE.test(sanitized) && sourceCount > 0;
  const wordCount = countWords(sanitized);
  const valid =
    sourceCount >= FACTUAL_RESEARCH_MIN_SOURCES &&
    hasCitations &&
    exactHeadings &&
    finalSections.missing.length === 0 &&
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

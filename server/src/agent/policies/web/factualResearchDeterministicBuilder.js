/**
 * P7 — Builder déterministe FACTUAL_RESEARCH (squelette P5, pas de prose LLM).
 */
import {
  FACTUAL_RESEARCH_MIN_SOURCES,
  countFactualResearchSources,
  isFactualResearchSourcedReportPath,
} from "./factualResearchDeliverablePolicy.js";
import {
  evidenceHasKeyFigures,
  FACTUAL_RESEARCH_METRICS_ADMISSION,
  replyHasKeyFigures,
} from "./factualResearchSourceRankPolicy.js";

/** Aligné P5 — évite import circulaire avec le validator. */
const EXACT_HEADINGS = [
  "## Résumé Exécutif",
  "## Analyse de Marché",
  "## Analyse Concurrentielle",
  "## Opportunités de Croissance",
  "## Sources",
];

/**
 * @param {object} packet
 * @returns {Array<{ url: string, title: string, snippet: string }>}
 */
export function collectFactualBuilderSources(packet = {}) {
  const fromEvidence = (packet.evidence || [])
    .filter((e) => /^https?:\/\//i.test(String(e?.source || "")))
    .map((e) => ({
      url: String(e.source).trim(),
      title: String(e.title || "").trim(),
      snippet: String(e.excerpt || e.snippet || "").replace(/\s+/g, " ").trim(),
    }));
  if (fromEvidence.length > 0) return fromEvidence;

  // Fallback : lignes du résumé web « - title: url »
  const web = (packet.expert_outputs || []).find(
    (o) => o?.stage === "web_research" && o?.content,
  );
  if (!web?.content) return [];
  const rows = [];
  for (const line of String(web.content).split(/\n/)) {
    const m = line.match(/https?:\/\/\S+/i);
    if (!m) continue;
    const url = m[0].replace(/[),.;]+$/, "");
    const title = line
      .replace(m[0], "")
      .replace(/^[-*•]\s*/, "")
      .replace(/[:：]\s*$/, "")
      .trim()
      .slice(0, 120);
    rows.push({ url, title, snippet: title });
  }
  return rows;
}

function hostLabel(url = "") {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h;
  } catch {
    return "source";
  }
}

function cite(i) {
  return `[${i + 1}]`;
}

function pickSnippet(s, max = 180) {
  const t = String(s?.snippet || s?.title || "").trim();
  if (!t) return "Signal qualitatif relevé dans la source.";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * @param {string} query
 * @param {object} packet
 * @returns {{ ok: boolean, text: string, path: string, sourceCount: number }}
 */
export function buildFactualResearchDeterministicReport(query = "", packet = {}) {
  if (!isFactualResearchSourcedReportPath(query, packet)) {
    return { ok: false, text: "", path: "skipped_not_factual", sourceCount: 0 };
  }

  const sources = collectFactualBuilderSources(packet);
  const sourceCount = sources.length || countFactualResearchSources(packet);
  if (sourceCount < FACTUAL_RESEARCH_MIN_SOURCES) {
    return {
      ok: false,
      text: "",
      path: "skipped_insufficient_sources",
      sourceCount,
    };
  }

  const list = sources.slice(0, 10);
  const hasFigures = evidenceHasKeyFigures(list);
  const focus = String(query || packet.user_query || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const resumeBits = list
    .slice(0, 3)
    .map((s, i) => `${pickSnippet(s, 140)} ${cite(i)}`)
    .join(" ");

  const resumeBody = [
    `Synthèse ancrée sur ${list.length} sources web pour : ${focus || "la demande"}.`,
    resumeBits,
    hasFigures
      ? "Des métriques chiffrées apparaissent dans les preuves ci-dessous ; elles sont reprises uniquement lorsqu'elles sont citables."
      : FACTUAL_RESEARCH_METRICS_ADMISSION,
  ].join("\n\n");

  const marcheBullets = list
    .slice(0, 5)
    .map((s, i) => `- ${pickSnippet(s, 160)} ${cite(i)}`)
    .join("\n");

  const tableHeader =
    "| Acteur / source | Signal concurrentiel | Preuve |\n|---|---|---|";
  const tableRows = list
    .slice(0, 6)
    .map((s, i) => {
      const actor = (s.title || hostLabel(s.url)).replace(/\|/g, "/").slice(0, 48);
      const signal = pickSnippet(s, 90).replace(/\|/g, "/");
      return `| ${actor} | ${signal} | ${cite(i)} |`;
    })
    .join("\n");

  const oppThemes = [
    {
      title: "Différenciation éditoriale",
      hint: "catalogue / auteur / formats courts",
    },
    {
      title: "Fenêtre locale vs géants",
      hint: "usages FR / fragmentation SVOD",
    },
    {
      title: "Preuve traction pour Série A",
      hint: "modèle économique justifiable",
    },
  ];
  const opportunities = oppThemes
    .map((t, idx) => {
      const src = list[idx % list.length];
      return `${idx + 1}. **${t.title}** — prioriser autour de « ${t.hint} », ancré sur ${cite(idx % list.length)} (${pickSnippet(src, 100)}).`;
    })
    .join("\n");

  const sourcesBlock = list
    .map((s, i) => {
      const title = s.title || hostLabel(s.url);
      return `${i + 1}. ${title} — ${s.url}`;
    })
    .join("\n");

  const [hResume, hMarche, hConcurrence, hOpp, hSources] = EXACT_HEADINGS;

  const text = [
    hResume,
    resumeBody,
    "",
    hMarche,
    marcheBullets,
    "",
    hConcurrence,
    tableHeader,
    tableRows,
    "",
    hOpp,
    opportunities,
    "",
    hSources,
    sourcesBlock,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const structuralOk =
    text.includes("| Acteur / source |") &&
    /\n1\.\s+\*\*/.test(`\n${opportunities}`) &&
    list.length >= FACTUAL_RESEARCH_MIN_SOURCES;

  return {
    ok: structuralOk,
    text,
    path: "factual_deterministic_builder",
    sourceCount: list.length,
    hasFigures: replyHasKeyFigures(text) || hasFigures,
  };
}

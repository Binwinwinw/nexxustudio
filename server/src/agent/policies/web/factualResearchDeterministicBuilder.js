/**
 * P7/P7.1 — Builder déterministe FACTUAL_RESEARCH (squelette P5, pas de prose LLM).
 */
import {
  FACTUAL_RESEARCH_MIN_SOURCES,
  countFactualResearchSources,
  isFactualResearchSourcedReportPath,
  resolveFactualResearchOutputShape,
  FACTUAL_RESEARCH_SHAPE_SOURCED_BRIEF,
} from "./factualResearchDeliverablePolicy.js";
import {
  evidenceHasKeyFigures,
  FACTUAL_RESEARCH_METRICS_ADMISSION,
  replyHasKeyFigures,
} from "./factualResearchSourceRankPolicy.js";
import {
  assessFactualSourcesTopicMatch,
  buildOpportunityThemesFromBrief,
  sourceMatchesTopic,
  FACTUAL_RESEARCH_TOPIC_MATCH_MIN,
} from "./factualResearchTopicMatchPolicy.js";

/** Aligné P5 — évite import circulaire avec le validator. */
const EXACT_HEADINGS = [
  "## Résumé Exécutif",
  "## Analyse de Marché",
  "## Analyse Concurrentielle",
  "## Opportunités de Croissance",
  "## Sources",
];

const INDIRECT_LIMITS =
  "Limites : sources insuffisamment alignées sur le brief (ou trop peu nombreuses) ; les entrées marquées « indirectes » ne doivent pas être lues comme preuves sectorielles directes. Aucun chiffre inventé.";

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
    return new URL(url).hostname.replace(/^www\./, "");
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
 * @returns {{
 *   ok: boolean,
 *   text: string,
 *   path: string,
 *   sourceCount: number,
 *   builder_triggered: boolean,
 *   sources_topic_match: number,
 *   fallback: boolean,
 *   hasFigures?: boolean,
 * }}
 */
function buildSourcedBriefText(list) {
  const top = list.slice(0, 5);
  const leadBits = top
    .map((s) => pickSnippet(s, 140))
    .filter(Boolean)
    .slice(0, 2);
  const lead =
    leadBits.length > 0
      ? `D'après les sources retenues, ${leadBits[0]}${leadBits[1] ? ` ${leadBits[1]}` : ""}`
      : "Les sources retenues donnent un aperçu utile, sans dossier de marché.";
  const points = top
    .map((s, i) => `- ${pickSnippet(s, 120)} ${cite(i)}`)
    .join("\n");
  const sourcesBlock = list
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.title || hostLabel(s.url)} — ${s.url}`)
    .join("\n");
  return [
    lead,
    "",
    points,
    "",
    "Limites : aperçu pratique à partir des sources ci-dessous ; à vérifier sur le site officiel avant une installation.",
    "",
    "Sources :",
    sourcesBlock,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildFactualResearchDeterministicReport(query = "", packet = {}) {
  if (!isFactualResearchSourcedReportPath(query, packet)) {
    return {
      ok: false,
      text: "",
      path: "skipped_not_factual",
      sourceCount: 0,
      builder_triggered: false,
      sources_topic_match: 0,
      fallback: false,
    };
  }

  const sources = collectFactualBuilderSources(packet);
  const sourceCount = sources.length || countFactualResearchSources(packet);
  const list = sources.slice(0, 10);
  const topic = assessFactualSourcesTopicMatch(query, list);
  const shape = resolveFactualResearchOutputShape(query);

  if (shape === FACTUAL_RESEARCH_SHAPE_SOURCED_BRIEF) {
    if (list.length === 0) {
      return {
        ok: false,
        text: "",
        path: "skipped_sourced_brief_no_sources",
        sourceCount: 0,
        builder_triggered: false,
        sources_topic_match: topic.matchCount,
        fallback: true,
        shape,
      };
    }
    const text = buildSourcedBriefText(list);
    return {
      ok: true,
      text,
      path: "factual_deterministic_builder_sourced_brief",
      sourceCount: list.length || sourceCount,
      builder_triggered: true,
      sources_topic_match: topic.matchCount,
      fallback: false,
      shape,
      hasFigures: replyHasKeyFigures(text),
    };
  }

  const matched = list.filter((s) => sourceMatchesTopic(s, topic.keywords));
  const unmatched = list.filter((s) => !sourceMatchesTopic(s, topic.keywords));

  const fallback =
    list.length < FACTUAL_RESEARCH_MIN_SOURCES ||
    topic.matchCount < FACTUAL_RESEARCH_TOPIC_MATCH_MIN;

  const primary =
    matched.length > 0 ? matched : fallback ? [] : list;
  const tableSources =
    primary.length > 0 ? primary.slice(0, 6) : list.slice(0, 6);

  const hasFigures = evidenceHasKeyFigures(
    primary.length > 0 ? primary : list,
  );
  const focus = String(query || packet.user_query || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const limitsLine = fallback
    ? INDIRECT_LIMITS
    : hasFigures
      ? "Des métriques chiffrées apparaissent dans les preuves ci-dessous ; elles sont reprises uniquement lorsqu'elles sont citables."
      : FACTUAL_RESEARCH_METRICS_ADMISSION;

  // Résumé = cadrage court. Les extraits sources vivent UNE fois dans Analyse de Marché
  // (évite le doublon Résumé = collage des mêmes snippets que Marché).
  const hasAnySource = (primary.length > 0 ? primary : list).length > 0;
  const resumeBody = [
    `Synthèse ancrée sur ${list.length} source(s) web pour : ${focus || "la demande"}.`,
    `Alignement brief : ${topic.matchCount}/${FACTUAL_RESEARCH_TOPIC_MATCH_MIN} source(s) thématiques.`,
    hasAnySource
      ? "Les signaux retenus sont détaillés une seule fois dans les sections Marché, Concurrence et Sources."
      : "Aucune source web directement exploitable n'a pu être retenue pour ce brief.",
    limitsLine,
  ].join("\n\n");

  const marcheBullets =
    (primary.length > 0 ? primary : list).length > 0
      ? (primary.length > 0 ? primary : list)
          .slice(0, 5)
          .map((s, i) => `- ${pickSnippet(s, 160)} ${cite(i)}`)
          .join("\n")
      : "- Aucun signal de marché directement aligné sur le brief dans les sources retenues.";

  const tableHeader =
    "| Acteur / source | Signal concurrentiel | Preuve |\n|---|---|---|";
  const tableRows =
    tableSources.length > 0
      ? tableSources
          .map((s, i) => {
            const actor = (s.title || hostLabel(s.url))
              .replace(/\|/g, "/")
              .slice(0, 48);
            const signal = pickSnippet(s, 90).replace(/\|/g, "/");
            const tag =
              fallback && !sourceMatchesTopic(s, topic.keywords)
                ? " (indirect)"
                : "";
            return `| ${actor}${tag} | ${signal} | ${cite(i)} |`;
          })
          .join("\n")
      : "| — | Pas de concurrent direct sourcé | — |";

  const oppThemes = buildOpportunityThemesFromBrief(query, topic.keywords);
  const oppAnchor = primary.length > 0 ? primary : list;
  const opportunities = oppThemes
    .map((t, idx) => {
      const src = oppAnchor[idx % Math.max(oppAnchor.length, 1)];
      if (!src) {
        return `${idx + 1}. **${t.title}** — prioriser « ${t.hint} » (à valider dès que des sources directes seront disponibles).`;
      }
      return `${idx + 1}. **${t.title}** — prioriser autour de « ${t.hint} », ancré sur ${cite(idx % oppAnchor.length)} (${pickSnippet(src, 100)}).`;
    })
    .join("\n");

  const sourcesBlock =
    list.length > 0
      ? list
          .map((s, i) => {
            const title = s.title || hostLabel(s.url);
            const markIndirect =
              fallback &&
              (matched.length === 0 || unmatched.includes(s));
            const mark = markIndirect ? " — *indirecte*" : "";
            return `${i + 1}. ${title}${mark} — ${s.url}`;
          })
          .join("\n")
      : "1. Aucune URL retenue — recherche web infructueuse après retries.";

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
    EXACT_HEADINGS.every((h) => text.includes(h));

  return {
    ok: structuralOk,
    text,
    path: fallback
      ? "factual_deterministic_builder_fallback"
      : "factual_deterministic_builder",
    sourceCount: list.length || sourceCount,
    builder_triggered: structuralOk,
    sources_topic_match: topic.matchCount,
    fallback,
    hasFigures: replyHasKeyFigures(text) || hasFigures,
  };
}

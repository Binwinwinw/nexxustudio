/**
 * Analyse locale des patterns ambigus du tri d'intention.
 * Source : clarification-feedback.jsonl (+ replay triage règles).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getIntentTriageFeedbackPath } from "./intentTriageFeedbackRecorder.js";
import {
  triageUserIntent,
  TRIAGE_CONFIDENCE,
  TRIAGE_ROUTING_ACTION,
  getTriageIntentLabel,
} from "./intentTriageClassifier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../../..");
const REPO_ROOT = path.resolve(SERVER_ROOT, "..");

export const VAULT_REPORTS_DIR = path.join(
  REPO_ROOT,
  "citadelle-vault",
  "Citadelle",
  "04-Operations",
  "reports",
);

export const JSON_REPORTS_DIR = path.join(
  SERVER_ROOT,
  "data",
  "intent-triage",
  "reports",
);

const PAIR_ENRICHMENT_HINTS = Object.freeze({
  "code_review|document_analysis":
    "Renforcer analyse+snippet et pénaliser document_analysis quand du code exécutable est présent.",
  "document_analysis|code_review":
    "Idem — prioriser signaux code_review si verbes extractifs absents.",
  "code_explain|document_analysis":
    "Distinguer « explique » explicite vs « analyse/résume » sur snippet.",
  "document_analysis|code_explain":
    "Vérifier verbes extractifs sans intention code explicite.",
  "code_debug|code_review":
    "Renforcer debug_execution_phrase pour formulations d'exécution.",
  "code_review|code_debug":
    "Affiner gap entre revue structurée et debug incident.",
  "document_analysis|self_analysis":
    "Booster meta_conversation_guard / self_reference_query quand la question porte sur l'assistant.",
  "self_analysis|document_analysis":
    "Pénaliser document_analysis si auto-analyse ou améliorations assistant sans document joint.",
  "document_analysis|general":
    "Vérifier signaux méta-conversation avant routage documentaire ou général.",
});

function parseJsonl(content = "") {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return { ...JSON.parse(line), _line: index + 1 };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function pairKey(top, runnerUp) {
  const a = top || "unknown";
  const b = runnerUp || "none";
  return `${a}|${b}`;
}

function isAmbiguousEntry(entry = {}) {
  return (
    entry.confidence === TRIAGE_CONFIDENCE.LOW ||
    entry.needs_clarification === true ||
    entry.routing_action === TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION
  );
}

function truncate(text = "", max = 120) {
  const value = String(text).replace(/\s+/g, " ").trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function countBy(items = [], keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function topN(mapOrEntries, n = 5) {
  const entries = mapOrEntries instanceof Map
    ? [...mapOrEntries.entries()]
    : mapOrEntries;
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

/**
 * @param {string} [feedbackPath]
 */
export function loadFeedbackEntries(feedbackPath = getIntentTriageFeedbackPath()) {
  if (!fs.existsSync(feedbackPath)) return [];
  return parseJsonl(fs.readFileSync(feedbackPath, "utf8"));
}

/**
 * @param {object[]} entries
 */
export function filterAmbiguousEntries(entries = []) {
  return entries.filter(isAmbiguousEntry);
}

/**
 * @param {object[]} ambiguousEntries
 */
export function aggregateAmbiguousPairs(ambiguousEntries = []) {
  const groups = new Map();

  for (const entry of ambiguousEntries) {
    const key = pairKey(entry.top_intent, entry.runner_up);
    if (!groups.has(key)) {
      groups.set(key, {
        pair: key,
        top_intent: entry.top_intent,
        runner_up: entry.runner_up || null,
        count: 0,
        sample_queries: [],
        signals: new Map(),
        user_replies: new Map(),
        recorded_dates: [],
      });
    }

    const group = groups.get(key);
    group.count += 1;
    if (group.sample_queries.length < 3) {
      group.sample_queries.push(truncate(entry.query, 160));
    }
    for (const signal of entry.signals || []) {
      group.signals.set(signal, (group.signals.get(signal) || 0) + 1);
    }
    const reply = entry.user_reply ? String(entry.user_reply).trim() : "(non résolu)";
    group.user_replies.set(reply, (group.user_replies.get(reply) || 0) + 1);
    if (entry.recorded_at) {
      group.recorded_dates.push(entry.recorded_at.slice(0, 10));
    }
  }

  const total = ambiguousEntries.length || 1;

  return [...groups.values()]
    .map((group) => ({
      pair: group.pair,
      top_intent: group.top_intent,
      runner_up: group.runner_up,
      top_label: getTriageIntentLabel(group.top_intent),
      runner_label: group.runner_up ? getTriageIntentLabel(group.runner_up) : null,
      count: group.count,
      share_pct: Number(((group.count / total) * 100).toFixed(1)),
      sample_queries: group.sample_queries,
      common_signals: topN(group.signals, 6),
      user_replies: topN(group.user_replies, 6),
      rule_enrichment_hint: PAIR_ENRICHMENT_HINTS[group.pair] || null,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * @param {object[]} entries
 * @param {boolean} [ambiguousOnly]
 */
export function aggregateSignalFrequency(entries = [], ambiguousOnly = false) {
  const pool = ambiguousOnly ? filterAmbiguousEntries(entries) : entries;
  const counts = new Map();

  for (const entry of pool) {
    for (const signal of entry.signals || []) {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }

  return topN(counts, 12).map(({ key, count }) => ({
    signal: key,
    count,
  }));
}

/**
 * Replay triage règles sur les entrées feedback pour détecter résolution / dérive.
 * @param {object[]} entries
 */
export function replayTriageOnEntries(entries = []) {
  return entries.map((entry) => {
    const replay = triageUserIntent(entry.query || "");
    const still_ambiguous = isAmbiguousEntry({
      confidence: replay.confidence,
      needs_clarification: replay.needs_clarification,
      routing_action: replay.routing_action,
    });

    return {
      recorded_at: entry.recorded_at,
      stored_top_intent: entry.top_intent,
      stored_confidence: entry.confidence,
      replay_top_intent: replay.top_intent,
      replay_confidence: replay.confidence,
      replay_routing_action: replay.routing_action,
      still_ambiguous,
      resolved_by_rules: !still_ambiguous,
      intent_changed: entry.top_intent !== replay.top_intent,
    };
  });
}

function buildRecommendations({
  ambiguousEntries,
  ambiguousPairs,
  signalFrequency,
  replaySummary,
}) {
  const recommendations = [];

  if (ambiguousEntries.length === 0) {
    recommendations.push({
      priority: "info",
      target: "scoreIntentCandidates",
      hint: "Aucune ambiguïté enregistrée — continuer la collecte terrain via clarifications.",
    });
    return recommendations;
  }

  const topPair = ambiguousPairs[0];
  if (topPair) {
    recommendations.push({
      priority: "high",
      target: "scoreIntentCandidates",
      pair: topPair.pair,
      hint:
        topPair.rule_enrichment_hint ||
        `Paires récurrentes ${topPair.pair} (${topPair.count} cas) — affiner les bumps de score.`,
    });
  }

  const topSignal = signalFrequency[0];
  if (topSignal) {
    recommendations.push({
      priority: "medium",
      target: "scoreIntentCandidates",
      signal: topSignal.signal,
      hint: `Signal dominant « ${topSignal.signal} » (${topSignal.count}×) — vérifier seuils et pénalités croisées.`,
    });
  }

  if (replaySummary.resolved_by_rules > 0) {
    recommendations.push({
      priority: "medium",
      target: "intentTriageGoldenQueries.js",
      hint: `${replaySummary.resolved_by_rules} cas historiques seraient résolus par les règles actuelles — candidats à internalisation golden.`,
    });
  }

  if (replaySummary.intent_changed > 0) {
    recommendations.push({
      priority: "low",
      target: "regression_review",
      hint: `${replaySummary.intent_changed} replays changent top_intent vs enregistrement — vérifier dérive ou enrichissement récent.`,
    });
  }

  return recommendations;
}

function summarizeReplay(replays = []) {
  return {
    total: replays.length,
    still_ambiguous: replays.filter((r) => r.still_ambiguous).length,
    resolved_by_rules: replays.filter((r) => r.resolved_by_rules).length,
    intent_changed: replays.filter((r) => r.intent_changed).length,
  };
}

function formatDateFr(date = new Date()) {
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const aaaa = date.getFullYear();
  return `${jj}/${mm}/${aaaa}`;
}

/**
 * @param {ReturnType<typeof analyzeIntentTriageAmbiguous>} analysis
 */
export function renderAmbiguousTriageMarkdown(analysis) {
  const { summary, confidence_distribution, ambiguous_pairs, signal_frequency, recommendations, replay } =
    analysis;

  const pairRows = ambiguous_pairs
    .map(
      (p) =>
        `| ${p.pair} | ${p.count} | ${p.share_pct}% | ${p.common_signals.map((s) => s.key).join(", ") || "—"} |`,
    )
    .join("\n");

  const signalRows = signal_frequency
    .map((s) => `| ${s.signal} | ${s.count} |`)
    .join("\n");

  const recoBlock = recommendations
    .map((r) => `- **[${r.priority}]** ${r.target} — ${r.hint}`)
    .join("\n");

  const sampleBlock = ambiguous_pairs
    .slice(0, 3)
    .map(
      (p) =>
        `### ${p.pair} (${p.count} cas)\n` +
        (p.sample_queries.map((q, i) => `${i + 1}. « ${q} »`).join("\n") || "_aucun échantillon_"),
    )
    .join("\n\n");

  return `# Rapport Triage Ambigu — ${formatDateFr(new Date(analysis.generated_at))}

**Entrées feedback** : ${summary.entries_total}  
**Cas ambigus** : ${summary.ambiguous_entries} (${summary.ambiguous_rate_pct}%)  
**Paires distinctes** : ${summary.distinct_pairs}  
**Résolus au replay règles** : ${replay.resolved_by_rules}/${replay.total}

## Distribution confiance (toutes entrées)

| Niveau | Nombre |
|---|---:|
| high | ${confidence_distribution.high} |
| medium | ${confidence_distribution.medium} |
| low | ${confidence_distribution.low} |

## Paires ambiguës récurrentes

| Paire top\\|runner | Cas | Part | Signaux communs |
|---|---:|---:|---|
${pairRows || "| — | 0 | — | — |"}

## Signaux fréquents (cas ambigus)

| Signal | Occurrences |
|---|---:|
${signalRows || "| — | 0 |"}

## Recommandations d'enrichissement

${recoBlock || "_Aucune recommandation._"}

## Échantillons terrain

${sampleBlock || "_Aucun échantillon._"}

---
*Généré par \`npm run triage:analyze-ambiguous\` — ${analysis.generated_at}*
`;
}

/**
 * @param {{
 *   feedbackPath?: string,
 *   writeReports?: boolean,
 *   jsonOutputDir?: string,
 *   markdownOutputDir?: string,
 * }} [options]
 */
export function analyzeIntentTriageAmbiguous(options = {}) {
  const feedbackPath = options.feedbackPath || getIntentTriageFeedbackPath();
  const entries = loadFeedbackEntries(feedbackPath);
  const ambiguousEntries = filterAmbiguousEntries(entries);

  const confidence_distribution = {
    high: entries.filter((e) => e.confidence === TRIAGE_CONFIDENCE.HIGH).length,
    medium: entries.filter((e) => e.confidence === TRIAGE_CONFIDENCE.MEDIUM).length,
    low: entries.filter((e) => e.confidence === TRIAGE_CONFIDENCE.LOW).length,
  };

  const ambiguous_pairs = aggregateAmbiguousPairs(ambiguousEntries);
  const signal_frequency = aggregateSignalFrequency(entries, true);
  const replays = replayTriageOnEntries(entries);
  const replay = summarizeReplay(replays);

  const recommendations = buildRecommendations({
    ambiguousEntries,
    ambiguousPairs: ambiguous_pairs,
    signalFrequency: signal_frequency,
    replaySummary: replay,
  });

  const generated_at = new Date().toISOString();
  const dayKey = generated_at.slice(0, 10);

  const analysis = {
    schema_version: "intent_triage_ambiguous_v1",
    generated_at,
    source: {
      feedback_path: feedbackPath,
      entries_total: entries.length,
      ambiguous_entries: ambiguousEntries.length,
    },
    summary: {
      entries_total: entries.length,
      ambiguous_entries: ambiguousEntries.length,
      ambiguous_rate_pct:
        entries.length === 0
          ? 0
          : Number(((ambiguousEntries.length / entries.length) * 100).toFixed(1)),
      distinct_pairs: ambiguous_pairs.length,
    },
    confidence_distribution,
    ambiguous_pairs,
    signal_frequency,
    replay,
    replay_details: replays,
    recommendations,
  };

  if (options.writeReports !== false) {
    const jsonDir = options.jsonOutputDir || JSON_REPORTS_DIR;
    const mdDir = options.markdownOutputDir || VAULT_REPORTS_DIR;
    fs.mkdirSync(jsonDir, { recursive: true });
    fs.mkdirSync(mdDir, { recursive: true });

    const jsonPath = path.join(jsonDir, `ambiguous-analysis-${dayKey}.json`);
    const mdPath = path.join(mdDir, `Rapport-Triage-Ambigu-${dayKey}.md`);

    fs.writeFileSync(jsonPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
    fs.writeFileSync(mdPath, renderAmbiguousTriageMarkdown(analysis), "utf8");

    analysis.output = { jsonPath, markdownPath: mdPath };
  }

  return analysis;
}

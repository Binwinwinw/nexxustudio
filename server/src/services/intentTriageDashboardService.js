/**
 * Agrégation locale pour le dashboard de tri d'intention (JSON-first, sans DB).
 */
import fs from "node:fs";
import path from "node:path";
import {
  analyzeIntentTriageAmbiguous,
  JSON_REPORTS_DIR,
  loadFeedbackEntries,
} from "../agent/classifiers/intentTriageAmbiguousAnalyzer.js";
import { getIntentTriageFeedbackPath } from "../agent/classifiers/intentTriageFeedbackRecorder.js";

function listReportFiles(dir = JSON_REPORTS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("ambiguous-analysis-") && name.endsWith(".json"))
    .map((name) => ({
      name,
      path: path.join(dir, name),
      mtime: fs.statSync(path.join(dir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
}

export function getLatestAnalysisReportPath(dir = JSON_REPORTS_DIR) {
  const files = listReportFiles(dir);
  return files[0]?.path || null;
}

export function loadLatestAnalysisReport(dir = JSON_REPORTS_DIR) {
  const reportPath = getLatestAnalysisReportPath(dir);
  if (!reportPath) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    return null;
  }
}

function countTiebreakFromFeedback(entries = []) {
  return entries.filter((entry) =>
    (entry.signals || []).includes("llm_tiebreak") ||
    String(entry.source || "").includes("tiebreak"),
  ).length;
}

/**
 * @param {{ limit?: number, refresh?: boolean }} [options]
 */
export function buildIntentTriageDashboardPayload(options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit || "12", 10), 1), 50);
  const feedbackPath = getIntentTriageFeedbackPath();
  const entries = loadFeedbackEntries(feedbackPath);

  let analysis = loadLatestAnalysisReport();
  let reportPath = getLatestAnalysisReportPath();

  if (!analysis || options.refresh) {
    const live = analyzeIntentTriageAmbiguous({ writeReports: false });
    analysis = live;
    reportPath = null;
  }

  const recent = [...entries]
    .sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)))
    .slice(0, limit)
    .map((entry) => ({
      recorded_at: entry.recorded_at,
      query: String(entry.query || "").slice(0, 200),
      top_intent: entry.top_intent,
      runner_up: entry.runner_up,
      confidence: entry.confidence,
      routing_action: entry.routing_action,
      user_reply: entry.user_reply,
      signals: (entry.signals || []).slice(0, 6),
    }));

  const tiebreak_count = countTiebreakFromFeedback(entries);

  return {
    generated_at: new Date().toISOString(),
    report_date: analysis?.generated_at?.slice(0, 10) || null,
    source: {
      report_path: reportPath,
      feedback_path: feedbackPath,
      has_report: Boolean(reportPath),
      entries_in_feedback: entries.length,
    },
    question: "Où enrichir les règles ensuite ?",
    summary: {
      clarifications_total: analysis?.summary?.entries_total ?? entries.length,
      ambiguous_entries: analysis?.summary?.ambiguous_entries ?? 0,
      ambiguous_rate_pct: analysis?.summary?.ambiguous_rate_pct ?? 0,
      distinct_pairs: analysis?.summary?.distinct_pairs ?? 0,
      tiebreak_count,
      resolved_by_rules: analysis?.replay?.resolved_by_rules ?? 0,
      still_ambiguous: analysis?.replay?.still_ambiguous ?? 0,
      intent_changed_on_replay: analysis?.replay?.intent_changed ?? 0,
    },
    confidence_distribution: analysis?.confidence_distribution ?? {
      high: 0,
      medium: 0,
      low: 0,
    },
    ambiguous_pairs: analysis?.ambiguous_pairs ?? [],
    signal_frequency: analysis?.signal_frequency ?? [],
    recommendations: analysis?.recommendations ?? [],
    recent_feedback: recent,
  };
}

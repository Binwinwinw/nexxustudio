/**
 * Export des clarifications terrain → fixtures golden CI (local-first).
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { getIntentTriageFeedbackPath } from "./intentTriageFeedbackRecorder.js";

export const EXPORT_CATEGORIES = Object.freeze({
  CLARIFICATION_FEEDBACK: "clarification_feedback",
  PRODUCTION_ROUTING: "production_routing",
});

/**
 * @typedef {Object} IntentTriageGoldenCase
 * @property {string} id
 * @property {string} category
 * @property {string} observedAt
 * @property {string} query
 * @property {string} [expectedTopIntent]
 * @property {string} [expectedRunnerUp]
 * @property {string} [minConfidence]
 * @property {string} [routingAction]
 * @property {string} [userReply]
 * @property {string} [incident]
 * @property {string} [source]
 */

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function queryFingerprint(query = "") {
  const normalized = String(query).trim().replace(/\s+/g, " ");
  return crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 10);
}

function parseJsonl(content = "") {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function resolveExpectedIntentFromReply(entry = {}) {
  const reply = String(entry.user_reply || "").trim().toLowerCase();
  if (!reply) return null;

  if (reply === "1" || reply.includes("revue") || reply.includes("erreur")) {
    return entry.top_intent;
  }
  if (reply === "2" || reply.includes("résumé") || reply.includes("resume") || reply.includes("points clés")) {
    return entry.runner_up || entry.top_intent;
  }

  if (/\bcode_review\b|\brevue de code\b/i.test(reply)) return "code_review";
  if (/\bcode_debug\b|\bdebug\b/i.test(reply)) return "code_debug";
  if (/\bcode_explain\b|\bexpliqu/i.test(reply)) return "code_explain";
  if (/\bdocument_analysis\b|\brésumé\b|\bresume\b/i.test(reply)) {
    return "document_analysis";
  }

  return null;
}

/**
 * @param {object} entry — ligne JSONL feedback
 * @returns {IntentTriageGoldenCase|null}
 */
export function feedbackEntryToGoldenCase(entry = {}) {
  if (!entry.query) return null;

  const fingerprint = queryFingerprint(entry.query);
  const resolvedIntent = resolveExpectedIntentFromReply(entry);
  const observedAt = (entry.recorded_at || new Date().toISOString()).slice(0, 10);

  const golden = {
    id: `feedback-${fingerprint}`,
    category: resolvedIntent
      ? EXPORT_CATEGORIES.CLARIFICATION_FEEDBACK
      : EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    observedAt,
    query: entry.query,
    source: entry.source || "feedback_export",
    incident:
      resolvedIntent
        ? `Clarification utilisateur → intention résolue (${resolvedIntent})`
        : `Cas ambigu enregistré (top=${entry.top_intent}, runner=${entry.runner_up})`,
  };

  if (resolvedIntent) {
    golden.expectedTopIntent = resolvedIntent;
    golden.userReply = entry.user_reply;
    golden.minConfidence = "medium";
    golden.routingAction = "route_direct";
  } else {
    golden.expectedTopIntent = entry.top_intent;
    if (entry.runner_up) golden.expectedRunnerUp = entry.runner_up;
    golden.minConfidence = "low";
    golden.routingAction = entry.routing_action || "ask_clarification";
  }

  return golden;
}

/**
 * @param {IntentTriageGoldenCase[]} existing
 * @param {IntentTriageGoldenCase[]} incoming
 */
export function mergeGoldenCases(existing = [], incoming = []) {
  const byId = new Map(existing.map((item) => [item.id, item]));

  for (const item of incoming) {
    if (!item?.id) continue;
    byId.set(item.id, { ...byId.get(item.id), ...item });
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * @param {string} [feedbackPath]
 * @returns {IntentTriageGoldenCase[]}
 */
export function loadGoldenCasesFromFeedback(feedbackPath = getIntentTriageFeedbackPath()) {
  if (!fs.existsSync(feedbackPath)) return [];

  const content = fs.readFileSync(feedbackPath, "utf8");
  const entries = parseJsonl(content);

  return entries
    .filter((entry) => entry.promoted_to_baseline !== true)
    .map(feedbackEntryToGoldenCase)
    .filter(Boolean);
}

/**
 * @param {IntentTriageGoldenCase[]} cases
 * @param {{ exportedAt?: string, feedbackPath?: string }} [meta]
 */
export function renderGoldenFixtureModule(cases = [], meta = {}) {
  const exportedAt = meta.exportedAt || new Date().toISOString().slice(0, 10);
  const feedbackPath = meta.feedbackPath || getIntentTriageFeedbackPath();

  const body = JSON.stringify(cases, null, 2);

  return `/**
 * AUTO-GENERATED — Ne pas éditer à la main.
 * Source : ${feedbackPath.replace(/\\/g, "/")}
 * Export : ${exportedAt}
 * Commande : npm run triage:export-golden
 */
import { EXPORT_CATEGORIES } from "../../src/agent/classifiers/intentTriageFeedbackExporter.js";

/** @type {import("../../src/agent/classifiers/intentTriageFeedbackExporter.js").IntentTriageGoldenCase[]} */
export const INTENT_TRIAGE_EXPORTED_QUERIES = ${body};

export { EXPORT_CATEGORIES };
`;
}

/**
 * @param {{
 *   feedbackPath?: string,
 *   outputPath: string,
 *   existingCases?: IntentTriageGoldenCase[],
 * }} options
 */
export function exportIntentTriageGolden(options = {}) {
  const {
    feedbackPath = getIntentTriageFeedbackPath(),
    outputPath,
    existingCases = [],
  } = options;

  const fromFeedback = loadGoldenCasesFromFeedback(feedbackPath);
  const merged = mergeGoldenCases(existingCases, fromFeedback);
  const content = renderGoldenFixtureModule(merged, { feedbackPath });

  fs.mkdirSync(pathDirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");

  return {
    feedbackPath,
    outputPath,
    imported: fromFeedback.length,
    total: merged.length,
    cases: merged,
  };
}

function pathDirname(filePath) {
  const idx = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return idx >= 0 ? filePath.slice(0, idx) : ".";
}

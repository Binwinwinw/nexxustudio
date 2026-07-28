/**
 * Enregistrement local des clarifications de tri (feedback loop).
 * Append-only JSONL — exploitable pour enrichir le golden set CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEEDBACK_DIR = path.resolve(__dirname, "../../../data/intent-triage");
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, "clarification-feedback.jsonl");

const RECORDING_ENABLED = process.env.INTENT_TRIAGE_FEEDBACK !== "0";

function ensureFeedbackDir() {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

/**
 * @param {{
 *   query: string,
 *   triage: object,
 *   userReply?: string|null,
 *   sessionId?: string|null,
 *   source?: string,
 * }} entry
 */
export function recordIntentTriageClarification(entry = {}) {
  if (!RECORDING_ENABLED) return false;

  const { query, triage, userReply = null, sessionId = null, source = "pipeline" } =
    entry;
  if (!query || !triage) return false;

  try {
    ensureFeedbackDir();
    const line = JSON.stringify({
      recorded_at: new Date().toISOString(),
      source,
      session_id: sessionId,
      query: String(query).slice(0, 2000),
      top_intent: triage.top_intent,
      runner_up: triage.runner_up,
      confidence: triage.confidence,
      confidence_score: triage.confidence_score,
      needs_clarification: triage.needs_clarification,
      routing_action: triage.routing_action,
      signals: triage.signals || [],
      user_reply: userReply ? String(userReply).slice(0, 500) : null,
    });
    fs.appendFileSync(FEEDBACK_FILE, `${line}\n`, "utf8");
    return true;
  } catch (err) {
    console.warn("[intentTriageFeedback] skip:", err.message);
    return false;
  }
}

export function getIntentTriageFeedbackPath() {
  return FEEDBACK_FILE;
}

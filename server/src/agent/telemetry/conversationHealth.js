import { computeHealthScore } from "./conversationHealthScore.js";
import { appendHealthIncident } from "./conversationHealthPersistor.js";

const MAX_RECENT_INCIDENTS = 100;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

class ConversationHealthTracker {
  constructor() {
    this.daily = new Map();
    this.recentIncidents = [];
    this.startedAt = new Date().toISOString();
  }

  ensureDayStats(key) {
    if (!this.daily.has(key)) {
      this.daily.set(key, {
        streams: 0,
        noVisibleTokens: 0,
        fallbackTriggered: 0,
        streamErrors: 0,
      });
    }
    return this.daily.get(key);
  }

  markStreamStart() {
    const stats = this.ensureDayStats(dayKey());
    stats.streams += 1;
  }

  recordIncident(type, meta = {}) {
    const stats = this.ensureDayStats(dayKey());
    if (type === "no_visible_tokens") {
      stats.noVisibleTokens += 1;
    }
    if (type === "fallback_triggered") {
      stats.fallbackTriggered += 1;
    }
    if (type === "stream_error") {
      stats.streamErrors += 1;
    }

    this.recentIncidents.unshift({
      type,
      at: new Date().toISOString(),
      ...meta,
    });
    appendHealthIncident({ type, ...meta });
    if (this.recentIncidents.length > MAX_RECENT_INCIDENTS) {
      this.recentIncidents.length = MAX_RECENT_INCIDENTS;
    }
  }

  snapshot() {
    const key = dayKey();
    const today = this.ensureDayStats(key);
    const fallbackRate =
      today.streams > 0
        ? Number(((today.fallbackTriggered / today.streams) * 100).toFixed(2))
        : 0;

    const recent = this.recentIncidents.slice(0, 20);
    const latestFailure = recent.find(
      (incident) =>
        incident.type === "stream_error" ||
        incident.type === "no_visible_tokens" ||
        incident.type === "fallback_triggered",
    );

    const todayMetrics = {
      ...today,
      fallbackRatePct: fallbackRate,
      streamErrorCount: today.streamErrors,
    };

    return {
      startedAt: this.startedAt,
      day: key,
      today: todayMetrics,
      globalScore: computeHealthScore(todayMetrics),
      lastFailureMode: latestFailure?.mode || "none",
      recentIncidents: recent,
    };
  }
}

const conversationHealth = new ConversationHealthTracker();

export default conversationHealth;


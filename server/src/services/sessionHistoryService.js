/**
 * Historique conversationnel session — source DB (event store) avec fallback client.
 */
import eventRepository from '../db/repositories/eventRepository.js';
import { projectRoutingResultMetadata } from '../agent/telemetry/routingResultMetadata.js';

export const SESSION_CONVERSATION_HISTORY_LIMIT = 40;
const DEFAULT_LIMIT = SESSION_CONVERSATION_HISTORY_LIMIT;

/** Métriques de continuité — activer avec SESSION_HISTORY_METRICS=1 */
export function isSessionHistoryMetricsEnabled() {
  const flag = String(process.env.SESSION_HISTORY_METRICS || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/**
 * @param {Array<{ role: string, content: string }>} dbHistory
 * @param {Array<{ role: string, content: string }>} clientHistory
 * @param {Array<{ role: string, content: string }>} resolved
 */
export function inferHistoryMergeStrategy(dbHistory = [], clientHistory = [], resolved = []) {
  const db = dbHistory.length;
  const client = clientHistory.length;
  if (db === 0) return "client_only";
  if (client === 0) return "db_only";
  const lastDb = dbHistory[dbHistory.length - 1];
  const lastClient = clientHistory[clientHistory.length - 1];
  const tailsAligned =
    lastDb?.role === lastClient?.role && lastDb?.content === lastClient?.content;
  if (tailsAligned) {
    return client >= db ? "aligned_prefer_client" : "aligned_prefer_db";
  }
  return "union_deduped";
}

/**
 * @param {string} sessionId
 * @param {{
 *   dbCount: number,
 *   clientCount: number,
 *   resolvedCount: number,
 *   mergeStrategy: string,
 *   source?: string,
 * }} stats
 */
export function logSessionHistoryResolution(sessionId, stats) {
  if (!isSessionHistoryMetricsEnabled()) return;
  console.log(
    JSON.stringify({
      tag: "SESSION_HISTORY_RESOLVE",
      sessionId: String(sessionId || "").slice(0, 12),
      source: stats.source || "unknown",
      dbMessages: stats.dbCount,
      clientMessages: stats.clientCount,
      resolvedMessages: stats.resolvedCount,
      mergeStrategy: stats.mergeStrategy,
      clientMinusDb: stats.clientCount - stats.dbCount,
      resolvedMinusDb: stats.resolvedCount - stats.dbCount,
      resolvedMinusClient: stats.resolvedCount - stats.clientCount,
    }),
  );
}

function historyEntryKey(message = {}) {
  return `${message.role}::${message.content}`;
}

function withRoutingMetadata(role, content, source = {}) {
  const base = { role, content };
  if (role !== "assistant") return base;
  const routing = projectRoutingResultMetadata(source);
  return Object.keys(routing).length ? { ...base, ...routing } : base;
}

function overlayDbRoutingMetadata(chosen = [], dbHistory = []) {
  const byKey = new Map();
  for (const message of dbHistory) {
    if (message?.role !== "assistant") continue;
    const routing = projectRoutingResultMetadata(message);
    if (Object.keys(routing).length) {
      byKey.set(historyEntryKey(message), routing);
    }
  }
  if (byKey.size === 0) return chosen;
  return chosen.map((message) => {
    const routing = byKey.get(historyEntryKey(message));
    if (!routing) return message;
    return withRoutingMetadata(message.role, message.content, {
      ...message,
      ...routing,
    });
  });
}

/**
 * @param {Array<object>} events
 * @param {number} [limit]
 * @returns {Array<{ role: string, content: string }>}
 */
export function mapEventsToConversationHistory(events = [], limit = DEFAULT_LIMIT) {
  const messages = (Array.isArray(events) ? events : [])
    .filter(
      (event) =>
        event?.event_family === "CONVERSATION" &&
        (event.event_type === "user_message" || event.event_type === "ai_response"),
    )
    .map((event) => {
      const role = event.event_type === "user_message" ? "user" : "assistant";
      const content = String(event.payload_json?.content || "").trim();
      return withRoutingMetadata(role, content, event.metadata_json || {});
    })
    .filter((message) => message.content);

  return messages.slice(-limit);
}

/**
 * Charge l'historique conversationnel depuis session_events.
 * @param {string} sessionId
 * @param {{ limit?: number }} [options]
 */
export async function loadSessionConversationHistory(
  sessionId,
  { limit = DEFAULT_LIMIT } = {},
) {
  if (!sessionId) return [];

  const events = await eventRepository.getEventsBySession(sessionId);
  return mapEventsToConversationHistory(events, limit);
}

function sanitizeClientHistory(clientHistory = [], limit = DEFAULT_LIMIT) {
  return (Array.isArray(clientHistory) ? clientHistory : [])
    .filter((m) => m?.content && (m.role === "user" || m.role === "assistant"))
    .map((m) =>
      withRoutingMetadata(m.role, String(m.content).trim(), m),
    )
    .filter((m) => m.content)
    .slice(-limit);
}

/**
 * Fusionne historique event-store et historique UI (reprise de session).
 * La DB seule peut être incomplète (migration, échec d'écriture) ; le client charge souvent
 * mentor.messages plus riche via snapshot — on prend l'union dédupliquée, pas « DB gagne ».
 * @param {Array<{ role: string, content: string }>} dbHistory
 * @param {Array<{ role: string, content: string }>} clientHistory
 * @param {number} [limit]
 */
export function mergeConversationHistories(
  dbHistory = [],
  clientHistory = [],
  limit = DEFAULT_LIMIT,
) {
  const db = Array.isArray(dbHistory) ? dbHistory : [];
  const client = Array.isArray(clientHistory) ? clientHistory : [];

  if (db.length === 0) return client.slice(-limit);
  if (client.length === 0) return db.slice(-limit);

  const lastDb = db[db.length - 1];
  const lastClient = client[client.length - 1];
  const tailsAligned =
    lastDb?.role === lastClient?.role &&
    lastDb?.content === lastClient?.content;

  if (tailsAligned) {
    const chosen = (client.length >= db.length ? client : db).slice(-limit);
    return overlayDbRoutingMetadata(chosen, db);
  }

  const merged = [];
  const seen = new Set();
  for (const message of [...db, ...client]) {
    const key = historyEntryKey(message);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(message);
  }
  return overlayDbRoutingMetadata(merged.slice(-limit), db);
}

/**
 * Résout l'historique pour agent.run — fusion DB + client (le plus complet gagne).
 * @param {string|null} sessionId
 * @param {{ clientHistory?: Array, limit?: number }} [options]
 */
export async function resolveSessionConversationHistory(
  sessionId,
  { clientHistory = [], limit = DEFAULT_LIMIT, metricsSource = "agent" } = {},
) {
  const client = sanitizeClientHistory(clientHistory, limit);

  if (!sessionId) {
    logSessionHistoryResolution(sessionId, {
      dbCount: 0,
      clientCount: client.length,
      resolvedCount: client.length,
      mergeStrategy: "no_session_client_only",
      source: metricsSource,
    });
    return client;
  }

  try {
    const dbHistory = await loadSessionConversationHistory(sessionId, {
      limit: Math.max(limit, DEFAULT_LIMIT),
    });
    const resolved = mergeConversationHistories(dbHistory, client, limit);
    logSessionHistoryResolution(sessionId, {
      dbCount: dbHistory.length,
      clientCount: client.length,
      resolvedCount: resolved.length,
      mergeStrategy: inferHistoryMergeStrategy(dbHistory, client, resolved),
      source: metricsSource,
    });
    return resolved;
  } catch (error) {
    console.warn(
      `[SessionHistory] Fallback historique client (${sessionId}):`,
      error.message,
    );
    logSessionHistoryResolution(sessionId, {
      dbCount: 0,
      clientCount: client.length,
      resolvedCount: client.length,
      mergeStrategy: "fallback_client_on_error",
      source: metricsSource,
    });
  }

  return client;
}

export default {
  SESSION_CONVERSATION_HISTORY_LIMIT,
  mapEventsToConversationHistory,
  loadSessionConversationHistory,
  mergeConversationHistories,
  inferHistoryMergeStrategy,
  isSessionHistoryMetricsEnabled,
  logSessionHistoryResolution,
  resolveSessionConversationHistory,
};

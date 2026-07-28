/** Titres génériques regroupés sous « Nouveau Projet » */
export const DEFAULT_SESSION_TITLES = new Set([
  "nouveau projet",
  "projet nexxus",
  "projet nexxus citadel",
  "projet nexxus citadelle",
  "sans titre",
]);

export function isDefaultSessionTitle(title = "") {
  return DEFAULT_SESSION_TITLES.has(String(title || "").trim().toLowerCase());
}

export function normalizeSessionTimestamp(session) {
  const ts = session?.timestamp;
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sessionSearchHaystack(session) {
  return [session?.title, session?.preview]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterSessions(sessions = [], searchTerm = "") {
  const query = String(searchTerm || "").trim().toLowerCase();
  if (!query) return sessions;
  return sessions.filter((session) =>
    sessionSearchHaystack(session).includes(query),
  );
}

export function sortSessionsByDateDesc(sessions = []) {
  return [...sessions].sort(
    (a, b) => normalizeSessionTimestamp(b) - normalizeSessionTimestamp(a),
  );
}

/**
 * Regroupe les sessions : projets nommés (liste plate) + défauts repliables.
 */
export function groupSessions(sessions = []) {
  const sorted = sortSessionsByDateDesc(sessions);
  const named = [];
  const defaults = [];

  for (const session of sorted) {
    if (isDefaultSessionTitle(session.title)) {
      defaults.push(session);
    } else {
      named.push(session);
    }
  }

  const groups = [];

  if (named.length > 0) {
    groups.push({
      id: "named",
      label: "Projets nommés",
      sessions: named,
      collapsible: false,
    });
  }

  if (defaults.length > 0) {
    groups.push({
      id: "default",
      label: "Nouveau Projet",
      sessions: defaults,
      collapsible: true,
    });
  }

  return groups;
}

/** Libellé affiché pour une session au titre générique. */
export function getSessionDisplayTitle(session) {
  if (!isDefaultSessionTitle(session?.title)) {
    return String(session?.title || "Sans titre");
  }

  const preview = String(session?.preview || "").trim();
  if (preview) {
    return preview.length > 72 ? `${preview.slice(0, 72)}…` : preview;
  }

  return "Nouveau Projet";
}

export function formatSessionDate(session) {
  const ts = normalizeSessionTimestamp(session);
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

/** Date courte pour lignes denses (historique). */
export function formatSessionDateCompact(session, now = Date.now()) {
  const ts = normalizeSessionTimestamp(session);
  if (!ts) return "—";
  const d = new Date(ts);
  const n = new Date(now);
  const sameDay =
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: d.getFullYear() !== n.getFullYear() ? "numeric" : undefined,
  });
}

function startOfLocalDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Regroupe par récence (Aujourd'hui / Hier / Cette semaine / Plus ancien).
 */
export function groupSessionsByRecency(sessions = [], now = Date.now()) {
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const buckets = {
    today: { id: "today", label: "Aujourd'hui", sessions: [] },
    yesterday: { id: "yesterday", label: "Hier", sessions: [] },
    week: { id: "week", label: "Cette semaine", sessions: [] },
    older: { id: "older", label: "Plus ancien", sessions: [] },
  };

  for (const session of sortSessionsByDateDesc(sessions)) {
    const ts = normalizeSessionTimestamp(session);
    if (ts >= todayStart) buckets.today.sessions.push(session);
    else if (ts >= yesterdayStart) buckets.yesterday.sessions.push(session);
    else if (ts >= weekStart) buckets.week.sessions.push(session);
    else buckets.older.sessions.push(session);
  }

  return Object.values(buckets).filter((g) => g.sessions.length > 0);
}

export function filterSessionsByKind(sessions = [], kind = "all") {
  if (kind === "named") {
    return sessions.filter((s) => !isDefaultSessionTitle(s.title));
  }
  if (kind === "default") {
    return sessions.filter((s) => isDefaultSessionTitle(s.title));
  }
  return sessions;
}

export function sortSessionsByTitle(sessions = []) {
  return [...sessions].sort((a, b) =>
    getSessionDisplayTitle(a).localeCompare(getSessionDisplayTitle(b), "fr"),
  );
}

/** Inférence légère du type de session pour badges UI (liste historique). */
export function inferSessionKind(session) {
  const hay = sessionSearchHaystack(session);
  if (/\b(audit|maturit|impact|verdict)\b/.test(hay)) return "audit";
  if (/\b(document|pdf|fichier joint|document analysis)\b/.test(hay)) {
    return "document";
  }
  if (/\b(forge|production|artefact|impeccable)\b/.test(hay)) return "forge";
  return "chat";
}

export const SESSION_KIND_META = {
  chat: { label: "Chat", tone: "text-blue-300 border-blue-500/40 bg-blue-500/10" },
  audit: { label: "Audit", tone: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  document: {
    label: "Document",
    tone: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
  },
  forge: {
    label: "Forge",
    tone: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  },
};

export function getSessionPreviewLine(session, maxLen = 140) {
  const preview = String(session?.preview || "").trim();
  if (preview) {
    return preview.length > maxLen ? `${preview.slice(0, maxLen)}…` : preview;
  }
  if (isDefaultSessionTitle(session?.title)) {
    return "Conversation démarrée — titre générique, en attente de contenu nommé.";
  }
  return "Aucun extrait de message enregistré pour cette session.";
}

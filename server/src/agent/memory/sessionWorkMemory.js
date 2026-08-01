/**
 * Mémoire de travail explicite par session — fichiers vus, intentions, erreurs, horodatage.
 * Doctrine : stateless par défaut ; continuité uniquement via état structuré, traçable, pruneable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFilePathsFromText } from "../policies/guards/index.js";
import { classifyErrorCategory } from "../policies/code/codeErrorPriorityPolicy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../../..");
export const SESSION_WORK_MEMORY_DIR = path.join(
  SERVER_ROOT,
  "state",
  "session-work-memory",
);

export const SESSION_WORK_MEMORY_LIMITS = Object.freeze({
  filesSeen: 15,
  intentions: 10,
  openErrors: 20,
  corrections: 10,
});

const STALENESS_HALF_LIFE_MS = 30 * 60 * 1000;
const SESSION_STORE = new Map();

function normalizeSessionId(sessionId = "") {
  const raw = String(sessionId || "default-session").trim() || "default-session";
  return raw.replace(/[^\w.-]/g, "_").slice(0, 120);
}

function sessionFilePath(sessionId) {
  return path.join(SESSION_WORK_MEMORY_DIR, `${normalizeSessionId(sessionId)}.json`);
}

function ensureStoreDir() {
  if (!fs.existsSync(SESSION_WORK_MEMORY_DIR)) {
    fs.mkdirSync(SESSION_WORK_MEMORY_DIR, { recursive: true });
  }
}

export function createEmptySessionWorkMemory(sessionId = "default-session") {
  const now = new Date().toISOString();
  return {
    sessionId: normalizeSessionId(sessionId),
    lastTurnTimestamp: null,
    previousTurnTimestamp: null,
    turnCount: 0,
    filesSeen: [],
    intentions: [],
    openErrors: [],
    corrections: [],
    sessionMode: null,
    stalenessScore: 0,
    updatedAt: now,
  };
}

export function computeStalenessScore(
  lastTurnTimestamp = null,
  nowMs = Date.now(),
) {
  if (!lastTurnTimestamp) return 0;
  const last = Date.parse(lastTurnTimestamp);
  if (!Number.isFinite(last)) return 0;
  const ageMs = Math.max(0, nowMs - last);
  const ratio = ageMs / STALENESS_HALF_LIFE_MS;
  return Math.min(1, Number(ratio.toFixed(3)));
}

function pruneList(list = [], max = 10) {
  return Array.isArray(list) ? list.slice(-max) : [];
}

export function pruneSessionWorkMemory(state = {}) {
  const next = { ...state };
  next.filesSeen = pruneList(next.filesSeen, SESSION_WORK_MEMORY_LIMITS.filesSeen);
  next.intentions = pruneList(next.intentions, SESSION_WORK_MEMORY_LIMITS.intentions);
  next.openErrors = pruneList(next.openErrors, SESSION_WORK_MEMORY_LIMITS.openErrors);
  next.corrections = pruneList(next.corrections, SESSION_WORK_MEMORY_LIMITS.corrections);
  next.stalenessScore = computeStalenessScore(next.lastTurnTimestamp);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function loadSessionWorkMemory(sessionId = "default-session") {
  const key = normalizeSessionId(sessionId);
  if (SESSION_STORE.has(key)) {
    return pruneSessionWorkMemory({ ...SESSION_STORE.get(key) });
  }

  ensureStoreDir();
  const filePath = sessionFilePath(key);
  if (!fs.existsSync(filePath)) {
    const empty = createEmptySessionWorkMemory(key);
    SESSION_STORE.set(key, empty);
    return empty;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const merged = pruneSessionWorkMemory({
      ...createEmptySessionWorkMemory(key),
      ...parsed,
      sessionId: key,
    });
    SESSION_STORE.set(key, merged);
    return merged;
  } catch {
    const empty = createEmptySessionWorkMemory(key);
    SESSION_STORE.set(key, empty);
    return empty;
  }
}

export function saveSessionWorkMemory(state = {}) {
  const key = normalizeSessionId(state.sessionId || "default-session");
  const pruned = pruneSessionWorkMemory({ ...state, sessionId: key });
  SESSION_STORE.set(key, pruned);

  try {
    ensureStoreDir();
    fs.writeFileSync(sessionFilePath(key), JSON.stringify(pruned, null, 2), "utf8");
  } catch (err) {
    console.warn("[sessionWorkMemory] persist failed:", err.message);
  }

  return pruned;
}

export function clearSessionWorkMemoryForTests(sessionId = null) {
  if (sessionId) {
    const key = normalizeSessionId(sessionId);
    SESSION_STORE.delete(key);
    const filePath = sessionFilePath(key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  SESSION_STORE.clear();
  if (fs.existsSync(SESSION_WORK_MEMORY_DIR)) {
    for (const file of fs.readdirSync(SESSION_WORK_MEMORY_DIR)) {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(SESSION_WORK_MEMORY_DIR, file));
      }
    }
  }
}

function upsertFilesSeen(existing = [], paths = [], source = "query", seenAt) {
  const map = new Map(
    existing.map((row) => [String(row.path).toLowerCase(), { ...row }]),
  );

  for (const rawPath of paths) {
    const filePath = String(rawPath || "").trim();
    if (!filePath) continue;
    const key = filePath.toLowerCase();
    map.set(key, {
      path: filePath,
      source,
      seenAt,
      pointer: { file: filePath, lines: null, expand: true },
    });
  }

  return [...map.values()].slice(-SESSION_WORK_MEMORY_LIMITS.filesSeen);
}

function upsertIntention(existing = [], intent = "", confidence = "", recordedAt) {
  if (!intent) return existing;
  const filtered = existing.filter((row) => row.intent !== intent);
  filtered.push({ intent, confidence: confidence || null, recordedAt });
  return filtered.slice(-SESSION_WORK_MEMORY_LIMITS.intentions);
}

export function formatTurnGapFr(previousIso, currentIso) {
  const prev = Date.parse(previousIso || "");
  const cur = Date.parse(currentIso || "");
  if (!Number.isFinite(prev) || !Number.isFinite(cur) || cur <= prev) {
    return null;
  }
  const deltaMs = cur - prev;
  const mins = Math.floor(deltaMs / 60000);
  const secs = Math.floor((deltaMs % 60000) / 1000);
  if (mins > 0) return `${mins} min ${secs}s`;
  return `${secs}s`;
}

/**
 * Début de tour — charge l'état précédent et fixe l'horodatage courant.
 */
export function beginSessionWorkTurn({ sessionId = "default-session", now = new Date() } = {}) {
  const key = normalizeSessionId(sessionId);
  const priorState = loadSessionWorkMemory(key);
  const turnTimestamp = now.toISOString();

  return {
    sessionId: key,
    turnTimestamp,
    priorState,
    previousTurnTimestamp: priorState.lastTurnTimestamp,
    gapLabel: formatTurnGapFr(priorState.lastTurnTimestamp, turnTimestamp),
  };
}

/**
 * Commit fin de tour — met à jour fichiers vus, intentions, horodatage.
 */
export function commitSessionWorkTurn({
  sessionId = "default-session",
  turnTimestamp = new Date().toISOString(),
  query = "",
  intent = null,
  confidence = null,
  pipelinePath = null,
  attachmentRefs = [],
  openErrors = [],
  corrections = [],
  sessionMode = undefined,
} = {}) {
  const key = normalizeSessionId(sessionId);
  const state = loadSessionWorkMemory(key);

  const filesFromQuery = extractFilePathsFromText(query);
  const filesFromAttachments = (attachmentRefs || [])
    .map((ref) => ref?.name || ref?.path)
    .filter(Boolean);

  const next = {
    ...state,
    previousTurnTimestamp: state.lastTurnTimestamp,
    lastTurnTimestamp: turnTimestamp,
    turnCount: (state.turnCount || 0) + 1,
    filesSeen: upsertFilesSeen(
      state.filesSeen,
      [...filesFromQuery, ...filesFromAttachments],
      "turn",
      turnTimestamp,
    ),
    intentions: upsertIntention(state.intentions, intent, confidence, turnTimestamp),
    openErrors: [
      ...state.openErrors,
      ...(openErrors || []).map((err) => ({
        category: err.category || classifyErrorCategory(err.message || ""),
        message: String(err.message || "").slice(0, 240),
        file: err.file || null,
        line: err.line ?? null,
        priority: err.priority ?? null,
        recordedAt: turnTimestamp,
        pipelinePath: pipelinePath || null,
      })),
    ].slice(-SESSION_WORK_MEMORY_LIMITS.openErrors),
    corrections: [
      ...state.corrections,
      ...(corrections || []).map((fix) => ({
        file: fix.file || null,
        lines: fix.lines ?? null,
        summary: String(fix.summary || "").slice(0, 200),
        recordedAt: turnTimestamp,
      })),
    ].slice(-SESSION_WORK_MEMORY_LIMITS.corrections),
  };

  if (sessionMode !== undefined) {
    next.sessionMode = sessionMode;
  }

  return saveSessionWorkMemory(next);
}

export function buildSessionWorkMemoryPromptAddon(state = {}, turnTimestamp = new Date().toISOString()) {
  const files = (state.filesSeen || []).slice(-5).map((f) => f.path);
  const intents = (state.intentions || []).slice(-3).map((i) => i.intent);
  const gap = formatTurnGapFr(state.lastTurnTimestamp, turnTimestamp);

  const lines = [
    "[MODIFICATEUR: MÉMOIRE DE TRAVAIL SESSION — SESSION_WORK_MEMORY_V1]",
    `turnTimestamp: ${turnTimestamp}`,
  ];

  if (state.lastTurnTimestamp) {
    lines.push(`previousTurnTimestamp: ${state.lastTurnTimestamp}`);
    if (gap) lines.push(`elapsedSincePreviousTurn: ${gap}`);
  } else {
    lines.push("previousTurnTimestamp: null (premier tour de ce fil)");
  }

  lines.push(`stalenessScore: ${computeStalenessScore(state.lastTurnTimestamp, Date.parse(turnTimestamp))}`);

  if (files.length) {
    lines.push(`filesSeenRecent: ${files.join(", ")}`);
  }
  if (intents.length) {
    lines.push(`intentionsRecent: ${intents.join(", ")}`);
  }

  lines.push(
    "RÈGLE : n'affirme pas de continuité temporelle entre sessions sans ces pointeurs. " +
      "Si stalenessScore > 0.7, traite le contexte fichier/intention comme potentiellement obsolète.",
  );

  return `\n\n${lines.join("\n")}`;
}

export function buildTemporalAwarenessReply(options = {}) {
  const sessionId = options.sessionId || "default-session";
  const turnTimestamp = options.turnTimestamp || new Date().toISOString();
  const state = options.priorState || loadSessionWorkMemory(sessionId);
  const gap = formatTurnGapFr(state.lastTurnTimestamp, turnTimestamp);
  const prev = state.lastTurnTimestamp;

  const gapLine =
    prev && gap
      ? `Entre ton message précédent (${prev}) et celui-ci (${turnTimestamp}), il s'est écoulé **${gap}** dans ce fil.`
      : "C'est le premier tour mémorisé de ce fil, ou le précédent horodatage n'est pas disponible.";

  return (
    "Aujourd'hui je n'ai pas une « conscience » persistante du temps : je ne « vis » pas les minutes entre vos messages.\n\n" +
    `✅ **Livré** : horodatage serveur par tour (\`turnTimestamp\`) + mémoire de session (\`sessionWorkMemory\`) pour ce fil.\n` +
    `${gapLine}\n\n` +
    "✅ **Livré** : réponse déterministe \`temporal_awareness\` (plus de salutation générique sur cette question).\n" +
    "✅ **Livré** : heure/date à la demande si formulation explicite (« quelle heure », \`time_lookup\`).\n\n" +
    "⚠️ **Limite** : entre deux sessions ou après purge, je ne conserve pas l'écart temporel sans ce fil.\n" +
    `🚧 **À renforcer** : contrat \`CODE_DIAGNOSTIC_V1\` (PR3) pour structurer preuves/patch.\n\n` +
    "Je peux citer l'heure courante du serveur à la demande, mais je ne prétends pas « maîtriser » le temps sans ces pointeurs explicites."
  );
}

export function getSessionWorkMemorySummary(sessionId = "default-session") {
  const state = loadSessionWorkMemory(sessionId);
  return {
    sessionId: state.sessionId,
    turnCount: state.turnCount,
    lastTurnTimestamp: state.lastTurnTimestamp,
    previousTurnTimestamp: state.previousTurnTimestamp,
    stalenessScore: state.stalenessScore,
    filesSeenCount: state.filesSeen?.length || 0,
    intentionsCount: state.intentions?.length || 0,
    openErrorsCount: state.openErrors?.length || 0,
    correctionsCount: state.corrections?.length || 0,
  };
}

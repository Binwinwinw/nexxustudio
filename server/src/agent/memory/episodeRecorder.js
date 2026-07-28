import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(SERVER_ROOT, 'state', 'session-work-memory');
const EPISODES_FILE = path.join(DATA_DIR, 'episodes.jsonl');

function ensureStoreDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Truncate a string to a maximum length to prevent explosive growth.
 */
function truncateString(str, maxLength = 10000) {
  if (!str) return "";
  const s = String(str);
  if (s.length <= maxLength) return s;
  return s.substring(0, maxLength) + "... [TRUNCATED]";
}

/**
 * Enregistre un épisode runtime (post-chat) en mode append-only.
 * Cette brique est uniquement responsable de figer une trace d'exécution
 * et n'inclut aucune extraction ou promotion de candidat.
 *
 * @param {Object} params
 * @returns {Object} { ok, episode_id, episode, error }
 */
export function recordEpisode(params) {
  const {
    sessionId,
    turnId,
    userQuery,
    assistantAnswer,
    activeFiles = [],
    openErrors = [],
    sourcesUsed = [],
    webEligible = false,
  } = params;

  // Garde-fou 1 : Rejeter si la réponse est vide ou inexploitable
  if (!sessionId || !assistantAnswer || typeof assistantAnswer !== 'string' || assistantAnswer.trim() === '') {
    return { ok: false, error: "Missing required fields or empty assistant answer." };
  }

  // Garde-fou 2 : Borner la taille des champs textuels
  const cleanQuery = truncateString(userQuery, 5000);
  const cleanAnswer = truncateString(assistantAnswer, 15000);

  const episodeId = `ep-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const episode = {
    episode_id: episodeId,
    session_id: sessionId,
    turn_id: turnId || `turn-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user_query: cleanQuery,
    assistant_answer: cleanAnswer,
    active_files: Array.isArray(activeFiles) ? activeFiles.slice(0, 5) : [],
    open_errors: Array.isArray(openErrors) ? openErrors.slice(0, 5) : [],
    sources_used: Array.isArray(sourcesUsed) ? sourcesUsed.slice(0, 10) : [],
    source_count: Array.isArray(sourcesUsed) ? sourcesUsed.length : 0,
    web_eligible: Boolean(webEligible),
    status: "recorded"
  };

  try {
    ensureStoreDir();
    fs.appendFileSync(EPISODES_FILE, JSON.stringify(episode) + "\n", "utf8");
    return { ok: true, episode_id: episodeId, episode };
  } catch (error) {
    console.error("[episodeRecorder] Échec de l'écriture de l'épisode :", error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Lecture utilitaire (principalement pour les tests et la policy).
 */
export function getEpisodeById(episodeId) {
  if (!fs.existsSync(EPISODES_FILE)) return null;
  const lines = fs.readFileSync(EPISODES_FILE, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const ep = JSON.parse(line);
      if (ep.episode_id === episodeId) return ep;
    } catch (e) {
      // Ignorer les lignes mal formées
    }
  }
  return null;
}

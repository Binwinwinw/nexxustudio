import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../../..");
const DATA_DIR = path.join(SERVER_ROOT, "state", "session-work-memory");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidate_facts.json");

function ensureStoreDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const ALLOWED_STATUSES = [
  "candidate_pending",
  "candidate_rejected",
  "candidate_validated",
  "promoted",
];

/**
 * Charge tous les candidats (JSON statique pour P0).
 */
function loadAll() {
  if (!fs.existsSync(CANDIDATES_FILE)) return [];
  try {
    const data = fs.readFileSync(CANDIDATES_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("[candidateFactStore] Error reading candidates:", e.message);
    return [];
  }
}

/**
 * Sauvegarde la collection de candidats.
 */
function saveAll(candidates) {
  ensureStoreDir();
  fs.writeFileSync(
    CANDIDATES_FILE,
    JSON.stringify(candidates, null, 2),
    "utf8",
  );
}

/**
 * Crée et stocke un nouveau candidate fact.
 */
export function appendCandidateFact(factData) {
  const {
    source_episode_id,
    session_id,
    subject = null,
    namespace = null,
    fact_text,
    fact_type = "technical_fact",
    scope = "global",
    source_consensus_score = 1.0,
    evidence = {},
  } = factData;

  if (!source_episode_id || !fact_text || fact_text.trim() === "") {
    return {
      ok: false,
      error: "Missing required fields: source_episode_id or fact_text",
    };
  }

  const candidateId = `cand-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const newCandidate = {
    candidate_id: candidateId,
    source_episode_id,
    session_id: session_id || "unknown",
    subject: subject || fact_text.trim(),
    namespace: namespace || null,
    created_at: new Date().toISOString(),
    fact_text: fact_text.trim(),
    fact_type,
    scope,
    source_consensus_score,
    validated_by_user: false,
    status: "candidate_pending",
    evidence: {
      active_files: Array.isArray(evidence.active_files)
        ? evidence.active_files
        : [],
      sources_used: Array.isArray(evidence.sources_used)
        ? evidence.sources_used
        : [],
      source_count: evidence.source_count || 0,
    },
  };

  const all = loadAll();
  all.push(newCandidate);
  saveAll(all);

  return { ok: true, candidate_id: candidateId, candidate: newCandidate };
}

/**
 * Trouve un candidat par son ID.
 */
export function findCandidateById(candidateId) {
  const all = loadAll();
  return all.find((c) => c.candidate_id === candidateId) || null;
}

/**
 * Liste les candidats, avec filtres optionnels.
 */
export function listCandidateFacts(filters = {}) {
  const all = loadAll();
  return all.filter((c) => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.session_id && c.session_id !== filters.session_id) return false;
    if (
      filters.source_episode_id &&
      c.source_episode_id !== filters.source_episode_id
    )
      return false;
    if (
      filters.validated_by_user !== undefined &&
      c.validated_by_user !== filters.validated_by_user
    )
      return false;
    return true;
  });
}

/**
 * Met à jour le statut ou la validation d'un candidat existant.
 */
export function updateCandidateStatus(candidateId, patch = {}) {
  const all = loadAll();
  const index = all.findIndex((c) => c.candidate_id === candidateId);
  if (index === -1) {
    return { ok: false, error: "Candidate not found" };
  }

  const candidate = all[index];

  if (patch.status) {
    if (!ALLOWED_STATUSES.includes(patch.status)) {
      return { ok: false, error: `Invalid status: ${patch.status}` };
    }
    candidate.status = patch.status;
  }

  if (patch.validated_by_user !== undefined) {
    candidate.validated_by_user = Boolean(patch.validated_by_user);
  }

  candidate.updated_at = new Date().toISOString();
  all[index] = candidate;
  saveAll(all);

  return { ok: true, candidate };
}

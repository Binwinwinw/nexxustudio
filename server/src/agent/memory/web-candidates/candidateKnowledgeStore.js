/**
 * Stockage local-first des épisodes et candidates web (JSONL + index query_normalized).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { normalizeWebQuery } from "./webCandidateUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(
  __dirname,
  "../../../../data/memory/web-candidates",
);

let dataDirOverride = null;

export const WEB_CANDIDATE_PATHS = {
  candidates: "candidates.jsonl",
  episodes: "episodes.jsonl",
  queryIndex: "query-index.json",
};

export function setWebCandidateDataDir(dir) {
  dataDirOverride = dir;
}

export function getWebCandidateDataDir() {
  return dataDirOverride || DEFAULT_DATA_DIR;
}

export function isWebCandidateMemoryEnabled() {
  return (
    process.env.WEB_CANDIDATE_MEMORY === "1" ||
    process.env.WEB_CANDIDATE_MEMORY === "true"
  );
}

function ensureDir() {
  fs.mkdirSync(getWebCandidateDataDir(), { recursive: true });
}

function resolvePath(name) {
  return path.join(getWebCandidateDataDir(), name);
}

function appendJsonl(fileName, entry) {
  ensureDir();
  fs.appendFileSync(
    resolvePath(fileName),
    `${JSON.stringify(entry)}\n`,
    "utf8",
  );
}

function readJsonl(fileName, limit = 2000) {
  const filePath = resolvePath(fileName);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function readQueryIndex() {
  const filePath = resolvePath(WEB_CANDIDATE_PATHS.queryIndex);
  if (!fs.existsSync(filePath)) {
    return { version: "web_query_index_v1", byQuery: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { version: "web_query_index_v1", byQuery: {} };
  }
}

function writeQueryIndex(index) {
  ensureDir();
  index.updated_at = new Date().toISOString();
  fs.writeFileSync(
    resolvePath(WEB_CANDIDATE_PATHS.queryIndex),
    JSON.stringify(index, null, 2),
    "utf8",
  );
}

function indexCandidate(candidate) {
  const key = candidate.query_normalized || normalizeWebQuery(candidate.query_raw);
  if (!key) return;
  const index = readQueryIndex();
  if (!index.byQuery[key]) index.byQuery[key] = [];
  if (!index.byQuery[key].includes(candidate.id)) {
    index.byQuery[key].unshift(candidate.id);
    index.byQuery[key] = index.byQuery[key].slice(0, 50);
  }
  writeQueryIndex(index);
}

export function appendWebEpisode(episode) {
  appendJsonl(WEB_CANDIDATE_PATHS.episodes, episode);
  return episode;
}

export function appendWebCandidate(candidate) {
  appendJsonl(WEB_CANDIDATE_PATHS.candidates, candidate);
  indexCandidate(candidate);
  return candidate;
}

export function readWebCandidates(limit = 500) {
  return readJsonl(WEB_CANDIDATE_PATHS.candidates, limit);
}

export function readWebEpisodes(limit = 500) {
  return readJsonl(WEB_CANDIDATE_PATHS.episodes, limit);
}

export function findCandidatesByQueryNormalized(queryNormalized, limit = 20) {
  const key = normalizeWebQuery(queryNormalized);
  const index = readQueryIndex();
  const ids = index.byQuery[key] || [];
  if (!ids.length) {
    return readWebCandidates(2000)
      .filter((c) => c.query_normalized === key)
      .slice(-limit)
      .reverse();
  }
  const byId = new Map(readWebCandidates(2000).map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, limit);
}

export function findCandidatesBySessionId(sessionId, limit = 10) {
  if (!sessionId) return [];
  return readWebCandidates(2000)
    .filter((c) => c.provenance?.session_id === sessionId)
    .slice(-limit)
    .reverse();
}

export function getWebCandidateById(id) {
  return readWebCandidates(2000).find((c) => c.id === id) || null;
}

/**
 * Réécrit le candidat dans le JSONL (volume P0 modeste).
 */
export function updateWebCandidate(id, patch) {
  const all = readWebCandidates(5000);
  let updated = null;
  const next = all.map((c) => {
    if (c.id !== id) return c;
    updated = {
      ...c,
      ...patch,
      validation: { ...c.validation, ...(patch.validation || {}) },
      promotion: { ...c.promotion, ...(patch.promotion || {}) },
      updated_at: new Date().toISOString(),
    };
    return updated;
  });
  if (!updated) return null;
  ensureDir();
  fs.writeFileSync(
    resolvePath(WEB_CANDIDATE_PATHS.candidates),
    `${next.map((c) => JSON.stringify(c)).join("\n")}\n`,
    "utf8",
  );
  indexCandidate(updated);
  return updated;
}

export function clearWebCandidateStoreForTests() {
  const dir = getWebCandidateDataDir();
  for (const name of Object.values(WEB_CANDIDATE_PATHS)) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

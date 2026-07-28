/**
 * Persistance locale du lexique vivant — observations, propositions, promotions.
 * Append-only + fichiers JSON gouvernés (local-first, auditable, réversible).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../../../data/micro/lexicon");

let dataDirOverride = null;
/** @type {{ entries: Record<string, object>, version?: string, updatedAt?: string } | null} */
let promotedCache = null;
let promotedMtime = 0;

export const LEXICON_LEARNING_PATHS = {
  observations: "observations.jsonl",
  learningEvents: "learning-events.jsonl",
  proposals: "proposals.json",
  promoted: "promoted-lexicon.json",
  rejected: "rejected.json",
};

export function setLexiconLearningDataDir(dir) {
  dataDirOverride = dir;
  invalidatePromotedLexiconCache();
}

export function getLexiconLearningDataDir() {
  return dataDirOverride || DEFAULT_DATA_DIR;
}

export function invalidatePromotedLexiconCache() {
  promotedCache = null;
  promotedMtime = 0;
}

function ensureDir() {
  fs.mkdirSync(getLexiconLearningDataDir(), { recursive: true });
}

function resolvePath(name) {
  return path.join(getLexiconLearningDataDir(), name);
}

function appendJsonl(fileName, entry) {
  ensureDir();
  fs.appendFileSync(resolvePath(fileName), `${JSON.stringify(entry)}\n`, "utf8");
}

function readJsonl(fileName, limit = 500) {
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

function readJson(fileName, fallback) {
  const filePath = resolvePath(fileName);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(fileName, data) {
  ensureDir();
  fs.writeFileSync(resolvePath(fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function isLexiconLearningEnabled() {
  return process.env.LEXICON_LEARNING === "1" || process.env.LEXICON_LEARNING === "true";
}

export function appendLexiconObservation(observation) {
  appendJsonl(LEXICON_LEARNING_PATHS.observations, {
    at: new Date().toISOString(),
    ...observation,
  });
}

export function readLexiconObservations(limit = 500) {
  return readJsonl(LEXICON_LEARNING_PATHS.observations, limit);
}

export function recordLexiconLearningEvent(event) {
  appendJsonl(LEXICON_LEARNING_PATHS.learningEvents, {
    at: new Date().toISOString(),
    ...event,
  });
}

export function readLexiconLearningEvents(limit = 200) {
  return readJsonl(LEXICON_LEARNING_PATHS.learningEvents, limit).reverse();
}

export function readLexiconProposals() {
  const data = readJson(LEXICON_LEARNING_PATHS.proposals, {
    version: "lexicon_proposals_v1",
    proposals: {},
  });
  return data.proposals || {};
}

export function upsertLexiconProposal(proposal) {
  const store = readJson(LEXICON_LEARNING_PATHS.proposals, {
    version: "lexicon_proposals_v1",
    proposals: {},
  });
  store.proposals[proposal.id] = proposal;
  store.updatedAt = new Date().toISOString();
  writeJson(LEXICON_LEARNING_PATHS.proposals, store);
  return proposal;
}

export function readRejectedLexiconProposals() {
  const data = readJson(LEXICON_LEARNING_PATHS.rejected, {
    version: "lexicon_rejected_v1",
    rejected: {},
  });
  return data.rejected || {};
}

export function markLexiconProposalRejected(proposalId, reason, meta = {}) {
  const store = readJson(LEXICON_LEARNING_PATHS.rejected, {
    version: "lexicon_rejected_v1",
    rejected: {},
  });
  store.rejected[proposalId] = {
    proposalId,
    reason,
    rejectedAt: new Date().toISOString(),
    ...meta,
  };
  store.updatedAt = new Date().toISOString();
  writeJson(LEXICON_LEARNING_PATHS.rejected, store);
}

export function readPromotedLexiconFile() {
  const filePath = resolvePath(LEXICON_LEARNING_PATHS.promoted);
  if (!fs.existsSync(filePath)) {
    return { version: "promoted_lexicon_v1", updatedAt: null, entries: {} };
  }
  const stat = fs.statSync(filePath);
  if (promotedCache && stat.mtimeMs === promotedMtime) {
    return promotedCache;
  }
  const data = readJson(LEXICON_LEARNING_PATHS.promoted, {
    version: "promoted_lexicon_v1",
    updatedAt: null,
    entries: {},
  });
  promotedCache = data;
  promotedMtime = stat.mtimeMs;
  return data;
}

export function getPromotedLexiconMap() {
  return readPromotedLexiconFile().entries || {};
}

export function promoteLexiconEntry(canonicalKey, entry) {
  const store = readPromotedLexiconFile();
  store.entries[canonicalKey] = {
    ...entry,
    promotedAt: new Date().toISOString(),
  };
  store.updatedAt = new Date().toISOString();
  writeJson(LEXICON_LEARNING_PATHS.promoted, store);
  invalidatePromotedLexiconCache();
  readPromotedLexiconFile();
  return store.entries[canonicalKey];
}

export function revokePromotedLexiconEntry(canonicalKey, reason = "manual_revoke") {
  const store = readPromotedLexiconFile();
  if (!store.entries[canonicalKey]) return false;
  const removed = store.entries[canonicalKey];
  delete store.entries[canonicalKey];
  store.updatedAt = new Date().toISOString();
  writeJson(LEXICON_LEARNING_PATHS.promoted, store);
  recordLexiconLearningEvent({
    type: "revoked",
    canonicalKey,
    reason,
    entry: removed,
  });
  invalidatePromotedLexiconCache();
  return true;
}

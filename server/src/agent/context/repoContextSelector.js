/**
 * Sélection intelligente de contexte repo — BM25 file-level + boost intent.
 * Doctrine Citadelle : 5–10 fichiers pertinents, pas dump brut 128K.
 */
import { tokenizeTechText } from "../router/routerUtils.js";
import { extractFilePathsFromText } from "../policies/guards/index.js";

const DEFAULT_MAX_FILES = 8;
const DEFAULT_MIN_SCORE = 0.08;
const PREVIEW_CHARS_PER_CHUNK = 240;
const MAX_PREVIEW_PER_FILE = 1200;

const INTENT_PATH_BOOSTS = Object.freeze({
  code_review: [/\.(js|jsx|ts|tsx|py|php)$/i, /server\/src\/agent/i, /tests\//i],
  code_debug: [/\.(js|jsx|ts|tsx|py|php)$/i, /server\/src/i],
  code_explain: [/\.(js|jsx|ts|tsx|py)$/i],
  code_refactor: [/server\/src/i],
  code_correction: [/server\/src/i, /tests\//i],
  code_audit: [/server\/src/i, /citadelle-vault/i],
  code_generation: [/server\/src/i, /src\//i],
  self_analysis: [
    /server\/src\/agent/i,
    /tests\//i,
    /citadelle-vault\/Citadelle\/02-Architecture/i,
  ],
  document_analysis: [/\.(md|pdf|txt)$/i, /citadelle-vault/i],
});

function normalizePath(filePath = "") {
  return String(filePath).trim().replace(/\\/g, "/").toLowerCase();
}

function basenameOf(filePath = "") {
  const normalized = normalizePath(filePath);
  return normalized.split("/").pop() || normalized;
}

/**
 * Agrège les chunks workspace_index par fichier.
 * @param {Array<{ path?: string, symbol?: string, text?: string, kind?: string }>} entries
 */
export function aggregateChunksByFile(entries = []) {
  const byFile = new Map();

  for (const entry of entries) {
    const rawPath = entry?.path;
    if (!rawPath) continue;

    const key = normalizePath(rawPath);
    if (!byFile.has(key)) {
      byFile.set(key, {
        path: rawPath.replace(/\\/g, "/"),
        symbols: new Set(),
        previewParts: [],
        chunkCount: 0,
      });
    }

    const file = byFile.get(key);
    file.chunkCount += 1;
    if (entry.symbol && entry.symbol !== "content") {
      file.symbols.add(String(entry.symbol));
    }

    const snippet = String(entry.text || "").slice(0, PREVIEW_CHARS_PER_CHUNK);
    if (snippet && file.previewParts.join("").length < MAX_PREVIEW_PER_FILE) {
      file.previewParts.push(snippet);
    }
  }

  return [...byFile.values()].map((file) => ({
    path: file.path,
    symbols: [...file.symbols],
    chunkCount: file.chunkCount,
    preview: file.previewParts.join("\n").slice(0, MAX_PREVIEW_PER_FILE),
    document: buildFileDocument(file),
  }));
}

function buildFileDocument(file) {
  const symbols = file.symbols.size ? [...file.symbols].join(" ") : "";
  return `[File: ${file.path} | Symbols: ${symbols || "none"}]\n${file.previewParts.join("\n")}`;
}

function buildBm25State(documents = []) {
  const docs = documents.map((doc, index) => ({
    id: doc.path || `file-${index}`,
    document: doc.document || "",
    metadata: { path: doc.path, symbols: doc.symbols, chunkCount: doc.chunkCount },
    tf: {},
    len: 0,
  }));

  const tokenized = docs.map((doc) => tokenizeTechText(doc.document));
  const N = tokenized.length || 1;
  const avgDl =
    tokenized.reduce((sum, tokens) => sum + tokens.length, 0) / N || 1;

  const df = {};
  for (const tokens of tokenized) {
    for (const token of new Set(tokens)) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  const idf = {};
  for (const [token, docFreq] of Object.entries(df)) {
    idf[token] = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
  }

  for (let i = 0; i < docs.length; i += 1) {
    const tokens = tokenized[i];
    const tf = {};
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }
    docs[i].tf = tf;
    docs[i].len = tokens.length || 1;
  }

  return { docs, idf, avgDl };
}

function scoreBm25(queryTokens, doc, idf, avgDl, k1 = 1.5, b = 0.75) {
  let score = 0;
  for (const token of queryTokens) {
    const freq = doc.tf[token] || 0;
    if (!freq) continue;
    const idfValue = idf[token] || 0;
    const numerator = freq * (k1 + 1);
    const denominator = freq + k1 * (1 - b + b * (doc.len / avgDl));
    score += idfValue * (numerator / denominator);
  }
  return score;
}

function computeIntentPathBoost(intent = "", filePath = "") {
  const patterns = INTENT_PATH_BOOSTS[intent];
  if (!patterns?.length) return 0;

  const normalized = normalizePath(filePath);
  let boost = 0;
  for (const pattern of patterns) {
    if (pattern.test(normalized) || pattern.test(basenameOf(normalized))) {
      boost += 0.12;
    }
  }
  return Math.min(0.36, boost);
}

function computeExplicitFileBoost(query = "", filePath = "") {
  const explicit = extractFilePathsFromText(query).map(normalizePath);
  if (!explicit.length) return 0;

  const base = normalizePath(basenameOf(filePath));
  const full = normalizePath(filePath);

  for (const name of explicit) {
    if (base === name || full.endsWith(`/${name}`) || full.includes(name)) {
      return 0.55;
    }
  }
  return 0;
}

function promoteTierFiles(rows = [], { activeFiles = [], seenFiles = [] } = {}) {
  const activeBases = new Set((activeFiles || []).map((f) => basenameOf(f)));
  const seenBases = new Set((seenFiles || []).map((f) => basenameOf(f)));

  const active = [];
  const seen = [];
  const rest = [];

  for (const row of [...rows].sort((a, b) => b.score - a.score)) {
    const base = basenameOf(row.path);
    if (activeBases.has(base)) {
      active.push(row);
    } else if (seenBases.has(base)) {
      seen.push(row);
    } else {
      rest.push(row);
    }
  }

  return [...active, ...seen, ...rest];
}

function computeTierBoost(filePath = "", { activeFiles = [], seenFiles = [] } = {}) {
  const base = basenameOf(filePath);
  const normalized = normalizePath(filePath);

  const active = (activeFiles || []).map((f) => normalizePath(basenameOf(f)));
  const seen = (seenFiles || []).map((f) => normalizePath(basenameOf(f)));

  if (active.includes(base) || active.some((f) => normalized.includes(f))) {
    return 0.75;
  }
  if (seen.includes(base) || seen.some((f) => normalized.includes(f))) {
    return 0.18;
  }
  return 0;
}

/**
 * @param {{
 *   query?: string,
 *   intent?: string,
 *   indexEntries?: Array,
 *   activeFiles?: string[],
 *   seenFiles?: string[],
 *   maxFiles?: number,
 *   minScore?: number,
 * }} input
 */
export function selectRepoContext(input = {}) {
  const {
    query = "",
    intent = "general",
    indexEntries = [],
    activeFiles = [],
    seenFiles = [],
    maxFiles = DEFAULT_MAX_FILES,
    minScore = DEFAULT_MIN_SCORE,
  } = input;

  const files = aggregateChunksByFile(indexEntries);
  if (!files.length || !String(query).trim()) {
    return {
      files: [],
      confidence: "low",
      needsClarification: true,
      reason: "empty_index_or_query",
      signals: [],
    };
  }

  const bm25 = buildBm25State(files);
  const queryTokens = tokenizeTechText(query);
  const signals = [];

  const scored = bm25.docs.map((doc) => {
      const bm25Score = scoreBm25(queryTokens, doc, bm25.idf, bm25.avgDl);
      const intentBoost = computeIntentPathBoost(intent, doc.metadata.path);
      const explicitBoost = computeExplicitFileBoost(query, doc.metadata.path);
      const tierBoost = computeTierBoost(doc.metadata.path, { activeFiles, seenFiles });
      const finalScore = bm25Score + intentBoost + explicitBoost + tierBoost;

      const reasons = [];
      if (bm25Score > 0) reasons.push("bm25");
      if (intentBoost > 0) reasons.push("intent_boost");
      if (explicitBoost > 0) reasons.push("explicit_file");
      if (tierBoost > 0) reasons.push(tierBoost >= 0.5 ? "active_file" : "seen_file");

      return {
        path: doc.metadata.path,
        score: Number(finalScore.toFixed(4)),
        bm25Score: Number(bm25Score.toFixed(4)),
        symbols: doc.metadata.symbols || [],
        chunkCount: doc.metadata.chunkCount || 0,
        reasons,
      };
    });

  const filtered = scored.filter((row) => row.score >= minScore);
  const ranked = promoteTierFiles(filtered, { activeFiles, seenFiles }).slice(
    0,
    maxFiles,
  );

  if (ranked.some((r) => r.reasons.includes("explicit_file"))) {
    signals.push("explicit_file_match");
  }
  if (ranked.some((r) => r.reasons.includes("intent_boost"))) {
    signals.push("intent_path_boost");
  }
  if (ranked.some((r) => r.reasons.includes("active_file"))) {
    signals.push("active_file_tier");
  }

  const top = ranked[0]?.score || 0;
  const gap = top - (ranked[1]?.score || 0);
  let confidence = "low";
  if (top >= 0.45 && gap >= 0.08) confidence = "high";
  else if (top >= 0.2) confidence = "medium";

  const needsClarification =
    ranked.length === 0 ||
    (confidence === "low" && !ranked.some((r) => r.reasons.includes("explicit_file")));

  return {
    files: ranked,
    confidence,
    needsClarification,
    reason: ranked.length ? "selected" : "no_match_above_threshold",
    signals,
    meta: {
      candidateCount: files.length,
      returned: ranked.length,
      intent,
    },
  };
}

/**
 * Formate un paquet contexte injectable (pointeurs, pas dump intégral).
 */
export function buildRepoContextPacket(selection = {}) {
  if (!selection?.files?.length) {
    return {
      kind: "repo_context_v1",
      status: "insufficient",
      message:
        "Je ne peux pas identifier de fichiers repo pertinents avec confiance suffisante. Précise un chemin, un module ou joins le fichier.",
      files: [],
    };
  }

  return {
    kind: "repo_context_v1",
    status: selection.needsClarification ? "tentative" : "ready",
    confidence: selection.confidence,
    files: selection.files.map((f) => ({
      path: f.path,
      score: f.score,
      symbols: f.symbols?.slice(0, 8) || [],
      reasons: f.reasons,
      pointer: { file: f.path, lines: null, expand: true },
    })),
    signals: selection.signals || [],
  };
}

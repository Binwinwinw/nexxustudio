/**
 * Hybrid Retrieval — BM25 + vecteur (knowledgeHub) + RRF + rerank léger.
 */
import fs from 'fs';
import { tokenizeTechText } from '../agent/router/routerUtils.js';
import {
  attachSourceRelevance,
  computeRetrievalConfidence,
  CONFIDENCE_THRESHOLDS,
  filterSourcesByRelevance,
} from './confidenceThresholds.js';

const DEFAULT_RRF_K = 60;

function buildBm25Index(documents = []) {
  const docs = documents.map((doc, index) => ({
    id: doc.id || `doc-${index}`,
    document: doc.content || doc.document || '',
    metadata: doc.metadata || {},
  }));

  const tokenizedDocs = docs.map((doc) => tokenizeTechText(doc.document));
  const N = tokenizedDocs.length || 1;
  const avgDl =
    tokenizedDocs.reduce((sum, tokens) => sum + tokens.length, 0) / N || 1;

  const df = {};
  for (const tokens of tokenizedDocs) {
    const unique = new Set(tokens);
    for (const token of unique) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  const idf = {};
  for (const [token, docFreq] of Object.entries(df)) {
    idf[token] = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
  }

  const postings = docs.map((doc, index) => {
    const tokens = tokenizedDocs[index];
    const tf = {};
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }
    return { ...doc, tf, len: tokens.length || 1 };
  });

  return { docs: postings, idf, avgDl, N };
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

/**
 * @param {Array} vectorResults
 * @param {Array} bm25Results
 * @param {object} config
 */
export function reciprocalRankFusion(vectorResults, bm25Results, config = {}) {
  const k = config.rrfK ?? DEFAULT_RRF_K;
  const vectorWeight = config.vectorWeight ?? 0.7;
  const bm25Weight = config.bm25Weight ?? 0.3;
  const scoreMap = new Map();
  const docById = new Map();

  vectorResults.forEach((result, index) => {
    const docId = result.id || result.metadata?.id || result.document;
    docById.set(docId, result);
    const score = vectorWeight * (1 / (k + index + 1));
    scoreMap.set(docId, (scoreMap.get(docId) || 0) + score);
  });

  bm25Results.forEach((result, index) => {
    const docId = result.id || result.metadata?.id || result.document;
    docById.set(docId, result);
    const score = bm25Weight * (1 / (k + index + 1));
    scoreMap.set(docId, (scoreMap.get(docId) || 0) + score);
  });

  return Array.from(scoreMap.entries())
    .map(([docId, score]) => {
      const source = docById.get(docId) || { document: docId, id: docId };
      return {
        id: docId,
        document: source.document,
        metadata: source.metadata || {},
        score,
        method: 'hybrid',
      };
    })
    .sort((a, b) => b.score - a.score);
}

export class HybridRetrieval {
  constructor(options = {}) {
    this.bm25IndexPath = options.bm25IndexPath || null;
    this.documents = options.documents || [];
    this.knowledgeHub = options.knowledgeHub || null;
    this.vectorWeight = options.vectorWeight ?? 0.7;
    this.bm25Weight = options.bm25Weight ?? 0.3;
    this.bm25State = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.bm25IndexPath && fs.existsSync(this.bm25IndexPath)) {
      const raw = JSON.parse(fs.readFileSync(this.bm25IndexPath, 'utf-8'));
      this.documents = raw.documents || raw;
    }

    this.bm25State = buildBm25Index(this.documents);
    this.initialized = true;

    if (this.knowledgeHub?.init) {
      await this.knowledgeHub.init();
    }

    return this;
  }

  bm25Search(query, topK = 10) {
    if (!this.bm25State) return [];

    const queryTokens = tokenizeTechText(query);
    const { docs, idf, avgDl } = this.bm25State;

    return docs
      .map((doc) => ({
        id: doc.id,
        document: doc.document,
        metadata: doc.metadata,
        score: scoreBm25(queryTokens, doc, idf, avgDl),
        method: 'bm25',
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async vectorSearch(query, topK = 10) {
    if (!this.knowledgeHub?.query) {
      return [];
    }

    const results = await this.knowledgeHub.query(query, topK);
    return results.map((result) => ({
      id: result.id,
      document: result.content,
      metadata: result.metadata || {},
      score: 1 - Math.min(1, result.distance ?? 1),
      method: 'vector',
    }));
  }

  rerank(_query, candidates = []) {
    return [...candidates].sort((a, b) => b.score - a.score);
  }

  async search(query, topK = 10, config = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const fusionConfig = {
      vectorWeight: config.vectorWeight ?? this.vectorWeight,
      bm25Weight: config.bm25Weight ?? this.bm25Weight,
      rrfK: config.rrfK,
    };

    const vectorResults = await this.vectorSearch(query, topK * 2);
    const bm25Results = this.bm25Search(query, topK * 2);
    const fused = reciprocalRankFusion(vectorResults, bm25Results, fusionConfig);

    const reranked = this.rerank(query, fused.slice(0, topK * 3));
    const combinedResults = reranked.slice(0, topK * 3);

    const confidence = computeRetrievalConfidence(combinedResults, {
      ...fusionConfig,
      threshold:
        config.confidenceThreshold ??
        CONFIDENCE_THRESHOLDS.MINIMUM_CONFIDENCE,
    });

    const withRelevance = attachSourceRelevance(combinedResults, fusionConfig);
    const filteredSources = filterSourcesByRelevance(
      withRelevance,
      config.sourceRelevanceMin ?? CONFIDENCE_THRESHOLDS.SOURCE_RELEVANCE_MIN,
    );

    const resultsWithConfidence = filteredSources.slice(0, topK).map((result) => ({
      ...result,
      confidence: confidence.score,
      confidenceLevel: confidence.level,
      reranked: true,
    }));

    if (config.legacyArray === true) {
      return resultsWithConfidence;
    }

    return {
      results: resultsWithConfidence,
      confidence,
      query,
      totalResults: combinedResults.length,
      filteredOut: combinedResults.length - filteredSources.length,
    };
  }

  async ingest(chunks = [], metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const docs = chunks.map((content, index) => ({
      id: metadata.id ? `${metadata.id}-${index}` : `chunk-${this.documents.length + index}`,
      content,
      metadata: { ...metadata, chunkIndex: index },
    }));

    this.documents.push(...docs);
    this.bm25State = buildBm25Index(this.documents);

    if (this.knowledgeHub?.addDocuments) {
      await this.knowledgeHub.addDocuments(
        docs.map((doc) => ({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
        })),
      );
    }

    return docs.length;
  }
}

export default HybridRetrieval;

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import HybridRetrievalModule, {
  HybridRetrieval,
  reciprocalRankFusion,
} from '../src/retrieval/hybrid-retrieval.js';

describe('hybrid-retrieval ESM', () => {
  it('exporte HybridRetrieval comme classe', () => {
    assert.equal(typeof HybridRetrieval, 'function');
  });

  it('exporte HybridRetrieval comme default', () => {
    assert.equal(HybridRetrievalModule, HybridRetrieval);
  });

  it('initialise avec corpus BM25 en mémoire', async () => {
    const retrieval = new HybridRetrieval({
      documents: [
        { id: 'a', content: 'consensus SMAC seuil 0.75' },
        { id: 'b', content: 'architecture orchestrateur Citadelle' },
      ],
    });

    await retrieval.initialize();
    assert.equal(retrieval.initialized, true);
    assert.ok(retrieval.bm25State.docs.length >= 2);
  });

  it('fusionne vector + BM25 avec RRF', () => {
    const fused = reciprocalRankFusion(
      [
        { id: 'a', document: 'doc a', metadata: { id: 'a' }, score: 0.9, method: 'vector' },
      ],
      [
        { id: 'b', document: 'doc b', metadata: { id: 'b' }, score: 1.2, method: 'bm25' },
      ],
      { vectorWeight: 0.7, bm25Weight: 0.3 },
    );

    assert.equal(fused.length, 2);
    assert.equal(fused[0].method, 'hybrid');
  });

  it('search retourne payload confiance + résultats BM25 sans Chroma', async () => {
    const retrieval = new HybridRetrieval({
      documents: [
        { id: 'smac', content: 'Seuils SMAC consensus 0.75 et SOTA 0.95' },
        { id: 'wiki', content: 'Compilation wiki Obsidian ADR modules' },
      ],
    });

    const payload = await retrieval.search('SMAC consensus', 5);
    assert.ok(payload && typeof payload === 'object');
    assert.ok(Array.isArray(payload.results));
    assert.ok(payload.results.length > 0);
    assert.match(String(payload.results[0].document), /SMAC/i);
    assert.ok(payload.confidence);
    assert.equal(typeof payload.confidence.score, 'number');
  });

  it('search legacyArray conserve le tableau seul', async () => {
    const retrieval = new HybridRetrieval({
      documents: [{ id: 'smac', content: 'Seuils SMAC consensus 0.75' }],
    });

    const results = await retrieval.search('SMAC', 3, { legacyArray: true });
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  it('ingest enrichit le corpus', async () => {
    const retrieval = new HybridRetrieval({ documents: [] });
    const count = await retrieval.ingest(['nouveau chunk RAG'], { id: 'chunk' });
    assert.equal(count, 1);
    assert.equal(retrieval.documents.length, 1);
  });
});

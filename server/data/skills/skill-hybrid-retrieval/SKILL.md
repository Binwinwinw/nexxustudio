# Skill : Hybrid Retrieval (v1.0)

Parent : [[skill-rag-ingestion]]

Runtime : `server/src/retrieval/hybrid-retrieval.js`

## Mission
Combiner recherche lexicale BM25 et recherche vectorielle (Chroma via knowledgeHub) avec fusion RRF.

## Pipeline
1. BM25 local sur corpus ingéré
2. Vecteur via `knowledgeHub.query` si disponible
3. RRF (`reciprocalRankFusion`)
4. Rerank score-based

## Fallback
Si Chroma indisponible → BM25 seul (fail-open contrôlé).

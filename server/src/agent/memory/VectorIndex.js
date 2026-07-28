
import fs from 'fs/promises';
import path from 'path';

/**
 * Un index vectoriel ultra-léger pour Nexxus Citadel.
 * Stocke les embeddings et permet la recherche par similarité cosinus.
 */
class VectorIndex {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.vectors = []; // { id, embedding, metadata, text }
  }

  /**
   * Calcule la similarité cosinus entre deux vecteurs
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Ajoute un document à l'index
   */
  add(id, embedding, text, metadata = {}) {
    this.vectors.push({ id, embedding, text, metadata });
  }

  /**
   * Recherche les top K documents les plus proches
   */
  search(queryEmbedding, topK = 3) {
    if (this.vectors.length === 0) return [];

    const results = this.vectors.map(vec => ({
      ...vec,
      score: this.cosineSimilarity(queryEmbedding, vec.embedding)
    }));

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async save(storagePath) {
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, JSON.stringify(this.vectors, null, 2));
  }

  async load(storagePath) {
    try {
      const data = await fs.readFile(storagePath, 'utf8');
      this.vectors = JSON.parse(data);
    } catch (e) {
      this.vectors = [];
    }
  }
}

export default VectorIndex;

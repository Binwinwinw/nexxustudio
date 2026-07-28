import { ChromaClient } from 'chromadb';
import ollama from '../llm/ollama.js';

/**
 * KnowledgeHub - Gestionnaire de Mémoire Vectorielle Souveraine (Industrial v4.0)
 * Permet de stocker et retrouver des connaissances sémantiques avec idempotence forte.
 */
class OllamaEmbeddingFunction {
  async generate(texts) {
    const embeddings = [];
    for (const text of texts) {
      const vector = await ollama.getEmbedding(text);
      if (vector) embeddings.push(vector);
    }
    return embeddings;
  }
}

class KnowledgeHub {
  constructor() {
    this.client = new ChromaClient({
      host: process.env.CHROMA_HOST || "127.0.0.1",
      port: Number(process.env.CHROMA_PORT || 8008),
      ssl: false
    });
    this.collectionName = "citadel_knowledge";
    this.collection = null;
    this.embedder = new OllamaEmbeddingFunction();
    this.initPromise = null;
  }

  /**
   * Initialisation sécurisée (Singleton Pattern / Concurrency Guard)
   */
  async init() {
    if (this.collection) return this.collection;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log(`[KnowledgeHub] 🧠 Connexion à ChromaDB...`);
        await this.client.heartbeat();
        this.collection = await this.client.getOrCreateCollection({
          name: this.collectionName,
          metadata: { "description": "Mémoire collective de La Citadelle" },
          embeddingFunction: this.embedder
        });
        console.log(`[KnowledgeHub] ✅ Collection [${this.collectionName}] prête.`);
        return this.collection;
      } catch (error) {
        this.initPromise = null; // Autoriser le retry
        console.warn("[KnowledgeHub] ⚠️ ChromaDB injoignable ou désactivé temporairement:", error.message);
        return null; // Ne pas propager l'erreur pour désactiver gracieusement
      }
    })();

    return this.initPromise;
  }

  /**
   * Ajoute ou met à jour (Upsert) des documents à la mémoire vectorielle.
   * Garantit l'idempotence par ID.
   */
  async addDocuments(docs) {
    if (!this.collection) await this.init();
    if (!this.collection) {
      console.warn(`[KnowledgeHub] ⚠️ Ignoré (ChromaDB hors ligne).`);
      return;
    }

    const ids = [];
    const embeddings = [];
    const metadatas = [];
    const contents = [];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (!doc.content || !doc.id) {
        console.warn(`⚠️ [KnowledgeHub] Document ignoré (ID ou contenu manquant).`);
        continue;
      }

      const id = doc.id;
      const metadata = doc.metadata || {};
      
      console.log(`[KnowledgeHub] ⚡ Embedding doc: ${id}...`);
      const vector = await ollama.getEmbedding(`search_document: ${doc.content}`);
      
      if (vector) {
        ids.push(id);
        embeddings.push(vector);
        
        // Normalisation et protection des métadonnées
        const meta = {
          type: metadata.type || 'unknown',
          project: metadata.project || 'general',
          category: metadata.category || 'general',
          source: metadata.source || 'unknown',
          source_display_name: metadata.source_display_name || metadata.source || 'Unknown Source',
          title: metadata.title || 'Untitled',
          version: String(metadata.version || '1.0'),
          status: metadata.status || 'active',
          ingest_origin: metadata.ingest_origin || 'manual',
          chunk_id: Number(metadata.chunk_id || 1),
          total_chunks: Number(metadata.total_chunks || 1),
          tags: Array.isArray(metadata.tags) ? metadata.tags.join(',') : (metadata.tags || ''),
          timestamp: metadata.timestamp || new Date().toISOString()
        };
        
        metadatas.push(meta);
        contents.push(doc.content);
      }
    }

    if (ids.length > 0) {
      // 🛡️ Passage au UPSERT (Idempotence)
      await this.collection.upsert({
        ids,
        embeddings,
        metadatas,
        documents: contents
      });
      console.log(`[KnowledgeHub] 📥 ${ids.length} documents synchronisés (upsert).`);
    }
  }

  /**
   * Vérifie si un document existe en mémoire par son ID.
   * Retourne un booléen net.
   */
  async exists(id) {
    if (!id) return false;
    const foundIds = await this.getDocuments([id]);
    return Array.isArray(foundIds) && foundIds.includes(id);
  }

  /**
   * Récupère les IDs de documents existants parmi une liste. (Usage interne)
   */
  async getDocuments(ids = []) {
    if (!ids.length) return [];
    if (!this.collection) await this.init();
    if (!this.collection) return [];
    try {
      const result = await this.collection.get({ ids });
      return result.ids || [];
    } catch (e) {
      console.error(`[KnowledgeHub] Error getDocuments:`, e.message);
      return [];
    }
  }

  /**
   * Recherche sémantique (RAG)
   */
  async query(text, nResults = 5, filter = null) {
    if (!this.collection) await this.init();
    if (!this.collection) return [];

    try {
      const queryEmbedding = await ollama.getEmbedding(`search_query: ${text}`);
      if (!queryEmbedding) return [];

      const queryParams = {
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: ["documents", "metadatas", "distances"]
      };

      if (filter) {
        queryParams.where = filter;
      }

      const results = await this.collection.query(queryParams);

      if (!results.ids || !results.ids[0]) return [];

      return results.ids[0].map((id, idx) => ({
        id,
        content: results.documents[0][idx],
        metadata: results.metadatas[0][idx],
        distance: results.distances[0][idx]
      }));
    } catch (error) {
      console.error("[KnowledgeHub] ❌ Erreur de recherche:", error.message);
      return [];
    }
  }

  async getLatestIncidents(limit = 10) {
    if (!this.collection) await this.init();
    if (!this.collection) return [];
    try {
      const results = await this.collection.get({
        where: { "type": "incident" },
        limit: limit,
      });

      return (results.ids || []).map((id, i) => ({
        id,
        content: results.documents[i],
        metadata: results.metadatas[i],
        timestamp: results.metadatas[i].timestamp
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error("[KnowledgeHub] ❌ Erreur getLatestIncidents:", error.message);
      return [];
    }
  }

  async getLatestPromotions(limit = 5) {
    if (!this.collection) await this.init();
    if (!this.collection) return [];
    try {
      const results = await this.collection.get({
        where: { "type": "episodic" },
        limit: limit,
      });

      return (results.ids || []).map((id, i) => ({
        id,
        content: results.documents[i],
        metadata: results.metadatas[i],
        timestamp: results.metadatas[i].timestamp
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error("[KnowledgeHub] ❌ Erreur getLatestPromotions:", error.message);
      return [];
    }
  }
}

export default new KnowledgeHub();

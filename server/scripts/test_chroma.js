
import { ChromaClient } from 'chromadb';

/**
 * Script de test permanent pour vérifier l'état du Knowledge Hub (ChromaDB)
 * Usage: node server/scripts/test_chroma.js
 */
async function runTest() {
  const host = "127.0.0.1";
  const port = 8008;
  
  console.log(`[TEST] 🧪 Tentative de connexion à ChromaDB sur ${host}:${port}...`);
  
  const client = new ChromaClient({ host, port });
  
  try {
    const heartbeat = await client.heartbeat();
    console.log(`[TEST] ✅ Heartbeat reçu:`, heartbeat);
    
    const collectionName = "citadel_test_connection";
    console.log(`[TEST] 📂 Création/Récupération de la collection [${collectionName}]...`);
    
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      metadata: { "description": "Collection de test technique" }
    });
    
    const testId = `test_${Date.now()}`;
    console.log(`[TEST] 📥 Ajout d'un document témoin [${testId}]...`);
    
    await collection.add({
      ids: [testId],
      embeddings: [new Array(768).fill(0)], // Dummy vector
      documents: ["Ceci est un document de test pour valider la chaîne de persistance souveraine."],
      metadatas: [{ source: "test_script", timestamp: new Date().toISOString() }]
    });
    
    console.log(`[TEST] 🔍 Recherche sémantique de validation...`);
    const results = await collection.query({
      queryEmbeddings: [new Array(768).fill(0)],
      nResults: 1
    });
    
    if (results.ids[0].includes(testId)) {
      console.log(`[TEST] 🏆 SUCCÈS : La chaîne de lecture/écriture est opérationnelle.`);
    } else {
      console.warn(`[TEST] ⚠️ AVERTISSEMENT : Document non retrouvé dans les résultats.`);
    }
    
    // Nettoyage optionnel
    // await client.deleteCollection({ name: collectionName });
    
  } catch (error) {
    console.error(`[TEST] ❌ ÉCHEC CRITIQUE :`, error.message);
    if (error.message.includes("ECONNREFUSED")) {
      console.error(`[TEST] 👉 Vérifiez que le conteneur 'nexxus-chroma' est bien démarré sur le port ${port}.`);
    }
    process.exit(1);
  }
}

runTest();

import { ChromaClient } from 'chromadb';

const client = new ChromaClient({ host: "127.0.0.1", port: 8008 });

async function purge() {
  try {
    console.log("🧹 Purge de la collection ChromaDB [citadel_knowledge]...");
    await client.deleteCollection({ name: "citadel_knowledge" });
    console.log("✅ Collection supprimée.");
  } catch (e) {
    console.log("⚠️ La collection n'existait pas ou a déjà été supprimée.");
  }
}

purge().catch(console.error);

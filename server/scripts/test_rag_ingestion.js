import WorkspaceIndexer from '../src/indexer/workspaceIndexer.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, '../../');
const targetModule = path.join(rootPath, 'server/src/agent');

async function runTestIndex() {
  console.log("🚀 Lancement de l'indexation RAG ciblée...");
  console.log(`Cible : ${targetModule}`);
  
  const indexer = new WorkspaceIndexer(rootPath);
  
  // Simulation d'un log progressif
  await indexer.index((msg) => {
    console.log(`[PROGRESS] ${msg}`);
  });
  
  console.log("✅ Indexation terminée.");
}

runTestIndex().catch(err => {
  console.error("❌ Échec de l'indexation :", err);
  process.exit(1);
});

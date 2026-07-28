
import WorkspaceIndexer from './src/indexer/workspaceIndexer.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, '../');

const indexer = new WorkspaceIndexer(rootPath);

console.log("🚀 [Nexxus Citadel] Lancement de l'indexation initiale...");
indexer.index((msg) => console.log(msg))
  .then(() => {
    console.log("✅ Indexation réussie. La Citadelle est prête.");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Échec de l'indexation :", err);
    process.exit(1);
  });

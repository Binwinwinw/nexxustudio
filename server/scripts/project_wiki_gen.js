import fs from 'fs/promises';
import path from 'path';

const targetPath = process.argv[2];
const projectName = process.argv[3] || path.basename(targetPath);
const VAULT_MODULES_PATH = '../citadelle-vault/Citadelle/02-Architecture/modules';

async function generateWiki() {
  console.log(`📚 [WIKI-GEN] Génération de la fiche projet pour ${projectName}...`);
  
  const stats = await getProjectStats(targetPath);
  
  let content = `# Projet : ${projectName}\n`;
  content += `> **Source** : \`${targetPath}\`\n`;
  content += `> **Statut** : 🔵 Indexé dans le Knowledge Hub\n`;
  content += `> **Dernière Analyse** : ${new Date().toLocaleDateString()}\n\n`;
  
  content += `## 🏗️ Structure du Projet\n`;
  content += `- **Fichiers analysés** : ${stats.fileCount}\n`;
  content += `- **Extensions principales** : ${stats.extensions.join(', ')}\n\n`;
  
  content += `## 🧠 Connaissance Citadelle\n`;
  content += `Ce projet est désormais disponible pour consultation via le moteur RAG. Vous pouvez poser des questions sur son architecture, ses dépendances ou sa sécurité.\n\n`;
  
  content += `## 🛠️ Actions Disponibles\n`;
  content += `- [ ] Lancer un Audit SOTA\n`;
  content += `- [ ] Générer le Dockerfile (ADR-010)\n`;
  content += `- [ ] Vérifier la conformité ADR-009\n\n`;

  const fileName = `${projectName.replace(/\s+/g, '-')}.md`;
  const filePath = path.join(VAULT_MODULES_PATH, fileName);
  
  await fs.mkdir(VAULT_MODULES_PATH, { recursive: true });
  await fs.writeFile(filePath, content);
  
  console.log(`✅ Fiche projet générée : ${filePath}`);
}

async function getProjectStats(dir) {
  let fileCount = 0;
  const exts = new Set();
  
  async function scan(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', '.memory'].includes(entry.name)) continue;
      if (entry.isDirectory()) {
        await scan(path.join(d, entry.name));
      } else {
        fileCount++;
        exts.add(path.extname(entry.name));
      }
    }
  }
  
  await scan(dir);
  return { fileCount, extensions: Array.from(exts).slice(0, 5) };
}

generateWiki().catch(console.error);

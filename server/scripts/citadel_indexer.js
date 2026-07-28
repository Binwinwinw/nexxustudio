import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import knowledgeHub from '../src/services/knowledgeHub.js';
import parser from '../src/indexer/codeParser.js';

// Récupération des arguments : node citadel_indexer.js [path] [projectName]
const targetPath = process.argv[2];
const projectName = process.argv[3] || path.basename(targetPath);

if (!targetPath) {
  console.error("❌ Usage: node citadel_indexer.js <path> [projectName]");
  process.exit(1);
}

async function run() {
  console.log(`🚀 [CITADEL-INDEXER] Démarrage de l'indexation : ${projectName} (${targetPath})`);
  
  if (!(await fs.stat(targetPath)).isDirectory()) {
    console.error("❌ Erreur : Le chemin n'est pas un répertoire.");
    process.exit(1);
  }

  await knowledgeHub.init();
  const allFiles = await walk(targetPath);
  const eligibleFiles = allFiles.filter(f => /\.(js|ts|vue|jsx|tsx|sql|md|php|html|htaccess|py|json|yml|yaml)$/.test(f));

  console.log(`🔍 ${eligibleFiles.length} fichiers éligibles trouvés.`);

  const docsToPush = [];
  const workspaceEntries = [];

  for (const filePath of eligibleFiles) {
    try {
      const relativePath = path.relative(targetPath, filePath).replace(/\\/g, '/');
      const ext = path.extname(filePath);
      const rawChunks = await parser.parse(relativePath, filePath, ext);
      
      for (const raw of rawChunks) {
        const contentHash = crypto.createHash('sha256').update(raw.text).digest('hex').substring(0, 16);
        const chunkId = `${projectName.toLowerCase()}_${relativePath.replace(/\//g, '_')}_${raw.kind || 'block'}_${contentHash}`;

        // Pour ChromaDB
        docsToPush.push({
          id: chunkId,
          content: `[Project: ${projectName} | File: ${relativePath} | Symbol: ${raw.symbol || 'none'}]\n${raw.text}`,
          metadata: {
            source: relativePath,
            project: projectName.toLowerCase(),
            category: raw.kind || 'logic_block',
            symbol: raw.symbol || 'none',
            timestamp: new Date().toISOString()
          }
        });

        // Pour workspace_index.json
        workspaceEntries.push({
          kind: raw.kind || 'text',
          symbol: raw.symbol || 'content',
          text: raw.text,
          path: relativePath,
          security: { zone: 'general', sensitivity: 'low', exposable: true },
          hash: contentHash,
          tags: [raw.kind || 'text', 'code'],
          relations: { imports: [], calls: [] },
          language: ext
        });
      }
    } catch (err) {
      console.warn(`⚠️ Erreur sur ${filePath}:`, err.message);
    }
  }

  // 1. Ingestion ChromaDB
  if (docsToPush.length > 0) {
    console.log(`📥 Ingestion de ${docsToPush.length} fragments dans ChromaDB...`);
    const batchSize = 50;
    for (let i = 0; i < docsToPush.length; i += batchSize) {
      await knowledgeHub.addDocuments(docsToPush.slice(i, i + batchSize));
    }
  }

  // 2. Mise à jour workspace_index.json (cache régénérable)
  const indexPath = path.join(ROOT, 'server', 'cache', 'workspace_index.json');
  console.log(`📂 Mise à jour de l'index structurel : ${indexPath}`);
  let currentIndex = [];
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    currentIndex = JSON.parse(data);
  } catch (e) {
    currentIndex = [];
  }

  // Fusion intelligente (on évite les doublons par hash)
  const existingHashes = new Set(currentIndex.map(e => e.hash));
  const newEntries = workspaceEntries.filter(e => !existingHashes.has(e.hash));
  
  const updatedIndex = [...currentIndex, ...newEntries];
  await fs.writeFile(indexPath, JSON.stringify(updatedIndex, null, 2));

  console.log(`✅ Indexation de ${projectName} terminée (${newEntries.length} nouvelles entrées).`);
}

async function walk(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.memory', 'vendor'].includes(entry.name)) continue;
      files = files.concat(await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

run().catch(console.error);

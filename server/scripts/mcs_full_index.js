import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import knowledgeHub from '../src/services/knowledgeHub.js';
import parser from '../src/indexer/codeParser.js';

const MCS_ROOT = 'd:/Hostinger/public_html/moncoachscolaire.v3';
const MCS_SRC = path.join(MCS_ROOT, 'src');

async function indexMcs() {
  console.log("🚀 [MCS-MATURATION] Démarrage de l'indexation AST-aware de MonCoachScolaire...");
  await knowledgeHub.init();

  const allFiles = await walk(MCS_SRC);
  const eligibleFiles = allFiles.filter(f => /\.(js|ts|vue|jsx|tsx|sql|md)$/.test(f));

  console.log(`🔍 ${eligibleFiles.length} fichiers éligibles trouvés dans MCS/src.`);

  const docsToPush = [];

  for (const filePath of eligibleFiles) {
    try {
      const relativePath = path.relative(MCS_ROOT, filePath).replace(/\\/g, '/');
      const ext = path.extname(filePath);

      // AST-Aware parsing avec la signature correcte
      const rawChunks = await parser.parse(relativePath, filePath, ext);
      
      for (const raw of rawChunks) {
        // Dans codeParser.js, enrich est interne ou n'existe pas publiquement?
        // En fait raw.text contient déjà le texte extrait.
        const contentHash = crypto.createHash('sha256').update(raw.text).digest('hex').substring(0, 16);
        const chunkId = `mcs_chunk_${relativePath.replace(/\//g, '_')}_${raw.kind || 'block'}_${contentHash}`;

        // Contextual Header SOTA
        const contextualText = `[Project: MonCoachScolaire | File: ${relativePath} | Symbol: ${raw.symbol || 'none'}]\n${raw.text}`;

        docsToPush.push({
          id: chunkId,
          content: contextualText,
          metadata: {
            source: relativePath,
            project: 'moncoachscolaire',
            type: ext === 'md' ? 'doc' : 'code',
            category: raw.kind || 'logic_block',
            symbol: raw.symbol || 'none',
            version: '3.0-SOTA',
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (err) {
      console.warn(`⚠️ Erreur sur ${filePath}:`, err.message);
    }
  }

  if (docsToPush.length > 0) {
    console.log(`📥 Indexation de ${docsToPush.length} fragments MCS dans ChromaDB...`);
    // On pousse par lots de 50 pour éviter de saturer Ollama
    const batchSize = 50;
    for (let i = 0; i < docsToPush.length; i += batchSize) {
      const batch = docsToPush.slice(i, i + batchSize);
      await knowledgeHub.addDocuments(batch);
      console.log(`  [Progress] ${Math.min(i + batchSize, docsToPush.length)} / ${docsToPush.length}`);
    }
    console.log("✅ Indexation MonCoachScolaire terminée.");
  }
}

async function walk(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      files = files.concat(await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

indexMcs().catch(console.error);

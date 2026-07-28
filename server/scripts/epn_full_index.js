import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import knowledgeHub from '../src/services/knowledgeHub.js';
import parser from '../src/indexer/codeParser.js';

const EPN_ROOT = 'd:/Hostinger/public_html/epn-web';

async function indexEpn() {
  console.log("🚀 [EPN-MATURATION] Démarrage de l'indexation de EPN-Web...");
  await knowledgeHub.init();

  const allFiles = await walk(EPN_ROOT);
  const eligibleFiles = allFiles.filter(f => /\.(js|ts|vue|jsx|tsx|sql|md|php|html|htaccess)$/.test(f));

  console.log(`🔍 ${eligibleFiles.length} fichiers éligibles trouvés dans EPN-Web.`);

  const docsToPush = [];

  for (const filePath of eligibleFiles) {
    try {
      const relativePath = path.relative(EPN_ROOT, filePath).replace(/\\/g, '/');
      const ext = path.extname(filePath);

      // Parsing
      const rawChunks = await parser.parse(relativePath, filePath, ext);
      
      for (const raw of rawChunks) {
        const contentHash = crypto.createHash('sha256').update(raw.text).digest('hex').substring(0, 16);
        const chunkId = `epn_chunk_${relativePath.replace(/\//g, '_')}_${raw.kind || 'block'}_${contentHash}`;

        // Header Contextuel SOTA
        const contextualText = `[Project: EPN-Web | File: ${relativePath} | Symbol: ${raw.symbol || 'none'}]\n${raw.text}`;

        docsToPush.push({
          id: chunkId,
          content: contextualText,
          metadata: {
            source: relativePath,
            project: 'epn-web',
            type: ext === '.php' || ext === '.js' ? 'code' : 'doc',
            category: raw.kind || 'logic_block',
            symbol: raw.symbol || 'none',
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (err) {
      console.warn(`⚠️ Erreur sur ${filePath}:`, err.message);
    }
  }

  if (docsToPush.length > 0) {
    console.log(`📥 Indexation de ${docsToPush.length} fragments EPN-Web dans ChromaDB...`);
    const batchSize = 50;
    for (let i = 0; i < docsToPush.length; i += batchSize) {
      const batch = docsToPush.slice(i, i + batchSize);
      await knowledgeHub.addDocuments(batch);
      console.log(`  [Progress] ${Math.min(i + batchSize, docsToPush.length)} / ${docsToPush.length}`);
    }
    console.log("✅ Indexation EPN-Web terminée.");
  }
}

async function walk(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.memory'].includes(entry.name)) continue;
      files = files.concat(await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

indexEpn().catch(console.error);

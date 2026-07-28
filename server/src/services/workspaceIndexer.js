import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import knowledgeHub from './knowledgeHub.js';
import parser from '../indexer/codeParser.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

class WorkspaceIndexer {
  async indexDirectory(targetPath, projectName) {
    console.log(`🚀 [WORKSPACE-INDEXER] Indexation automatique : ${projectName} (${targetPath})`);
    
    try {
      await knowledgeHub.init();
      const allFiles = await this.walk(targetPath);
      const eligibleFiles = allFiles.filter(f => /\.(js|ts|vue|jsx|tsx|sql|md|php|html|htaccess|py|json|yml|yaml)$/.test(f));

      const docsToPush = [];
      const workspaceEntries = [];

      for (const filePath of eligibleFiles) {
        const relativePath = path.relative(targetPath, filePath).replace(/\\/g, '/');
        const ext = path.extname(filePath);
        const rawChunks = await parser.parse(relativePath, filePath, ext);
        
        for (const raw of rawChunks) {
          const contentHash = crypto.createHash('sha256').update(raw.text).digest('hex').substring(0, 16);
          const chunkId = `${projectName.toLowerCase()}_${relativePath.replace(/\//g, '_')}_${raw.kind || 'block'}_${contentHash}`;

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
      }

      // 1. ChromaDB
      if (docsToPush.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < docsToPush.length; i += batchSize) {
          await knowledgeHub.addDocuments(docsToPush.slice(i, i + batchSize));
        }
      }

      // Cache régénérable — index workspace (pas une source de vérité mémoire)
      const indexPath = path.join(ROOT, 'cache', 'workspace_index.json');
      let currentIndex = [];
      try {
        const data = await fs.readFile(indexPath, 'utf8');
        currentIndex = JSON.parse(data);
      } catch (e) { currentIndex = []; }

      const existingHashes = new Set(currentIndex.map(e => e.hash));
      const newEntries = workspaceEntries.filter(e => !existingHashes.has(e.hash));
      
      const updatedIndex = [...currentIndex, ...newEntries];
      await fs.writeFile(indexPath, JSON.stringify(updatedIndex, null, 2));

      console.log(`✅ [WORKSPACE-INDEXER] Indexation terminée (${newEntries.length} nouvelles entrées).`);
      return { success: true, count: newEntries.length };

    } catch (error) {
      console.error("❌ [WORKSPACE-INDEXER] Échec :", error.message);
      throw error;
    }
  }

  async walk(dir) {
    let files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git', '.memory', 'vendor'].includes(entry.name)) continue;
        files = files.concat(await this.walk(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }
}

export default new WorkspaceIndexer();

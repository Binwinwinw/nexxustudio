
import path from 'path';
import fs from 'fs/promises';
import fileDiscovery from './fileDiscovery.js';
import codeParser from './codeParser.js';
import chunkPolicy from './chunkPolicy.js';
import ManifestStore from './manifestStore.js';
import { getClientForModel } from '../llm/llmFactory.js';
import { AGENT_ROLES } from '../agent/policies/core/index.js';
import knowledgeHub from '../services/knowledgeHub.js';
import crypto from 'crypto';

class WorkspaceIndexer {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.manifest = new ManifestStore(path.join(rootPath, 'server/data/memory/manifest.json'));
    this.vectorStorePath = path.join(rootPath, 'server/cache/workspace_index.json');
  }

  async index(onLog) {
    const log = (msg) => {
      console.log(`[Indexer] ${msg}`);
      if (onLog) onLog(msg);
    };

    log("Démarrage de l'indexation du workspace...");
    await this.manifest.load();

    const files = await fileDiscovery.scan(this.rootPath);
    log(`${files.length} fichiers éligibles trouvés.`);

    let indexedCount = 0;
    let allChunks = [];

    // On charge l'index actuel s'il existe
    try {
      const existingData = await fs.readFile(this.vectorStorePath, 'utf8');
      allChunks = JSON.parse(existingData);
    } catch (e) {
      allChunks = [];
    }

    const client = getClientForModel(AGENT_ROLES.CHAT);

    for (const file of files) {
      const content = await fs.readFile(file.absolutePath, 'utf8');
      const hash = this.manifest.computeHash(content);

      if (this.manifest.shouldReindex(file.path, file.mtime, hash)) {
        log(`Indexation : ${file.path}`);
        
        // Supprimer les anciens chunks de ce fichier
        allChunks = allChunks.filter(c => c.path !== file.path);

        const rawChunks = await codeParser.parse(file.path, file.absolutePath, file.extension);
        const docsToPush = [];
        
        for (const raw of rawChunks) {
          const enriched = chunkPolicy.enrich(raw);
          enriched.language = file.extension;

          const normalizedPath = file.path.replace(/\\/g, '/');
          const contentHash = crypto.createHash('sha256').update(enriched.text).digest('hex').substring(0, 16);
          const chunkId = `chunk_${normalizedPath.replace(/\//g, '_')}_${raw.kind || 'block'}_${contentHash}`;

          // Enrichissement contextuel SOTA : On préfixe le texte avec le contexte parent
          const contextualText = `[File: ${normalizedPath} | Symbol: ${raw.symbol || 'none'}]\n${enriched.text}`;

          docsToPush.push({
            id: chunkId,
            content: contextualText,
            metadata: {
              source: file.path,
              type: file.extension === '.md' ? 'doc' : 'code',
              category: raw.kind || 'logic_block',
              symbol: raw.symbol || 'none',
              version: '1.2',
              timestamp: new Date().toISOString()
            }
          });

          allChunks.push(enriched);
        }

        if (docsToPush.length > 0) {
          await knowledgeHub.addDocuments(docsToPush);
        }

        this.manifest.updateEntry(file.path, file.mtime, hash);
        indexedCount++;
        
        // Sauvegarde régulière pour ne pas tout perdre en cas de crash
        if (indexedCount % 10 === 0) {
          await this.save(allChunks);
        }
      }
    }

    await this.save(allChunks);
    await this.manifest.save();
    log(`Indexation terminée. ${indexedCount} fichiers traités. Total chunks : ${allChunks.length}`);
  }

  async save(chunks) {
    await fs.mkdir(path.dirname(this.vectorStorePath), { recursive: true });
    await fs.writeFile(this.vectorStorePath, JSON.stringify(chunks, null, 2));
  }
}

export default WorkspaceIndexer;

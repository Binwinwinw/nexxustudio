
import fs from 'fs/promises';
import path from 'path';
import hub from '../src/services/knowledgeHub.js';
import chunker from '../src/services/chunker.js';

/**
 * Pilote d'ingestion pour MonCoachScolaire (MCS)
 * Ce script valide le chunking et le recall sur un projet tiers.
 */

const MCS_ROOT = path.resolve('..', 'moncoachscolaire.v3');

const FILES_TO_INDEX = [
  { path: 'README.md', type: 'doc', category: 'overview' },
  { path: 'ARCHITECTURE.md', type: 'doc', category: 'architecture' },
  { path: 'supabase_schema.sql', type: 'code', category: 'database' }
];

async function runPilot() {
  console.log("🚀 Lancement du Pilote d'ingestion MonCoachScolaire...");
  
  await hub.init();
  const docs = [];

  for (const item of FILES_TO_INDEX) {
    const fullPath = path.join(MCS_ROOT, item.path);
    try {
      console.log(`📑 Lecture de: ${item.path}...`);
      const rawContent = await fs.readFile(fullPath, 'utf8');
      const filename = path.basename(item.path);
      const fileExt = filename.split('.').pop();

      const chunks = chunker.chunk(rawContent, fileExt, {
        maxChars: 2000,
        overlap: 400,
        metadata: {
          type: item.type,
          project: 'moncoachscolaire',
          category: item.category,
          source: `moncoachscolaire/${item.path}`,
          source_display_name: filename,
          title: `[MCS] ${filename}`,
          status: 'active',
          version: '3.0',
          timestamp: new Date().toISOString()
        }
      });

      console.log(`✂️  Découpé en ${chunks.length} chunks.`);

      for (const c of chunks) {
        const id = `mcs_${item.path.replace(/[^a-z0-9]/gi, '_')}_c${c.metadata.chunk_id}`;
        docs.push({
          id,
          content: c.text,
          metadata: c.metadata
        });
      }
    } catch (err) {
      console.warn(`⚠️ Erreur sur ${item.path}:`, err.message);
    }
  }

  if (docs.length > 0) {
    console.log(`📥 Indexation de ${docs.length} fragments MCS...`);
    await hub.addDocuments(docs);
    console.log("✅ Pilote MCS terminé avec succès.");
  }
}

runPilot();

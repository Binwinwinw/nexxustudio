import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_WIKI_RAG_PATH = path.join(
  REPO_ROOT,
  'citadelle-vault',
  'Citadelle',
  'Wiki',
  'rag-adrs.json',
);

/**
 * Transforme un fichier ADR en document indexable (RAG / Chroma).
 * @param {string} adrPath
 * @param {object} [metadata]
 */
export function ingestAdr(adrPath, metadata = {}) {
  const content = fsSync.readFileSync(adrPath, 'utf8');
  const fileName = path.basename(adrPath);
  const id = metadata.id || fileName.replace(/\.md$/i, '');

  return {
    id,
    content,
    metadata: {
      source: metadata.source || fileName,
      category: metadata.category || 'governance',
      path: adrPath,
      ...metadata,
    },
  };
}

/**
 * Ingère tous les ADR Markdown d'un répertoire.
 * @param {string} adrDir
 * @param {object} [metadataDefaults]
 * @returns {Promise<Array<{ id: string, content: string, metadata: object }>>}
 */
export async function batchIngestAdr(adrDir, metadataDefaults = {}) {
  const stat = await fs.stat(adrDir).catch(() => null);
  if (!stat?.isDirectory()) {
    return [];
  }

  const files = (await fs.readdir(adrDir)).filter((file) => file.endsWith('.md'));
  return files.map((file) =>
    ingestAdr(path.join(adrDir, file), {
      ...metadataDefaults,
      source: metadataDefaults.source || file,
    }),
  );
}

/**
 * Charge des chunks pré-compilés depuis rag-adrs.json.
 * @param {string} [wikiRagPath]
 */
export async function loadWikiRagChunks(wikiRagPath = DEFAULT_WIKI_RAG_PATH) {
  const raw = await fs.readFile(wikiRagPath, 'utf8');
  const data = JSON.parse(raw);

  return data.map((item) => ({
    id: item.id,
    content: item.content,
    metadata: item.metadata || {},
  }));
}

/**
 * Pousse les chunks wiki dans ChromaDB via knowledgeHub.
 * @param {object} knowledgeHub
 * @param {object} [options]
 */
export async function ingestWikiChunksToHub(knowledgeHub, options = {}) {
  const wikiRagPath = options.wikiRagPath || DEFAULT_WIKI_RAG_PATH;
  await knowledgeHub.init();

  const docs = await loadWikiRagChunks(wikiRagPath);
  await knowledgeHub.addDocuments(docs);

  return {
    ingested: docs.length,
    wikiRagPath,
  };
}

/**
 * Évalue la précision SMAC sur un échantillon de requête (smoke test ops).
 * @param {object} knowledgeHub
 * @param {string} [query]
 */
export async function evaluateSmacPrecision(
  knowledgeHub,
  query = 'quels sont les seuils de consensus SMAC et le seuil SOTA ?',
) {
  const results = await knowledgeHub.query(query, 3, { category: 'governance' });
  let successCount = 0;

  for (const result of results) {
    const has075 = result.content.includes('0.75');
    const has085 = result.content.includes('0.85');
    const hasSota = result.content.includes('0.95');
    const isSmac = result.content.toLowerCase().includes('smac');

    if (isSmac && (has075 || has085 || hasSota)) {
      successCount += 1;
    }
  }

  const precision = results.length > 0 ? (successCount / results.length) * 100 : 0;

  return {
    query,
    precision,
    resultCount: results.length,
    successCount,
    pass: precision >= 80,
  };
}

export default ingestAdr;

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import ingestModule, {
  ingestAdr,
  batchIngestAdr,
  loadWikiRagChunks,
} from '../src/wiki/ingest_wiki_adrs.js';

describe('ingest_wiki_adrs ESM', () => {
  it('exporte ingestAdr comme fonction nommée', () => {
    assert.equal(typeof ingestAdr, 'function');
  });

  it('exporte batchIngestAdr comme fonction nommée', () => {
    assert.equal(typeof batchIngestAdr, 'function');
  });

  it('exporte ingestAdr comme default', () => {
    assert.equal(typeof ingestModule, 'function');
    assert.equal(ingestModule, ingestAdr);
  });

  it('ingestAdr transforme un fichier ADR en document indexable', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adr-ingest-'));
    const adrPath = path.join(tmpDir, 'ADR-007.md');
    await fs.writeFile(
      adrPath,
      '# ADR-007 Orchestrateur\n\n**Statut** : Accepté\n',
      'utf8',
    );

    const doc = ingestAdr(adrPath, { category: 'governance' });
    assert.equal(doc.id, 'ADR-007');
    assert.match(doc.content, /Orchestrateur/);
    assert.equal(doc.metadata.category, 'governance');
    assert.equal(doc.metadata.source, 'ADR-007.md');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('batchIngestAdr ingère tous les .md d\'un répertoire', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adr-batch-'));
    await fs.writeFile(path.join(tmpDir, 'a.md'), '# A\n', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'b.md'), '# B\n', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'skip.txt'), 'x', 'utf8');

    const docs = await batchIngestAdr(tmpDir);
    assert.equal(docs.length, 2);
    assert.deepEqual(
      docs.map((doc) => doc.id).sort(),
      ['a', 'b'],
    );

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loadWikiRagChunks parse rag-adrs.json si présent', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-json-'));
    const jsonPath = path.join(tmpDir, 'rag-adrs.json');
    await fs.writeFile(
      jsonPath,
      JSON.stringify([
        { id: 'adr-1', content: 'SMAC 0.75', metadata: { source: 'test' } },
      ]),
      'utf8',
    );

    const chunks = await loadWikiRagChunks(jsonPath);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].id, 'adr-1');
    assert.match(chunks[0].content, /SMAC/);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

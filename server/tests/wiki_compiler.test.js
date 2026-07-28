import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import compileWikiModule, {
  compileWiki,
  generateIndex,
  buildAdrIndexTable,
  parseAdrFrontmatter,
} from '../src/wiki/wiki_compiler.js';

describe('wiki_compiler ESM', () => {
  it('exporte compileWiki comme fonction nommée', () => {
    assert.equal(typeof compileWiki, 'function');
  });

  it('exporte generateIndex comme fonction nommée', () => {
    assert.equal(typeof generateIndex, 'function');
  });

  it('exporte compileWiki comme default', () => {
    assert.equal(typeof compileWikiModule, 'function');
    assert.equal(compileWikiModule, compileWiki);
  });

  it('compile 3 entries en wiki Markdown', () => {
    const entries = [
      { title: 'ADR-007', content: 'Décision orchestrateur.' },
      { title: 'ADR-008', content: 'Sub-skills Obsidian.' },
      { title: 'ADR-009', content: 'Pipeline mémoire.' },
    ];
    const result = compileWiki(entries);
    assert.match(result, /# Wiki/);
    assert.match(result, /ADR-007/);
    assert.match(result, /ADR-008/);
  });

  it('parseAdrFrontmatter extrait titre et statut', () => {
    const content = `# ADR-011 Web Scraping\n\n**Statut** : Accepté\n**Expert** : Nexxus\n**Date** : 17/05/2026\n`;
    const meta = parseAdrFrontmatter(content, 'ADR-011.md');
    assert.equal(meta.title, 'ADR-011 Web Scraping');
    assert.equal(meta.status, 'Accepté');
    assert.equal(meta.expert, 'Nexxus');
  });

  it('buildAdrIndexTable produit un tableau Markdown', () => {
    const table = buildAdrIndexTable([
      {
        title: 'ADR-007',
        status: 'Accepté',
        expert: 'Nexxus',
        date: '17/05/2026',
        fileName: 'ADR-007.md',
      },
    ]);
    assert.match(table, /Index des Décisions Architecturales/);
    assert.match(table, /ADR-007/);
  });

  it('generateIndex liste les fichiers .md du répertoire wiki', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-index-'));
    await fs.writeFile(path.join(tmpDir, 'Wiki-ADR-Index.md'), '# ADR\n');
    await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'ignore');

    const index = await generateIndex(tmpDir);
    assert.match(index, /Index Wiki Citadelle/);
    assert.match(index, /Wiki-ADR-Index\.md/);
    assert.doesNotMatch(index, /notes\.txt/);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_VAULT_PATH = path.join(REPO_ROOT, 'citadelle-vault', 'Citadelle');

/**
 * Extrait les métadonnées d'un fichier ADR Markdown.
 * @param {string} content
 * @param {string} [fileName]
 */
export function parseAdrFrontmatter(content, fileName = 'adr.md') {
  const titleMatch = content.match(/^#\s+(.*)/m);
  const statusMatch = content.match(/\*\*Statut\*\*\s*:\s*(.*)/);
  const expertMatch = content.match(/\*\*Expert\*\*\s*:\s*(.*)/);
  const dateMatch = content.match(/\*\*Date\*\*\s*:\s*(.*)/);

  return {
    title: titleMatch ? titleMatch[1].trim() : fileName,
    status: statusMatch ? statusMatch[1].trim() : 'Inconnu',
    expert: expertMatch ? expertMatch[1].trim() : 'Nexxus',
    date: dateMatch ? dateMatch[1].trim() : '2026-05-06',
    fileName,
  };
}

/**
 * Compile des entrées wiki en Markdown (mode programmatique / tests).
 * @param {Array<{ title: string, content: string }>} entries
 * @returns {string}
 */
export function compileWiki(entries = []) {
  let md = '# Wiki — Compilation Citadelle\n\n';

  if (!entries.length) {
    md += '*(aucune entrée)*\n';
    return md;
  }

  for (const entry of entries) {
    const title = entry.title || 'Sans titre';
    md += `## ${title}\n\n${entry.content || ''}\n\n`;
  }

  return md;
}

/**
 * Construit le tableau d'index ADR (Wiki-ADR-Index).
 * @param {Array<{ title: string, status: string, expert: string, date: string, fileName?: string }>} adrRows
 */
export function buildAdrIndexTable(adrRows = []) {
  let adrIndex = '# Index des Décisions Architecturales (ADR)\n\n';
  adrIndex += '| Statut | Décision | Expert | Date |\n|---|---|---|---|\n';

  for (const row of adrRows) {
    const linkFile = row.fileName || `${row.title}.md`;
    adrIndex += `| ${row.status} | [[${linkFile}|${row.title}]] | ${row.expert} | ${row.date} |\n`;
  }

  return adrIndex;
}

/**
 * Génère un index Markdown à partir d'un répertoire wiki existant.
 * @param {string} wikiDir
 * @returns {Promise<string>}
 */
export async function generateIndex(wikiDir) {
  const stat = await fs.stat(wikiDir).catch(() => null);
  if (!stat?.isDirectory()) {
    return '# Index Wiki Citadelle\n\n*(répertoire wiki introuvable)*\n';
  }

  const files = (await fs.readdir(wikiDir)).filter((file) => file.endsWith('.md'));
  let index = '# Index Wiki Citadelle\n\n';

  for (const file of files.sort()) {
    const base = file.replace(/\.md$/i, '');
    index += `- [[${file}|${base}]]\n`;
  }

  return index;
}

/**
 * Compilation complète du Vault Obsidian (ADR index + synthèse modules).
 * @param {object} [options]
 * @param {string} [options.vaultPath]
 * @param {string} [options.wikiPath]
 * @param {boolean} [options.writeFiles=true]
 */
export async function compileWikiFromVault(options = {}) {
  const vaultPath = options.vaultPath || DEFAULT_VAULT_PATH;
  const wikiPath = options.wikiPath || path.join(vaultPath, 'Wiki');
  const writeFiles = options.writeFiles !== false;

  if (!(await fs.stat(wikiPath).catch(() => false))) {
    await fs.mkdir(wikiPath, { recursive: true });
  }

  const adrDir = path.join(vaultPath, '02-Architecture', 'adr');
  const adrFiles = (await fs.readdir(adrDir)).filter((file) => file.endsWith('.md'));
  const adrRows = [];

  for (const file of adrFiles) {
    const content = await fs.readFile(path.join(adrDir, file), 'utf8');
    adrRows.push(parseAdrFrontmatter(content, file));
  }

  const adrIndex = buildAdrIndexTable(adrRows);

  const modulesDir = path.join(vaultPath, '02-Architecture', 'modules');
  const moduleEntries = await fs.readdir(modulesDir, { withFileTypes: true });
  const modules = moduleEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  let moduleSummary = '# Synthèse des Modules Stratégiques\n\n';
  for (const mod of modules) {
    moduleSummary += `## [[${mod}/_index|${mod}]]\n`;
    const indexPath = path.join(modulesDir, mod, '_index.md');
    if (await fs.stat(indexPath).catch(() => false)) {
      const content = await fs.readFile(indexPath, 'utf8');
      moduleSummary += `${content.substring(0, 300)}...\n\n`;
    }
  }

  if (writeFiles) {
    await fs.writeFile(path.join(wikiPath, 'Wiki-ADR-Index.md'), adrIndex);
    await fs.writeFile(path.join(wikiPath, 'Wiki-Modules-Summary.md'), moduleSummary);
  }

  return {
    wikiPath,
    adrIndex,
    moduleSummary,
    adrCount: adrRows.length,
    moduleCount: modules.length,
  };
}

export default compileWiki;

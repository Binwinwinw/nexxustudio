import fs from 'fs/promises';
import path from 'path';

/**
 * obsidianBridge.js
 * Pont de Mémoire Souveraine entre Nexxus et le Vault Obsidian.
 */
class ObsidianBridge {
  constructor(vaultPath) {
    this.vaultPath = vaultPath;
  }

  // --- ACTIONS DE BASE ---

  async readNote(notePath) {
    const fullPath = path.join(this.vaultPath, notePath.endsWith('.md') ? notePath : `${notePath}.md`);
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      console.error(`[ObsidianBridge] Erreur lecture note : ${notePath}`, error);
      return null;
    }
  }

  async writeNote(notePath, content) {
    const fullPath = path.join(this.vaultPath, notePath.endsWith('.md') ? notePath : `${notePath}.md`);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`[ObsidianBridge] Erreur écriture note : ${notePath}`, error);
      return false;
    }
  }

  async appendNote(notePath, content) {
    const fullPath = path.join(this.vaultPath, notePath.endsWith('.md') ? notePath : `${notePath}.md`);
    try {
      await fs.appendFile(fullPath, `\n${content}`, 'utf-8');
      return true;
    } catch (error) {
      console.error(`[ObsidianBridge] Erreur append note : ${notePath}`, error);
      return false;
    }
  }

  // --- RECHERCHE ET INDEXATION ---

  async listFolder(folderPath = "") {
    const fullPath = path.join(this.vaultPath, folderPath);
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'folder' : 'file',
        path: path.join(folderPath, e.name)
      }));
    } catch (error) {
      console.error(`[ObsidianBridge] Erreur list folder : ${folderPath}`, error);
      return [];
    }
  }

  async searchVault(query) {
    // Implémentation simplifiée par scan de fichiers (Greplike)
    // À terme, connectera à l'index vectoriel RAG
    const results = [];
    const files = await this.walk(this.vaultPath);
    
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(file, 'utf-8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        results.push(path.relative(this.vaultPath, file));
      }
    }
    return results;
  }

  async walk(dir) {
    let results = [];
    const list = await fs.readdir(dir);
    for (const file of list) {
        const fullPath = path.resolve(dir, file);
        const stat = await fs.stat(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(await this.walk(fullPath));
        } else {
            results.push(fullPath);
        }
    }
    return results;
  }
}

export default new ObsidianBridge('d:/Hostinger/public_html/nexxustudio/citadelle-vault/Citadelle');

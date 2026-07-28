
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkspaceScanner {
  constructor() {
    this.root = path.resolve(__dirname, '../../../..'); // Racine publique (public_html)
  }

  /**
   * Liste les fichiers d'un répertoire spécifique dans le workspace
   * @param {string} relativePath 
   */
  async scan(relativePath = '') {
    const targetPath = path.join(this.root, relativePath);
    
    // Sécurité : Interdire de remonter au-dessus de la racine
    if (!targetPath.startsWith(this.root)) {
      throw new Error("Accès hors workspace interdit.");
    }

    try {
      if (!(await fs.pathExists(targetPath))) {
        return { error: `Le chemin ${relativePath} n'existe pas.` };
      }

      const stats = await fs.stat(targetPath);
      if (stats.isFile()) {
        return { type: 'file', name: path.basename(targetPath), size: stats.size };
      }

      const files = await fs.readdir(targetPath);
      const results = [];

      for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const fPath = path.join(targetPath, file);
        const fStats = await fs.stat(fPath);
        results.push({
          name: file,
          type: fStats.isDirectory() ? 'directory' : 'file',
          size: fStats.isFile() ? fStats.size : null
        });
      }

      return { type: 'directory', path: relativePath, children: results };
    } catch (err) {
      return { error: err.message };
    }
  }
}

export default new WorkspaceScanner();

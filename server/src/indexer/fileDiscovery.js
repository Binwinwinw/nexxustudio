
import fs from 'fs/promises';
import path from 'path';

/**
 * FileDiscovery - L'éclaireur de l'Assistant Nexxus.
 * Scanne le workspace en appliquant les règles d'exclusion strictes de La Citadelle.
 */
class FileDiscovery {
  constructor() {
    this.ignoredDirs = [
      'node_modules', 'dist', 'build', '.git', '.next', 'out', 'logs', 'temp', 'vendor', 'data',
      '99-Zone-Exclue'
    ];
    
    this.allowedRootDirs = [
      'server', 'src', 'citadelle-vault', 'moncoachscolaire', 'docs'
    ];
    
    this.allowedExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.css', '.html'
    ];
  }

  async scan(rootPath) {
    const results = [];
    
    const walk = async (dir, isRoot = false) => {
      const files = await fs.readdir(dir, { withFileTypes: true });
      
      for (const file of files) {
        const res = path.resolve(dir, file.name);
        const relativePath = path.relative(rootPath, res);
        
        if (file.isDirectory()) {
          if (this.ignoredDirs.includes(file.name)) continue;
          // Au niveau racine, on ne descend que dans les dossiers autorisés
          if (isRoot && !this.allowedRootDirs.includes(file.name)) continue;
          await walk(res, false);
        } else {
          const ext = path.extname(file.name).toLowerCase();
          if (this.allowedExtensions.includes(ext)) {
            const stats = await fs.stat(res);
            results.push({
              path: relativePath,
              absolutePath: res,
              size: stats.size,
              mtime: stats.mtimeMs,
              extension: ext
            });
          }
        }
      }
    };

    await walk(rootPath, true);
    return results;
  }
}

export default new FileDiscovery();

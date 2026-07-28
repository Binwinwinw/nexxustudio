import fs from 'fs/promises';
import path from 'path';

/**
 * HeritageScanner - Le regard de la Citadelle sur son passé.
 * Scanne le dossier projects/ pour indexer les créations passées.
 */
class HeritageScanner {
  constructor(projectsRoot) {
    this.projectsRoot = projectsRoot;
  }

  /**
   * Scanne le dossier projects et retourne un résumé structuré
   */
  async scan() {
    try {
      const entries = await fs.readdir(this.projectsRoot, { withFileTypes: true });
      const projects = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(this.projectsRoot, entry.name);
          const info = await this.getProjectInfo(projectPath, entry.name);
          projects.push(info);
        }
      }

      return projects;
    } catch (error) {
      console.error('[HeritageScanner] Scan failed:', error.message);
      return [];
    }
  }

  async getProjectInfo(projectPath, name) {
    const info = {
      name,
      type: 'unknown',
      description: '',
      techStack: [],
      files: []
    };

    try {
      const files = await fs.readdir(projectPath);
      info.files = files;

      // Détection du type de projet
      if (files.includes('package.json')) {
        const pkgData = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
        info.type = 'Node.js / Web';
        info.description = pkgData.description || '';
        info.techStack = Object.keys(pkgData.dependencies || {});
      } else if (files.includes('requirements.txt') || files.some(f => f.endsWith('.py'))) {
        info.type = 'Python / Data';
      } else if (files.includes('index.html')) {
        info.type = 'Static HTML';
      }

    } catch (err) {
      console.warn(`[HeritageScanner] Could not read info for ${name}:`, err.message);
    }

    return info;
  }
}

export default HeritageScanner;

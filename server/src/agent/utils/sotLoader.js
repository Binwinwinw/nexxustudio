import fs from 'fs/promises';
import path from 'path';

/**
 * Source Of Truth Loader (Fiabilité v3.5)
 * Charge les fichiers critiques d'un projet pour ancrer le contexte.
 */
class SOTLoader {
  constructor() {
    this.criticalFiles = [
      'handoff.json',
      'package.json',
      'project.json',
      'structure.md',
      'structure.json',
      'blueprint.md',
      'README.md'
    ];
  }

  /**
   * Charge les fichiers SOT d'un projet
   * @param {string} projectPath 
   */
  async loadProjectSOT(projectPath) {
    if (!projectPath) return null;
    
    const sotData = {};
    for (const file of this.criticalFiles) {
      const filePath = path.join(projectPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        sotData[file] = content;
      } catch (e) {
        // Fichier absent, on ignore
      }
    }
    
    return Object.keys(sotData).length > 0 ? sotData : null;
  }

  /**
   * Formate le SOT pour le prompt
   */
  formatSOT(sotData) {
    if (!sotData) return '';
    
    const blocks = [];
    for (const [file, content] of Object.entries(sotData)) {
      blocks.push(`[SOURCE DE VÉRITÉ : ${file}]\n${content}\n`);
    }
    
    return blocks.join('\n---\n');
  }
}

export default new SOTLoader();

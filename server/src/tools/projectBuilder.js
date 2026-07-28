/* server/src/tools/projectBuilder.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

import FileSafety from '../security/fileSafety.js';

class ProjectBuilder {
  constructor() {
    this.baseDir = path.resolve(__dirname, '../../../projects');
  }

  resolveTargetPath(projectPath, relativeFilePath) {
    // 🛡️ SÉCURITÉ UNIFORMISÉE (Citadelle v4.2)
    return FileSafety.validatePath(projectPath, relativeFilePath);
  }

  /**
   * Crée l'architecture d'un projet et génère les Blueprints (MD/JSON).
   * @param {string} projectName - Nom du dossier du projet.
   * @param {Array} files - Liste d'fichiers { path: 'rel/path', content: '...' }.
   * @param {boolean} isSandbox - Si vrai, écrit dans un dossier temporaire isolé.
   */
  async build(projectName, files, isSandbox = false) {
    const cleanName = FileSafety.normalizeProjectName(projectName);
    const targetDir = isSandbox ? `${cleanName}_sandbox` : cleanName;
    const projectPath = path.join(this.baseDir, targetDir);
    await fs.ensureDir(projectPath);
    
    console.log(`[ProjectBuilder] ${isSandbox ? '🧪 Sandbox' : '🏗️ Real'} Build started for project: ${projectName}`);

    // 1. Création des fichiers physiques
    for (const file of files) {
      const filePath = this.resolveTargetPath(projectPath, file.path);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, file.content, 'utf8');
    }

    if (isSandbox) return `Validation Sandbox terminée pour '${projectName}'. Aucun fichier système n'a été modifié.`;

    // 2. Génération du Blueprint Markdown (Uniquement en Build réel)
    const mdContent = `# Project Blueprint: ${projectName}\n\n` +
      files.map(f => `## File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n`).join('\n');
    await fs.writeFile(path.join(projectPath, 'blueprint.md'), mdContent);

    // 3. Génération du Blueprint JSON
    const jsonContent = {
      projectName,
      timestamp: new Date().toISOString(),
      structure: files.map(f => ({ path: f.path, size: f.content.length })),
      files: files
    };
    await fs.writeJson(path.join(projectPath, 'blueprint.json'), jsonContent, { spaces: 2 });

    return `Projet '${projectName}' scellé avec succès (Arborescence + Blueprints MD/JSON).`;
  }
}

export default new ProjectBuilder();

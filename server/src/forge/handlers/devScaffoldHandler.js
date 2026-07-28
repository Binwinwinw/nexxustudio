/* server/src/forge/handlers/devScaffoldHandler.js */
import fs from 'fs/promises';
import path from 'path';
import { SCAFFOLD_TEMPLATES } from '../templates/scaffoldTemplates.js';
import { getArtifactPath } from '../utils/projectPaths.js';
import { writeForgeArtifact } from '../utils/forgeArtifactWriter.js';

export class DevScaffoldHandler {
  async execute(handoff, projectBase, forgeCtx = {}) {
    console.log(`[Forge:DevScaffold] Scaffolding for project type: ${handoff.projectType}`);

    const templateKey = this._mapProjectTypeToTemplate(handoff.projectType);
    const template = SCAFFOLD_TEMPLATES[templateKey];

    if (!template) {
      console.warn(`[Forge:DevScaffold] No specific template found for ${handoff.projectType}. Falling back to basic structure.`);
      return { skipped: true, reason: 'unsupported_type' };
    }

    const { projectPath } = projectBase;
    const generatedFiles = [];

    // Protection contre l'écrasement (Idempotence)
    const pkgPath = getArtifactPath(projectPath, 'package.json');
    try {
      await fs.access(pkgPath);
      console.log(`[Forge:DevScaffold] package.json already exists. Skipping scaffolding to prevent overwrite.`);
      return { skipped: true, reason: 'already_scaffolded' };
    } catch {
      // Le fichier n'existe pas, on procède
    }

    // Génération récursive des fichiers
    for (const [relativePath, contentFn] of Object.entries(template.files)) {
      const fullPath = getArtifactPath(projectPath, relativePath);
      
      // Assurer que le sous-répertoire existe
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Écrire le contenu (dynamique si nécessaire)
      const content = contentFn(handoff.projectTitle);
      await writeForgeArtifact(fullPath, content, {
        ...forgeCtx,
        artifactKind: 'scaffold',
      });
      
      generatedFiles.push(relativePath);
    }

    console.log(`[Forge:DevScaffold] Successfully generated ${generatedFiles.length} files for template: ${templateKey}`);
    
    return {
      templateUsed: templateKey,
      artifacts: generatedFiles
    };
  }

  _mapProjectTypeToTemplate(type) {
    const t = type.toLowerCase();
    if (t.includes('react') || t.includes('web') || t.includes('front')) return 'react-vite';
    if (t.includes('node') || t.includes('api') || t.includes('back')) return 'node-express';
    if (t.includes('static') || t.includes('html')) return 'static-html';
    return null;
  }
}

export default new DevScaffoldHandler();

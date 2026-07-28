/* server/src/forge/handlers/projectBootstrapHandler.js */
import { ensureProjectDir, getArtifactPath } from '../utils/projectPaths.js';
import { writeForgeArtifact } from '../utils/forgeArtifactWriter.js';

export class ProjectBootstrapHandler {
  async execute(handoff, forgeCtx = {}) {
    console.log(`[Forge:Bootstrap] Bootstrapping project: ${handoff.projectTitle}`);

    // 1. Créer le dossier projet
    const projectPath = await ensureProjectDir(handoff.projectTitle, forgeCtx);

    // 2. Générer le structure.md (Blueprint)
    const structureMd = this._generateStructureMd(handoff);
    await writeForgeArtifact(
      getArtifactPath(projectPath, 'structure.md'),
      structureMd,
      { ...forgeCtx, artifactKind: 'structure' },
    );

    // 3. Sauvegarder le handoff canonique pour audit
    await writeForgeArtifact(
      getArtifactPath(projectPath, 'handoff.json'),
      JSON.stringify(handoff, null, 2),
      { ...forgeCtx, artifactKind: 'handoff' },
    );

    console.log(`[Forge:Bootstrap] Project files initialized in ${projectPath}`);
    
    return {
      projectPath,
      artifacts: ['structure.md', 'handoff.json']
    };
  }

  _generateStructureMd(h) {
    return `
# Structure du Projet : ${h.projectTitle}
> Généré par Nexxus Forge V1.0 - ${new Date().toISOString()}

## Vision & Objectifs
${h.goal}

## Livrables Attendus
${h.deliverables.map(d => `- [ ] **${d.name}** : ${d.desc}`).join('\n')}

## Stack Technique Recommandée
- ${h.recommendedStack.join('\n- ')}

## Contraintes
${h.constraints.map(c => `- ${c}`).join('\n')}

## Directives Forge
### Architecte
${h.forgeDirectives?.architect || 'Standard architecture rules.'}

### Développeur
${h.forgeDirectives?.developer || 'Standard implementation rules.'}
    `.trim();
  }
}

export default new ProjectBootstrapHandler();

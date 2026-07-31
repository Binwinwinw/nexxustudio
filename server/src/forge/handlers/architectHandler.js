/* server/src/forge/handlers/architectHandler.js */
import { AGENT_ROLES } from '../../agent/policies/core/index.js';
import ollama from '../../llm/ollama.js';
import { buildArchitectSystemPrompt } from '../prompts/architectPrompt.js';
import { getArtifactPath } from '../utils/projectPaths.js';
import { writeForgeArtifact } from '../utils/forgeArtifactWriter.js';

export class ArchitectHandler {
  async execute(handoff, projectBase, forgeCtx = {}) {
    const { projectPath } = projectBase;
    console.log(`[Forge:Architect] Generating sentient architecture for ${handoff.projectTitle}...`);

    const model = AGENT_ROLES.FORGE_REASONER;
    const projectInfo = {
      projectTitle: handoff.projectTitle,
      projectType: handoff.projectType,
      projectGoal: handoff.goal,
      recommendedStack: handoff.recommendedStack || []
    };

    const prompt = buildArchitectSystemPrompt(projectInfo);

    try {
      // 1. Appel au LLM Raisonnant
      const messages = [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Génère le fichier architecture.md complet pour ce projet.' }
      ];

      const response = await ollama.chat(messages, model, {
        temperature: 0.35,
        num_ctx: 4096
      });

      // Nettoyage de la réponse (extraire le markdown si entouré de texte ou de <think>)
      const cleanContent = response
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();

      // 2. Sauvegarde du fichier
      const archPath = getArtifactPath(projectPath, 'architecture.md');
      await writeForgeArtifact(archPath, cleanContent, {
        ...forgeCtx,
        artifactKind: 'architecture',
      });

      console.log(`[Forge:Architect] Successfully generated architecture.md`);

      return {
        artifacts: ['architecture.md'],
        status: 'completed'
      };

    } catch (error) {
      console.error(`[Forge:Architect] Error during generation:`, error);
      return { status: 'failed', error: error.message };
    }
  }
}

export default new ArchitectHandler();

/* server/src/forge/handlers/devAdvancedHandler.js */
import fs from 'fs/promises';
import path from 'path';
import ollama from '../../llm/ollama.js';
import projectBuilder from '../../tools/projectBuilder.js';
import { buildDevAdvancedPrompt } from '../prompts/devAdvancedPrompt.js';
import { getArtifactPath } from '../utils/projectPaths.js';

export class DevAdvancedHandler {
  async execute(handoff, projectBase) {
    const { projectPath, artifacts = [] } = projectBase;
    console.log(`[Forge:DevAdvanced] Starting business logic generation for ${handoff.projectTitle}...`);

    try {
      // 1. Collecter le contexte (Architecture + Liste des fichiers existants)
      const archPath = getArtifactPath(projectPath, 'architecture.md');
      let architecture = "Aucune architecture détaillée trouvée.";
      try {
        architecture = await fs.readFile(archPath, 'utf8');
      } catch (e) {
        console.warn("[Forge:DevAdvanced] Architecture missing, proceed with handoff only.");
      }

      const projectInfo = {
        projectTitle: handoff.projectTitle,
        projectGoal: handoff.goal,
        architecture: architecture,
        existingFiles: artifacts || []
      };

      // 2. Préparer le Prompt
      const systemPrompt = buildDevAdvancedPrompt(projectInfo);
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Génère les 3 à 5 fichiers React CLÉS pour ce projet. Utilisez exclusivement la balise <action> buildProject.' }
      ];

      // 3. Appel à LeadDeveloperElite (StarCoder2 15B pour la précision syntaxique)
      const model = 'qwen2.5-coder:7b';
      const response = await ollama.chat(messages, model, {
        temperature: 0.2, // Faible température pour la rigueur du code
        num_ctx: 8192
      });

      // 4. Extraction de l'action et exécution via ProjectBuilder
      // Recherche de <action> buildProject(files: [...])
      const actionMatch = response.match(/<action>\s*buildProject\(files:\s*([\s\S]*?)\)\s*<\/action>/i) 
                       || response.match(/buildProject\(files:\s*([\s\S]*?)\)/i);

      if (!actionMatch) {
         console.warn("[Forge:DevAdvanced] No <action> found in LLM response. Recording thought only.");
         return { status: 'completed', message: 'No files generated, thought only.', artifacts: [] };
      }

      let filesToBuild = [];
      try {
        // Nettoyage sommaire si l'assistant a mis des fioritures
        let jsonStr = actionMatch[1].trim();
        // Si ça ne commence pas par [, on essaie de trouver le premier [
        if (!jsonStr.startsWith('[')) {
          const startIdx = jsonStr.indexOf('[');
          const endIdx = jsonStr.lastIndexOf(']');
          if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = jsonStr.substring(startIdx, endIdx + 1);
          }
        }
        filesToBuild = JSON.parse(jsonStr);
      } catch (e) {
        console.error("[Forge:DevAdvanced] Failed to parse files JSON:", e);
        throw new Error("Format JSON invalide dans l'action de génération.");
      }

      // 5. Build physique
      const slug = path.basename(projectPath);
      const buildResult = await projectBuilder.build(slug, filesToBuild);
      console.log(`[Forge:DevAdvanced] ${buildResult}`);

      return {
        status: 'completed',
        artifacts: filesToBuild.map(f => f.path),
        message: buildResult
      };

    } catch (error) {
      console.error(`[Forge:DevAdvanced] Critical Error:`, error);
      return { status: 'failed', error: error.message };
    }
  }
}

export default new DevAdvancedHandler();

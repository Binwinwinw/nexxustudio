/**
 * @legacy-experimental — Hors noyau runtime (ADR-20260705 Option B).
 * Patrimoine officiel : Knowledge Hub / Chroma via memoryOrchestrator.
 * Ne pas importer depuis le noyau agent sans ADR de réactivation.
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ollama from '../llm/ollama.js';
import HeritageScanner from '../agent/memory/heritageScanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProjectLibrary {
  constructor() {
    this.projectsDir = path.resolve(__dirname, '../../../projects');
    this.indexPath = path.resolve(__dirname, '../../data/projects_index.json');
    this.index = {}; // { projectKey: { vector, description, timestamp, name, tree } }
    this.threshold = 0.55; 
    this.heritageScanner = new HeritageScanner(this.projectsDir);
  }

  /**
   * Scan et indexation "Lazy" (Fraîcheur & Vitesse)
   */
  async init() {
    if (await fs.pathExists(this.indexPath)) {
      this.index = await fs.readJson(this.indexPath);
    }

    const projects = await fs.readdir(this.projectsDir);
    let needsUpdate = false;

    for (const projectName of projects) {
      const pPath = path.join(this.projectsDir, projectName);
      try {
        const stats = await fs.stat(pPath);
        if (!stats.isDirectory()) continue;

        const blueprintPath = path.join(pPath, 'blueprint.json');
        let projectData = null;
        let lastModified = stats.mtimeMs;

        if (await fs.pathExists(blueprintPath)) {
          const blueprint = await fs.readJson(blueprintPath);
          projectData = {
            name: blueprint.projectName,
            description: blueprint.description || "Projet structuré Nexxus.",
            techStack: blueprint.techStack || [],
            tree: blueprint.structure?.map(s => s.path).join(', ') || ""
          };
        } else {
          // Fallback sur le patrimoine (HeritageScanner)
          const info = await this.heritageScanner.getProjectInfo(pPath, projectName);
          projectData = {
            name: info.name,
            description: `Patrimoine scanné (${info.type}).`,
            techStack: info.techStack,
            tree: info.files.join(', ')
          };
        }

        // Si le projet est nouveau ou a été modifié
        if (!this.index[projectName] || this.index[projectName].timestamp !== lastModified) {
          console.log(`[Librarian] 📚 Indexing project: ${projectName}...`);
          
          const textToEmbed = `${projectData.name} - ${projectData.description}. Stack: ${projectData.techStack.join(', ')}. Files: ${projectData.tree}`;
          
          try {
            const vector = await ollama.getEmbedding(textToEmbed);
            this.index[projectName] = {
              vector,
              name: projectData.name,
              timestamp: lastModified,
              description: projectData.description,
              tree: projectData.tree
            };
            needsUpdate = true;
          } catch (e) {
            console.error(`[Librarian] Failed to embed project ${projectName}:`, e.message);
          }
        }
      } catch (err) {
        console.warn(`[Librarian] Error scanning folder ${projectName}:`, err.message);
      }
    }

    if (needsUpdate) {
      await fs.writeJson(this.indexPath, this.index, { spaces: 2 });
      console.log("[Librarian] Project index updated on disk.");
    }
  }

  /**
   * Recherche hybride (Keywords + Vectoriel)
   */
  async search(query) {
    await this.init();

    const queryVector = await ollama.getEmbedding(query);
    const results = [];

    for (const key in this.index) {
      const project = this.index[key];
      const vectorScore = queryVector ? this.cosineSimilarity(queryVector, project.vector) : 0;
      const q = query.toLowerCase();
      const keywordScore = (project.name.toLowerCase().includes(q) || project.description.toLowerCase().includes(q)) ? 0.4 : 0;
      const totalScore = vectorScore + keywordScore;

      if (totalScore >= this.threshold) {
        results.push({
          projectName: project.name,
          description: project.description,
          tree: project.tree,
          score: totalScore
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  cosineSimilarity(u, v) {
    let dotProduct = 0;
    let uSq = 0;
    let vSq = 0;
    for (let i = 0; i < u.length; i++) {
      dotProduct += u[i] * v[i];
      uSq += u[i] * u[i];
      vSq += v[i] * v[i];
    }
    const mag = Math.sqrt(uSq) * Math.sqrt(vSq);
    return mag === 0 ? 0 : dotProduct / mag;
  }
}

export default new ProjectLibrary();

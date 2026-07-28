/* server/src/services/CreativeGeneratorService.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CreativeGeneratorService (Vague 5)
 * Orchestre la génération d'actifs multimédias (Images & Audio).
 */
class CreativeGeneratorService {
  constructor() {
    this.outputDir = path.resolve(__dirname, '../../..', 'citadelle-vault/Citadelle/01-Architecture/03-Forge/media');
    this.localServerUrl = process.env.CREATIVE_SERVER_URL || 'http://localhost:11437';
  }

  /**
   * Génère une image bitmap via le moteur local.
   */
  async generateImage(prompt, options = {}) {
    const { size = '512x512' } = options;
    console.log(`🎨 [Creative-Local] Requête image : "${prompt}"...`);

    try {
      const response = await fetch(`${this.localServerUrl}/generate/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size })
      });

      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          path: `03-Forge/media/${result.filename}`,
          prompt,
          engine: result.engine,
          mode: 'local'
        };
      }
      throw new Error(result.error || 'Erreur moteur local');
    } catch (error) {
      console.error(`❌ [Creative] Échec local:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Génère une piste audio via le moteur local.
   */
  async generateAudio(prompt) {
    console.log(`🎵 [Creative-Local] Requête audio : "${prompt}"...`);

    try {
      const response = await fetch(`${this.localServerUrl}/generate/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          path: `03-Forge/media/${result.filename}`,
          prompt,
          engine: result.engine,
          mode: 'local'
        };
      }
      throw new Error(result.error || 'Erreur moteur local');
    } catch (error) {
      console.error(`❌ [Creative] Échec local:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new CreativeGeneratorService();

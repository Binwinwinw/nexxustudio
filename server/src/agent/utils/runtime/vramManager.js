
import axios from 'axios';

class VRAMManager {
  constructor() {
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  }

  /**
   * Décharge tous les modèles de la VRAM en envoyant un signal keep_alive: 0 à Ollama.
   */
  async unloadAll() {
    console.log("🧹 [VRAMManager] Nettoyage de la VRAM (Unload models)...");
    try {
      // Pour décharger un modèle, Ollama demande d'envoyer une requête avec keep_alive: 0
      // Comme on ne sait pas forcément quel modèle est chargé, on peut tenter sur les principaux
      // ou si on a une liste des modèles actifs.
      
      const activeModels = await this.getActiveModels();
      for (const model of activeModels) {
        await axios.post(`${this.ollamaHost}/api/generate`, {
          model: model.name,
          keep_alive: 0
        });
        console.log(`  - Modèle [${model.name}] déchargé.`);
      }
      return { success: true, count: activeModels.length };
    } catch (err) {
      console.error("❌ [VRAMManager] Échec du déchargement VRAM:", err.message);
      return { success: false, error: err.message };
    }
  }

  async getActiveModels() {
    try {
      const res = await axios.get(`${this.ollamaHost}/api/ps`);
      return res.data.models || [];
    } catch (err) {
      return [];
    }
  }
}

export default new VRAMManager();

/* server/src/agent/utils/visionAgent.js */
import { analyzeImage } from '../../services/imageAnalyzer.js';
import turnTelemetry from '../telemetry/turnTelemetry.js';

/**
 * VisionAgent - Orchestrateur de l'intelligence visuelle
 * Vague 4 - Mémoire Multimodale
 */
class VisionAgent {
  constructor() {
    this.name = "Nexxus-Vision";
  }

  /**
   * Analyse une liste d'images et retourne un briefing textuel pour le pipeline.
   * @param {Array<Buffer|Object>} images - Liste des buffers images ou objets images
   * @param {string} turnId 
   */
  async analyze(images, turnId) {
    if (!images || images.length === 0) return null;

    console.log(`[VisionAgent] 👁️ Analyse de ${images.length} image(s) pour le tour [${turnId}]...`);
    const startTime = Date.now();
    
    try {
      const analyses = await Promise.all(images.map(async (img, idx) => {
        // Support du buffer direct ou de l'objet multer
        const buffer = Buffer.isBuffer(img) ? img : img.buffer;
        const filename = img.originalname || `image_${idx}.png`;
        
        const result = await analyzeImage(buffer, { filename });
        return {
          filename,
          analysis: result.visionAnalysis,
          ocr: result.ocrText,
          timestamp: result.timestamp
        };
      }));

      const duration = Date.now() - startTime;
      turnTelemetry.setMetric('visionLatency', duration);

      // --- FORMATAGE DU BRIEFING VISUEL POUR LE PROMPT ---
      let briefing = "\n--- BRIEFING VISUEL (SITUATIONAL AWARENESS) ---\n";
      analyses.forEach((a, i) => {
        briefing += `\n[IMAGE #${i+1}: ${a.filename}]\n`;
        briefing += `DÉCRIPTION: ${a.analysis}\n`;
        if (a.ocr) {
          briefing += `TEXTE DÉTECTÉ (OCR): ${a.ocr}\n`;
        }
      });
      briefing += "\n-----------------------------------------------\n";

      return {
        briefing,
        rawAnalyses: analyses,
        duration
      };

    } catch (error) {
      console.error(`[VisionAgent] ❌ Échec de l'analyse visuelle:`, error.message);
      const detail = String(error.message || 'erreur inconnue').slice(0, 400);
      return {
        briefing:
          `\n⚠️ [ERREUR VISION] Impossible d'analyser les images jointes.\n` +
          `Cause technique: ${detail}\n` +
          `(Pipeline branché — échec runtime modèle/Ollama, pas un refus de capacité.)\n`,
        error: error.message,
      };
    }
  }

  /**
   * Prépare les métadonnées multimodales pour la consolidation LTM.
   */
  prepareEpisodicAssets(visionResults) {
    if (!visionResults || !visionResults.rawAnalyses) return null;
    
    return visionResults.rawAnalyses.map(a => ({
      type: 'visual_episode',
      filename: a.filename,
      description: a.analysis,
      ocr: a.ocr
    }));
  }
}

export default new VisionAgent();

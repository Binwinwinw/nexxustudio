// server/config/pipelines.js
import { selectPipeline } from './intent-routing.js';
import { justIntentDetection } from './intent-detector.js';

const missingHandler = (pipelineKey) => async () => {
  throw new Error(`Handler non configuré pour le pipeline: ${pipelineKey}`);
};

export function createPipelines(handlers = {}) {
  return {
    direct_explanation: async (query, context) => {
      // Réponse directe factuelle + recherche web si besoin
      return await (handlers.generateFactAnswer ?? missingHandler("direct_explanation"))(query, context);
    },
  
    general_answer: async (query, context) => {
      // Fallback générique : recherche web + génération
      return await (handlers.webSearchAndAnswer ?? missingHandler("general_answer"))(query, context);
    },
  
    clarify_user: async (query, context) => {
      // Demander plus de contexte
      return await (handlers.askClarification ?? missingHandler("clarify_user"))(query, context);
    },
  
    build_v1: async (query, context) => {
      // Création de code ou webapp
      return await (handlers.buildContent ?? missingHandler("build_v1"))(query, context);
    },
  
    recall_previous: async (query, context) => {
      // Rappel de conversation précédente
      return await (handlers.recallConversation ?? missingHandler("recall_previous"))(query, context);
    }
  };
}

export const pipelines = createPipelines();

export async function orchestrate(query, options = {}) {
  // 1. Classification d'intention
  const detectIntent = options.detectIntent ?? justIntentDetection;
  const { intent, conf, evaluation } = await detectIntent(query);
  
  // 2. Sélection du pipeline
  const pipelineKey = selectPipeline(intent, conf);
  
  // 3. Exécution
  const pipelineRegistry = options.pipelines ?? createPipelines(options.handlers);
  const pipeline = pipelineRegistry[pipelineKey];
  if (!pipeline) {
    throw new Error(`Pipeline inconnu: ${pipelineKey}`);
  }
  
  return await pipeline(query, { intent, conf, evaluation, pipelineKey });
}

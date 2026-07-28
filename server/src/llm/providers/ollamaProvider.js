/**
 * Implémentation default InferenceProvider — Ollama local (M2).
 */
import ollama from '../ollama.js';

/** @type {import('../inferenceProvider.js').InferenceProvider} */
export const ollamaProvider = {
  id: 'ollama',

  ensureModel(model, onLog) {
    return ollama.ensureModel(model, onLog);
  },

  chat(messages, model, options) {
    return ollama.chat(messages, model, options);
  },

  chatStream(messages, onToken, model, options, keepAlive) {
    return ollama.chatStream(messages, onToken, model, options, keepAlive);
  },

  stopAll() {
    ollama.stopAll();
  },
};

export default ollamaProvider;

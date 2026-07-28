/**
 * Contrat InferenceProvider — abstraction inférence backend-agnostique (M2).
 * Spec : citadelle-vault/.../ADR-20260530-API-v1-InferenceProvider.md
 */

/**
 * @typedef {object} InferenceChatMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {object} InferenceProvider
 * @property {string} id
 * @property {() => Promise<boolean>} [checkHealth]
 * @property {(model: string, onLog?: Function) => Promise<void>} [ensureModel]
 * @property {(messages: InferenceChatMessage[], model: string, options?: object) => Promise<any>} chat
 * @property {(messages: InferenceChatMessage[], onToken: Function, model: string, options?: object, keepAlive?: string) => Promise<any>} [chatStream]
 * @property {() => void} [stopAll]
 */

/**
 * @param {InferenceProvider} provider
 */
export function assertInferenceProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new Error('InferenceProvider invalide');
  }
  if (!provider.id || typeof provider.id !== 'string') {
    throw new Error('InferenceProvider.id requis');
  }
  if (typeof provider.chat !== 'function') {
    throw new Error('InferenceProvider.chat requis');
  }
}

/**
 * @param {Record<string, InferenceProvider>} providers
 * @param {string} [defaultId='ollama']
 */
export function createInferenceProviderRegistry(providers, defaultId = 'ollama') {
  return {
    get(id = defaultId) {
      const provider = providers[id] || providers[defaultId];
      if (!provider) {
        throw new Error(`InferenceProvider introuvable: ${id}`);
      }
      assertInferenceProvider(provider);
      return provider;
    },
    list() {
      return Object.keys(providers);
    },
  };
}

export default {
  assertInferenceProvider,
  createInferenceProviderRegistry,
};

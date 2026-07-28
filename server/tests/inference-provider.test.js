import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertInferenceProvider,
  createInferenceProviderRegistry,
} from '../src/llm/inferenceProvider.js';

/** Stub minimal — évite le chargement d'ollama.js en premerge. */
const ollamaLikeStub = {
  id: 'ollama',
  chat: async () => ({ message: { content: 'pong' } }),
  chatStream: async () => {},
  stopAll: () => {},
};

test('assertInferenceProvider: provider conforme', () => {
  assert.doesNotThrow(() => assertInferenceProvider(ollamaLikeStub));
  assert.equal(ollamaLikeStub.id, 'ollama');
});

test('assertInferenceProvider: rejette provider sans chat', () => {
  assert.throws(
    () => assertInferenceProvider({ id: 'broken' }),
    /chat requis/,
  );
});

test('createInferenceProviderRegistry: résout default et mock', async () => {
  const mockProvider = {
    id: 'mock',
    chat: async () => ({ message: { content: 'ok' } }),
  };
  const registry = createInferenceProviderRegistry({
    mock: mockProvider,
    ollama: ollamaLikeStub,
  });

  const provider = registry.get('mock');
  const out = await provider.chat([], 'test-model');
  assert.equal(out.message.content, 'ok');
  assert.deepEqual(registry.list().sort(), ['mock', 'ollama']);
});

test('createInferenceProviderRegistry: fallback default ollama', () => {
  const registry = createInferenceProviderRegistry({ ollama: ollamaLikeStub });
  assert.equal(registry.get().id, 'ollama');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { runConversationShortCircuit } from '../src/agent/micro/classifiers/intentShortCircuit.js';
import { isConversationMemoryRecallRequest } from '../src/agent/utils/conversationGuards.js';

test('rappel: short-circuit ne capture pas vers multi_segment', async () => {
  const query = 'tu te souviens de mon dernier message ???';
  assert.equal(isConversationMemoryRecallRequest(query), true);
  const hit = await runConversationShortCircuit(query, {
    history: [{ role: 'user', content: 'cadrage forge react vite' }],
  });
  assert.equal(hit, null);
});

test('rappel: retrouver un objet externe ne déclenche pas conversation_recall', () => {
  const query = 'peut-on retrouver un ordinateur Windows 11 avec son ID-produit ou sa clé produit ?';
  assert.equal(isConversationMemoryRecallRequest(query), false);
});

test('rappel: introduction entité ICHIGO ne déclenche pas conversation_recall', () => {
  const query =
    'si je te dis ICHIGO est ce que tu trouveras de quoi je veux parler ???';
  assert.equal(isConversationMemoryRecallRequest(query), false);
});

test('rappel: de quoi je veux parler (futur) ne déclenche pas conversation_recall', () => {
  assert.equal(
    isConversationMemoryRecallRequest('de quoi je veux parler avec toi ?'),
    false,
  );
});

test('rappel: rappel explicite du fil reste actif', () => {
  assert.equal(
    isConversationMemoryRecallRequest('rappelle ce qu on a dit sur le fil'),
    true,
  );
  assert.equal(
    isConversationMemoryRecallRequest('saurais tu retrouver de quoi nous avons parlé hier ?'),
    true,
  );
});

test('rappel: invitation à discuter avant le travail ≠ conversation_recall', () => {
  assert.equal(
    isConversationMemoryRecallRequest(
      'bah on discute un peu avant di tu veux bien',
    ),
    false,
  );
  assert.equal(
    isConversationMemoryRecallRequest('on peut papoter un peu avant si tu veux'),
    false,
  );
});

test('rappel: « de quoi on discute avant » reste un vrai recall', () => {
  assert.equal(
    isConversationMemoryRecallRequest('de quoi on discute avant'),
    true,
  );
  assert.equal(
    isConversationMemoryRecallRequest('rappelle ce qu on a discute avant'),
    true,
  );
});

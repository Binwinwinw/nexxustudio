import test from 'node:test';
import assert from 'node:assert/strict';
import { runConversationShortCircuit } from '../src/agent/micro/classifiers/intentShortCircuit.js';
import { isConversationMemoryRecallRequest } from '../src/agent/utils/conversation/conversationGuards.js';

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

test('rappel: page HTML collée (discuter CTA + avant tout) ≠ conversation_recall', () => {
  const query = [
    "voici mon portfolio une page html qu'il faut améliorer :",
    "<!DOCTYPE html><html lang=\"fr\"><body>",
    "<a href=\"#contact\">Discuter d'un projet</a>",
    "<p>".repeat(40) + "padding</p>".repeat(40),
    "<h2>Une approche produit avant tout</h2>",
    "</body></html>",
  ].join("\n");
  assert.equal(isConversationMemoryRecallRequest(query), false);
});

test('rappel: fence html à améliorer ≠ conversation_recall', () => {
  const query =
    "améliore ce bloc :\n```html\n<a>Discuter d'un projet</a>\n<p>avant tout</p>\n```";
  assert.equal(isConversationMemoryRecallRequest(query), false);
});

test('rappel: fence js / css collé ≠ conversation_recall', () => {
  assert.equal(
    isConversationMemoryRecallRequest(
      "revue ce script :\n```js\nconsole.log('Discuter');\n```\n" +
        "padding ".repeat(80) +
        "\n// avant tout",
    ),
    false,
  );
  assert.equal(
    isConversationMemoryRecallRequest(
      "améliore :\n```css\n.cta { content: 'Discuter'; }\n```\n" +
        "x ".repeat(80) +
        "\n/* avant tout */",
    ),
    false,
  );
});

test('rappel: marketing long discuter / avant éloignés ≠ conversation_recall', () => {
  const query =
    "améliore ce texte : Discuter d'un projet. " +
    "lorem ".repeat(200) +
    "Une approche produit avant tout.";
  assert.equal(isConversationMemoryRecallRequest(query), false);
});

test('rappel: portefeuille HTML inline → pas conversation_recall', () => {
  const query = [
    "voici mon portfolio une page html qu'il faut améliorer :",
    "<!DOCTYPE html>",
    '<html lang="fr"><head></head><body>',
    '<a class="btn">Discuter d’un projet</a>',
    "<style>.hero{}</style>",
    "<section id=\"about\"><h2>Une approche produit avant tout</h2></section>",
    "</body></html>",
  ].join("\n");
  assert.equal(isConversationMemoryRecallRequest(query), false);
});

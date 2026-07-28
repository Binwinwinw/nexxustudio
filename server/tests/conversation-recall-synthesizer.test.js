import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRecallHistoryEntries,
  buildRecallFooter,
  buildConversationRecallResponse,
} from '../src/agent/utils/conversationGuards.js';
import { synthesizeConversationRecall } from '../src/agent/utils/conversationRecallSynthesizer.js';

test('filterRecallHistoryEntries: exclut refus épistémiques et requête courante', () => {
  const entries = filterRecallHistoryEntries(
    'de quoi on a parlé précédemment ?',
    [
      { role: 'user', content: 'bonjour' },
      {
        role: 'assistant',
        content:
          "Je n'ai pas assez d'éléments fiables pour répondre correctement.",
      },
      { role: 'user', content: 'de quoi on a parlé précédemment ?' },
      { role: 'user', content: 'projet IA avec navigateur' },
      { role: 'assistant', content: 'Voici ce que je retrouve dans ce fil.' },
    ],
  );

  assert.equal(entries.length, 2);
  assert.equal(entries[0].content, 'bonjour');
  assert.equal(entries[1].content, 'projet IA avec navigateur');
});

test('buildRecallFooter: pas de mention hier si query dit précédemment', () => {
  const footer = buildRecallFooter('de quoi on a parlé précédemment ?');
  assert.doesNotMatch(footer, /hier/i);
  assert.match(footer, /fil uniquement/i);
});

test('synthesizeConversationRecall: fallback template si historique insuffisant', async () => {
  const out = await synthesizeConversationRecall('rappelle notre fil', []);
  assert.match(out, /pas encore d'échange substantiel/i);
});

test('synthesizeConversationRecall: utilise LLM mocké si assez de contexte', async () => {
  const mockClient = {
    chat: async () => ({
      message: {
        content:
          'Nous avons évoqué un projet IA dans le navigateur.\n- Projet IA\n- Navigateur',
      },
    }),
  };

  const out = await synthesizeConversationRecall(
    'de quoi on a parlé précédemment ?',
    [
      { role: 'user', content: 'bonjour' },
      { role: 'assistant', content: 'Salut !' },
      { role: 'user', content: 'projet IA navigateur' },
      { role: 'assistant', content: 'Voici trois pistes.' },
    ],
    { llmClient: mockClient },
  );

  assert.match(out, /projet IA/i);
  assert.doesNotMatch(out, /hier/i);
  assert.match(out, /fil uniquement/i);
});

test('synthesizeConversationRecall: fallback si LLM renvoie refus épistémique', async () => {
  const mockClient = {
    chat: async () => ({
      message: {
        content:
          "Je n'ai pas assez d'éléments fiables pour répondre correctement.",
      },
    }),
  };

  const history = [
    { role: 'user', content: 'sujet A' },
    { role: 'assistant', content: 'réponse A' },
    { role: 'user', content: 'sujet B' },
    { role: 'assistant', content: 'réponse B' },
  ];

  const out = await synthesizeConversationRecall('rappelle le fil', history, {
    llmClient: mockClient,
  });

  assert.equal(out, buildConversationRecallResponse('rappelle le fil', history));
});

test('synthesizeConversationRecall: fallback si LLM invente un marqueur temporel', async () => {
  const mockClient = {
    chat: async () => ({
      message: {
        content:
          'Hier nous avons parlé du navigateur et du projet IA.\n- Navigateur\n- Projet IA',
      },
    }),
  };

  const history = [
    { role: 'user', content: 'projet IA navigateur' },
    { role: 'assistant', content: 'Voici trois pistes.' },
    { role: 'user', content: 'sujet B' },
    { role: 'assistant', content: 'réponse B' },
  ];

  const out = await synthesizeConversationRecall('rappelle le fil', history, {
    llmClient: mockClient,
  });

  assert.equal(out, buildConversationRecallResponse('rappelle le fil', history));
});

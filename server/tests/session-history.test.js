import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapEventsToConversationHistory,
  mergeConversationHistories,
  inferHistoryMergeStrategy,
  resolveSessionConversationHistory,
} from '../src/services/sessionHistoryService.js';

test('mapEventsToConversationHistory: mappe user_message et ai_response', () => {
  const history = mapEventsToConversationHistory(
    [
      {
        event_family: 'CONVERSATION',
        event_type: 'user_message',
        payload_json: { content: 'bonjour' },
      },
      {
        event_family: 'CONVERSATION',
        event_type: 'ai_response',
        payload_json: { content: 'Salut !' },
      },
      {
        event_family: 'SYSTEM',
        event_type: 'user_feedback',
        payload_json: { rating: 1 },
      },
    ],
    10,
  );

  assert.equal(history.length, 2);
  assert.deepEqual(history[0], { role: 'user', content: 'bonjour' });
  assert.deepEqual(history[1], { role: 'assistant', content: 'Salut !' });
});

test('mapEventsToConversationHistory: respecte la limite', () => {
  const events = Array.from({ length: 5 }, (_, index) => ({
    event_family: 'CONVERSATION',
    event_type: index % 2 === 0 ? 'user_message' : 'ai_response',
    payload_json: { content: `msg-${index}` },
  }));

  const history = mapEventsToConversationHistory(events, 2);
  assert.equal(history.length, 2);
  assert.equal(history[0].content, 'msg-3');
  assert.equal(history[1].content, 'msg-4');
});

test('resolveSessionConversationHistory: sans sessionId retourne historique client', async () => {
  const client = [
    { role: 'user', content: 'alpha' },
    { role: 'assistant', content: 'beta' },
  ];
  const resolved = await resolveSessionConversationHistory(null, {
    clientHistory: client,
    limit: 10,
  });
  assert.deepEqual(resolved, client);
});

test('mergeConversationHistories: préfère le client si plus long et aligné en queue', () => {
  const db = [
    { role: 'user', content: 'bonjour' },
    { role: 'assistant', content: 'salut' },
  ];
  const client = [
    { role: 'user', content: 'bonjour' },
    { role: 'assistant', content: 'salut' },
    { role: 'user', content: 'cadrage forge react vite' },
    { role: 'assistant', content: 'brief prêt' },
  ];
  const merged = mergeConversationHistories(db, client, 10);
  assert.equal(merged.length, 4);
  assert.equal(merged[2].content, 'cadrage forge react vite');
});

test('inferHistoryMergeStrategy: aligned_prefer_client si client plus long', () => {
  const db = [
    { role: 'user', content: 'a' },
    { role: 'assistant', content: 'b' },
  ];
  const client = [
    { role: 'user', content: 'prefix' },
    { role: 'user', content: 'a' },
    { role: 'assistant', content: 'b' },
  ];
  const merged = mergeConversationHistories(db, client, 10);
  assert.equal(inferHistoryMergeStrategy(db, client, merged), 'aligned_prefer_client');
});

test('mergeConversationHistories: union si queues désalignées', () => {
  const db = [
    { role: 'user', content: 'ancien fil db' },
    { role: 'assistant', content: 'réponse db' },
  ];
  const client = [
    { role: 'user', content: 'cadrage forge complet' },
    { role: 'assistant', content: 'ok forge' },
  ];
  const merged = mergeConversationHistories(db, client, 10);
  assert.equal(merged.length, 4);
  assert.equal(merged[0].content, 'ancien fil db');
  assert.equal(merged[3].content, 'ok forge');
});

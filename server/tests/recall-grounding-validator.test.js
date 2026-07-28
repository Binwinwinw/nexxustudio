import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecallGrounding } from '../src/agent/utils/recallGroundingValidator.js';

test('validateRecallGrounding: OK si marqueur temporel présent dans historique', () => {
  const result = validateRecallGrounding('Nous avons parlé hier du projet.', [
    { content: 'Rappel : hier nous avons discuté budget.' },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
});

test('validateRecallGrounding: violation si hier inventé', () => {
  const result = validateRecallGrounding(
    'Hier nous avons parlé du navigateur et du projet IA.',
    [
      { content: 'projet IA dans le navigateur' },
      { content: 'Voici trois pistes.' },
    ],
  );
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'invented_temporal');
  assert.match(result.violations[0].token, /hier/i);
});

test('validateRecallGrounding: OK sans marqueur temporel', () => {
  const result = validateRecallGrounding(
    'Nous avons évoqué un projet IA et un navigateur.',
    [{ content: 'projet IA navigateur' }],
  );
  assert.equal(result.ok, true);
});

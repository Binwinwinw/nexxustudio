/* eslint-env node */
import test from 'node:test';
import assert from 'node:assert/strict';

import { extractResultContent, resolveStreamResult } from './streamResultResolver.js';

test('resolveStreamResult keeps final result when it is more complete than streamed content', () => {
  const streamed = '## MODULE 5 : SYNTHESE &';
  const finalResult = '## MODULE 5 : SYNTHESE & EVALUATION\n\n- Debrief collectif\n- Quiz final';

  assert.equal(resolveStreamResult(streamed, finalResult), finalResult);
});

test('resolveStreamResult keeps streamed content when final result is empty', () => {
  const streamed = 'Réponse visible complète';

  assert.equal(resolveStreamResult(streamed, ''), streamed);
});

test('resolveStreamResult prefers cleaned final when stream leaked thinking', () => {
  const streamed =
    'Je propose un projet.<think> raisonnement interne </think>';
  const finalResult = 'Je propose un projet.';

  assert.equal(resolveStreamResult(streamed, finalResult), finalResult);
});

test('extractResultContent supports string payloads and object payloads', () => {
  assert.equal(extractResultContent('texte final'), 'texte final');
  assert.equal(extractResultContent({ content: 'texte objet' }), 'texte objet');
  assert.equal(extractResultContent({ foo: 'bar' }), '');
});

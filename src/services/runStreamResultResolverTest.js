/* eslint-env node */
import assert from 'node:assert/strict';

import { extractResultContent, resolveStreamResult } from './streamResultResolver.js';

function run() {
  {
    const streamed = '## MODULE 5 : SYNTHESE &';
    const finalResult = '## MODULE 5 : SYNTHESE & EVALUATION\n\n- Debrief collectif\n- Quiz final';
    assert.equal(resolveStreamResult(streamed, finalResult), finalResult);
  }

  {
    const streamed = 'Réponse visible complète';
    assert.equal(resolveStreamResult(streamed, ''), streamed);
  }

  {
    assert.equal(extractResultContent('texte final'), 'texte final');
    assert.equal(extractResultContent({ content: 'texte objet' }), 'texte objet');
    assert.equal(extractResultContent({ foo: 'bar' }), '');
  }

  console.log('streamResultResolver regression checks passed');
}

run();

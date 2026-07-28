import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDesignCreateInput,
  buildDesignCreateEnvelope,
} from '../src/services/nexxus-design/nexxusDesignContract.js';
import {
  validateDesignAuditInput,
  buildImpeccableAuditEnvelope,
} from '../src/services/impeccable/impeccableContract.js';
import {
  validateDesignExtractInput,
  buildDesignExtractEnvelope,
} from '../src/services/design-extract/designExtractContract.js';

test('validateDesignCreateInput: refuse sans brief ni ADN', () => {
  const result = validateDesignCreateInput({});
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'QUERY_OR_DNA_REQUIRED');
});

test('buildDesignCreateEnvelope: structure blueprint', () => {
  const envelope = buildDesignCreateEnvelope({
    objective: 'cockpit',
    blueprint: { layout: 'sidebar+main' },
  });
  assert.equal(envelope.kind, 'nexxus.design.create_result');
  assert.equal(envelope.objective, 'cockpit');
});

test('buildImpeccableAuditEnvelope: classe blockers et merge_ok', () => {
  const envelope = buildImpeccableAuditEnvelope({
    score_global: 72,
    issues: [
      { severity: 'blocker', message: 'Contraste insuffisant' },
      { severity: 'minor', message: 'Padding incohérent' },
    ],
  });
  assert.equal(envelope.blockers.length, 1);
  assert.equal(envelope.score_global, 72);
  assert.equal(envelope.merge_ok, false);
});

test('validateDesignExtractInput: exige URL valide', () => {
  assert.equal(validateDesignExtractInput({ url: 'ftp://x.com' }).ok, false);
  assert.equal(
    validateDesignExtractInput({ url: 'https://example.com', query: 'ADN' }).ok,
    true,
  );
});

test('buildDesignExtractEnvelope: dossier ADN', () => {
  const envelope = buildDesignExtractEnvelope({
    url: 'https://example.com',
    tokens: { primary: '#0f172a' },
    reproduction_prompt: 'Refonte fidèle au style source.',
  });
  assert.equal(envelope.kind, 'nexxus.design.extract_result');
  assert.match(envelope.reproduction_prompt, /fidèle/i);
});

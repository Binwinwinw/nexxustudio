import test from 'node:test';
import assert from 'node:assert/strict';
import agent from '../src/agent/agent.js';
import { RESPONSE_MODES } from '../src/agent/config/modeResponseContracts.js';

const CASES = [
  {
    name: 'teams-365-beginners-plan',
    query:
      "prépare le plan d'une animation adressée à des débutants pour la découverte des notions nécessaires à l'utilisation de teams 365",
    mustIncludeAny: ['Introduction', 'Découverte', 'Fonctionnalités', 'Q&A', 'équipes', 'canaux'],
    minLength: 220,
  },
  {
    name: 'python-workshop-5-sections',
    query:
      "fais un plan pour un atelier d’initiation à Python en 5 sections avec objectifs et durée",
    mustIncludeAny: ['Python', 'objectifs', 'durée', 'section', 'atelier'],
    minLength: 220,
  },
  {
    name: 'excel-discovery-training',
    query:
      "prépare un plan de formation découverte d’Excel pour débutants avec étapes, durée et exercice pratique",
    mustIncludeAny: ['Excel', 'durée', 'exercice', 'formation', 'débutants'],
    minLength: 220,
  },
  {
    name: 'cybersecurity-intro-session',
    query:
      "conçois une animation d’initiation à la cybersécurité pour novices avec objectifs pédagogiques et déroulé",
    mustIncludeAny: ['cybersécurité', 'objectifs', 'déroulé', 'initiation', 'novices'],
    minLength: 220,
  },
  {
    name: 'new-employees-onboarding-workshop',
    query:
      "prépare le plan d’un atelier d’accueil pour de nouveaux employés avec séquences, durée et activité participative",
    mustIncludeAny: ['atelier', 'accueil', 'durée', 'activité', 'employés'],
    minLength: 220,
  },
  {
    name: 'sql-beginners-session',
    query:
      "prépare une séance d’initiation au SQL pour grands débutants avec plan détaillé, objectifs et exercices",
    mustIncludeAny: ['SQL', 'objectifs', 'exercices', 'plan', 'débutants'],
    minLength: 220,
  },
];

function normalize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countSections(text) {
  const lines = String(text || '').split('\n');
  return lines.filter((line) => {
    const l = line.trim();
    return (
      /^#{1,6}\s/.test(l) ||
      /^\d+[\).\s-]/.test(l) ||
      /^[-*]\s/.test(l)
    );
  }).length;
}

function looksAggressivelyTruncated(text) {
  const cleaned = normalize(text);
  if (!cleaned) return true;

  const sentenceCount = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean).length;

  return cleaned.length < 120 || sentenceCount <= 2;
}

async function runQuery(query) {
  let pipelinePath = null;
  let mode = null;

  const resultText = await agent.run(query, [], { sessionId: 'test-multi-segment-composite' }, (step, meta) => {
    if (meta?.pipelinePath) pipelinePath = meta.pipelinePath;
    if (meta?.responseMode) mode = meta.responseMode;
  });

  return {
    text: resultText,
    pipelinePath,
    mode
  };
}

for (const c of CASES) {
  test(`multi_segment_composite :: ${c.name}`, async () => {
    const out = await runQuery(c.query);
    const text = normalize(out.text);

    assert.ok(text.length >= c.minLength, `Réponse trop courte (${text.length} chars)`);

    assert.equal(
      looksAggressivelyTruncated(text),
      false,
      'La réponse ressemble à une troncature agressive (<= 2 phrases ou trop courte)'
    );

    assert.ok(
      countSections(out.text) >= 3,
      `Réponse insuffisamment structurée (sections détectées: ${countSections(out.text)})`
    );

    assert.ok(
      c.mustIncludeAny.some((token) =>
        text.toLowerCase().includes(token.toLowerCase())
      ),
      `Aucun marqueur attendu trouvé dans la réponse: ${c.mustIncludeAny.join(', ')}`
    );

    if (out.pipelinePath) {
      assert.equal(
        out.pipelinePath,
        'multi_segment_composite',
        `pipelinePath inattendu: ${out.pipelinePath}`
      );
    }

    if (out.mode) {
      assert.notEqual(
        out.mode,
        RESPONSE_MODES.SIMPLE_FAST,
        `Le mode ne doit plus retomber sur SIMPLE_FAST pour ce type de requête`
      );
    }
  });
}

test('multi_segment_composite :: repeated query stays complete', async () => {
  const query =
    "prépare le plan d'une animation adressée à des débutants pour la découverte des notions nécessaires à l'utilisation de teams 365";

  const first = await runQuery(query);
  const second = await runQuery(query);

  const t1 = normalize(first.text);
  const t2 = normalize(second.text);

  assert.ok(t1.length >= 220, 'Premier run trop court');
  assert.ok(t2.length >= 220, 'Second run trop court');
  assert.equal(looksAggressivelyTruncated(t1), false, 'Premier run tronqué');
  assert.equal(looksAggressivelyTruncated(t2), false, 'Second run tronqué');
});

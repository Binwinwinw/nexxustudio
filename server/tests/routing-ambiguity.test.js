import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../src/agent/utils/intentClassifier.js';

describe('routing ambiguity', () => {
  const cases = [
    {
      input: "salut, tu peux m'aider avec ça ?",
      expected: 'normal_conversation',
      family: 'Mix social + technique léger',
    },
    {
      input: 'bonjour, ça crash chez moi',
      expected: 'expert_task',
      family: 'Mix social + technique léger',
    },
    {
      input: 'on peut parler du bug ?',
      expected: 'expert_task',
      family: 'Mix social + technique léger',
    },
    {
      input: 'hello, je comprends pas ce code',
      expected: 'expert_task',
      family: 'Mix social + technique léger',
    },

    {
      input: 'ça bug',
      expected: 'expert_task',
      family: 'Court mais ambigu',
    },
    {
      input: 'ça marche pas',
      expected: 'expert_task',
      family: 'Court mais ambigu',
    },
    {
      input: 'je bloque',
      expected: 'normal_conversation',
      family: 'Court mais ambigu',
    },
    {
      input: 'explique',
      expected: 'normal_conversation',
      family: 'Court mais ambigu',
    },

    {
      input: 'et là ?',
      expected: 'normal_conversation',
      family: 'Relance contextuelle',
    },
    {
      input: "tu vois l'erreur ?",
      expected: 'expert_task',
      family: 'Relance contextuelle',
    },
    {
      input: 'tu peux préciser ?',
      expected: 'normal_conversation',
      family: 'Relance contextuelle',
    },
    {
      input: 'ok et maintenant ?',
      expected: 'normal_conversation',
      family: 'Relance contextuelle',
    },

    {
      input: 'le build casse',
      expected: 'expert_task',
      family: 'Jargon mineur',
    },
    {
      input: "petite question sur l'api",
      expected: 'expert_task',
      family: 'Jargon mineur',
    },
    {
      input: 'on regarde le json ?',
      expected: 'expert_task',
      family: 'Jargon mineur',
    },
    {
      input: 'j’ai un souci de route',
      expected: 'expert_task',
      family: 'Jargon mineur',
    },

    {
      input: 'salut, le bot répond plus',
      expected: 'expert_task',
      family: 'Cas piège social parasité',
    },
    {
      input: 'hey, ça plante encore',
      expected: 'expert_task',
      family: 'Cas piège social parasité',
    },
    {
      input: 'on en parle ?',
      expected: 'normal_conversation',
      family: 'Cas piège social parasité',
    },
    {
      input: 'et maintenant ?',
      expected: 'normal_conversation',
      family: 'Cas piège social parasité',
    },
  ];

  it.each(cases)('$family: "$input" -> $expected', ({ input, expected }) => {
    const result = classifyIntent(input, {});
    expect(result.intent).toBe(expected);
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('scores');
  });
});

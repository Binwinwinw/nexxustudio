import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../src/agent/utils/intentClassifier.js';

describe('routing heuristics', () => {
  const cases = [
    {
      input: 'salut salut',
      expected: 'social_chit_chat',
    },
    {
      input: 'on peut discuter ?*',
      expected: 'social_chit_chat',
    },
    {
      input: 'ça crash',
      expected: 'normal_conversation',
    },
    {
      input: 'on peut voir le bug ?',
      expected: 'normal_conversation',
    },
    {
      input: 'corrige ce bug dans mon code',
      expected: 'expert_task',
    },
  ];

  cases.forEach(({ input, expected }) => {
    it(`routes "${input}" to ${expected}`, () => {
      const result = classifyIntent(input, {});
      expect(result.intent).toBe(expected);
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('scores');
    });
  });
});

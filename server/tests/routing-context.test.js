import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../src/agent/utils/intentClassifier.js';

describe('routing context memory', () => {
  const cases = [
    {
      name: 'Un tour social ne force pas un tour technique en social',
      input: 'ça crash',
      context: { lastIntent: 'social_chit_chat' },
      expected: 'expert_task',
    },
    {
      name: 'Relance très courte après une session technique active',
      input: 'corrige ça',
      context: { activeTask: true },
      expected: 'expert_task',
    },
    {
      name: 'Maintien en social après un début social',
      input: 'on peut discuter ?',
      context: { lastIntent: 'social_chit_chat' },
      expected: 'social_chit_chat',
    },
    {
      name: 'Un message purement social après une tâche technique',
      input: 'ça va ?',
      context: { activeTask: true },
      // Ne doit surtout pas devenir expert, mais peut être normal ou social
      // normal_conversation est plus prudent ici (évite de briser le rythme de travail avec une réponse purement sociale déconnectée)
      expected: 'normal_conversation', 
    },
  ];

  it.each(cases)('$name: "$input" -> $expected', ({ input, context, expected }) => {
    const result = classifyIntent(input, context);
    expect(result.intent).toBe(expected);
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('scores');
  });
});

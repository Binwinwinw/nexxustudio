import assert from 'node:assert/strict';

import agent from '../src/agent/agent.js';
import OllamaStreamProcessor from '../src/agent/utils/ollamaStreamProcessor.js';

function includesAll(text, patterns = []) {
  const lower = text.toLowerCase();
  return patterns.every((pattern) => lower.includes(pattern.toLowerCase()));
}

function includesNone(text, patterns = []) {
  const lower = text.toLowerCase();
  return patterns.every((pattern) => !lower.includes(pattern.toLowerCase()));
}

const SOCIAL_CASES = [
  {
    name: 'salutation courte avec expert forcé',
    query: 'bonjour comment ça va la dedans ???',
    forcedExpertKey: 'expert_mentor',
    required: ['tout va bien ici'],
    forbidden: ['products', 'nutrition', 'éthique', 'je suis désolé', 'intelligence artificielle']
  },
  {
    name: 'identité et fonctionnalités',
    query: "bonjour, comment t'appelles tu et quelles sont tes fonctionnalités??",
    forcedExpertKey: 'expert_mentor',
    required: ["coordinateur souverain", "citadel"],
    forbidden: ['constraints', 'generate and output the response', "that's the forge's job", 'intelligence artificielle']
  },
  {
    name: 'identité courte gouvernée',
    query: 'tu es qui ?',
    forcedExpertKey: 'expert_mentor',
    required: ["coordinateur souverain"],
    forbidden: ['vie personnelle', 'intelligence artificielle', 'constraints']
  },
  {
    name: 'périmètre assistant gouverné',
    query: 'que peux tu faire exactement dans le studio ?',
    forcedExpertKey: 'expert_mentor',
    required: ['cadrer un projet', 'handoff', 'forge'],
    forbidden: ['vie personnelle', 'équipe de 10 personnes', 'intelligence artificielle']
  },
  {
    name: 'message social taquin',
    query: "héy héy héy pourquoi tu es pressé comme a tu as autre chose à faire ??? tu réponds très vite , c'est bluffant",
    forcedExpertKey: 'expert_mentor',
    required: ['répons', 'rapid'],
    forbidden: ['produits de santé', 'nutrition', 'éthique', 'je me souviens', 'contenu spécifique']
  },
  {
    name: 'question produit sur la forge',
    query: 'comment fonctionne la forge ??',
    forcedExpertKey: 'expert_mentor',
    required: ['la forge', 'analyse', 'architecture', 'qa'],
    forbidden: ['10 personnes', 'ressources humaines', 'technicienne du code', 'formation continue', 'maintenance informatique']
  },
  {
    name: 'fonctionnement nexxus gouverné',
    query: 'comment tu fais pour réfléchir ?',
    forcedExpertKey: 'expert_mentor',
    required: ['je structure la demande', 'documents gouvernés'],
    forbidden: ['chaîne de pensée', 'intelligence artificielle', 'vie personnelle']
  }
];

async function runConversationCases() {
  for (const scenario of SOCIAL_CASES) {
    const streamed = [];
    const steps = [];
    const response = await agent.run(scenario.query, [], {
      forcedExpertKey: scenario.forcedExpertKey,
      onContent: (token) => streamed.push(token),
      onStep: (step) => steps.push(step)
    });

    assert.ok(includesAll(response, scenario.required), `[${scenario.name}] Réponse inattendue: ${response}`);
    assert.ok(includesNone(response, scenario.forbidden), `[${scenario.name}] Réponse contaminée: ${response}`);
    assert.equal(streamed.join(''), response, `[${scenario.name}] Le flux visible diffère de la réponse finale.`);

    if (scenario.name === 'identité et fonctionnalités') {
      assert.ok(steps.some((step) => step.includes('governed direct answer [nexxus-identity]')), `[${scenario.name}] Le routage gouverné n'a pas été utilisé.`);
    }

    if (scenario.name === 'identité courte gouvernée') {
      assert.ok(steps.some((step) => step.includes('governed direct answer [nexxus-identity]')), `[${scenario.name}] Le routage identité courte n'a pas été utilisé.`);
    }

    if (scenario.name === 'question produit sur la forge') {
      assert.ok(steps.some((step) => step.includes('governed direct answer [forge-overview]')), `[${scenario.name}] Le routage Forge gouverné n'a pas été utilisé.`);
    }

    if (scenario.name === 'périmètre assistant gouverné') {
      assert.ok(steps.some((step) => step.includes('governed direct answer [assistant-scope]')), `[${scenario.name}] Le routage scope gouverné n'a pas été utilisé.`);
    }

    if (scenario.name === 'fonctionnement nexxus gouverné') {
      assert.ok(steps.some((step) => step.includes('governed direct answer [nexxus-workings]')), `[${scenario.name}] Le routage Nexxus gouverné n'a pas été utilisé.`);
    }

    console.log(`PASS - ${scenario.name}`);
  }
}

function runStreamProcessorCase() {
  const processor = new OllamaStreamProcessor();
  const sample = 'Bonjour<think>internal chain of thought</think> visible';

  for (const char of sample) {
    processor.processToken(char);
  }

  processor.finalize();
  const result = processor.getResult();
  assert.equal(result.currentResponse, 'Bonjour visible');
  assert.ok(result.fullResponse.includes('<think>internal chain of thought</think>'));
  console.log('PASS - stream processor strips think blocks');

  // Test 100% internal thinking block fallback
  const processor2 = new OllamaStreamProcessor();
  const sample2 = '<think>This is a 100% internal reasoning chain that yields no visible text.</think>';
  for (const char of sample2) {
    processor2.processToken(char);
  }
  processor2.finalize();
  const result2 = processor2.getResult();
  assert.ok(result2.currentResponse.length > 0);
  assert.equal(result2.currentResponse, 'This is a 100% internal reasoning chain that yields no visible text.');
  console.log('PASS - stream processor handles 100 percent think blocks');

  // Test plain-text leaked English plans blocking
  const processor3 = new OllamaStreamProcessor();
  const sample3 = '**Thinking Process:**\n* Start with a clear plan.\n* Step 1: We will need to check the parameters.\n* Step 2: Then we must return the results.';
  for (const char of sample3) {
    processor3.processToken(char);
  }
  processor3.finalize();
  const result3 = processor3.getResult();
  assert.equal(result3.currentResponse, 'Tout est prêt. Sur quoi travaillons-nous ? 😄');
  console.log('PASS - stream processor detects and blocks plain text leaked English plans');
}

async function main() {
  await runConversationCases();
  console.log('PASS - conversation cases completed');
  runStreamProcessorCase();
  console.log('PASS - stream processor case completed');
  console.log('All conversation regressions passed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Conversation regression failure:', error.message);
  process.exitCode = 1;
});

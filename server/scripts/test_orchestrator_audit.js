import AgentPipeline from '../src/agent/agentPipeline.js';
import controlHarness from '../src/agent/harness/controlHarness.js';
import ollama from '../src/llm/ollama.js';

ollama.chat = async () => "Réponse experte mockée.";
ollama.chatStream = async (messages, onToken) => {
  onToken("Réponse "); onToken("experte "); onToken("mockée.");
  return "Réponse experte mockée.";
};
ollama.chatSafe = async () => '{"selected_experts": ["master_orchestrator"]}';

const queries = [
  { id: '1_AUDIT_TECH', text: 'Comment tu gères le cache en Node.js ?' },
  { id: '2_MIXTE_SOCIAL_TECH', text: 'Salut Nexxus, tu vas bien ? J\'ai un gros crash de mémoire sur le module d\'indexation, le process Node meurt en OOM.' },
  { id: '3_DEBAT_ARCHI', text: 'discussion: Je pense que la ségrégation des réseaux Docker est inutile si on utilise déjà des JWT pour l\'authentification applicative.' },
  { id: '4_RAPPORT_TECH', text: 'J\'ai remplacé le routeur par un switch statique pour corriger le bug, c\'est en prod.' }
];

async function runAudit() {
  console.log('=== DÉBUT AUDIT PIPELINE ORCHESTRATEUR ===\n');
  const pipeline = new AgentPipeline({ maxIterations: 1 });

  for (const q of queries) {
    console.log(`\n\n--- TEST: ${q.id} ---`);
    console.log(`QUERY: "${q.text}"`);

    const trace = {
      intent: '?',
      mode: '?',
      experts: [],
      fallback: 'NONE',
      finalOutputLength: 0,
      guardResult: 'PASS'
    };

    let stepLog = [];

    const onStep = (msg) => {
      stepLog.push(msg);
      // Capture intent
      if (msg.includes('🎯 Intent :')) {
        const match = msg.match(/Intent : (\w+)/);
        if (match) trace.intent = match[1];
        const modeMatch = msg.match(/Mode : (\w+)/);
        if (modeMatch) trace.mode = modeMatch[1];
      }
      // Capture experts
      if (msg.includes('Hub [Agents]: Specialized advisors aligned')) {
        const match = msg.match(/\((.*?)\)/);
        if (match) trace.experts = match[1].split(',').map(s => s.trim());
      }
      if (msg.includes('Hub [Agents]: Expert forced')) {
        const match = msg.match(/\[(.*?)\]/);
        if (match) trace.experts.push(match[1]);
      }
      if (msg.includes('governed direct answer')) {
        trace.fallback = 'DIRECT_ANSWER';
      }
    };

    let fullContent = '';
    const onContent = (token) => {
      fullContent += token;
    };

    try {
      const response = await pipeline.run(q.text, [], { onStep, onContent, sessionId: 'audit-' + q.id });
      
      trace.finalOutputLength = response.length;
      
      // ControlHarness check manually
      const harnessCheck = controlHarness.validateResponse(q.text, response);
      if (!harnessCheck.valid) {
        trace.guardResult = harnessCheck.reason;
      }

      console.log(`TRACE: ${q.text.substring(0, 30)}... -> Intent: [${trace.intent}] -> Mode: [${trace.mode}] -> Experts: [${trace.experts.join(',')}] -> Fallback: [${trace.fallback}] -> Guard: [${trace.guardResult}]`);
      console.log('Step Logs:');
      stepLog.forEach(l => console.log('  ' + l));
      console.log('\nExtrait Réponse Finale:');
      console.log(response.substring(0, 150) + '...');
      
    } catch (err) {
      console.error(`Erreur sur ${q.id}:`, err);
    }
  }
  
  console.log('\n=== FIN AUDIT ===');
  process.exit(0);
}

runAudit();

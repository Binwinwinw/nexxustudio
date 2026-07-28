/* server/src/scripts/benchmark-epistemic.js */
import criticAgent, { REJECTION_TAXONOMY } from '../agent/utils/criticAgent.js';

const BENCHMARK_CASES = [
  {
    name: 'Perfect Citation',
    query: 'Vérifie package.json.',
    response: '[OBSERVÉ] J\'ai lu package.json [0].\n[DÉDUIT] Le projet utilise Express.\n[RECOMMANDÉ] Continuer.',
    expectedValid: true
  },
  {
    name: 'Hallucination (No Citation)',
    query: 'Analyse la configuration de VRAM détectée par le système.',
    response: '[OBSERVÉ] La configuration système indique une VRAM de 7Go totalement opérationnelle sur le port 11434.\n[DÉDUIT] La performance sera optimale pour les modèles qwen3.5.\n[RECOMMANDÉ] Déployer le modèle en mode balanced immédiatement.\n' + ' '.repeat(500),
    expectedValid: false,
    expectedReason: REJECTION_TAXONOMY.UNSUPPORTED_CLAIM
  },
  {
    name: 'Missing Contract Tags',
    query: 'Génère un rapport sur la structure du projet.',
    response: 'Le projet est structuré avec un dossier server et un dossier client. La sécurité est assurée par des guards.\n' + ' '.repeat(500),
    expectedValid: false,
    expectedReason: REJECTION_TAXONOMY.OUTPUT_CONTRACT_INCOMPLETE
  }

];

async function runBenchmark() {
  console.log('\n--- 🧠 NEXXUS EPISTEMIC RELIABILITY BENCHMARK ---');
  let passCount = 0;

  for (const test of BENCHMARK_CASES) {
    console.log(`\nTesting Case: [${test.name}]`);
    const report = await criticAgent.verify(test.query, test.response);
    
    const validMatch = report.valid === test.expectedValid;
    const reasonMatch = !test.expectedReason || report.reasons.includes(test.expectedReason);

    if (validMatch && reasonMatch) {
      console.log(`✅ Passed: Score ${report.score.toFixed(2)}`);
      passCount++;
    } else {
      console.log(`❌ Failed: Expected Valid=${test.expectedValid}, Got=${report.valid}`);
      console.log(`   Reasons: ${report.reasons.join(', ')}`);
      console.log(`   Annotations: ${report.annotations.join('\n   ')}`);
    }
  }

  console.log(`\n--- Benchmark Result: ${passCount}/${BENCHMARK_CASES.length} cases passed ---\n`);
  
  if (passCount === BENCHMARK_CASES.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

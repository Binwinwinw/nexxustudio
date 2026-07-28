import criticAgent from '../src/agent/utils/criticAgent.js';
import turnTelemetry from '../src/agent/telemetry/turnTelemetry.js';

/**
 * Reliability Regression Suite v1 (Fiabilité v3.5)
 */
const TEST_CASES = [
  {
    name: "Ghost Tool Detection",
    response: "[OBSERVÉ]\nJ'ai utilisé l'outil organizeComponents() pour ranger les fichiers.\n[DÉDUIT]\nLe projet est bien structuré.\n[RECOMMANDÉ]\nContinuer.",
    expectedReasons: ['ghost_tools_detected']
  },
  {
    name: "Missing Output Contract",
    response: "Le projet e-commerce est prêt. J'ai vérifié les fichiers.",
    expectedReasons: ['output_contract_incomplete']
  },
  {
    name: "Unproven Affirmations",
    response: "[OBSERVÉ]\nLe bug a été corrigé et le fichier est présent.\n[DÉDUIT]\nLe système est stable.\n[RECOMMANDÉ]\nDéployer.",
    expectedReasons: ['unsupported_claims']
  },
  {
    name: "Syntax Error in Code",
    response: "[OBSERVÉ]\nScan effectué.\n[DÉDUIT]\nCode requis.\n[RECOMMANDÉ]\nUtiliser ce code :\n```js\nimport { something from 'somewhere';\nconst a = { unclosed: 'bracket'\n```",
    expectedReasons: ['syntax_invalid']
  },
  {
    name: "Blueprint vs Build Confusion",
    response: "[OBSERVÉ]\nLa structure du projet contient src/components/ProductCard.js.\n[DÉDUIT]\nLe blueprint est respecté.\n[RECOMMANDÉ]\nAjouter des styles.",
    // Note: This should trigger an annotation and lower the score, but might not be 'invalid' if other parts are okay.
    // However, in our simplified critic, we want to see the annotation.
    checkAnnotation: "Confusion potentielle Blueprint/Build"
  }
];

async function runTests() {
  console.log("🛡️ DÉMARRAGE DE LA SUITE DE RÉGRESSION FIABILITÉ v3.5\n");
  let passed = 0;

  for (const tc of TEST_CASES) {
    turnTelemetry.reset('test');
    const report = await criticAgent.verify('test query', tc.response);
    
    let tcPassed = true;
    if (tc.expectedReasons) {
      tcPassed = tc.expectedReasons.every(reason => report.reasons.includes(reason));
    }
    if (tc.checkAnnotation) {
      tcPassed = tcPassed && report.annotations.some(a => a.includes(tc.checkAnnotation));
    }

    if (tcPassed) {
      console.log(`✅ PASSED: ${tc.name} (Score: ${Math.round(report.score * 100)}%)`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${tc.name}`);
      console.error(`   Reasons found: ${report.reasons.join(', ')}`);
      console.error(`   Annotations: ${report.annotations.join('\n')}`);
    }
  }

  const score = passed / TEST_CASES.length;
  console.log(`\n📊 BILAN : ${passed}/${TEST_CASES.length} tests réussis (${Math.round(score * 100)}%)`);
  
  if (score >= 0.85) {
    console.log("🏛️ CERTIFICATION FIABILITÉ : VALIDÉE.");
  } else {
    console.error("🚫 CERTIFICATION FIABILITÉ : ÉCHEC.");
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});

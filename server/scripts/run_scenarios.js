/* server/scripts/run_scenarios.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import evalHarness from '../src/harness/evalHarness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const scenariosPath = path.resolve(__dirname, '../tests/fixtures/scenarios.json');
  const scenarios = await fs.readJson(scenariosPath);

  console.log('🚀 NEXXUS PROBATORY PHASE: SCENARIO RUNNER STARTING...\n');

  for (const scenario of scenarios) {
    const results = await evalHarness.runScenario(scenario);
    
    console.log(`\n--- RESULTS for ${scenario.name} ---`);
    results.forEach(r => {
      const status = r.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`  [${r.probeId}] ${status} (Score: ${r.score}%)`);
      if (r.findings.length > 0) {
        r.findings.forEach(f => console.log(`      - ${f}`));
      }
    });
    console.log('--------------------------------------------\n');
  }

  const finalReport = evalHarness.generateReport();
  const reportPath = `server/data/reports/scenarios_${Date.now()}.json`;
  await fs.ensureDir('server/data/reports');
  await fs.writeJson(reportPath, finalReport, { spaces: 2 });

  console.log(`\n🎉 Scenarios completed. Final Success Rate: ${finalReport.summary.successRate}`);
  console.log(`📄 Report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

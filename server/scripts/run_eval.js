import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import evalHarness from '../src/harness/evalHarness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("🚀 NEXXUS SOVEREIGNTY EVALUATION STARTING...");
  
  const probesPath = path.resolve(__dirname, '../tests/fixtures/persona_probes.json');
  const data = await fs.readJson(probesPath);

  for (const probe of data.probes) {
    const result = await evalHarness.runProbe(probe);
    if (result.passed) {
      console.log(`✅ [${probe.id}] PASSED (Score: ${result.score}%)`);
    } else {
      console.log(`❌ [${probe.id}] FAILED (Score: ${result.score}%)`);
      result.findings.forEach(f => console.log(`   - ${f}`));
    }
  }

  const report = evalHarness.generateReport();
  console.log("\n==========================================");
  console.log("NEXXUS SOVEREIGNTY REPORT");
  console.log(`Success Rate : ${report.summary.successRate}`);
  console.log(`Avg Score    : ${report.summary.averageSovereigntyScore}`);
  console.log("==========================================\n");

  const reportPath = path.resolve(__dirname, `../data/reports/report_${Date.now()}.json`);
  await fs.ensureDir(path.dirname(reportPath));
  await fs.writeJson(reportPath, report, { spaces: 2 });
  console.log(`Report saved to: ${reportPath}`);
}

run().catch(console.error);

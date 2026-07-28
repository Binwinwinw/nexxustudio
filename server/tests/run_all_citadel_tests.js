/**
 * 🛡️ NEXXUS CITADEL : ARCHITECTURAL CERTIFICATION ENGINE v3.3.8
 * Orchestre les tests multi-niveaux (SMOKE, CERTIFICATION, EXTENDED).
 * Génère des rapports Markdown et JSON pour la CI et le Cockpit.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_ID = `NX-${Date.now().toString(36).toUpperCase()}`;

const SUITES = [
  { id: 'SMOKE', file: 'smoke.test.js', description: 'Vérification du boot et des imports' },
  { id: 'CERTIFICATION', file: 'expertRouter_modular.test.js', description: 'Validation des contrats ExpertRouter' },
  { id: 'CERTIFICATION', file: 'systemPromptBuilder.test.js', description: 'Validation de l\'assemblage souverain' },
  { id: 'EXTENDED', file: 'extended_governance.test.js', description: 'Stress VRAM et limites de gouvernance' }
];

async function runEngine() {
  console.log("=====================================================");
  console.log(`🎖️  CITADEL CERTIFICATION ENGINE [${BUILD_ID}]  🎖️`);
  console.log("=====================================================\n");

  const results = [];
  const startTime = Date.now();

  for (const suite of SUITES) {
    const testPath = path.join(__dirname, suite.file);
    console.log(`[${suite.id}] EXÉCUTION : ${suite.file}...`);
    
    let status = 'PASSED';
    let output = '';
    const suiteStart = Date.now();

    try {
      output = execSync(`node ${testPath}`, { encoding: 'utf8' });
      console.log("✅ OK");
    } catch (err) {
      status = 'FAILED';
      output = err.stdout || err.message;
      console.error("❌ ÉCHEC");
    }

    results.push({
      ...suite,
      status,
      duration: Date.now() - suiteStart,
      output: output.split('\n').filter(l => l.startsWith('✅') || l.startsWith('❌'))
    });
  }

  const totalDuration = Date.now() - startTime;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const healthScore = Math.round(((SUITES.length - failedCount) / SUITES.length) * 100);

  // 1. GÉNÉRATION DU RAPPORT JSON (Pour CI & Cockpit)
  const reportPath = path.join(__dirname, 'certification_report.json');
  await fs.writeJson(reportPath, {
    buildId: BUILD_ID,
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    healthScore,
    results,
    certified: failedCount === 0,
    cockpitSummary: `Citadel [${BUILD_ID}] : ${healthScore}% Health - ${failedCount === 0 ? 'CERTIFIED' : 'REGRESSION DETECTED'}`
  }, { spaces: 2 });

  // 2. GÉNÉRATION DU RAPPORT MARKDOWN
  let md = `# 🎖️ Rapport de Certification Nexxus Citadel\n\n`;
  md += `- **ID de Build** : \`${BUILD_ID}\`\n`;
  md += `- **Date** : ${new Date().toLocaleString()}\n`;
  md += `- **Santé Souveraine** : ${healthScore}%\n`;
  md += `- **Statut Global** : ${failedCount === 0 ? '✅ CERTIFIÉ' : '❌ RÉGRESSION DÉTECTÉE'}\n\n`;
  
  md += `## 📊 Résumé Cockpit\n> \`Citadel [${BUILD_ID}] : ${healthScore}% Health - ${failedCount === 0 ? 'CERTIFIED' : 'REGRESSION DETECTED'}\`\n\n`;

  md += `## 🔍 Détail des Suites\n\n`;
  md += `| Niveau | Fichier | Description | Statut | Durée |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  results.forEach(r => {
    md += `| ${r.id} | \`${r.file}\` | ${r.description} | ${r.status === 'PASSED' ? '✅' : '❌'} | ${r.duration}ms |\n`;
  });

  md += `\n## 📝 Journal des Assertions\n\n`;
  results.forEach(r => {
    md += `### ${r.file}\n`;
    if (r.output.length > 0) {
      r.output.forEach(line => md += `- ${line}\n`);
    } else {
      md += `*Aucune assertion détaillée disponible.*\n`;
    }
    md += `\n`;
  });

  const mdPath = path.join(__dirname, 'certification_report.md');
  await fs.writeFile(mdPath, md);

  // 3. AFFICHAGE FINAL
  console.log("\n-----------------------------------------------------");
  console.log(`🏁 FIN DE SESSION [${BUILD_ID}] : ${failedCount === 0 ? 'CERTIFIÉ' : 'ÉCHEC'}`);
  console.log(`📂 Rapports : certification_report.md, certification_report.json`);
  console.log("-----------------------------------------------------\n");

  if (failedCount > 0) process.exit(1);
  process.exit(0);
}

runEngine();

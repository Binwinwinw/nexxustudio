/* server/src/forge/handlers/qaBuildValidationHandler.js */
import fs from 'fs/promises';
import path from 'path';
import { runCommand } from '../utils/shellRunner.js';
import { getArtifactPath } from '../utils/projectPaths.js';
import { writeForgeArtifact } from '../utils/forgeArtifactWriter.js';

export class QABuildValidationHandler {
  async execute(handoff, projectBase, forgeCtx = {}) {
    const { projectPath } = projectBase;
    console.log(`[Forge:CI] Starting CI/CD validation for ${handoff.projectTitle}...`);

    const report = {
      timestamp: new Date().toISOString(),
      projectTitle: handoff.projectTitle,
      status: 'PENDING',
      steps: []
    };

    try {
      const pkgPath = path.join(projectPath, 'package.json');
      const hasPackageJson = await fs.access(pkgPath).then(() => true).catch(() => false);

      if (!hasPackageJson) {
         this._addStep(report, 'Dependencies', 'SKIP', 'No package.json found. Skipping build.');
         report.status = 'PASS'; // Consider valid for non-node projects
         await this._saveReports(projectPath, report, forgeCtx);
         return report;
      }

      // 1. Dependency Install (si node_modules absent)
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      const hasNodeModules = await fs.access(nodeModulesPath).then(() => true).catch(() => false);

      if (!hasNodeModules) {
        const installRes = await runCommand('npm install --no-audit', projectPath, 300000, forgeCtx);
        this._addStep(report, 'npm install', installRes.success ? 'PASS' : 'FAIL', installRes.stderr);
        if (!installRes.success) {
          report.status = 'FAIL';
          await this._saveReports(projectPath, report, forgeCtx);
          return report;
        }
      } else {
        this._addStep(report, 'npm install', 'SKIP', 'node_modules already present.');
      }

      // 2. Build Check
      const pkgContent = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgContent);
      
      if (pkg.scripts && pkg.scripts.build) {
        const buildRes = await runCommand('npm run build', projectPath, 180000, forgeCtx);
        this._addStep(report, 'npm run build', buildRes.success ? 'PASS' : 'FAIL', buildRes.stderr || buildRes.stdout);
        
        if (buildRes.success) {
          // Vérification de l'artefact (dist/ ou build/)
          const hasDist = await fs.access(path.join(projectPath, 'dist')).then(() => true).catch(() => false);
          const hasBuild = await fs.access(path.join(projectPath, 'build')).then(() => true).catch(() => false);
          
          if (hasDist || hasBuild) {
            this._addStep(report, 'Build Artifact Detection', 'PASS', `Found ${hasDist ? 'dist/' : 'build/'} folder.`);
            report.status = 'PASS';
          } else {
            this._addStep(report, 'Build Artifact Detection', 'WARN', 'Build succeeded but no dist/ or build/ folder found.');
            report.status = 'WARN';
          }
        } else {
          report.status = 'FAIL';
        }
      } else {
        this._addStep(report, 'Build Check', 'SKIP', 'No build script defined in package.json.');
        report.status = 'PASS';
      }

    } catch (error) {
      console.error(`[Forge:CI] Validation failed:`, error);
      this._addStep(report, 'System Error', 'FAIL', error.message);
      report.status = 'FAIL';
    }

    // 3. Sauvegarde finale
    await this._saveReports(projectPath, report, forgeCtx);
    console.log(`[Forge:CI] CI Validation finished with status: ${report.status}`);
    return report;
  }

  _addStep(report, name, status, details = '') {
    report.steps.push({ name, status, details: details.substring(0, 1000) }); // Truncate logs if too big
  }

  async _saveReports(projectPath, results, forgeCtx = {}) {
    await writeForgeArtifact(
      path.join(projectPath, 'qa_build_report.json'),
      JSON.stringify(results, null, 2),
      { ...forgeCtx, artifactKind: 'qa_build_json' },
    );

    const md = this._generateMdReport(results);
    await writeForgeArtifact(
      path.join(projectPath, 'qa_build_report.md'),
      md,
      { ...forgeCtx, artifactKind: 'qa_build_md' },
    );
  }

  _generateMdReport(r) {
    const emoji = r.status === 'PASS' ? '✅' : (r.status === 'WARN' ? '⚠️' : '❌');
    const rows = r.steps.map(s => {
      const sEmoji = s.status === 'PASS' ? '✅' : (s.status === 'SKIP' ? '⚪' : (s.status === 'WARN' ? '⚠️' : '❌'));
      return `| ${sEmoji} | ${s.name} | ${s.details || '-'} |`;
    }).join('\n');

    return `
# Rapport de Validation Forge CI/CD : ${r.projectTitle}
> Statut Global : ${emoji} **${r.status}**
> Date : ${new Date(r.timestamp).toLocaleString()}

## Étapes du Pipeline
| Statut | Étape | Détails / Logs |
| :--- | :--- | :--- |
${rows}

---
*Généré par Nexxus Forge CI/CD Pipeline V0.7*
    `.trim();
  }
}

export default new QABuildValidationHandler();

/* server/src/forge/handlers/qaScaffoldAuditHandler.js */
import fs from 'fs/promises';
import { SCAFFOLD_TEMPLATES } from '../templates/scaffoldTemplates.js';
import { getArtifactPath } from '../utils/projectPaths.js';
import { writeForgeArtifact } from '../utils/forgeArtifactWriter.js';

export class QAScaffoldAuditHandler {
  async execute(handoff, projectBase, scaffoldRes, forgeCtx = {}) {
    const { projectPath } = projectBase;
    const templateKey = scaffoldRes.templateUsed;
    const template = SCAFFOLD_TEMPLATES[templateKey];

    console.log(`[Forge:QA] Starting audit for ${handoff.projectTitle} (Template: ${templateKey || 'None'})`);

    const auditResults = {
      timestamp: new Date().toISOString(),
      projectTitle: handoff.projectTitle,
      template: templateKey,
      status: 'PASS',
      checks: []
    };

    if (!template) {
      this._addCheck(auditResults, 'Template detection', 'FAIL', 'No scaffold template matched for this project type.');
      auditResults.status = 'FAIL';
    } else {
      // 1. Vérifier la présence de chaque fichier du template
      for (const relativePath of Object.keys(template.files)) {
        const fullPath = getArtifactPath(projectPath, relativePath);
        try {
          await fs.access(fullPath);
          this._addCheck(auditResults, `File presence: ${relativePath}`, 'PASS');
        } catch (err) {
          this._addCheck(auditResults, `File presence: ${relativePath}`, 'FAIL', 'File missing on disk.');
          auditResults.status = 'FAIL';
        }
      }

      // 2. Vérifier la validité du package.json if it exists
      const pkgPath = getArtifactPath(projectPath, 'package.json');
      try {
        const pkgContent = await fs.readFile(pkgPath, 'utf8');
        JSON.parse(pkgContent);
        this._addCheck(auditResults, 'package.json syntax', 'PASS');
      } catch (err) {
        if (template.files['package.json']) {
          this._addCheck(auditResults, 'package.json syntax', 'FAIL', `Invalid JSON or read error: ${err.message}`);
          auditResults.status = 'FAIL';
        }
      }
    }

    // 3. Générer les rapports physiques
    await this._saveReports(projectPath, auditResults, forgeCtx);

    console.log(`[Forge:QA] Audit finished with status: ${auditResults.status}`);
    return auditResults;
  }

  _addCheck(results, name, status, message = '') {
    results.checks.push({ name, status, message });
  }

  async _saveReports(projectPath, results, forgeCtx = {}) {
    await writeForgeArtifact(
      getArtifactPath(projectPath, 'qa_audit.json'),
      JSON.stringify(results, null, 2),
      { ...forgeCtx, artifactKind: 'qa_audit_json' },
    );

    const md = this._generateMdReport(results);
    await writeForgeArtifact(
      getArtifactPath(projectPath, 'qa_audit.md'),
      md,
      { ...forgeCtx, artifactKind: 'qa_audit_md' },
    );
  }

  _generateMdReport(r) {
    const emoji = r.status === 'PASS' ? '✅' : '❌';
    const rows = r.checks.map(c => 
      `| ${c.status === 'PASS' ? '✅' : '❌'} | ${c.name} | ${c.message || '-'} |`
    ).join('\n');

    return `
# Rapport d'Audit QA Forge : ${r.projectTitle}
> Statut Global : ${emoji} **${r.status}**
> Date : ${new Date(r.timestamp).toLocaleString()}

## Détails des contrôles
| Statut | Test | Observations |
| :--- | :--- | :--- |
${rows}

---
*Généré par Nexxus Forge QA Guardian V1.0*
    `.trim();
  }
}

export default new QAScaffoldAuditHandler();

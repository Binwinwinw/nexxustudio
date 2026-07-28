/**
 * Persistance artefacts Nexxus Video (JSON + Markdown).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {object} pack
 */
export function renderEvidencePackMarkdown(pack = {}) {
  const lines = [
    '# Nexxus Video — Evidence Pack',
    '',
    `- Objectif : **${pack.objective || 'summary'}**`,
    `- Profondeur : ${pack.depth || 'fast'}`,
    `- Hash source : \`${pack.source?.hash_sha256 || '—'}\``,
    `- Durée : ${pack.source?.duration_s ?? '—'}s`,
    '',
    '## Scènes',
  ];

  for (const scene of pack.scenes || []) {
    lines.push(
      `- ${scene.id} : ${scene.start_s}s → ${scene.end_s ?? '?'}s (conf. ${scene.confidence ?? '—'})`,
    );
  }

  if ((pack.uncertainties || []).length > 0) {
    lines.push('', '## Incertitudes');
    for (const note of pack.uncertainties) {
      lines.push(`- ${note}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * @param {object} result
 */
export function renderAnalysisMarkdown(result = {}) {
  const lines = [
    '# Nexxus Video — Rapport',
    '',
    result.summary ? `## Résumé\n\n${result.summary}\n` : '',
    '## Timeline',
  ];

  for (const item of result.timeline || []) {
    lines.push(`- [${item.at_s ?? '?'}s] ${item.label || item.event || '—'}`);
  }

  if ((result.highlights || []).length > 0) {
    lines.push('', '## Moments saillants');
    for (const highlight of result.highlights) {
      lines.push(`- ${highlight}`);
    }
  }

  return `${lines.filter(Boolean).join('\n')}\n`;
}

/**
 * @param {string} outputDir
 * @param {object} payload
 */
export async function writeVideoArtifacts(outputDir, payload = {}) {
  await fs.mkdir(outputDir, { recursive: true });

  const evidencePath = path.join(outputDir, 'evidence-pack.json');
  const analysisPath = path.join(outputDir, 'analysis-result.json');
  const reportPath = path.join(outputDir, 'report.md');

  if (payload.evidencePack) {
    await fs.writeFile(evidencePath, JSON.stringify(payload.evidencePack, null, 2), 'utf8');
    await fs.writeFile(
      path.join(outputDir, 'evidence-pack.md'),
      renderEvidencePackMarkdown(payload.evidencePack),
      'utf8',
    );
  }

  if (payload.analysisResult) {
    await fs.writeFile(analysisPath, JSON.stringify(payload.analysisResult, null, 2), 'utf8');
    await fs.writeFile(reportPath, renderAnalysisMarkdown(payload.analysisResult), 'utf8');
  }

  return {
    outputDir,
    files: {
      evidenceJson: payload.evidencePack ? evidencePath : null,
      analysisJson: payload.analysisResult ? analysisPath : null,
      reportMarkdown: payload.analysisResult ? reportPath : null,
    },
  };
}

export default {
  renderEvidencePackMarkdown,
  renderAnalysisMarkdown,
  writeVideoArtifacts,
};

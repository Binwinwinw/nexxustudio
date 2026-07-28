/**
 * Persistance artefacts Design Extract.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '../../data/design-extract-jobs');

export const DESIGN_EXTRACT_ARTIFACT_ROOT =
  process.env.DESIGN_EXTRACT_ARTIFACT_DIR || DEFAULT_ROOT;

/**
 * @param {string} outputDir
 * @param {object} envelope
 */
export async function writeDesignExtractArtifacts(outputDir, envelope = {}) {
  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'design-dna.json');
  const mdPath = path.join(outputDir, 'design-dna.md');

  await fs.writeFile(jsonPath, JSON.stringify(envelope, null, 2), 'utf8');

  const md = renderDesignDnaMarkdown(envelope);
  await fs.writeFile(mdPath, md, 'utf8');

  return {
    outputDir,
    files: {
      json: jsonPath,
      markdown: mdPath,
    },
  };
}

export function renderDesignDnaMarkdown(envelope = {}) {
  const lines = [
    '# Design Extract — Dossier ADN',
    '',
    `- Source : ${envelope.source?.url || '—'}`,
    `- Généré : ${envelope.generated_at || '—'}`,
    '',
    '## Tokens couleur',
  ];

  for (const color of envelope.tokens?.colors?.palette_ranked || envelope.tokens?.colors || []) {
    const label = color.hex || color.value || color;
    lines.push(`- ${label}`);
  }

  lines.push('', '## Typographie');
  const typoFamilies =
    envelope.tokens?.typography?.families || envelope.tokens?.typography || [];
  for (const font of typoFamilies) {
    const label = font.name || font;
    lines.push(`- ${label}`);
  }

  lines.push('', '## Patterns composants');
  for (const pattern of envelope.patterns || []) {
    lines.push(`- ${pattern.value} (${pattern.count})`);
  }

  if (envelope.reproduction_prompt) {
    lines.push('', '## Prompt reproduction', '', envelope.reproduction_prompt);
  }

  if ((envelope.uncertainties || []).length > 0) {
    lines.push('', '## Incertitudes');
    for (const note of envelope.uncertainties) {
      lines.push(`- ${note}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export default {
  DESIGN_EXTRACT_ARTIFACT_ROOT,
  writeDesignExtractArtifacts,
  renderDesignDnaMarkdown,
};

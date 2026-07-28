/**
 * Contrat pipeline orchestré Extract → Design Create → Forge (D4).
 */
import { validateDesignExtractInput } from '../design-extract/designExtractContract.js';
import { validateDesignCreateInput } from '../nexxus-design/nexxusDesignContract.js';

export const DESIGN_PIPELINE_KIND = 'design.pipeline';

export const PIPELINE_MODES = ['url_extract', 'dna_direct'];

/**
 * @param {object} input
 * @param {string} [input.url]
 * @param {string} [input.query]
 * @param {string} [input.objective]
 * @param {object} [input.referenceDna]
 * @param {object} [input.extractEnvelope]
 * @param {string} [input.extractionMode]
 * @param {string} [input.egressPolicy]
 */
export function validateDesignPipelineInput(input = {}) {
  const violations = [];
  const url = String(input.url || '').trim();
  const referenceDna = input.referenceDna || input.extractEnvelope || null;
  const hasUrl = Boolean(url);
  const hasDna = Boolean(referenceDna);

  if (!hasUrl && !hasDna) {
    violations.push({
      code: 'PIPELINE_SOURCE_REQUIRED',
      message: 'URL (mode Extract hybrid) ou referenceDna (mode direct) requis.',
    });
    return { ok: false, violations, mode: null };
  }

  if (hasUrl && hasDna) {
    violations.push({
      code: 'PIPELINE_INPUT_AMBIGUOUS',
      message:
        'Fournir une URL seule (Extract puis Design) ou un referenceDna seul, pas les deux.',
    });
    return { ok: false, violations, mode: null };
  }

  if (hasUrl) {
    const extractCheck = validateDesignExtractInput({
      url,
      query: input.query,
      egressPolicy: input.egressPolicy || 'local-only',
      extractionMode: input.extractionMode || 'hybrid',
      htmlSnapshot: input.htmlSnapshot,
    });
    if (!extractCheck.ok) {
      violations.push(...extractCheck.violations);
    }
    if (violations.length > 0) {
      return { ok: false, violations, mode: 'url_extract' };
    }
    return {
      ok: true,
      violations: [],
      mode: 'url_extract',
      normalized: {
        url,
        query: input.query || '',
        objective: input.objective || 'redesign',
        extractionMode: input.extractionMode || 'hybrid',
        egressPolicy: input.egressPolicy || 'local-only',
      },
    };
  }

  const createCheck = validateDesignCreateInput({
    query: input.query,
    objective: input.objective || 'redesign',
    referenceDna,
  });
  if (!createCheck.ok) {
    violations.push(...createCheck.violations);
  }

  if (violations.length > 0) {
    return { ok: false, violations, mode: 'dna_direct' };
  }

  return {
    ok: true,
    violations: [],
    mode: 'dna_direct',
    normalized: {
      query: input.query || '',
      objective: input.objective || 'redesign',
      referenceDna,
      projectTitle: input.projectTitle || null,
    },
  };
}

export default {
  DESIGN_PIPELINE_KIND,
  PIPELINE_MODES,
  validateDesignPipelineInput,
};

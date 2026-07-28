/**
 * Contrat Design Extract — rétro-ingénierie visuelle (DESIGN_EXTRACT).
 */

export const DESIGN_EXTRACT_SKILL_ID = 'skill-design-extract';

export const DESIGN_EXTRACT_INTENT = 'DESIGN_EXTRACT';

export const EXTRACT_SIGNALS = [
  'palette',
  'typography',
  'grid',
  'radius',
  'shadows',
  'sections',
  'editorial_tone',
  'spacing_rhythm',
  'cta_patterns',
  'component_patterns',
  'tech_stack_hints',
];

export const DESIGN_EXTRACT_ENVELOPE_VERSION = '2.0.0';

export const EXTRACT_EGRESS_POLICIES = ['local-only', 'hybrid-controlled'];

export const EXTRACT_MODES = ['static', 'hybrid', 'rendered'];

/**
 * @param {object} input
 * @param {string} [input.url]
 * @param {string} [input.htmlSnapshot]
 * @param {string} [input.query]
 * @param {string} [input.egressPolicy]
 * @param {string} [input.extractionMode]
 */
export function validateDesignExtractInput(input = {}) {
  const violations = [];
  const url = String(input.url || '').trim();
  const htmlSnapshot = String(input.htmlSnapshot || '').trim();
  const egressPolicy = input.egressPolicy || 'local-only';
  const extractionMode = input.extractionMode || 'static';

  if (!url && !htmlSnapshot && !input.query?.trim()) {
    violations.push({
      code: 'SOURCE_REQUIRED',
      message: 'URL, snapshot HTML ou requête requis pour extraction ADN.',
    });
  }

  if (url && !htmlSnapshot && !/^https?:\/\//i.test(url)) {
    violations.push({
      code: 'URL_INVALID',
      message: 'URL http(s) requise pour crawl contrôlé.',
    });
  }

  if (htmlSnapshot && htmlSnapshot.length < 120) {
    violations.push({
      code: 'HTML_SNAPSHOT_TOO_SHORT',
      message: 'Snapshot HTML insuffisant pour extraction ADN.',
    });
  }

  if (!EXTRACT_EGRESS_POLICIES.includes(egressPolicy)) {
    violations.push({
      code: 'EGRESS_DENIED',
      message: `Politique egress ${egressPolicy} non autorisée.`,
    });
  }

  if (!EXTRACT_MODES.includes(extractionMode)) {
    violations.push({
      code: 'EXTRACTION_MODE_INVALID',
      message: `Mode extraction « ${extractionMode} » non supporté.`,
    });
  }

  if (['hybrid', 'rendered'].includes(extractionMode)) {
    if (!url) {
      violations.push({
        code: 'URL_REQUIRED_HYBRID',
        message: 'URL requise pour extraction hybrid ou rendered.',
      });
    }
    if (htmlSnapshot) {
      violations.push({
        code: 'HTML_SNAPSHOT_INCOMPATIBLE',
        message: 'Snapshot HTML incompatible avec mode hybrid/rendered.',
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * @param {object} payload
 */
export function buildDesignExtractEnvelope(payload = {}) {
  return {
    version: payload.version || DESIGN_EXTRACT_ENVELOPE_VERSION,
    kind: 'nexxus.design.extract_result',
    skill_id: DESIGN_EXTRACT_SKILL_ID,
    source: {
      url: payload.url || null,
      fetched_at: payload.fetched_at || new Date().toISOString(),
      extraction_mode: payload.extraction_mode || 'static',
      viewport: payload.viewport || null,
      browser_session_id: payload.browser_session_id || null,
    },
    tokens: payload.tokens || {},
    layout_signatures: payload.layout_signatures || [],
    dna_dossier: payload.dna_dossier || {},
    patterns: payload.patterns || [],
    reproduction_prompt: payload.reproduction_prompt || null,
    signals: payload.signals || {},
    uncertainties: payload.uncertainties || [],
    quality_gate: payload.quality_gate || null,
    generated_at: new Date().toISOString(),
  };
}

export default {
  DESIGN_EXTRACT_SKILL_ID,
  DESIGN_EXTRACT_INTENT,
  DESIGN_EXTRACT_ENVELOPE_VERSION,
  EXTRACT_SIGNALS,
  EXTRACT_EGRESS_POLICIES,
  EXTRACT_MODES,
  validateDesignExtractInput,
  buildDesignExtractEnvelope,
};

/**
 * Utilitaires golden Browser Harness — normalisation et comparaison .00 / .01.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GOLDEN_ROOT = __dirname;

const VOLATILE_KEYS = new Set([
  'generated_at',
  'observed_at',
  'fetched_at',
  'recorded_at',
  'browser_session_id',
  'trace_id',
  'job_id',
  'duration_ms',
  'eventIndex',
]);

/**
 * @param {unknown} value
 * @param {Set<string>} [stripKeys]
 */
export function stripVolatile(value, stripKeys = VOLATILE_KEYS) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripVolatile(entry, stripKeys));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (stripKeys.has(key)) continue;
      out[key] = stripVolatile(entry, stripKeys);
    }
    return out;
  }
  return value;
}

/**
 * @param {object} envelope
 */
export function normalizeObservationGolden(envelope = {}) {
  const styles = envelope.computed_styles || [];
  return stripVolatile({
    version: envelope.version,
    kind: envelope.kind,
    source: {
      url: envelope.source?.url,
      response_status: envelope.source?.response_status,
      viewport: envelope.source?.viewport,
    },
    style_summary: envelope.style_summary,
    computed_styles_count: styles.length,
    computed_style_keys: styles.map((sample) => ({
      selector: sample.selector,
      tag: sample.tag,
      classes: sample.classes,
      color: sample.styles?.color || null,
      background: sample.styles?.['background-color'] || null,
      font_family: sample.styles?.['font-family'] || null,
    })),
    dom_snapshot: envelope.dom_snapshot
      ? {
          title: envelope.dom_snapshot.title,
          node_count: envelope.dom_snapshot.node_count,
        }
      : null,
    artifact_kinds: envelope.artifacts
      ? Object.keys(envelope.artifacts).filter((key) => envelope.artifacts[key])
      : [],
    uncertainties_count: (envelope.uncertainties || []).length,
  });
}

/**
 * @param {object} envelope
 */
export function normalizeExtractGolden(envelope = {}) {
  return stripVolatile({
    version: envelope.version,
    kind: envelope.kind,
    extraction_mode: envelope.source?.extraction_mode,
    style_summary: {
      palette: envelope.tokens?.colors?.distinct_count,
      typography: envelope.tokens?.typography?.distinct_families,
      layout_signatures: envelope.layout_signatures?.length,
    },
    tokens: {
      colors: {
        primary: envelope.tokens?.colors?.primary || null,
        accent: envelope.tokens?.colors?.accent || null,
        distinct_count: envelope.tokens?.colors?.distinct_count,
      },
      typography: {
        primary_family: envelope.tokens?.typography?.primary_family || null,
        distinct_families: envelope.tokens?.typography?.distinct_families,
      },
    },
    layout_signatures: (envelope.layout_signatures || []).map((entry) => ({
      pattern: entry.pattern,
      confidence: entry.confidence,
    })),
    signals: envelope.signals || {},
    quality_gate: envelope.quality_gate
      ? {
          merge_ok: envelope.quality_gate.merge_ok,
          score: envelope.quality_gate.score,
        }
      : null,
  });
}

/**
 * @param {object} payload
 */
export function normalizeRefusalGolden(payload = {}) {
  return stripVolatile({
    code: payload.code || payload.refusal?.code || null,
    has_browser_session: Boolean(payload.browser_session_id),
    has_partial_artifacts: Boolean(payload.artifacts?.trace_jsonl || payload.artifacts?.failure_json),
    artifact_kinds: payload.artifacts ? Object.keys(payload.artifacts) : [],
  });
}

/**
 * @param {string} caseId
 * @param {string} kind — observe | hybrid | refusal
 * @param {string} [revision]
 */
export function goldenPath(caseId, kind, revision = '00') {
  return path.join(GOLDEN_ROOT, `${caseId}.${kind}.envelope.${revision}.json`);
}

/**
 * @param {string} filePath
 */
export async function readGolden(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {string} filePath
 * @param {object} payload
 */
export async function writeGolden(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/**
 * @param {object} actual
 * @param {object} expected
 * @param {string} label
 */
export function assertGoldenEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual, null, 2);
  const expectedJson = JSON.stringify(expected, null, 2);
  if (actualJson !== expectedJson) {
    const error = new Error(`Golden mismatch — ${label}`);
    error.actual = actual;
    error.expected = expected;
    throw error;
  }
}

export default {
  GOLDEN_ROOT,
  stripVolatile,
  normalizeObservationGolden,
  normalizeExtractGolden,
  normalizeRefusalGolden,
  goldenPath,
  readGolden,
  writeGolden,
  assertGoldenEqual,
};

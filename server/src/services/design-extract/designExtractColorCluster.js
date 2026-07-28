/**
 * Clustering couleurs Design Extract v2 — normalisation, buckets RGB, rôles sémantiques.
 */

const GENERIC_NOISE = new Set([
  'transparent',
  'inherit',
  'currentcolor',
  'initial',
  'unset',
]);

const NOISE_HEX = new Set(['#ffffff', '#fff', '#000000', '#000']);

/**
 * @param {string} hex
 */
function expandHex3(hex) {
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const c = hex.slice(1);
    return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toLowerCase();
  }
  return hex.toLowerCase();
}

/**
 * @param {string} value
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseColorToRgb(value = '') {
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '');
  if (!raw || GENERIC_NOISE.has(raw)) return null;

  if (/^#[0-9a-f]{3,8}$/i.test(raw)) {
    const hex = expandHex3(raw.length <= 4 ? raw : raw.slice(0, 7));
    const n = hex.slice(1);
    return {
      r: parseInt(n.slice(0, 2), 16),
      g: parseInt(n.slice(2, 4), 16),
      b: parseInt(n.slice(4, 6), 16),
    };
  }

  const rgbMatch = raw.match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)/);
  if (rgbMatch) {
    return {
      r: Math.round(Number(rgbMatch[1])),
      g: Math.round(Number(rgbMatch[2])),
      b: Math.round(Number(rgbMatch[3])),
    };
  }

  return null;
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 */
export function rgbToHex({ r, g, b }) {
  const clamp = (channel) => Math.max(0, Math.min(255, Math.round(channel)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Quantification bucket RGB ±8 (spec v2).
 * @param {{ r: number, g: number, b: number }} rgb
 */
export function bucketRgb(rgb) {
  const quantize = (channel) => Math.round(channel / 8) * 8;
  return {
    r: quantize(rgb.r),
    g: quantize(rgb.g),
    b: quantize(rgb.b),
  };
}

/**
 * @param {Array<{ value: string, hint?: string, count?: number }>} samples
 */
export function clusterColors(samples = []) {
  const buckets = new Map();

  for (const sample of samples) {
    const rgb = parseColorToRgb(sample.value);
    if (!rgb) continue;

    const hex = rgbToHex(rgb);
    if (NOISE_HEX.has(hex)) continue;

    const key = rgbToHex(bucketRgb(rgb));
    const weight = sample.count || 1;
    const entry = buckets.get(key) || {
      hex: key,
      frequency: 0,
      hints: new Map(),
    };
    entry.frequency += weight;
    const hint = sample.hint || 'unknown';
    entry.hints.set(hint, (entry.hints.get(hint) || 0) + weight);
    buckets.set(key, entry);
  }

  const palette_ranked = [...buckets.values()]
    .sort((a, b) => b.frequency - a.frequency)
    .map((entry) => ({
      hex: entry.hex,
      frequency: entry.frequency,
      sources: [...entry.hints.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([hint]) => hint),
    }));

  const pickRole = (roleHints) => {
    let best = null;
    let bestScore = 0;
    for (const entry of buckets.values()) {
      let score = 0;
      for (const hint of roleHints) {
        score += entry.hints.get(hint) || 0;
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry.hex;
      }
    }
    return best;
  };

  const primary =
    pickRole(['body', 'header', 'nav']) || palette_ranked[0]?.hex || null;
  const accent =
    pickRole(['button', 'cta', 'link']) || palette_ranked[1]?.hex || null;
  const surface =
    pickRole(['main', 'section', 'card']) || palette_ranked[2]?.hex || null;
  const text = pickRole(['text', 'body', 'paragraph']) || primary;

  return {
    primary,
    accent,
    surface,
    text,
    palette_ranked: palette_ranked.map((entry, index) => ({
      hex: entry.hex,
      role:
        entry.hex === primary
          ? 'primary'
          : entry.hex === accent
            ? 'accent'
            : entry.hex === surface
              ? 'surface'
              : 'support',
      frequency: entry.frequency,
      sources: entry.sources,
      rank: index + 1,
    })),
    distinct_count: palette_ranked.length,
  };
}

export default {
  parseColorToRgb,
  rgbToHex,
  bucketRgb,
  clusterColors,
};

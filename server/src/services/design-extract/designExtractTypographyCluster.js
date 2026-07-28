/**
 * Clustering typographie Design Extract v2.
 */

const GENERIC_FONTS = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'inherit',
]);

/**
 * @param {string} raw
 */
export function normalizeFontFamily(raw = '') {
  const first = String(raw)
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim();
  if (!first || GENERIC_FONTS.has(first.toLowerCase())) return null;
  return first;
}

/**
 * @param {string} size
 * @param {number} [basePx=16]
 */
export function sizeToPx(size = '', basePx = 16) {
  const match = String(size).trim().match(/^([\d.]+)(px|rem|em)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2] || 'px';
  if (unit === 'px') return Math.round(value);
  return Math.round(value * basePx);
}

/**
 * @param {Array<{ family: string, size?: string, hint?: string }>} samples
 */
export function clusterTypography(samples = []) {
  const familyMap = new Map();

  for (const sample of samples) {
    const name = normalizeFontFamily(sample.family);
    if (!name) continue;

    const entry = familyMap.get(name) || {
      name,
      roles: new Set(),
      sizes_px: new Set(),
      frequency: 0,
    };
    entry.frequency += 1;
    if (sample.hint) entry.roles.add(sample.hint);
    const px = sample.size ? sizeToPx(sample.size) : null;
    if (px) entry.sizes_px.add(px);
    familyMap.set(name, entry);
  }

  const families = [...familyMap.values()]
    .sort((a, b) => b.frequency - a.frequency)
    .map((entry) => ({
      name: entry.name,
      roles: [...entry.roles],
      sizes_px: [...entry.sizes_px].sort((a, b) => a - b),
      frequency: entry.frequency,
    }));

  const allSizes = [...new Set(families.flatMap((entry) => entry.sizes_px))].sort(
    (a, b) => a - b,
  );

  return {
    families,
    scale: allSizes,
    distinct_families: families.length,
    distinct_sizes: allSizes.length,
  };
}

export default {
  normalizeFontFamily,
  sizeToPx,
  clusterTypography,
};

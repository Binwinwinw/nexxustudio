/**
 * Échantillonnage styles — sélecteurs cibles, props CSS, limite 120 nœuds.
 */

export const MAX_STYLE_SAMPLES = 120;

export const STYLE_SAMPLE_SELECTORS = [
  'html',
  'body',
  'header',
  'nav',
  'main',
  'section',
  'article',
  'footer',
  'aside',
  'h1',
  'h2',
  'h3',
  'p',
  'a',
  'button',
  '[role="button"]',
  'input',
  'label',
  '[class*="btn"]',
  '[class*="card"]',
  '[class*="hero"]',
  '[class*="nav"]',
];

export const COMPUTED_STYLE_PROPS = [
  'color',
  'background-color',
  'border-color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'gap',
  'border-radius',
  'box-shadow',
  'display',
  'grid-template-columns',
  'flex-direction',
];

const HINT_BY_SELECTOR = [
  [/^(button|\[role="button"\]|a|\[class\*="btn"\])/i, 'cta'],
  [/^header/i, 'header'],
  [/^nav|\[class\*="nav"\]/i, 'nav'],
  [/^main/i, 'main'],
  [/^section/i, 'section'],
  [/^footer/i, 'footer'],
  [/^body|^html/i, 'body'],
  [/^h[1-3]/i, 'heading'],
  [/^p/i, 'paragraph'],
  [/\[class\*="card"\]/i, 'card'],
  [/\[class\*="hero"\]/i, 'hero'],
];

/**
 * @param {string} selector
 * @param {string} [tag]
 * @param {string} [className]
 */
export function inferStyleHint(selector = '', tag = '', className = '') {
  const probe = `${selector} ${tag} ${className}`.trim();
  for (const [pattern, hint] of HINT_BY_SELECTOR) {
    if (pattern.test(probe)) return hint;
  }
  return 'unknown';
}

/**
 * @param {Array} samples
 * @param {number} [limit]
 */
export function capStyleSamples(samples = [], limit = MAX_STYLE_SAMPLES) {
  return samples.slice(0, limit);
}

/**
 * @param {Array<{ styles?: object }>} samples
 */
export function summarizeComputedStyles(samples = []) {
  const colors = new Set();
  const fonts = new Set();

  for (const sample of samples) {
    const styles = sample.styles || {};
    for (const key of ['color', 'background-color', 'border-color']) {
      const value = styles[key];
      if (value && !/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(value)) {
        colors.add(String(value).trim().toLowerCase());
      }
    }
    if (styles['font-family']) {
      const family = String(styles['font-family']).split(',')[0].replace(/['"]/g, '').trim();
      if (family) fonts.add(family);
    }
  }

  return {
    samples_count: samples.length,
    unique_colors: colors.size,
    unique_font_families: fonts.size,
  };
}

/**
 * Convertit des samples bruts en color_samples pour Design Extract merge (futur C5).
 * @param {Array} samples
 */
export function toDesignExtractColorSamples(samples = []) {
  const output = [];
  for (const sample of samples) {
    const styles = sample.styles || {};
    const hint = sample.hint || inferStyleHint(sample.selector, sample.tag, sample.classes?.join(' '));
    for (const key of ['color', 'background-color', 'border-color']) {
      if (styles[key]) {
        output.push({ value: styles[key], hint });
      }
    }
  }
  return output;
}

export default {
  MAX_STYLE_SAMPLES,
  STYLE_SAMPLE_SELECTORS,
  COMPUTED_STYLE_PROPS,
  inferStyleHint,
  capStyleSamples,
  summarizeComputedStyles,
  toDesignExtractColorSamples,
};

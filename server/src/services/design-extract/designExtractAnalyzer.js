/**
 * Analyse HTML statique — ADN design (palette, typo, layout, patterns).
 * v1 sans browser harness ; styles calculés = incertitude documentée.
 */
import * as cheerio from 'cheerio';

const COLOR_PATTERN =
  /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

const SPACING_PATTERN =
  /\b(\d+(?:\.\d+)?)(px|rem|em|%)\b/g;

const RADIUS_PATTERN = /border-radius\s*:\s*([^;]+)/gi;
const SHADOW_PATTERN = /box-shadow\s*:\s*([^;]+)/gi;
const FONT_FAMILY_PATTERN = /font-family\s*:\s*([^;]+)/gi;

function normalizeColor(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function topFrequency(items = [], limit = 8) {
  const counts = new Map();
  for (const item of items) {
    const key = String(item).trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/**
 * @param {string} html
 * @param {string} [sourceUrl]
 */
export function analyzeDesignHtml(html = '', sourceUrl = null) {
  const $ = cheerio.load(html);
  const uncertainties = [];

  const inlineStyles = [];
  const styleBlocks = [];

  $('[style]').each((_, element) => {
    inlineStyles.push($(element).attr('style') || '');
  });
  $('style').each((_, element) => {
    styleBlocks.push($(element).text() || '');
  });

  const cssCorpus = [...inlineStyles, ...styleBlocks].join('\n');

  const color_samples = [];
  const addColorSample = (value, hint) => {
    const normalized = normalizeColor(value);
    if (normalized) color_samples.push({ value: normalized, hint });
  };

  for (const match of cssCorpus.matchAll(COLOR_PATTERN)) {
    addColorSample(match[0], 'style');
  }
  $('[data-theme-color], meta[name="theme-color"]').each((_, element) => {
    const content =
      $(element).attr('content') || $(element).attr('data-theme-color') || '';
    if (content) addColorSample(content, 'meta');
  });

  const tagHints = [
    ['body', 'body'],
    ['header', 'header'],
    ['nav', 'nav'],
    ['main', 'main'],
    ['section', 'section'],
    ['footer', 'footer'],
    ['p', 'paragraph'],
    ['h1', 'heading'],
    ['button', 'button'],
    ['a', 'link'],
  ];
  for (const [selector, hint] of tagHints) {
    $(selector).each((_, element) => {
      const style = $(element).attr('style') || '';
      for (const match of style.matchAll(COLOR_PATTERN)) {
        addColorSample(match[0], hint);
      }
      const cls = ($(element).attr('class') || '').toLowerCase();
      if (/btn|cta|primary/.test(cls)) {
        for (const match of style.matchAll(COLOR_PATTERN)) {
          addColorSample(match[0], 'cta');
        }
      }
      if (/card/.test(cls)) {
        for (const match of style.matchAll(COLOR_PATTERN)) {
          addColorSample(match[0], 'card');
        }
      }
    });
  }

  const palette = topFrequency(color_samples.map((sample) => sample.value), 10);

  const fontFamilies = [];
  const typography_samples = [];
  for (const match of cssCorpus.matchAll(FONT_FAMILY_PATTERN)) {
    const family = match[1].replace(/['"]/g, '').trim();
    fontFamilies.push(family);
    typography_samples.push({ family, hint: 'style' });
  }
  $('h1, h2, h3').each((_, element) => {
    const style = $(element).attr('style') || '';
    const sizeMatch = style.match(/font-size\s*:\s*([^;]+)/i);
    for (const match of style.matchAll(FONT_FAMILY_PATTERN)) {
      typography_samples.push({
        family: match[1],
        size: sizeMatch?.[1]?.trim(),
        hint: 'heading',
      });
    }
  });
  $('body, p, button').each((_, element) => {
    const style = $(element).attr('style') || '';
    const sizeMatch = style.match(/font-size\s*:\s*([^;]+)/i);
    for (const match of style.matchAll(FONT_FAMILY_PATTERN)) {
      typography_samples.push({
        family: match[1],
        size: sizeMatch?.[1]?.trim(),
        hint: element.tagName === 'button' ? 'button' : 'body',
      });
    }
  });
  $('link[rel="stylesheet"], link[href*="fonts.googleapis"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    if (/fonts\.googleapis|fonts\.gstatic|typekit|fontawesome/i.test(href)) {
      fontFamilies.push(href);
    }
  });

  const typography = {
    families: topFrequency(fontFamilies, 6),
    heading_samples: $('h1, h2, h3')
      .slice(0, 6)
      .map((_, element) => $(element).text().trim().slice(0, 80))
      .get()
      .filter(Boolean),
  };

  const spacingValues = [];
  for (const match of cssCorpus.matchAll(SPACING_PATTERN)) {
    spacingValues.push(`${match[1]}${match[2]}`);
  }

  const radii = [];
  for (const match of cssCorpus.matchAll(RADIUS_PATTERN)) {
    radii.push(match[1].trim());
  }

  const shadows = [];
  for (const match of cssCorpus.matchAll(SHADOW_PATTERN)) {
    shadows.push(match[1].trim().slice(0, 120));
  }

  const sectionTags = ['header', 'nav', 'main', 'section', 'footer', 'aside', 'article'];
  const sections = sectionTags
    .map((tag) => ({ tag, count: $(tag).length }))
    .filter((entry) => entry.count > 0);

  const ctaCandidates = [];
  $('a, button, [role="button"]').each((_, element) => {
    const cls = ($(element).attr('class') || '').toLowerCase();
    const text = $(element).text().trim().slice(0, 48);
    if (/cta|btn|button|primary|action/.test(cls) || text.length > 0) {
      ctaCandidates.push({ tag: element.tagName, class: cls, text });
    }
  });

  const componentPatterns = topFrequency(
    $('[class]')
      .slice(0, 200)
      .map((_, element) => {
        const cls = ($(element).attr('class') || '').split(/\s+/).filter(Boolean);
        return cls.find((name) =>
          /card|hero|nav|footer|modal|badge|pill|sidebar|grid|container/.test(name),
        );
      })
      .get()
      .filter(Boolean),
    12,
  );

  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const title = $('title').text().trim();
  const editorialTone = {
    title,
    meta_description: metaDescription.slice(0, 240),
    h1: $('h1').first().text().trim().slice(0, 120),
  };

  const techStackHints = [];
  if (/react|vite|next|nuxt|vue|svelte/i.test(html)) {
    const frameworks = html.match(/react|vite|next\.js|nuxt|vue|svelte/gi) || [];
    techStackHints.push(...topFrequency(frameworks.map((f) => f.toLowerCase()), 4));
  }
  $('script[src]').each((_, element) => {
    const src = $(element).attr('src') || '';
    if (/vite|webpack|next|nuxt|tailwind/i.test(src)) {
      techStackHints.push({ value: src.split('/').pop(), count: 1 });
    }
  });

  if (palette.length === 0) {
    uncertainties.push(
      'Palette limitée — styles probablement chargés via CSS externe non analysé.',
    );
  }
  uncertainties.push(
    'Analyse static HTML/CSS — getComputedStyle requiert browser harness (Phase C).',
  );

  const raw_tokens = {
    radius: topFrequency(radii, 6),
    shadows: topFrequency(shadows, 4),
    spacing: topFrequency(spacingValues, 8),
  };

  const tokens = {
    colors: palette.map((entry) => entry.value),
    typography: typography.families.map((entry) => entry.value),
    spacing: raw_tokens.spacing.map((entry) => entry.value),
    radius: raw_tokens.radius.map((entry) => entry.value),
    shadows: raw_tokens.shadows.map((entry) => entry.value),
  };

  const dna_dossier = {
    source_url: sourceUrl,
    palette,
    typography,
    spacing_rhythm: topFrequency(spacingValues, 12),
    layout_sections: sections,
    cta_patterns: ctaCandidates.slice(0, 12),
    component_patterns: componentPatterns,
    editorial_tone: editorialTone,
    tech_stack_hints: techStackHints,
  };

  return {
    dna_dossier,
    tokens,
    patterns: componentPatterns,
    color_samples,
    typography_samples,
    raw_tokens,
    signals: {
      palette: palette.length,
      typography: typography.families.length,
      sections: sections.length,
      cta: ctaCandidates.length,
    },
    uncertainties,
  };
}

/**
 * @param {object} analysis
 */
export function buildReproductionPrompt(analysis = {}) {
  const colorTokens = analysis.tokens?.colors;
  const isV2 = colorTokens && typeof colorTokens === 'object' && !Array.isArray(colorTokens);

  const colors = isV2
    ? [colorTokens.primary, colorTokens.accent, colorTokens.surface]
        .filter(Boolean)
        .join(', ')
    : (analysis.tokens?.colors || []).slice(0, 6).join(', ');

  const fonts = isV2
    ? (analysis.tokens?.typography?.families || [])
        .slice(0, 2)
        .map((entry) => entry.name)
        .join(', ')
    : (analysis.tokens?.typography || []).slice(0, 3).join(', ');

  const layoutSigs = (analysis.layout_signatures || [])
    .map((entry) => entry.pattern)
    .join(', ');

  const sections = (analysis.dna_dossier?.layout_sections || [])
    .map((section) => `${section.tag}×${section.count}`)
    .join(', ');

  const spacing = analysis.tokens?.spacing?.dominant_gap || 'à préciser';
  const patterns = (analysis.patterns || [])
    .slice(0, 4)
    .map((entry) => entry.value || entry.name)
    .filter(Boolean)
    .join(', ');

  const uncertaintyCount = (analysis.uncertainties || []).length;

  return (
    `Refonte fidèle au style source observé. ` +
    `Palette dominante : ${colors || 'non détectées'}. ` +
    `Typographies : ${fonts || 'non détectées'}. ` +
    `Structure : ${layoutSigs || sections || 'à préciser'}. ` +
    `Rythme espacement : base ${spacing}. ` +
    `Patterns à conserver : ${patterns || 'à préciser'}. ` +
    `Ne pas inventer de composants absents du dossier ADN. ` +
    `Incertitudes : ${uncertaintyCount} signal(s) partiel(s).`
  );
}

export default {
  analyzeDesignHtml,
  buildReproductionPrompt,
};

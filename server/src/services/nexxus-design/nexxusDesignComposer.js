/**
 * Composition blueprint / composants / structure depuis envelope Extract v2.
 */
import { contrastRatio } from '../impeccable/impeccableScorer.js';

const OBJECTIVE_LAYOUT_DEFAULTS = {
  landing: 'hero-first',
  cockpit: 'sidebar+main',
  design_system: 'card-grid',
  component: 'card-grid',
  webapp: 'header+main+footer',
  redesign: 'header+main+footer',
};

/**
 * @param {string} objective
 * @param {Array} layout_signatures
 */
export function pickPrimaryLayout(objective, layout_signatures = []) {
  if (layout_signatures.length === 0) {
    return OBJECTIVE_LAYOUT_DEFAULTS[objective] || 'header+main+footer';
  }
  const ranked = [...layout_signatures].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  return ranked[0].pattern;
}

/**
 * @param {object} extractEnvelope
 * @param {string} objective
 */
export function buildBlueprintFromExtract(extractEnvelope = {}, objective = 'redesign') {
  const layout_signatures = extractEnvelope.layout_signatures || [];
  const primaryLayout = pickPrimaryLayout(objective, layout_signatures);

  return {
    layout: primaryLayout,
    layout_signatures,
    grid_strategy: objective === 'cockpit' ? 'dense-dashboard' : 'marketing-flow',
    source_url: extractEnvelope.source?.url || null,
    quality_score: extractEnvelope.quality_gate?.score ?? null,
    assembly_notes: [
      `Layout principal : ${primaryLayout}`,
      'Tokens hérités de Design Extract v2 — pas de dérive palette sans validation.',
      'Forge consomme ce blueprint en entrée unique de vérité.',
    ],
  };
}

/**
 * @param {object} tokens
 * @param {string} objective
 * @param {Array} patterns
 */
export function buildComponentsFromExtract(tokens = {}, objective = 'redesign', patterns = []) {
  const colors = tokens.colors || {};
  const radius = tokens.radius?.dominant || '8px';
  const components = [];

  const primaryBtn = {
    id: 'ButtonPrimary',
    role: 'cta',
    props: {
      background: colors.accent || colors.primary,
      color: '#ffffff',
      borderRadius: radius,
      fontFamily: tokens.typography?.families?.[0]?.name || 'Inter, sans-serif',
    },
    tailwind: `rounded-lg px-6 py-3 font-semibold text-white bg-[${colors.accent || colors.primary}]`,
  };
  components.push(primaryBtn);

  const card = {
    id: 'CardSurface',
    role: 'surface',
    props: {
      background: colors.surface || '#ffffff',
      borderRadius: tokens.radius?.values?.[0] || '16px',
      shadow: tokens.shadows?.[0]?.value || '0 4px 16px rgba(15,23,42,0.08)',
    },
    tailwind: `rounded-2xl p-4 bg-[${colors.surface || '#ffffff'}] shadow-sm`,
  };
  components.push(card);

  if (objective === 'design_system' || patterns.some((entry) => /badge/i.test(entry.value))) {
    const accentHex =
      colors.palette_ranked?.find((entry) => entry.role === 'accent')?.hex ||
      colors.accent ||
      '#10b981';
    components.push({
      id: 'BadgeStatus',
      role: 'badge',
      props: { background: accentHex, color: '#ffffff', borderRadius: '999px' },
      tailwind: `inline-flex rounded-full px-3 py-1 text-sm text-white bg-[${accentHex}]`,
    });
  }

  if (objective === 'cockpit') {
    const metricColor =
      colors.palette_ranked?.find((entry) => /metric|accent/i.test(entry.role || ''))?.hex ||
      colors.accent ||
      '#38bdf8';
    components.push({
      id: 'KpiTile',
      role: 'metric',
      props: {
        background: colors.primary || '#1e293b',
        valueColor: metricColor,
        borderRadius: '12px',
      },
      tailwind: `rounded-xl p-4 bg-[${colors.primary || '#1e293b'}]`,
    });
    components.push({
      id: 'DataTable',
      role: 'table',
      props: {
        background: colors.primary || '#1e293b',
        textColor: colors.text || '#cbd5e1',
      },
      tailwind: `w-full rounded-xl overflow-hidden bg-[${colors.primary || '#1e293b'}]`,
    });
  }

  return components;
}

/**
 * @param {string} objective
 * @param {object} blueprint
 */
export function buildPageStructure(objective, blueprint = {}) {
  const layout = blueprint.layout || 'header+main+footer';

  if (objective === 'cockpit' || layout === 'sidebar+main') {
    return [
      { id: 'header', tag: 'header', role: 'top-bar', children: ['title', 'actions'] },
      { id: 'main', tag: 'main', role: 'dashboard', children: ['kpi-grid', 'data-table', 'chart'] },
    ];
  }

  if (objective === 'design_system' || layout === 'card-grid') {
    return [
      { id: 'main', tag: 'main', role: 'showcase', children: ['badges', 'buttons', 'card-demo'] },
    ];
  }

  return [
    { id: 'header', tag: 'header', role: 'navigation', children: ['nav'] },
    { id: 'hero', tag: 'section', role: 'hero', children: ['headline', 'subheadline'] },
    { id: 'content', tag: 'article', role: 'card', children: ['body', 'cta'] },
    { id: 'footer', tag: 'footer', role: 'footer', children: ['legal'] },
  ];
}

/**
 * @param {string} objective
 * @param {string} [query]
 */
export function buildUxCopy(objective, query = '') {
  const base = {
    landing: {
      headline: 'La Citadelle',
      subheadline: 'Observer, transposer, corriger',
      cta: 'Découvrir Forge',
    },
    cockpit: {
      headline: 'Dashboard Ops',
      subheadline: 'Télémétrie et jobs en temps réel',
      cta: 'Voir les détails',
    },
    design_system: {
      headline: 'Composants UI',
      subheadline: 'Bibliothèque Nexxus Design — tokens alignés Extract',
      cta: 'Action principale',
    },
  };

  return {
    ...(base[objective] || base.landing),
    brief_excerpt: query ? query.slice(0, 160) : null,
  };
}

/**
 * Assure un token texte lisible sur surface (WCAG AA 4.5:1).
 * @param {object} tokens
 */
export function normalizeTokensForAccessibility(tokens = {}) {
  const colors = { ...(tokens.colors || {}) };
  const surface = colors.surface || '#f8fafc';
  const ranked = colors.palette_ranked || [];
  let text = colors.text || colors.primary || '#0f172a';

  if (!contrastRatio(text, surface) || contrastRatio(text, surface) < 4.5) {
    const fromPalette = ranked
      .map((entry) => entry.hex)
      .find((hex) => contrastRatio(hex, surface) >= 4.5);
    text =
      fromPalette ||
      ranked.find((entry) => entry.role === 'support')?.hex ||
      '#101828';
  }

  return {
    ...tokens,
    colors: {
      ...colors,
      text,
    },
  };
}

/**
 * @param {object} extractEnvelope
 * @param {object} options
 * @param {string} [options.objective]
 * @param {string} [options.query]
 */
export function composeDesignFromExtract(extractEnvelope = {}, options = {}) {
  const objective = options.objective || 'redesign';
  const tokens = normalizeTokensForAccessibility(extractEnvelope.tokens || {});
  const patterns = extractEnvelope.patterns || [];

  const blueprint = buildBlueprintFromExtract(extractEnvelope, objective);
  const components = buildComponentsFromExtract(tokens, objective, patterns);
  const page_structure = buildPageStructure(objective, blueprint);

  const uncertainties = [...(extractEnvelope.uncertainties || [])];
  if (!extractEnvelope.reproduction_prompt) {
    uncertainties.push('Prompt reproduction Extract absent — guidelines dérivées des tokens uniquement.');
  }

  return {
    objective,
    blueprint,
    tokens,
    components,
    page_structure,
    ux_copy: buildUxCopy(objective, options.query),
    guidelines: [
      'Local-first — pas de dépendance CDN critique pour la charte.',
      'Contraste WCAG à valider via Impeccable avant merge production.',
      extractEnvelope.reproduction_prompt
        ? `Référence reproduction : ${extractEnvelope.reproduction_prompt.slice(0, 200)}…`
        : 'Référence reproduction non fournie.',
    ],
    assembly: {
      scaffold_template: 'react-vite',
      css_strategy: 'tailwind-arbitrary',
      layout: blueprint.layout,
      component_count: components.length,
    },
    uncertainties,
    source: {
      extract_version: extractEnvelope.version || '2.0.0',
      extract_url: extractEnvelope.source?.url || null,
      extraction_mode: extractEnvelope.source?.extraction_mode || null,
      quality_score: extractEnvelope.quality_gate?.score ?? null,
    },
  };
}

export default {
  pickPrimaryLayout,
  buildBlueprintFromExtract,
  buildComponentsFromExtract,
  buildPageStructure,
  buildUxCopy,
  normalizeTokensForAccessibility,
  composeDesignFromExtract,
};

/**
 * Scoring heuristique Impeccable — dimensions design / UX (E1).
 */
import { IMPECCABLE_DIMENSIONS } from './impeccableContract.js';

function parseHexColor(value = '') {
  const raw = String(value).trim();
  const match = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
  const a = parseHexColor(hexA);
  const b = parseHexColor(hexB);
  if (!a || !b) return null;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * @param {object} input
 * @param {object} [input.createEnvelope]
 * @param {object} [input.extractEnvelope]
 * @param {string} [input.appJsx]
 * @param {string} [input.blueprintMd]
 * @param {object} [input.browserObservation]
 */
export function scoreImpeccableArtifacts(input = {}) {
  const createEnvelope = input.createEnvelope || {};
  const extractEnvelope = input.extractEnvelope || {};
  const appJsx = String(input.appJsx || '');
  const blueprintMd = String(input.blueprintMd || '');
  const browserObservation = input.browserObservation || null;

  const issues = [];
  const quick_wins = [];
  const dimensions = Object.fromEntries(IMPECCABLE_DIMENSIONS.map((d) => [d, 0]));

  const tokens = createEnvelope.tokens || {};
  const colors = tokens.colors || {};
  const components = createEnvelope.components || [];
  const pageStructure = createEnvelope.page_structure || [];
  const objective = createEnvelope.objective || 'redesign';

  const primary = colors.primary || '#0f172a';
  const accent = colors.accent || primary;
  const surface = colors.surface || '#f8fafc';
  const text = colors.text || primary;

  let coherence = 70;
  if (components.length >= 2) coherence += 10;
  if (pageStructure.length >= 2) coherence += 10;
  if (blueprintMd.includes('Blueprint Nexxus')) coherence += 5;
  if (primary === text && objective !== 'cockpit') {
    issues.push({
      severity: 'major',
      dimension: 'coherence',
      message: 'Couleur texte identique au primary — hiérarchie visuelle affaiblie.',
      recommendation: 'Distinguer text et primary dans les tokens.',
    });
    coherence -= 15;
  }
  dimensions.coherence = clampScore(coherence);

  let hierarchy = 65;
  const headingCount = (appJsx.match(/<h[1-3]/g) || []).length;
  if (headingCount >= 1) hierarchy += 15;
  if (headingCount >= 2) hierarchy += 10;
  if (createEnvelope.ux_copy?.headline) hierarchy += 10;
  if (headingCount === 0) {
    issues.push({
      severity: 'major',
      dimension: 'hierarchy',
      message: 'Aucun titre sémantique (h1–h3) détecté dans App.jsx.',
      recommendation: 'Ajouter au moins un h1 et un sous-titre.',
    });
    hierarchy -= 20;
  }
  dimensions.hierarchy = clampScore(hierarchy);

  const textContrast = contrastRatio(text, surface);
  const accentContrast = contrastRatio(accent, surface);
  let contrast = 60;
  if (textContrast && textContrast >= 4.5) contrast += 20;
  else if (textContrast) {
    issues.push({
      severity: 'blocker',
      dimension: 'contrast',
      message: `Contraste texte/surface insuffisant (${textContrast.toFixed(2)}:1, minimum 4.5:1).`,
      recommendation: 'Assombrir le texte ou éclaircir le fond surface.',
    });
    contrast -= 25;
  }
  if (accentContrast && accentContrast >= 3) contrast += 10;
  dimensions.contrast = clampScore(contrast);

  const spacingHits = (appJsx.match(/\b(p|px|py|gap|space)-[0-9]/g) || []).length;
  let rhythm = 55;
  if (spacingHits >= 4) rhythm += 25;
  else if (spacingHits >= 2) rhythm += 12;
  else {
    quick_wins.push({
      dimension: 'rhythm',
      message: 'Renforcer le rythme vertical (py-*, gap-*, space-y-*).',
    });
  }
  dimensions.rhythm = clampScore(rhythm);

  let readability = 60;
  if (appJsx.includes('text-sm') || appJsx.includes('text-base')) readability += 15;
  if (createEnvelope.ux_copy?.subheadline) readability += 10;
  dimensions.readability = clampScore(readability);

  let accessibility = dimensions.contrast;
  if (appJsx.includes('aria-') || appJsx.includes('role=')) accessibility += 10;
  dimensions.accessibility = clampScore(accessibility);

  let affordance = 55;
  const hasButton = /button|Button|cta/i.test(appJsx) || components.some((c) => c.role === 'cta');
  if (hasButton) affordance += 25;
  else {
    issues.push({
      severity: 'minor',
      dimension: 'affordance',
      message: 'Peu de signaux CTA explicites dans le rendu.',
      recommendation: 'Exposer un bouton primaire visible.',
    });
  }
  dimensions.affordance = clampScore(affordance);

  let density = 65;
  if (objective === 'cockpit' && appJsx.includes('grid')) density += 15;
  if (objective === 'landing' && appJsx.includes('max-w')) density += 10;
  dimensions.density = clampScore(density);

  let continuity = 60;
  const extractScore = extractEnvelope.quality_gate?.score ?? createEnvelope.source?.quality_score;
  if (extractScore >= 70) continuity += 20;
  if (tokens.colors?.distinct_count >= 3) continuity += 10;
  dimensions.continuity = clampScore(continuity);

  if (components.length < 2) {
    issues.push({
      severity: 'blocker',
      dimension: 'coherence',
      message: 'Manifest composants insuffisant (< 2).',
      recommendation: 'Enrichir components-manifest via Nexxus Design.',
    });
  }

  if (browserObservation) {
    const samples = browserObservation.computed_styles?.length ?? 0;
    if (samples < 3) {
      issues.push({
        severity: 'major',
        dimension: 'continuity',
        message: 'Signal visuel browser insuffisant pour valider le rendu.',
        recommendation: 'Relancer Browser Harness avec plus de sélecteurs.',
      });
    } else {
      dimensions.continuity = clampScore(dimensions.continuity + 8);
      quick_wins.push({
        dimension: 'continuity',
        message: `Rendu observé (${samples} échantillons) — alignement visuel vérifiable.`,
      });
    }
  }

  const dimensionValues = IMPECCABLE_DIMENSIONS.map((key) => dimensions[key] ?? 0);
  const score_global = clampScore(
    dimensionValues.reduce((sum, value) => sum + value, 0) / dimensionValues.length,
  );

  const blockers = issues.filter((entry) => entry.severity === 'blocker');
  const merge_ok = score_global >= 72 && blockers.length === 0;

  const checklist_pre_merge = [
    {
      id: 'palette',
      label: 'Palette ≥ 3 couleurs distinctes',
      ok: (tokens.colors?.distinct_count ?? 0) >= 3,
      required: true,
    },
    {
      id: 'contrast',
      label: 'Contraste texte/surface WCAG AA (4.5:1)',
      ok: textContrast ? textContrast >= 4.5 : false,
      required: true,
    },
    {
      id: 'components',
      label: '≥ 2 composants déclarés',
      ok: components.length >= 2,
      required: true,
    },
    {
      id: 'structure',
      label: 'Structure de page documentée',
      ok: pageStructure.length >= 2,
      required: true,
    },
    {
      id: 'headings',
      label: 'Hiérarchie titres dans App.jsx',
      ok: headingCount >= 1,
      required: false,
    },
    {
      id: 'spacing',
      label: 'Rythme espacement Tailwind',
      ok: spacingHits >= 2,
      required: false,
    },
    {
      id: 'score',
      label: `Score global ≥ 72 (actuel ${score_global})`,
      ok: score_global >= 72,
      required: true,
    },
    {
      id: 'blockers',
      label: 'Aucun blocker',
      ok: blockers.length === 0,
      required: true,
    },
  ];

  return {
    score_global,
    dimensions,
    issues,
    quick_wins,
    blockers,
    merge_ok,
    checklist_pre_merge,
  };
}

export default { scoreImpeccableArtifacts, contrastRatio };

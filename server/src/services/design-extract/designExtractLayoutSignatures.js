/**
 * Signatures layout heuristiques Design Extract v2.
 */

/**
 * @param {object} dnaDossier
 */
export function detectLayoutSignatures(dnaDossier = {}) {
  const sections = dnaDossier.layout_sections || [];
  const sectionTags = new Set(sections.map((entry) => entry.tag));
  const patterns = dnaDossier.component_patterns || [];
  const patternNames = patterns.map((entry) => entry.value || entry.name || '');

  const signatures = [];

  const hasHeader = sectionTags.has('header');
  const hasMain = sectionTags.has('main');
  const hasFooter = sectionTags.has('footer');
  const hasAside = sectionTags.has('aside') || sectionTags.has('nav');
  const hasHero = patternNames.some((name) => /hero/i.test(name));
  const cardCount = patternNames.filter((name) => /card/i.test(name)).length;

  if (hasHeader && hasMain && hasFooter) {
    signatures.push({
      pattern: 'header+main+footer',
      confidence: 0.92,
    });
  }

  if (hasAside && hasMain) {
    signatures.push({
      pattern: 'sidebar+main',
      confidence: 0.78,
    });
  }

  if (hasHero) {
    signatures.push({
      pattern: 'hero-first',
      confidence: 0.85,
    });
  }

  if (cardCount >= 2) {
    signatures.push({
      pattern: 'card-grid',
      confidence: Math.min(0.95, 0.6 + cardCount * 0.1),
    });
  }

  return signatures;
}

export default { detectLayoutSignatures };

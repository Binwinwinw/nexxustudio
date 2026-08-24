/**
 * Validation post-synthèse rappel — contrat « n'invente pas » (M2-S1).
 * Détecte les marqueurs temporels absents de l'historique transmis.
 */

const TEMPORAL_PATTERN =
  /\b(hier|avant-hier|demain|la semaine dernière|la semaine prochaine|la veille|l'an dernier|l'année dernière)\b/gi;

/**
 * @param {string} responseText
 * @param {Array<{ content?: string }>} historyEntries
 * @returns {{ ok: boolean, violations: Array<{ code: string, token: string }> }}
 */
export function validateRecallGrounding(responseText = '', historyEntries = []) {
  const historyBlob = (Array.isArray(historyEntries) ? historyEntries : [])
    .map((entry) => String(entry?.content || ''))
    .join('\n')
    .toLowerCase();

  const violations = [];
  const text = String(responseText);

  for (const match of text.matchAll(TEMPORAL_PATTERN)) {
    const token = match[0];
    if (!historyBlob.includes(token.toLowerCase())) {
      violations.push({ code: 'invented_temporal', token });
    }
  }

  return { ok: violations.length === 0, violations };
}

export default validateRecallGrounding;

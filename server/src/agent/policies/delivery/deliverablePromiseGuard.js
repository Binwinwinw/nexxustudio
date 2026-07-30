/**
 * Policy NO_DELIVERABLE_PROMISE_OUTSIDE_AUTHORIZED_DELIVERY
 * Empêche les branches non autorisées de promettre un livrable technique.
 */

const AUTHORIZED_DELIVERY_MODES = new Set([
  'CODE_DELIVERY',
  'DOCUMENT_DELIVERY',
  'HTML_PROJECT_DELIVERY'
]);

const STRICT_BLOCK_MODES = new Set([
  'CRITICAL',
  'DOCUMENT',
  'INSTANT', // Les short circuits n'ont pas à promettre de livraison
]);

const FORBIDDEN_DELIVERABLE_PATTERNS = [
  /\bje peux fournir\b/i,
  /\bje vais fournir\b/i,
  /\bje peux générer\b/i,
  /\bje vais générer\b/i,
  /\bje peux livrer\b/i,
  /\bje t['’]ai préparé\b/i,
  /\bvoici le code\b/i,
  /\ble code complet\b/i,
  /\bprototype complet\b/i,
  /\bprêt à l['’]emploi\b/i,
  /\bje peux créer\b.*\b(composant|fichier|application|script|code)\b/i,
  /\bje vais créer\b.*\b(composant|fichier|application|script|code)\b/i
];

const STRONG_COMPLETENESS_PATTERNS = [
  /\ble code complet\b/i,
  /\bapplication complète\b/i,
  /\bprototype complet\b/i,
  /\bprêt à l['’]emploi\b/i,
  /\bvoici le code\b/i
];

const ARTIFACT_NOUNS = [
  /\bcomposant\b/i,
  /\bscript\b/i,
  /\bdocument complet\b/i,
  /\bfichier\b/i,
  /\bapplication\b/i
];

/**
 * Valide si un texte respecte la politique anti-surpromesse.
 * @param {string} responseText 
 * @param {string} pipelinePath (le mode, e.g. 'COMPOSER', 'CODE_DELIVERY', etc.)
 * @returns {{ ok: boolean, severity?: 'none'|'sanitize'|'block', suggestedRewrite?: string, hits?: string[] }}
 */
export function validateDeliverablePromise(responseText, pipelinePath) {
  if (!responseText) return { ok: true, severity: 'none' };
  
  if (AUTHORIZED_DELIVERY_MODES.has(pipelinePath)) {
    return { ok: true, severity: 'none' };
  }

  const hits = FORBIDDEN_DELIVERABLE_PATTERNS.filter((rx) => rx.test(responseText));
  if (hits.length === 0) {
    return { ok: true, severity: 'none' };
  }

  const hasStrongPattern = STRONG_COMPLETENESS_PATTERNS.some((rx) => rx.test(responseText));
  const hasArtifactNoun = ARTIFACT_NOUNS.some((rx) => rx.test(responseText));
  const isStrictBranch = STRICT_BLOCK_MODES.has(pipelinePath) || /safety|taxonomy/i.test(pipelinePath);

  let severity = 'sanitize';

  if (isStrictBranch) {
    severity = 'block';
  } else if (hasStrongPattern) {
    severity = 'block';
  } else if (hits.length >= 2) {
    severity = 'block';
  }

  // Rewrite standard. Un fallback block dur utilise aussi ce texte.
  const suggestedRewrite = 'J’ai bien compris la demande. Je peux t’aider à la cadrer ou lancer la bonne branche de génération.';

  return {
    ok: false,
    reason: 'unauthorized_deliverable_promise',
    severity,
    hits: hits.map(String),
    suggestedRewrite
  };
}

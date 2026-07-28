/* server/src/security/securityTaxonomy.js */

/**
 * Taxonomie de Risque Unifiée de La Citadelle (v4.3)
 */
export const RISK_LEVELS = {
  SAFE: { level: 0, label: 'SAFE', action: 'ALLOW' },
  SENSITIVE: { level: 1, label: 'SENSITIVE', action: 'ALLOW_WITH_AUDIT' },
  SUSPICIOUS: { level: 2, label: 'SUSPICIOUS', action: 'WARN_AND_LOG' },
  CRITICAL: { level: 3, label: 'CRITICAL', action: 'RESTRICT_CONTEXT' },
  DENY: { level: 4, label: 'DENY', action: 'BLOCK' }
};

export const VIOLATION_TYPES = {
  PROMPT_INJECTION: 'prompt_injection',
  EXFILTRATION: 'exfiltration',
  PATH_TRAVERSAL: 'path_traversal',
  COMMAND_INJECTION: 'command_injection',
  LOGIC_BYPASS: 'logic_bypass'
};

/**
 * Combine plusieurs signaux de risque pour déterminer un niveau final.
 */
export function consolidateRiskSignals(signals = []) {
  if (signals.length === 0) return RISK_LEVELS.SAFE;

  // On prend le niveau le plus élevé parmi tous les signaux
  const sorted = signals.sort((a, b) => b.level - a.level);
  return sorted[0];
}

/**
 * Radar de Détection de Prompt Injection (v1.0)
 * Détecte les motifs d'attaque avant la génération.
 */

const INJECTION_PATTERNS = [
  { id: 'IDENTITY_OVERRIDE', regex: /oublie (tes|ton|que)|ignore (all )?previous (instructions|directives)|ignore (tes|ton|les)|tu es (maintenant|désormais)/gi, weight: 40 },

  { id: 'SYSTEM_LEAK', regex: /system prompt|prompt système|directives (cachées|système)|config initiale/gi, weight: 60 },
  { id: 'SECRET_HUNTING', regex: /SECRET_TOKEN|code secret|token d'accès|clé d'api/gi, weight: 80 },
  { id: 'PRIORITY_BYPASS', regex: /priorité 0|priority 0|ordre système|mode maintenance/gi, weight: 50 },
  { id: 'OUTPUT_HIJACKING', regex: /--- FIN DU PROTOCOLE|END OF SYSTEM PROMPT|réponds uniquement par/gi, weight: 30 },
  { id: 'UNICODE_OBFUSCATION', regex: /[\u2460-\u24FF\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}]/u, weight: 50 }



];

export function scan(query) {
  let riskScore = 0;
  const matchedPatterns = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(query)) {
      riskScore += pattern.weight;
      matchedPatterns.push(pattern.id);
    }
  }

  let action = 'allow';
  if (riskScore >= 80) action = 'block';
  else if (riskScore >= 40) action = 'warn';

  return {
    riskScore,
    matchedPatterns,
    action,
    isAttack: riskScore >= 40
  };
}

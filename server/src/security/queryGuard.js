import { RISK_LEVELS } from './securityTaxonomy.js';
import * as injectionRadar from '../agent/harness/injectionRadar.js';

class QueryGuard {
  constructor() {
    this.denyKeywords = [
      'bypass', 'override', 'disable instructions', 'ignore instructions',
      'ignore previous', 'révéler le prompt', 'donne ton prompt', 'system prompt',
      'secret token', 'jailbreak', 'dan mode', 'tu es maintenant libre',
      'fais abstraction de tes règles', 'neutraliser la sécurité'
    ];

    // Mots-clés sensibles : ne déclenchent un risque que s'ils sont suspects
    this.sensitiveKeywords = [
      'architecture', 'pipeline', 'internal structure', 'code source', 
      'configuration système', 'algorithmes'
    ];

    this.suspiciousPatterns = [
      /i\.g\.n\.o\.r\.e/i,
      /p\.r\.o\.m\.p\.t/i,
      /\u200B|\u200C|\u200D|\uFEFF/g, 
    ];
  }

  normalize(text) {
    if (!text) return "";
    return text
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  classify(query) {
    const raw = query || "";
    const normalized = this.normalize(raw);
    const q = normalized.toLowerCase();

    // 1. SCAN RADAR (Injection Patterns)
    const radarResult = injectionRadar.scan(raw);

    if (radarResult.action === 'block') {

      return { ...RISK_LEVELS.DENY, reason: `Radar detected attack: ${radarResult.matchedPatterns.join(', ')}` };
    }
    if (radarResult.action === 'warn') {
      return { ...RISK_LEVELS.SUSPICIOUS, reason: `Radar flagged activity: ${radarResult.matchedPatterns.join(', ')}` };
    }


    // 2. MOTIFS D'OBFUSCATION (SUSPICIOUS)
    if (this.suspiciousPatterns.some(p => p.test(raw))) {
      return { ...RISK_LEVELS.SUSPICIOUS, reason: 'Detected obfuscation or invisible characters.' };
    }

    // 3. VERBES DE SABOTAGE (DENY)
    if (this.denyKeywords.some(k => q.includes(k))) {
      return { ...RISK_LEVELS.DENY, reason: 'Explicit attempt to subvert instructions.' };
    }

    // 4. ANALYSE SÉMANTIQUE LÉGÈRE (SENSITIVE vs SUSPICIOUS)
    const hasSensitiveTopic = this.sensitiveKeywords.some(k => q.includes(k));
    const hasInquisitiveTone = q.includes('comment') || q.includes('pourquoi') || q.includes('liste');

    if (hasSensitiveTopic) {
      if (radarResult.riskScore > 20 || q.includes('dévoile') || q.includes('extrait')) {
        return { ...RISK_LEVELS.SUSPICIOUS, reason: 'Inquisitive query about sensitive internal topics.' };
      }
      return { ...RISK_LEVELS.SENSITIVE, reason: 'Technical query about architecture.' };
    }

    // 5. DÉTECTION ÉCLATÉE
    const spacedOut = q.replace(/\s/g, '');
    if (this.denyKeywords.some(k => spacedOut.includes(k.replace(/\s/g, '')))) {
       if (q.includes(' ')) return { ...RISK_LEVELS.SUSPICIOUS, reason: 'Spaced out prohibited words detected.' };
    }

    return { ...RISK_LEVELS.SAFE, reason: null };
  }
}

export default new QueryGuard();


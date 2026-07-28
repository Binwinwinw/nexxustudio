import { RISK_LEVELS } from './securityTaxonomy.js';
import turnTelemetry from '../agent/telemetry/turnTelemetry.js';

/**
 * OutputGuard - La sentinelle finale de l'Assistant Nexxus.
 * Scanne la réponse finale pour empêcher les fuites de secrets, de chemins ou de persona.
 */
class OutputGuard {
  constructor() {
    // Patterns de rédaction (secrets, chemins, IP internes, etc.)
    this.redactionPatterns = [
      { id: 'secret', pattern: /SECRET_[A-Z0-9_]+/g },
      { id: 'token', pattern: /AI_TOKEN_[A-Z0-9_]+/g },
      { id: 'internal_ip', pattern: /127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}/g },
      // Chemins Windows & Unix (Détection de fuite de structure serveur)
      { id: 'win_path', pattern: /[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g },
      { id: 'unix_path', pattern: /\/(?:home|var|etc|usr|bin|tmp)\/[\w.\/-]+/g }
    ];

    // Patterns de fuite de prompt / persona (Souveraineté)
    this.leakPatterns = [
      /system_prompt/gi,
      /ignore previous instructions/gi,
      /you are a large language model/gi,
      /trained by openai/gi,
      /développé par deepseek/gi,
      /en tant qu'ia/gi,
      /en tant que modèle d'ia/gi,
      /as an ai model/gi,
      /as an assistant trained by/gi,
      /mon prompt/gi,
      /mes instructions système/gi
    ];
  }

  /**
   * Scanne et nettoie la réponse finale.
   */
  secure(text) {
    if (typeof text !== 'string' || !text) {
      return text || "";
    }

    let securedText = text;

    // 1. Redaction des informations sensibles
    securedText = this.redact(securedText);

    // 2. Normalisation de la persona (Souveraineté Nexxus)
    securedText = this.normalizePersona(securedText);

    return securedText;
  }

  /**
   * Masque les patterns interdits (secrets, chemins).
   */
  redact(text) {
    let result = text;
    let redactedCount = 0;

    for (const { pattern, id } of this.redactionPatterns) {
      result = result.replace(pattern, (match) => {
        redactedCount++;
        console.warn(`[OutputGuard] 🛡️ Redaction [${id}] détectée dans la sortie.`);
        return '[REDACTED_BY_NEXXUS]';
      });
    }

    if (redactedCount > 0) {
      turnTelemetry.increment('securityObfuscations', redactedCount);
    }

    return result;
  }

  /**
   * Corrige les fuites de persona pour maintenir l'identité Nexxus.
   */
  normalizePersona(text) {
    let result = text;
    
    // 1. Correction des préambules IA classiques
    const personaMap = [
      { re: /En tant qu'IA[^,.!?]*/gi, replacement: "En tant qu'Assistant Nexxus" },
      { re: /As an AI[^,.!?]*/gi, replacement: "As Nexxus Assistant" },
      { re: /Je suis un modèle de langage/gi, replacement: "Je suis Nexxus" }
    ];

    for (const { re, replacement } of personaMap) {
      result = result.replace(re, replacement);
    }

    // 2. Remplacement des patterns de fuite par une formulation neutre/souveraine
    for (const pattern of this.leakPatterns) {
      result = result.replace(pattern, "Nexxus Core");
    }

    return result;
  }
}

export default new OutputGuard();


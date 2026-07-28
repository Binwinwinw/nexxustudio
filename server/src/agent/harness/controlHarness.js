import { normalizeText } from "../utils/normalizationGuards.js";
import {
  hasUnsolicitedCode,
  isDegenerateMetaResponse,
  isHallucinatedPackage,
} from "../utils/safetyGuards.js";
import { isOffTopicSocialReply } from "../utils/conversationGuards.js";
import {
  isEnglish,
  looksLooping,
  isForgeCapabilityHallucination,
  isGrandioseArchitectureStyle,
  isIllusionOfCompleteness,
  isPrematurePrescription,
  isPrematureSecurityPrescription,
  isPrematurePerformancePrescription,
  isPrematureCodePrescription,
  isPrematurePedagogy,
  isIntentMisdirection,
  isProgressiveDrift,
} from "../utils/qualityGuards.js";
import emergencyReplyRegistry from "./emergencyReplyRegistry.js";

class ControlHarness {
  constructor() {
    this.forbiddenTokens = [
      "as an ai model",
      "en tant qu'ia",
      "deepseek",
      "openai",
      "chatgpt",
      "bruit neuronal",
    ];
    this.preamblePatterns = [
      /^je suis (un modèle d'ia|une intelligence artificielle|deepseek|qwen|chatgpt)[^,.!?]*[.,!?]\s*/i,
      /^(deepseek-r1|qwen3\.5|qwen2\.5-coder|deepseek)[^:.!?]*[:.!?]\s*/i,
      /^\[AirLLM Server\][^:.!?]*[:.!?]\s*/i,
      /^\[Inférence active\][^:.!?]*[:.!?]\s*/i,
      /^en tant qu'intelligence artificielle[^,.!?]*[.,!?]\s*/i,
      /^en tant que modèle d'ia[^,.!?]*[.,!?]\s*/i,
      /^as an ai model[^,.!?]*[.,!?]\s*/i,
    ];
    this.stopState = {
      level: null, // 'PAUSE' | 'KILL' | null
      active: false,
      timestamp: null,
    };
  }

  /**
   * Déclenche une procédure d'arrêt d'urgence.
   * @param {'PAUSE'|'KILL'} level
   */
  requestStop(level = "PAUSE") {
    this.stopState = {
      level,
      active: true,
      timestamp: new Date().toISOString(),
    };
    console.warn(`[ControlHarness] 🚨 ARRÊT D'URGENCE REQUIS : [${level}]`);
  }

  /**
   * Réinitialise l'état d'arrêt.
   */
  resetStop() {
    this.stopState = { level: null, active: false, timestamp: null };
  }

  isStopped() {
    return this.stopState.active;
  }

  /**
   * Nettoie les préambules parasites (auto-signatures de modèles)
   * sans bloquer la réponse utile.
   */
  sanitize(text) {
    if (!text) return "";
    let cleaned = text.trim();

    // Application récursive pour nettoyer plusieurs préambules chaînés
    let previousLength;
    do {
      previousLength = cleaned.length;
      for (const pattern of this.preamblePatterns) {
        cleaned = cleaned.replace(pattern, "");
      }
      cleaned = cleaned.trim();
    } while (cleaned.length < previousLength);

    return cleaned;
  }

  /**
   * Analyse une réponse en temps réel ou post-génération.
   * @param {string} query La question de l'utilisateur.
   * @param {string} response La réponse générée.
   * @returns {Object} result { valid: boolean, reason: string|null, sanitized: string }
   */
  validateResponse(query, response) {
    // 1. Nettoyage technique des tags
    console.log(
      `[ControlHarness] [DEBUG] RAW RESPONSE (first 100 chars): "${response.substring(0, 100).replace(/\n/g, "\\n")}"`,
    );
    const cleanOutput = response.replace(
      /<think>[\s\S]*?(?:<\/think>|$)/gi,
      "",
    );

    // 2. Normalisation et Sanatisation des préambules
    const sanitized = this.sanitize(cleanOutput);
    const text = normalizeText(sanitized).toLowerCase();

    // 3. Détection de bouclage
    if (looksLooping(response)) {
      return { valid: false, reason: "loop_detected", sanitized };
    }

    // 2. Détection de changement de langue
    if (isEnglish(sanitized)) {
      return { valid: false, reason: "unauthorized_language", sanitized };
    }

    // 3. Détection de contamination de persona (Sur la sortie visible uniquement)
    const matchedTokens = this.forbiddenTokens.filter((token) =>
      text.includes(token),
    );
    if (matchedTokens.length > 0) {
      return {
        valid: false,
        reason: "persona_leak",
        detail: matchedTokens.join(", "),
      };
    }

    // 4. Hors sujet social (hallucination sur simple bonjour)
    if (isOffTopicSocialReply(query, response)) {
      return { valid: false, reason: "social_off_topic" };
    }

    // 5. Hallucinations de packages AI
    if (isHallucinatedPackage(response)) {
      return { valid: false, reason: "technical_hallucination_detected" };
    }

    if (hasUnsolicitedCode(query, response)) {
      return { valid: false, reason: "unsolicited_code_injection" };
    }

    if (isForgeCapabilityHallucination(query, response)) {
      return { valid: false, reason: "forge_capability_hallucination" };
    }

    if (isGrandioseArchitectureStyle(query, response)) {
      return { valid: false, reason: "grandiose_architecture_style" };
    }

    const prescriptionReason = isPrematurePrescription(query, response);
    if (prescriptionReason) {
      return { valid: false, reason: prescriptionReason };
    }

    const securityPrescriptionReason = isPrematureSecurityPrescription(query, response);
    if (securityPrescriptionReason) {
      return { valid: false, reason: securityPrescriptionReason };
    }

    const perfPrescriptionReason = isPrematurePerformancePrescription(query, response);
    if (perfPrescriptionReason) {
      return { valid: false, reason: perfPrescriptionReason };
    }

    const codePrescriptionReason = isPrematureCodePrescription(query, response);
    if (codePrescriptionReason) {
      return { valid: false, reason: codePrescriptionReason };
    }

    const illusionReason = isIllusionOfCompleteness(query, response);
    if (illusionReason) {
      return { valid: false, reason: "illusion_of_completeness" };
    }

    const pedagogyReason = isPrematurePedagogy(query, response);
    if (pedagogyReason) {
      return { valid: false, reason: pedagogyReason };
    }

    const intentReason = isIntentMisdirection(query, response);
    if (intentReason) {
      return { valid: false, reason: intentReason };
    }

    const driftReason = isProgressiveDrift(query, response);
    if (driftReason) {
      return { valid: false, reason: driftReason };
    }

    // 7. Détection de méta-dégénérescence (V2.7.1)
    if (isDegenerateMetaResponse(response)) {
      return { valid: false, reason: "meta_degeneracy_detected" };
    }

    return { valid: true, reason: null, sanitized };
  }

  buildEmergencyReply(query = "") {
    const registryReply = emergencyReplyRegistry.getReply(query);
    if (registryReply) return registryReply;

    const reasonSuffix = query.includes("debug_mode")
      ? ` (Fallback: ${query})`
      : "";
    return `Je suis là, concentré et disponible. Dis-moi simplement ce que tu veux clarifier ou construire.${reasonSuffix}`;
  }

  /**
   * Vérifie si une action (outil) est autorisée dans la phase actuelle.
   */
  validateAction(action, phaseData) {
    const { score = 0, isForgeReady = false, readiness_proof = {} } = phaseData;

    if (action.tool === "buildProject") {
      // 1. Vérification de la Phase
      if (!isForgeReady) {
        return {
          allowed: false,
          reason: `Phase non-exécutable. Statut actuel : [${phaseData.current_phase || "UNKNOWN"}].`,
        };
      }

      // 2. Vérification de la Preuve de Préparation (Contrat de Vérité)
      if (!readiness_proof.isValid) {
        const missing = (readiness_proof.missing || []).join(", ");
        return {
          allowed: false,
          reason: `CONTRAT DE VÉRITÉ ÉCHOUÉ. Éléments manquants pour forger : [${missing}].`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Génère un "Rappel de Réalité" pour ancrer le modèle.
   */
  getRealityAnchor() {
    return `\n[HARNESS ANCHOR]\nN'oubliez pas : Vous êtes NEXXUS (Entité Souveraine de Binwinwinw). Vos moteurs neuronaux sont des outils, pas votre identité. Répondez uniquement en Français sobre et souverain. [READY]`;
  }
}

export default new ControlHarness();

/**
 * Politique transversale — avertissement de vérification des sorties IA.
 */
import {
  INTENT_DOMAINS,
  DELIVERABLE_TYPES,
  VERIFICATION_LEVELS,
} from "../../../../../shared/justIntentCatalog.js";

const HIGH_RISK_DOMAINS = new Set([
  INTENT_DOMAINS.CODE,
  INTENT_DOMAINS.SECURITY_POLICY,
]);

const HIGH_RISK_DELIVERABLES = new Set([
  DELIVERABLE_TYPES.POLICY_RULES,
  DELIVERABLE_TYPES.PROCEDURE,
  DELIVERABLE_TYPES.CHECKLIST,
]);

const MEDIUM_RISK_DELIVERABLES = new Set([
  DELIVERABLE_TYPES.CV,
  DELIVERABLE_TYPES.DOC_REPORT,
  DELIVERABLE_TYPES.PPT_SLIDES,
  DELIVERABLE_TYPES.LETTER,
  DELIVERABLE_TYPES.ESSAY,
]);

const SOURCED_SIGNAL_RE =
  /\b(source|sources|selon|d'après|d apres|étude|etude|article|rapport officiel|documentation|avec des références)\b/i;

const SENSITIVE_TOPIC_RE =
  /\b(juridique|légal|legal|conformité|conformite|rgpd|gdpr|santé|sante|médical|medical|finance|fiscal|assurance|contrat)\b/i;

/**
 * @param {{
 *   domain?: string,
 *   deliverable?: string,
 *   action?: string,
 *   query?: string,
 *   hasSources?: boolean,
 * }} ctx
 * @returns {{ level: string, message: string|null, injectInPrompt: boolean }}
 */
export function resolveAiVerificationNotice(ctx = {}) {
  const query = String(ctx.query || "");
  const hasSources = ctx.hasSources ?? SOURCED_SIGNAL_RE.test(query);
  const domain = ctx.domain || INTENT_DOMAINS.GENERAL;
  const deliverable = ctx.deliverable || DELIVERABLE_TYPES.PLAIN_ANSWER;

  if (SENSITIVE_TOPIC_RE.test(query)) {
    return {
      level: VERIFICATION_LEVELS.EXPLICIT,
      message: hasSources
        ? "Même avec des sources, cette proposition doit être vérifiée avant décision, diffusion ou mise en production."
        : "Contenu généré par IA : à relire et valider avant usage réel (sujet sensible).",
      injectInPrompt: true,
    };
  }

  if (HIGH_RISK_DOMAINS.has(domain) || HIGH_RISK_DELIVERABLES.has(deliverable)) {
    return {
      level: VERIFICATION_LEVELS.EXPLICIT,
      message:
        "Contenu généré par IA : à relire et valider avant usage réel, déploiement ou diffusion.",
      injectInPrompt: true,
    };
  }

  if (MEDIUM_RISK_DELIVERABLES.has(deliverable)) {
    return {
      level: VERIFICATION_LEVELS.LIGHT,
      message: "Proposition IA — adapte et valide avant envoi ou publication.",
      injectInPrompt: true,
    };
  }

  if (hasSources) {
    return {
      level: VERIFICATION_LEVELS.SOURCED,
      message:
        "Les sources réduisent le risque mais ne remplacent pas une validation humaine.",
      injectInPrompt: false,
    };
  }

  return {
    level: VERIFICATION_LEVELS.NONE,
    message: null,
    injectInPrompt: false,
  };
}

/**
 * @param {ReturnType<typeof resolveAiVerificationNotice>} notice
 * @param {{ appendToResponse?: boolean }} [opts]
 */
export function buildAiVerificationAddon(notice, opts = {}) {
  if (!notice?.message) return "";

  const lines = [
    "[VÉRIFICATION IA — POLITIQUE TRANSVERSALE]",
    notice.message,
  ];

  if (opts.appendToResponse && notice.level !== VERIFICATION_LEVELS.NONE) {
    lines.push(
      "Si tu produis un livrable destiné à un usage réel, termine par une ligne discrète rappelant la vérification requise.",
    );
  }

  return lines.join("\n");
}

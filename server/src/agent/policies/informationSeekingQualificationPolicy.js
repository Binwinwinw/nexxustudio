/**
 * P3 — subject anchoring information_seeking / general_knowledge (G17).
 */
import {
  extractConversationSubject,
  scoreSubjectSurfaceAlignment,
  ANCHOR_ALIGNMENT_TIER,
} from "./conversationSubjectExtraction.js";
import {
  isInformationSeekingRecoveryResponse,
  isInformationSeekingWithTarget,
  buildInformationSeekingWebQuery,
} from "../utils/informationSeekingIntentGuards.js";
import { isGeneralKnowledgeContractViolation } from "../micro/replies/generalKnowledgeComposerContract.js";
import { isGeneralKnowledgeRequest } from "../utils/generalKnowledgeIntentGuards.js";
import { isInsufficientSignalRefusal } from "../config/modeResponseContracts.js";

const PSEUDO_CLARIFY_RE =
  /\b(?:je vois la piste|pas encore la destination|objectif en une phrase|donne[- ]moi l['']objectif|pr[ée]cise(?:\s+ton|\s+ta)?\s+(?:besoin|objectif|format|angle)|je n['']?ai pas pu finaliser|reessaie ou precise|réessaie ou précise)\b/i;

const SOCIAL_DRIFT_RE =
  /\b(?:bonjour|salut|coucou|hello|hey|bonsoir)\b.*\b(?:comment puis[- ]je t['']aider|tout va bien|comment puis[- ]je vous aider)\b|\bcomment puis[- ]je t['']aider\b/i;

const GENERIC_OVERVIEW_RE =
  /\b(?:je peux t['']aider|comment puis[- ]je t['']aider|n'hésite pas|precise ton|précise ton|quel angle|quelle information)\b/i;

/**
 * @param {string} text
 * @param {string} query
 */
export function assessInformationSeekingSubjectAlignment(text = "", query = "") {
  const subject = extractConversationSubject(query);
  if (!subject) {
    return {
      subject: null,
      score: 0,
      tier: ANCHOR_ALIGNMENT_TIER.MISS,
      signals: [],
      anchor_tokens: [],
    };
  }
  return {
    subject,
    ...scoreSubjectSurfaceAlignment(text, subject),
  };
}

/**
 * @param {string} text
 * @param {string} query
 */
export function isInformationSeekingSubjectAnchorMiss(text = "", query = "") {
  const subject = extractConversationSubject(query);
  if (!subject) return false;

  const body = String(text || "").trim();
  if (!body || body.length < 40) return true;

  const alignment = scoreSubjectSurfaceAlignment(body, subject);
  return alignment.tier === ANCHOR_ALIGNMENT_TIER.MISS;
}

/**
 * @param {string} text
 * @param {string} query
 */
export function isInformationSeekingContractViolation(text = "", query = "") {
  const probe = String(text || "").trim();
  if (!probe) return true;

  if (isGeneralKnowledgeRequest(query)) {
    return isGeneralKnowledgeContractViolation(query, probe);
  }

  if (!isInformationSeekingWithTarget(query)) return false;

  if (
    isInsufficientSignalRefusal(probe) ||
    PSEUDO_CLARIFY_RE.test(probe) ||
    SOCIAL_DRIFT_RE.test(probe) ||
    isInformationSeekingRecoveryResponse(probe) ||
    GENERIC_OVERVIEW_RE.test(probe)
  ) {
    return true;
  }

  return isInformationSeekingSubjectAnchorMiss(probe, query);
}

/**
 * Fallback honnête — jamais de rail « fiche locale » (archaïque).
 * @param {string} query
 */
export function buildInformationSeekingDirectFallback(query = "") {
  const subject = extractConversationSubject(query) || "ce sujet";
  const webHint = buildInformationSeekingWebQuery(query);
  const lines = [
    `Sur **${subject}**, je n'ai pas assez de preuves ancrées dans ce tour pour te livrer une synthèse fiable (prix, specs ou actu).`,
    "",
    "Je ne vais pas inventer de détails.",
  ];
  if (webHint) {
    lines.push(
      "",
      `On peut relancer une recherche web ciblée : « ${webHint} ». Dis-moi l'angle (comparatif, prix, définition, actu) et je reprends.`,
    );
  } else {
    lines.push(
      "",
      "Précise l'angle (comparatif, prix, définition, actu) et je relance avec recherche web.",
    );
  }
  return lines.join("\n");
}

/**
 * @param {string} text
 * @param {string} query
 */
export function enforceInformationSeekingDirectness(text = "", query = "") {
  if (!isInformationSeekingContractViolation(text, query)) {
    return String(text || "").trim();
  }
  return buildInformationSeekingDirectFallback(query);
}

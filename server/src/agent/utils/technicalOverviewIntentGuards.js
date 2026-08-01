/**
 * Aperçus techniques — compréhension d'un concept / techno (pas debug, pas how-to procédural).
 * Ex. : « explique Redis », « c'est quoi Kubernetes », « bases d'InnoDB »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "./beginnerTopicOverviewIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { classifySelectiveDecisionIntent } from "./selectiveDecisionIntentGuards.js";
import { isExploitableProcedureIntent } from "./procedureIntentGuards.js";
import { isPedagogicalStructuredExplainRequest } from "../policies/pedagogical/index.js";
import { isCodeReviewRequest } from "../policies/code/codeReviewPolicy.js";
import { isGeneralKnowledgeRequest } from "./generalKnowledgeIntentGuards.js";
import {
  isDebugDiagnosticSignal,
  DEBUG_DIAGNOSTIC_SIGNAL_RE,
} from "./debugDiagnosticIntentGuards.js";
import { isTechnicalLearningPathSignal } from "./technicalLearningPathIntentGuards.js";
import { isCodeConceptExplainRequest } from "../policies/code/codeConceptExplainPolicy.js";
import { extractCodeConceptExplainSubject } from "../policies/code/codeConceptExplainExecutionPolicy.js";
import { isArchitectureDesignIntent } from "./architectureDesignIntentGuards.js";

export const TECHNICAL_OVERVIEW_ROUTING_RULE =
  "technical_overview_local_generative";

export { isDebugDiagnosticSignal, DEBUG_DIAGNOSTIC_SIGNAL_RE };

const TECH_OVERVIEW_SHELL_RE =
  /\b(?:explique(?:r|-moi)?|explain|presente(?:r|-moi)?|présente(?:r|-moi)?|c['']?\s*est quoi|qu['']?\s*est[- ]ce que|que faut[- ]il savoir|what should i know|bases? de|introduction (?:a|à|sur|en)|apercu|aperçu|overview of|a quoi sert|à quoi sert|what is|how does .+ work|comment fonctionne)\b/i;

const TECH_PROCEDURAL_EXCLUDE_RE =
  /\b(?:installer|install(?:er|ation)?|configurer|configure|deployer|déployer|deploy(?:ment)?|mettre en place pas a pas|etape par etape|étape par étape|how to install|how to set up|how to deploy|comment installer|comment configurer|comment deployer|comment déployer|brancher mon|connecter mon|mon fichier \.env)\b/i;

const TECH_DOMAIN_HINT_RE =
  /\b(?:redis|kubernetes|k8s|docker|innodb|mysql|postgres|postgresql|mongodb|api|rest|graphql|websocket|nginx|apache|linux|git|node\.?js|python|java|typescript|javascript|react|vue|angular|sql|nosql|cache|microservice|microservices|kafka|rabbitmq|elasticsearch|terraform|ansible|ci\/cd|devops|oauth|jwt|ssl|tls|http|https|tcp|udp|dns|cdn|lambda|serverless|blockchain|llm|rag|vector|embedding|orm|mvc|solid|clean architecture)\b/i;

export { TECH_DOMAIN_HINT_RE };

/**
 * @typedef {'intro'|'architecture'|'standard'|'deep'} TechnicalScope
 * @typedef {'general'|'junior'|'senior'} TechnicalAudience
 * @typedef {'high'|'medium'|'low'} SlotConfidence

 * @typedef {Object} TechnicalOverviewSlots
 * @property {'technical_overview'} intent
 * @property {string|null} tech
 * @property {string|null} techLabel
 * @property {TechnicalScope} scope
 * @property {TechnicalAudience} audience
 * @property {SlotConfidence} confidence
 */

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractTechnicalSubject(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  const patterns = [
    /\bexplique(?:r|-moi)?\s+(?:moi\s+)?(?:la |le |les |l')?([^?.!]{2,80})$/,
    /\bexplain\s+(?:me\s+)?(?:the\s+)?([^?.!]{2,80})$/i,
    /\bc['']est quoi\s+(?:la |le |les |l')?([^?.!]{2,80})$/,
    /\bqu['']est[- ]ce que\s+(?:la |le |les |l')?([^?.!]{2,80})$/,
    /\bwhat is\s+(?:a |an |the )?([^?.!]{2,80})$/i,
    /\bbases?(?:\s+de|\s+d[''])?\s+(?:la |le |les |l')?([^?.!]{2,80})$/,
    /\bintroduction (?:a|à|sur|en)\s+(?:la |le |les |l')?([^?.!]{2,80})$/,
    /\ba quoi sert\s+(?:la |le |les |l')?([^?.!]{2,80})$/,
    /\bcomment fonctionne\s+(?:la |le |les |l')?([^?.!]{2,80})$/,
    /\bhow does\s+(?:a |an |the )?([^?.!]{2,80})\s+work\b/i,
    /\bque faut[- ]il savoir sur\s+(?:la |le |les |l')?([^?.!]{2,80})$/,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || "").trim();
    if (raw.length >= 2) {
      return raw.replace(/\s+/g, " ").trim();
    }
  }

  if (TECH_DOMAIN_HINT_RE.test(q)) {
    const token = q.match(TECH_DOMAIN_HINT_RE);
    return token ? token[0] : null;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {TechnicalScope}
 */
export function extractTechnicalScope(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (/\b(?:architecture|architectural|design pattern|patterns?)\b/i.test(q)) {
    return "architecture";
  }
  if (/\b(?:en profondeur|deep dive|detaille|détaillé|advanced|avance)\b/i.test(q)) {
    return "deep";
  }
  if (/\b(?:bases?|intro|introduction|overview|apercu|aperçu|c['']est quoi|what is)\b/i.test(q)) {
    return "intro";
  }
  return "standard";
}

/**
 * @param {string} query
 * @returns {TechnicalAudience}
 */
export function extractTechnicalAudience(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (/\b(?:senior|expert|experimente|expérimenté|architecte)\b/i.test(q)) {
    return "senior";
  }
  if (/\b(?:junior|debutant|débutant|novice|premiers pas en dev)\b/i.test(q)) {
    return "junior";
  }
  return "general";
}

/**
 * @param {string} query
 * @returns {TechnicalOverviewSlots|null}
 */
export function parseTechnicalOverview(query = "") {
  if (isCodeConceptExplainRequest(query)) {
    const techLabel = extractCodeConceptExplainSubject(query) || "le concept demandé";
    return {
      intent: "technical_overview",
      tech: techLabel.toLowerCase().replace(/\s+/g, " ").trim(),
      techLabel,
      scope: "intro",
      audience: "general",
      confidence: "high",
    };
  }

  const techLabel = extractTechnicalSubject(query);
  if (!techLabel) return null;

  const tech = techLabel.toLowerCase().replace(/\s+/g, " ").trim();

  return {
    intent: "technical_overview",
    tech,
    techLabel,
    scope: extractTechnicalScope(query),
    audience: extractTechnicalAudience(query),
    confidence: TECH_DOMAIN_HINT_RE.test(normalizeFamiliarityQuery(query))
      ? "high"
      : "medium",
  };
}

const PEDAGOGY_SOFT_PREEMPT_RE =
  /\b(?:parle(?:r|-)?moi\s+de|explique(?:r|-)?moi\s+(?:la\s+)?géographie|explique(?:r|-)?moi\s+(?:la\s+)?geographie|dis(?:s|-)?moi\s+(?:l['']?\s*)?essentiel|raconte(?:r|-)?moi)\b/i;
const PEDAGOGY_SOFT_DOMAIN_RE =
  /\b(?:révolution|revolution|géographie|geographie|volcan|histoire(?:\s+de|\s+d[''])?|canada|france)\b/i;

function isPedagogySoftOverviewPreempt(query = "") {
  const q = normalizeFamiliarityQuery(query);
  return PEDAGOGY_SOFT_PREEMPT_RE.test(q) && PEDAGOGY_SOFT_DOMAIN_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTechnicalOverviewRequest(query = "") {
  if (isCodeConceptExplainRequest(query)) return true;

  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 8) return false;
  // Tableau / schéma pédagogique sciences ≠ aperçu technique rapide
  if (isPedagogicalStructuredExplainRequest(query)) return false;
  if (isPedagogySoftOverviewPreempt(query)) return false;

  if (isArchitectureDesignIntent(query)) return false;
  if (isDebugDiagnosticSignal(query)) return false;
  if (isTechnicalLearningPathSignal(query)) return false;
  if (isBeginnerTopicOverviewRequest(query)) return false;

  const CITADELLE_VISION_RUNTIME_RE =
    /\b(?:intent\s+ocr|nexxus|la citadelle|citadelle|visionagent|glm-ocr|deepseek-ocr|pipeline vision|briefing visuel|gemma4|ocr citadelle)\b/i;
  if (CITADELLE_VISION_RUNTIME_RE.test(q)) return false;

  if (isPedagogicalOverviewRequest(query)) return false;
  if (isCodeReviewRequest(query)) return false;
  if (isExploitableProcedureIntent(query)) return false;
  if (TECH_PROCEDURAL_EXCLUDE_RE.test(q)) return false;
  if (classifySelectiveDecisionIntent(query).detected) return false;

  const hasShell = TECH_OVERVIEW_SHELL_RE.test(q);
  const hasDomainHint = TECH_DOMAIN_HINT_RE.test(q);
  if (!hasShell && !hasDomainHint) return false;

  // Indice techno seul (ex. « python » dans une demande de création) ≠ aperçu technique.
  if (!hasShell) return false;

  if (isGeneralKnowledgeRequest(query) && !hasDomainHint) return false;

  return Boolean(extractTechnicalSubject(query));
}

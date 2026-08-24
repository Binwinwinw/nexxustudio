/**
 * Parcours d'apprentissage technique — plan / fiches pour maîtriser un domaine (pas aperçu ponctuel).
 * Ex. : « créer des fiches pour maîtriser la JVM », « plan d'apprentissage React »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isCareerLearningPathSignal, isPrimaryCareerLearningSignal } from "./careerLearningPathIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "./beginnerTopicOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "./debugDiagnosticIntentGuards.js";
import { isCompareChooseRequest } from "./compareChooseIntentGuards.js";
import { isAdminProcedureRequest } from "./adminProcedureIntentGuards.js";
import { isExploitableProcedureIntent } from "./procedureIntentGuards.js";
import { classifySelectiveDecisionIntent } from "./selectiveDecisionIntentGuards.js";
import {
  extractLearningRequestTarget,
  isLearningRequestForTechnicalDomain,
  isLearningRequestWithTarget,
} from "./learningRequestIntentGuards.js";

export const TECHNICAL_LEARNING_PATH_ROUTING_RULE =
  "technical_learning_path_local_generative";

const LEARNING_SHELL_RE =
  /\b(?:maitriser|me former sur|progression sur|plan d apprentissage|plan pour apprendre|parcours d apprentissage|roadmap pour apprendre|feuille de route pour apprendre|fiches? de connaissance|fiches? de revision|fiches? de revisions|fiche de connaissance|creer des fiches|construire des fiches|structurer mon apprentissage|organiser mon apprentissage|je veux apprendre|j aimerais apprendre|monter en competence|approfondir mes connaissances sur|syllabus|curriculum technique|reviser|revision)\b/i;

const LEARNING_GOAL_RE =
  /\b(?:maitriser|apprendre|approfondir|monter en competence|progression|fiches?|plan|parcours|roadmap|syllabus|reviser|revision|comprendre|exercices?|katas?|quiz)\b/i;

/** Livrable explicite (web, code, UI) — à ne pas confondre avec un support d'apprentissage. */
const EXPLICIT_BUILD_DELIVERABLE_RE =
  /\b(?:page html|fichier html|site web|landing|\.html\b|doctype|<html|maquette html|template html|page web|portfolio|dashboard html|snippet|script pour|composant react|module react|api rest|endpoint|landing page)\b/i;

const PRODUCTION_VERB_RE =
  /\b(?:cree|creer|generer|genere|fais|fait|faire|produis|produire|construis|construire|developpe|redige|ecris|prepare|preparer)\b/i;

const PEDAGOGICAL_ARTIFACT_RE =
  /\b(?:fiches?(?:\s+de\s+(?:connaissance|revision|revisions|cours|memo|memoire|synthese|revue))?|flashcards?|cartes memoire|plan d apprentissage|parcours d apprentissage|roadmap pour apprendre|syllabus|curriculum|cours structur|support de cours|feuille de route pour apprendre|plan de revision|plan pour maitriser|preparer un plan|exercices?|katas?|quiz|qcm|problemes?|drills?)\b/i;

const PEDAGOGICAL_SUMMARY_FOR_LEARNING_RE =
  /\b(?:resume|synthese)\b/i;

const PEDAGOGICAL_PRACTICE_RE =
  /\b(?:exercices?|katas?|quiz|qcm|problemes?|drills?)\b/i;

const LEARNING_MASTERY_VERB_RE =
  /\b(?:maitriser|apprendre|reviser|revision|comprendre|approfondir|monter en competence|progression|me former|afin de maitriser)\b/i;

const TECH_DOMAIN_RE =
  /\b(?:jvm|jsx|bytecode|garbage collector|gc|runtime|nodejs|node\.?js|javascript|typescript|python|java|kotlin|rust|go|golang|react|vue|angular|express|expressjs|fastify|fastifyjs|docker|kubernetes|k8s|redis|postgres|postgresql|mysql|mongodb|graphql|rest|api|linux|git|sql|nosql|devops|ci\/cd|terraform|aws|azure|gcp|llm|rag|embedding|microservice|nginx|kafka|websocket|oauth|jwt|spring|hibernate|innodb|compiler|interpreteur|interpréteur|architecture logicielle|design pattern|algorithmique|reseau|réseau|tcp|http|css|html|tailwind|tailwindcss|webpack|vite|bash|shell|zsh|powershell|sh\b|langage bash)\b/i;

const SCHOOL_CURRICULUM_RE =
  /\b(?:eleve|élève|6e|6eme|6ème|5e|4e|3e|seconde|terminale|programme scolaire|education nationale|éducation nationale)\b/i;

const OVERVIEW_ONLY_EXCLUDE_RE =
  /\b(?:explique(?:r|-moi)?|c est quoi|qu est ce que|a quoi sert|comment fonctionne)\b/i;

/**
 * @typedef {'mastery'|'learn'|'refresh'|'unknown'} LearningGoal
 * @typedef {'flashcards'|'knowledge_sheets'|'roadmap'|'mixed'} LearningDeliverable
 * @typedef {'intro'|'standard'|'deep'} LearningDepth
 * @typedef {'short'|'medium'|'long'|'unknown'} LearningHorizon
 * @typedef {'high'|'medium'|'low'} SlotConfidence
 *
 * @typedef {Object} TechnicalLearningPathSlots
 * @property {'technical_learning_path'} intent
 * @property {string|null} domain
 * @property {string|null} domainLabel
 * @property {string|null} targetStack
 * @property {LearningGoal} goal
 * @property {LearningDeliverable} deliverable
 * @property {LearningDepth} depth
 * @property {LearningHorizon} horizon
 * @property {SlotConfidence} confidence
 */

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTechnicalLearningPathSignal(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  if (isLearningRequestForTechnicalDomain(query)) return true;
  return LEARNING_SHELL_RE.test(q) || (LEARNING_GOAL_RE.test(q) && TECH_DOMAIN_RE.test(q));
}

/**
 * Shell d'apprentissage technique fort — prime sur une motivation carrière secondaire (ex. « pour un job »).
 * @param {string} query
 * @returns {boolean}
 */
export function isStrongTechnicalLearningShell(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  if (LEARNING_SHELL_RE.test(q)) return true;
  if (/\bplan\s+pour\s+apprendre\b/i.test(q) && TECH_DOMAIN_RE.test(q)) return true;
  return (
    LEARNING_GOAL_RE.test(q) &&
    TECH_DOMAIN_RE.test(q) &&
    /\b(?:plan|parcours|roadmap|fiches?|maitriser|apprendre)\b/i.test(q)
  );
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractLearningDomain(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  const learningRequestTarget = extractLearningRequestTarget(query);
  if (learningRequestTarget && isLearningRequestWithTarget(query)) {
    return learningRequestTarget;
  }

  const patterns = [
    /\bmaitriser\s+(?:la |le |les |l )?([^?.!,]{3,80})/i,
    /\bapprendre\s+(?:la |le |les |l )?([^?.!,]{3,80})/i,
    /\bfiches?(?:\s+de\s+connaissance)?\s+(?:pour|sur|afin de maitriser)\s+(?:la |le |les |l )?([^?.!,]{3,80})/i,
    /\bfiches? de revision(?:s)?\s+(?:pour|sur|afin de maitriser)\s+(?:la |le |les |l )?([^?.!,]{3,80})/i,
    /\bafin de maitriser\s+(?:la |le |les |l )?([^?.!,]{3,80})/i,
    /\bplan d apprentissage\s+(?:pour|sur|de)\s+(?:la |le |les |l )?([^?.!,]{3,80})/i,
    /\bprogression sur\s+(?:la |le |les |l )?([^?.!,]{3,80})/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || "")
      .replace(/\s+(?:et ses|pour|avec|en|sur)\b.*/i, "")
      .trim();
    if (raw.length >= 2) return raw;
  }

  if (TECH_DOMAIN_RE.test(q)) {
    const token = q.match(TECH_DOMAIN_RE);
    return token ? token[0] : null;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractTargetStack(query = "") {
  const q = normalizeQuery(query);
  const match = q.match(/\b(?:pour|with|avec)\s+(?:le |la |les |l )?([^?.!,]{2,50})$/i);
  if (match?.[1]) {
    return String(match[1]).replace(/\s+/g, " ").trim();
  }
  if (/\b(?:javascript|typescript|node\.?js|python|java|kotlin)\b/i.test(q)) {
    const token = q.match(/\b(?:javascript|typescript|node\.?js|python|java|kotlin)\b/i);
    return token ? token[0] : null;
  }
  return null;
}

/**
 * @param {string} query
 * @returns {LearningGoal}
 */
export function extractLearningGoal(query = "") {
  const q = normalizeQuery(query);
  if (/\bmaitriser\b/i.test(q)) return "mastery";
  if (/\b(?:approfondir|refresh|reactualiser|remise a niveau|remise à niveau)\b/i.test(q)) {
    return "refresh";
  }
  if (/\bapprendre\b/i.test(q)) return "learn";
  return "unknown";
}

/**
 * @param {string} query
 * @returns {LearningDeliverable}
 */
export function extractLearningDeliverable(query = "") {
  const q = normalizeQuery(query);
  if (/\bfiches? de connaissance\b/i.test(q)) return "knowledge_sheets";
  if (/\b(?:flashcards?|cartes memoire|cartes mémoire|anki)\b/i.test(q)) return "flashcards";
  if (/\bfiches? de revision(?:s)?\b/i.test(q)) return "knowledge_sheets";
  if (/\b(?:exercices?|katas?|quiz|qcm)\b/i.test(q)) return "mixed";
  if (/\b(?:roadmap|feuille de route|plan d apprentissage|parcours)\b/i.test(q)) {
    return "roadmap";
  }
  if (/\bfiches?\b/i.test(q)) return "knowledge_sheets";
  return "mixed";
}

/**
 * @param {string} query
 * @returns {LearningDepth}
 */
export function extractLearningDepth(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:en profondeur|deep|avance|avancé|expert|architecture)\b/i.test(q)) {
    return "deep";
  }
  if (/\b(?:bases|intro|introduction|debutant|débutant)\b/i.test(q)) {
    return "intro";
  }
  return "standard";
}

/**
 * @param {string} query
 * @returns {LearningHorizon}
 */
export function extractLearningHorizon(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:rapidement|1 mois|un mois|30 jours|court terme)\b/i.test(q)) {
    return "short";
  }
  if (/\b(?:6 mois|un an|1 an|long terme|plusieurs mois)\b/i.test(q)) {
    return "long";
  }
  if (/\b(?:3 mois|trimestre|moyen terme)\b/i.test(q)) {
    return "medium";
  }
  return "unknown";
}

/**
 * @param {string} query
 * @returns {TechnicalLearningPathSlots|null}
 */
export function parseTechnicalLearningPath(query = "") {
  const domainLabel = extractLearningDomain(query);
  if (!domainLabel && !isTechnicalLearningPathSignal(query)) return null;

  return {
    intent: "technical_learning_path",
    domain: domainLabel ? domainLabel.toLowerCase().replace(/\s+/g, " ").trim() : null,
    domainLabel,
    targetStack: extractTargetStack(query),
    goal: extractLearningGoal(query),
    deliverable: extractLearningDeliverable(query),
    depth: extractLearningDepth(query),
    horizon: extractLearningHorizon(query),
    confidence:
      domainLabel && isTechnicalLearningPathSignal(query)
        ? "high"
        : domainLabel
          ? "medium"
          : "low",
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTechnicalLearningPathRequest(query = "") {
  const q = normalizeQuery(query);
  if (!q || q.length < 15) return false;

  if (!isTechnicalLearningPathSignal(query)) return false;
  if (isPrimaryCareerLearningSignal(query)) return false;
  if (isCareerLearningPathSignal(query) && !isStrongTechnicalLearningShell(query)) {
    return false;
  }
  if (SCHOOL_CURRICULUM_RE.test(q)) return false;
  if (isPedagogicalOverviewRequest(query)) return false;
  if (isBeginnerTopicOverviewRequest(query)) return false;
  if (isAdminProcedureRequest(query)) return false;
  if (isCompareChooseRequest(query)) return false;
  if (isDebugDiagnosticRequest(query)) return false;
  if (isExploitableProcedureIntent(query)) return false;

  if (OVERVIEW_ONLY_EXCLUDE_RE.test(q) && !LEARNING_SHELL_RE.test(q)) {
    return false;
  }

  const selective = classifySelectiveDecisionIntent(query);
  if (selective.detected && /\b(?:vs|versus|comparer|meilleur|choisir entre)\b/i.test(q)) {
    return false;
  }

  const slots = parseTechnicalLearningPath(query);
  if (!slots) return false;
  return Boolean(slots.domainLabel) || slots.confidence !== "low";
}

/**
 * Sujet techniquement ambigu mais exploitable : JVM + JavaScript (GraalVM / Nashorn).
 * @param {string} [query]
 * @param {TechnicalLearningPathSlots|null} [slots]
 * @returns {boolean}
 */
export function isJvmJavaScriptHybridLearningTopic(query = "", slots = null) {
  const q = normalizeQuery(query).toLowerCase();
  const domain = String(
    slots?.domainLabel || slots?.domain || extractLearningDomain(query) || "",
  ).toLowerCase();
  const stack = String(
    slots?.targetStack || extractTargetStack(query) || "",
  ).toLowerCase();
  const hasJvm = /\bjvm\b/.test(domain) || /\bjvm\b/.test(q);
  const hasJs =
    /\b(?:javascript|js)\b/.test(stack) ||
    /\b(?:javascript|js)\b/.test(q);
  return hasJvm && hasJs;
}

/**
 * @param {string} q
 * @returns {boolean}
 */
function matchesPedagogicalBuildPreemption(q = "") {
  if (!TECH_DOMAIN_RE.test(q)) return false;
  if (EXPLICIT_BUILD_DELIVERABLE_RE.test(q)) return false;

  const hasLearning =
    LEARNING_MASTERY_VERB_RE.test(q) || LEARNING_GOAL_RE.test(q);
  const hasSummaryForLearning =
    PEDAGOGICAL_SUMMARY_FOR_LEARNING_RE.test(q) && hasLearning;
  const hasPracticeArtifact = PEDAGOGICAL_PRACTICE_RE.test(q);
  const hasClassicPedagogical =
    PEDAGOGICAL_ARTIFACT_RE.test(q) || LEARNING_SHELL_RE.test(q);

  const hasPedagogical =
    hasClassicPedagogical ||
    hasSummaryForLearning ||
    (hasPracticeArtifact && hasLearning);

  const hasPracticeBundle =
    hasPracticeArtifact && PRODUCTION_VERB_RE.test(q);

  if (!hasPedagogical && !hasPracticeBundle) return false;
  if (hasPracticeBundle && !hasLearning) return true;
  if (!hasLearning && !LEARNING_SHELL_RE.test(q)) return false;
  if (PRODUCTION_VERB_RE.test(q)) return true;
  return LEARNING_SHELL_RE.test(q);
}

/**
 * Surclasse les intents de build (web_html, code, document…) quand l'utilisateur
 * veut apprendre une stack, pas livrer un artefact technique.
 * Test mental : « apprendre X » vs « livrer un artefact X ».
 * @param {string} query
 * @returns {boolean}
 */
let suppressesBuildIntentForTechnicalLearningDepth = 0;

export function suppressesBuildIntentForTechnicalLearning(query = "") {
  if (suppressesBuildIntentForTechnicalLearningDepth > 0) return false;
  suppressesBuildIntentForTechnicalLearningDepth += 1;
  try {
    if (isTechnicalLearningPathRequest(query)) return true;

    const q = normalizeQuery(query);
    if (!q || q.length < 15) return false;
    if (EXPLICIT_BUILD_DELIVERABLE_RE.test(q)) return false;
    if (matchesPedagogicalBuildPreemption(q)) return true;

    return (
      isTechnicalLearningPathSignal(query) && Boolean(extractLearningDomain(query))
    );
  } finally {
    suppressesBuildIntentForTechnicalLearningDepth -= 1;
  }
}

/** @deprecated alias — préférer suppressesBuildIntentForTechnicalLearning */
export function suppressesWebHtmlBuildIntent(query = "") {
  return suppressesBuildIntentForTechnicalLearning(query);
}

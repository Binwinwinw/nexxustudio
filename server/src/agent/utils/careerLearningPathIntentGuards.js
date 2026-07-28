/**
 * Parcours carrière / formation pro — roadmap vers un métier (pas scolaire, pas admin officiel).
 * Ex. : « comment devenir développeur », « parcours reconversion data analyst »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { isTechnicalOverviewRequest } from "./technicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "./debugDiagnosticIntentGuards.js";
import { isCompareChooseRequest } from "./compareChooseIntentGuards.js";
import { isAdminProcedureRequest } from "./adminProcedureIntentGuards.js";
import { classifySelectiveDecisionIntent } from "./selectiveDecisionIntentGuards.js";

export const CAREER_LEARNING_PATH_ROUTING_RULE =
  "career_learning_path_local_generative";

const CAREER_SHELL_RE =
  /\b(?:devenir (?:un |une |le |la )?|comment devenir|parcours (?:pour|vers|de|du|d un|d une)|reconversion (?:vers|en|dans|pour)|roadmap (?:pour|vers|de|du)|plan (?:de carriere|pour devenir|pour acceder)|chemin (?:pour|vers)|etapes pour devenir|progresser vers (?:le |la |un |une )?|acceder au metier|acceder a la profession|se reconvertir|break into|career path|learning path)\b/i;

const CAREER_MARKER_RE =
  /\b(?:metier|carriere|profession|professionnel|professionnelle|reconversion|employabilite|embauche|poste|job|travail|stage|alternance|apprentissage pro|bilan de competences|marche du travail)\b/i;

const SCHOOL_CURRICULUM_RE =
  /\b(?:eleve|élève|ecolier|écolier|6e|6eme|6ème|5e|5eme|5ème|4e|4eme|4ème|3e|3eme|3ème|cm2|seconde|2nde|premiere|première|1ere|1ère|terminale|programme scolaire|socle|education nationale|éducation nationale)\b/i;

const WORKSHOP_ONLY_EXCLUDE_RE =
  /\b(?:atelier|support animateur|support de formation|trame pedagogique|trame pédagogique|deroule de seance|déroulé de séance)\b/i;

const TARGET_ROLE_PATTERNS = [
  /\bdevenir\s+(?:un |une |le |la )?([^?.!,]{3,70})/i,
  /\bparcours\s+(?:pour|vers|de)\s+(?:devenir\s+)?(?:un |une |le |la )?([^?.!,]{3,70})/i,
  /\breconversion\s+(?:vers|en|dans|pour)\s+(?:le |la |l )?([^?.!,]{3,70})/i,
  /\broadmap\s+(?:pour|vers|de)\s+(?:devenir\s+)?(?:un |une |le |la )?([^?.!,]{3,70})/i,
  /\bprogresser vers\s+(?:le |la |un |une )?([^?.!,]{3,70})/i,
  /\bmetier de\s+([^?.!,]{3,70})/i,
];

const TECH_ROLE_HINT_RE =
  /\b(?:developpeur|devops|data analyst|data scientist|designer|ux|ui|cyber|cybersecurite|ingenieur|architecte logiciel|product manager|marketing digital|community manager)\b/i;

const HEALTH_ROLE_HINT_RE =
  /\b(?:infirmier|infirmiere|medecin|aide soignant|kinesitherapeute|pharmacien)\b/i;

/**
 * @typedef {'none'|'junior'|'mid'|'switcher'|'unknown'} CareerExperienceLevel
 * @typedef {'short'|'medium'|'long'|'unknown'} CareerHorizon
 * @typedef {'tech'|'health'|'business'|'creative'|'trades'|'general'} CareerDomain
 * @typedef {'overview'|'roadmap'|'skills'|'certifications'} CareerScope
 * @typedef {'high'|'medium'|'low'} SlotConfidence
 *
 * @typedef {Object} CareerLearningPathSlots
 * @property {'career_learning_path'} intent
 * @property {string|null} targetRole
 * @property {string|null} targetRoleLabel
 * @property {CareerExperienceLevel} experienceLevel
 * @property {CareerHorizon} horizon
 * @property {CareerDomain} domain
 * @property {CareerScope} scope
 * @property {SlotConfidence} confidence
 */

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function cleanTargetRole(part = "") {
  return String(part || "")
    .replace(/\s+(?:en|dans|avec|pour|sur|a|à)\b.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Signal carrière sans décision complète — utilisé pour frontière beginner.
 * @param {string} query
 * @returns {boolean}
 */
export function isCareerLearningPathSignal(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  return CAREER_SHELL_RE.test(q) || CAREER_MARKER_RE.test(q);
}

/**
 * Intent carrière principal (devenir, reconversion, parcours métier) — prime sur TLP si les deux coexistent.
 * @param {string} query
 * @returns {boolean}
 */
export function isPrimaryCareerLearningSignal(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  return CAREER_SHELL_RE.test(q);
}

/**
 * Motivation emploi secondaire sans shell carrière (ex. « pour trouver un job »).
 * @param {string} query
 * @returns {boolean}
 */
export function isSecondaryCareerMotivation(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  return CAREER_MARKER_RE.test(q) && !CAREER_SHELL_RE.test(q);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractTargetRole(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  for (const pattern of TARGET_ROLE_PATTERNS) {
    const match = q.match(pattern);
    const raw = cleanTargetRole(match?.[1] || "");
    if (raw.length >= 3) return raw;
  }

  if (TECH_ROLE_HINT_RE.test(q)) {
    const token = q.match(TECH_ROLE_HINT_RE);
    return token ? token[0] : null;
  }
  if (HEALTH_ROLE_HINT_RE.test(q)) {
    const token = q.match(HEALTH_ROLE_HINT_RE);
    return token ? token[0] : null;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {CareerExperienceLevel}
 */
export function extractCareerExperienceLevel(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:reconversion|switcher|changer de metier|changer de métier|reconvertir|sans experience|sans expérience|debut de carriere|début de carrière)\b/i.test(q)) {
    return "switcher";
  }
  if (/\b(?:junior|debutant|débutant|premier emploi|premiere experience|première expérience)\b/i.test(q)) {
    return "junior";
  }
  if (/\b(?:senior|experimente|expérimenté|5 ans|10 ans|manager|lead)\b/i.test(q)) {
    return "mid";
  }
  return "unknown";
}

/**
 * @param {string} query
 * @returns {CareerHorizon}
 */
export function extractCareerHorizon(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:rapidement|vite|6 mois|un an|1 an|12 mois|court terme)\b/i.test(q)) {
    return "short";
  }
  if (/\b(?:2 ans|3 ans|4 ans|5 ans|long terme|plusieurs annees|plusieurs années)\b/i.test(q)) {
    return "long";
  }
  if (/\b(?:18 mois|2 ans|medium|moyen terme)\b/i.test(q)) {
    return "medium";
  }
  return "unknown";
}

/**
 * @param {string} query
 * @returns {CareerDomain}
 */
export function extractCareerDomain(query = "") {
  const q = normalizeQuery(query);
  if (TECH_ROLE_HINT_RE.test(q)) return "tech";
  if (HEALTH_ROLE_HINT_RE.test(q)) {
    return "health";
  }
  if (/\b(?:comptable|commercial|rh|ressources humaines|management|entrepreneur|freelance|consultant)\b/i.test(q)) {
    return "business";
  }
  if (/\b(?:designer|graphiste|photographe|musicien|redacteur|rédacteur|createur|créateur)\b/i.test(q)) {
    return "creative";
  }
  if (/\b(?:electricien|électricien|plombier|macon|maçon|menuisier|boulanger|coiffeur)\b/i.test(q)) {
    return "trades";
  }
  return "general";
}

/**
 * @param {string} query
 * @returns {CareerScope}
 */
export function extractCareerScope(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:certification|diplome|diplôme|titre pro|titre professionnel|bts|dut|licence pro|master|ecole|école|bootcamp)\b/i.test(q)) {
    return "certifications";
  }
  if (/\b(?:competences|compétences|skills|stack|outils|technologies)\b/i.test(q)) {
    return "skills";
  }
  if (/\b(?:roadmap|parcours|etapes|étapes|plan|chemin)\b/i.test(q)) {
    return "roadmap";
  }
  return "overview";
}

/**
 * @param {string} query
 * @returns {CareerLearningPathSlots|null}
 */
export function parseCareerLearningPath(query = "") {
  const targetRoleLabel = extractTargetRole(query);
  if (!targetRoleLabel && !isCareerLearningPathSignal(query)) return null;

  const targetRole = targetRoleLabel
    ? targetRoleLabel.toLowerCase().replace(/\s+/g, " ").trim()
    : null;

  return {
    intent: "career_learning_path",
    targetRole,
    targetRoleLabel,
    experienceLevel: extractCareerExperienceLevel(query),
    horizon: extractCareerHorizon(query),
    domain: extractCareerDomain(query),
    scope: extractCareerScope(query),
    confidence:
      targetRoleLabel && isCareerLearningPathSignal(query)
        ? "high"
        : targetRoleLabel
          ? "medium"
          : "low",
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCareerLearningPathRequest(query = "") {
  const q = normalizeQuery(query);
  if (!q || q.length < 15) return false;

  if (!isCareerLearningPathSignal(query)) return false;
  if (SCHOOL_CURRICULUM_RE.test(q)) return false;
  if (WORKSHOP_ONLY_EXCLUDE_RE.test(q) && !CAREER_SHELL_RE.test(q)) return false;

  if (isPedagogicalOverviewRequest(query)) return false;
  if (isAdminProcedureRequest(query)) return false;
  if (isCompareChooseRequest(query)) return false;
  if (isDebugDiagnosticRequest(query)) return false;

  const selective = classifySelectiveDecisionIntent(query);
  if (selective.detected && /\b(?:vs|versus|comparer|meilleur|choisir entre)\b/i.test(q)) {
    return false;
  }

  if (isTechnicalOverviewRequest(query) && !/\b(?:devenir|parcours|reconversion|roadmap|carriere|metier)\b/i.test(q)) {
    return false;
  }

  const slots = parseCareerLearningPath(query);
  if (!slots) return false;
  return Boolean(slots.targetRoleLabel) || slots.confidence !== "low";
}

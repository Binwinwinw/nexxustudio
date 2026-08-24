/**
 * pedagogy_soft_overview — aperçus vagues mais légitimes (histoire, géo, sciences).
 * Lot #35 : répondre d'abord, suffixe de ciblage ensuite.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "./beginnerTopicOverviewIntentGuards.js";
import { isTechnicalLearningPathRequest } from "./technicalLearningPathIntentGuards.js";
import { isCareerLearningPathRequest } from "./careerLearningPathIntentGuards.js";
import { isCompareChooseRequest } from "./compareChooseIntentGuards.js";
import { isInformationSeekingWithTarget } from "./informationSeekingIntentGuards.js";
import { isPromptForArtifactRequest } from "./promptForArtifactIntentGuards.js";
import { isRecipeKnowledgeRequest } from "./recipeKnowledgeIntentGuards.js";
import { isAdminProcedureRequest } from "./adminProcedureIntentGuards.js";

export const PEDAGOGY_SOFT_OVERVIEW_RULE = "pedagogy_soft_overview_v1";

export const PEDAGOGY_SOFT_DOMAINS = {
  HISTORY: "history",
  GEOGRAPHY: "geography",
  SCIENCES: "sciences",
};

const SOFT_OVERVIEW_SHELL_RE =
  /\b(?:parle(?:r|-)?moi\s+de|explique(?:r|-)?moi|dis(?:s|-)?moi\s+(?:l['']?\s*)?(?:essentiel|l\s+essentiel)|presente(?:r|-)?moi|présente(?:r|-)?moi|raconte(?:r|-)?moi|donne(?:r|-)?moi\s+un\s+aper[cç]u|dis(?:s|-)?moi\s+ce\s+que\s+tu\s+sais\s+sur)\b/i;

const SOFT_OVERVIEW_BREADTH_RE =
  /\b(?:en\s+général|en\s+general|l['']?\s*essentiel|globalement|dans\s+les\s+grandes\s+lignes|vue\s+d['']ensemble|aper[cç]u\s+général)\b/i;

const HISTORY_SIGNAL_RE =
  /\b(?:révolution|revolution|guerre|empire|monarchie|siècle|siecle|antiquité|antiquite|moyen[\s-]?âge|moyen[\s-]?age|renaissance|colonisation|colonization|indépendance|independance|histoire(?:\s+de|\s+d[''])?|république|republique|monarch|dynastie|conquête|conquete|bataille|traité|traite)\b/i;

const GEOGRAPHY_SIGNAL_RE =
  /\b(?:géographie|geographie|géographique|geographique|relief|climat|population|frontière|frontiere|continents?|région|region|carte|territoire|reliefs?|hydrographie|démographie|demographie)\b/i;

const SCIENCE_SIGNAL_RE =
  /\b(?:volcan(?:s|ique)?|sciences?|biologie|physique|chimie|écosystème|ecosysteme|astronomie|cellule|atome|géologie|geologie|météorologie|meteorologie|énergie|energie|photosynthèse|photosynthese|tectonique|fossile|molecule|molécule)\b/i;

const TECH_DOMAIN_EXCLUDE_RE =
  /\b(?:redis|kubernetes|k8s|docker|innodb|mysql|postgres|postgresql|mongodb|api|rest|graphql|websocket|nginx|apache|linux|git|node\.?js|python|java|typescript|javascript|react|vue|angular|sql|nosql|cache|microservice|microservices|kafka|rabbitmq|elasticsearch|terraform|ansible|ci\/cd|devops|oauth|jwt|ssl|tls|http|https|tcp|udp|dns|cdn|lambda|serverless|blockchain|llm|rag|vector|embedding|orm|mvc|solid|clean architecture)\b/i;

const EXPLICIT_LEARNING_PATH_RE =
  /\b(?:plan\s+d['']apprentissage|parcours\s+(?:de|pour)|roadmap|maîtriser|maitriser|devenir\s+expert|reconversion)\b/i;

/**
 * @param {string} query
 * @param {string} subject
 * @returns {string|null}
 */
export function classifyPedagogySoftDomain(query = "", subject = "") {
  const probe = normalizeFamiliarityQuery(`${query} ${subject}`);
  if (!probe) return null;

  if (HISTORY_SIGNAL_RE.test(probe)) return PEDAGOGY_SOFT_DOMAINS.HISTORY;
  if (GEOGRAPHY_SIGNAL_RE.test(probe)) return PEDAGOGY_SOFT_DOMAINS.GEOGRAPHY;
  if (SCIENCE_SIGNAL_RE.test(probe)) return PEDAGOGY_SOFT_DOMAINS.SCIENCES;

  return null;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeSubjectKey(raw = "") {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(?:la |le |les |l')/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractPedagogySoftSubject(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  const patterns = [
    /\b(?:parle(?:r|-)?moi\s+de|explique(?:r|-)?moi|presente(?:r|-)?moi|présente(?:r|-)?moi|raconte(?:r|-)?moi)\s+(?:la |le |les |l')?([^?.!]{4,90})/i,
    /\bdis(?:s|-)?moi\s+(?:l['']?\s*)?(?:essentiel|l\s+essentiel)\s+sur\s+(?:la |le |les |l')?([^?.!]{4,90})/i,
    /\bdis(?:s|-)?moi\s+ce\s+que\s+tu\s+sais\s+sur\s+(?:la |le |les |l')?([^?.!]{4,90})/i,
    /\bdonne(?:r|-)?moi\s+un\s+aper[cç]u\s+(?:de|sur|d[''])?\s*(?:la |le |les |l')?([^?.!]{4,90})/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    let candidate = match?.[1]?.trim();
    if (!candidate || candidate.length < 4) continue;
    candidate = candidate
      .replace(/\s+en\s+(?:général|general)\s*$/i, "")
      .replace(/\s+dans\s+les\s+grandes\s+lignes\s*$/i, "")
      .trim();
    if (candidate.length >= 4) return candidate;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {{
 *   kind: string,
 *   domain: string,
 *   subject: string,
 *   subjectLabel: string,
 *   subjectKey: string,
 *   breadth: boolean,
 * }|null}
 */
export function parsePedagogySoftOverviewTask(query = "") {
  const subject = extractPedagogySoftSubject(query);
  const domain = classifyPedagogySoftDomain(query, subject || "");
  if (!subject || !domain) return null;

  const subjectKey = normalizeSubjectKey(subject);
  const subjectLabel = subject.charAt(0).toUpperCase() + subject.slice(1);

  return {
    kind: "pedagogy_soft_overview",
    domain,
    subject: subjectKey,
    subjectLabel,
    subjectKey,
    breadth: SOFT_OVERVIEW_BREADTH_RE.test(normalizeFamiliarityQuery(query)),
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPedagogySoftOverviewExcluded(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return true;

  const subject = extractPedagogySoftSubject(query);
  const domain = classifyPedagogySoftDomain(query, subject || "");
  const confirmedSoft = Boolean(subject && domain);

  if (isPedagogicalOverviewRequest(query)) return true;
  if (isBeginnerTopicOverviewRequest(query)) return true;
  if (isTechnicalLearningPathRequest(query)) return true;
  if (isCareerLearningPathRequest(query)) return true;
  if (isCompareChooseRequest(query)) return true;
  if (!confirmedSoft && isInformationSeekingWithTarget(query)) return true;
  if (isPromptForArtifactRequest(query)) return true;
  if (isRecipeKnowledgeRequest(query)) return true;
  if (isAdminProcedureRequest(query)) return true;
  if (EXPLICIT_LEARNING_PATH_RE.test(q)) return true;
  if (
    !confirmedSoft &&
    TECH_DOMAIN_EXCLUDE_RE.test(q) &&
    !HISTORY_SIGNAL_RE.test(q) &&
    !GEOGRAPHY_SIGNAL_RE.test(q) &&
    !SCIENCE_SIGNAL_RE.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPedagogySoftOverviewRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 15) return false;
  if (!SOFT_OVERVIEW_SHELL_RE.test(q)) return false;
  if (isPedagogySoftOverviewExcluded(query)) return false;
  return Boolean(parsePedagogySoftOverviewTask(query));
}

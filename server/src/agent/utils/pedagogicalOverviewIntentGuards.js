/**
 * Requêtes pédagogiques « overview » answerables localement (socle cycle 3/4).
 * Ex. : « que doit apprendre un élève de 6e sur les fractions simples ? »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import {
  parsePedagogicalOverview,
  extractPedagogicalTopic,
} from "./pedagogicalOverviewParser.js";
import { isBeginnerTopicOverviewRequest } from "./beginnerTopicOverviewIntentGuards.js";

export { parsePedagogicalOverview } from "./pedagogicalOverviewParser.js";

export const PEDAGOGICAL_OVERVIEW_ROUTING_RULE =
  "answerable_overview_pedagogic_local_first";

const PEDAGOGICAL_SHELL_RE =
  /\b(?:que\s+(?:dois|doit|doivent)\s+(?:apprendre|savoir)|qu['']?\s*apprendre|notions?\s+(?:de\s+base\s+)?(?:sur|de|du|des)|programme\s+(?:de|sur|en)|le\s+socle\s+(?:de|sur|en)|objectifs?\s+(?:de|pour|du))\b/i;

const PEDAGOGICAL_LEVEL_RE =
  /\b(?:eleve|élève|ecolier|écolier|6e|6eme|6ème|5e|5eme|5ème|4e|4eme|4ème|3e|3eme|3ème|cm2|cycle\s+[234]|college|collège|primaire|lycee|lycée|seconde|2nde|premiere|première|1ere|1ère|terminale)\b/i;

const PEDAGOGICAL_TOPIC_RE =
  /\b(?:fraction|math|maths|arithmetique|arithmétique|français|francais|svt|physique|histoire|géographie|geographie|geo|grammaire|conjugaison|geometrie|géométrie|numeration|numération|proportion|pourcentage|equation|équation)\b/i;

const OFFICIAL_PROGRAM_ESCALATION_RE =
  /\b(?:programme\s+officiel|bulletin\s+officiel|programmes?\s+(?:de|du)\s+l['']?education|ressources?\s+a\s+jour|derniere\s+reforme|referentiel\s+national)\b/i;

/**
 * Contexte scolaire explicite — élève + bande/niveau, ou niveau curriculum reconnu.
 *
 * @param {string} query
 * @returns {boolean}
 */
export function hasSchoolCurriculumContext(query = "") {
  if (isBeginnerTopicOverviewRequest(query)) return false;

  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;

  const slots = parsePedagogicalOverview(query);
  if (slots?.level || slots?.lyceeGrade) return true;
  if (slots?.educationBand) return true;

  const hasEleve = /\b(?:eleve|élève|ecolier|écolier)\b/i.test(q);
  if (hasEleve && PEDAGOGICAL_LEVEL_RE.test(q)) return true;

  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPedagogicalOverviewRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 12) return false;
  if (requiresPedagogicalOfficialProgramEscalation(query)) return false;
  if (isBeginnerTopicOverviewRequest(query)) return false;

  const hasShell =
    PEDAGOGICAL_SHELL_RE.test(q) ||
    /\b(?:dois|doit|doivent)\s+apprendre\b/.test(q);
  if (!hasShell) return false;

  if (!hasSchoolCurriculumContext(query)) return false;

  const { topic, topicLabel } = extractPedagogicalTopic(query);
  return PEDAGOGICAL_TOPIC_RE.test(q) || Boolean(topic || topicLabel);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function requiresPedagogicalOfficialProgramEscalation(query = "") {
  return OFFICIAL_PROGRAM_ESCALATION_RE.test(normalizeFamiliarityQuery(query));
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractPedagogicalSubject(query = "") {
  const slots = parsePedagogicalOverview(query);
  if (slots?.topicLabel) return slots.topicLabel;
  if (slots?.topic) return slots.topic;

  const { topicLabel, topic } = extractPedagogicalTopic(query);
  return topicLabel || topic;
}

/**
 * Procédures administratives / institutionnelles — démarches officielles (pas studio, pas tech install).
 * Ex. : « comment déclarer mes impôts », « démarche carte grise », « s'inscrire à France Travail »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isExploitableProcedureIntent } from "./procedureIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "./beginnerTopicOverviewIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { isTechnicalOverviewRequest } from "./technicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "./debugDiagnosticIntentGuards.js";
import { isCompareChooseRequest } from "./compareChooseIntentGuards.js";
import { classifySelectiveDecisionIntent } from "./selectiveDecisionIntentGuards.js";

export const ADMIN_PROCEDURE_ROUTING_RULE =
  "admin_procedure_web_rag_grounded";

const ADMIN_PROCEDURE_SHELL_RE =
  /\b(?:comment (?:faire|obtenir|demander|declarer|inscrire|s inscrire|renouveler|deposer|constituer|remplir|demarche)|s inscrire|quelle demarche|quelles demarches|les etapes pour|procedure pour|marche a suivre|demarche pour|faire pour obtenir|comment faire pour)\b/i;

const ADMIN_INFO_ONLY_RE =
  /\b(?:c est quoi|qu est ce que|definition|role de|missions? de|a quoi sert|histoire de|expliquer la caf|expliquer le cpam)\b/i;

const ADMIN_INSTITUTION_RE =
  /\b(?:impot|impôt|impots|impôts|impots\.gouv|urssaf|caf|cnaf|cpam|ameli|assurance maladie|pole emploi|pôle emploi|france travail|prefecture|préfecture|mairie|ants|carte grise|passeport|visa|secu|sécurité sociale|securite sociale|carte vitale|numero secu|numéro secu|retraite|allocation|rsa|apl|chomage|chômage|service[- ]public|demarches administratives|démarches administratives|permis de conduire|titre de sejour|titre de séjour|naturalisation|casier judiciaire|bail|logement social|hlm|dossier locatif|carte d['']identite|carte d['']identité|acte de naissance|livret de famille|tribunal|juridiction|micro[- ]entreprise|auto[- ]entrepreneur|greffe|inpi|douane|customs|douanes)\b/i;

const ADMIN_TOPIC_PATTERNS = [
  /\b(?:declarer|déclarer)\s+(?:mes|mon|ma|les)?\s*([^?.!,]{3,60})/i,
  /\b(?:obtenir|demander|renouveler)\s+(?:un|une|le|la|les|mon|ma|mes)?\s*([^?.!,]{3,60})/i,
  /\b(?:demarche|démarche)\s+(?:pour|de)\s+(?:obtenir|demander|renouveler|declarer|déclarer)?\s*([^?.!,]{3,60})/i,
  /\b(?:inscrire|s inscrire)\s+(?:a|à|sur|chez)?\s*([^?.!,]{3,60})/i,
];

const STUDIO_PROCEDURE_EXCLUDE_RE =
  /\b(?:citadelle|nexxus|studio|forge|handoff|buildproject|pipeline forge|api\/stream|vault|cockpit|orchestrat)\b/i;

const TECH_INSTALL_EXCLUDE_RE =
  /\b(?:installer|install(?:er|ation)?|configurer|configure|deployer|déployer|deploy(?:ment)?|mettre en place|brancher mon|connecter mon|mon fichier \.env|npm|docker compose|kubernetes|k8s)\b/i;

const TECH_DOMAIN_ONLY_RE =
  /\b(?:redis|nginx|mysql|postgres|mongodb|node\.?js|react|vue|angular|typescript|javascript|linux server|serveur linux)\b/i;

/**
 * @typedef {'tax'|'social'|'employment'|'health'|'identity'|'transport'|'housing'|'legal'|'business'|'general_admin'} AdminDomain
 * @typedef {'fr'|'eu'|'unknown'} AdminJurisdiction
 * @typedef {'high'|'medium'|'low'} FreshnessRisk
 * @typedef {'high'|'medium'|'low'} SlotConfidence
 *
 * @typedef {Object} AdminProcedureSlots
 * @property {'admin_procedure'} intent
 * @property {string|null} topic
 * @property {string|null} topicLabel
 * @property {AdminDomain} domain
 * @property {AdminJurisdiction} jurisdiction
 * @property {FreshnessRisk} freshnessRisk
 * @property {boolean} requiresOfficialSource
 * @property {SlotConfidence} confidence
 */

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isAdminProcedureShell(query = "") {
  return ADMIN_PROCEDURE_SHELL_RE.test(normalizeQuery(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isAdminInstitutionContext(query = "") {
  return ADMIN_INSTITUTION_RE.test(normalizeQuery(query));
}

/**
 * @param {string} query
 * @returns {AdminDomain}
 */
export function extractAdminDomain(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:impot|impôt|impots|impôts|urssaf|micro[- ]entreprise|auto[- ]entrepreneur|tva|taxe)\b/i.test(q)) {
    return "tax";
  }
  if (/\b(?:pole emploi|pôle emploi|france travail|chomage|chômage|emploi|inscrire|s['']inscrire)\b/i.test(q)) {
    return "employment";
  }
  if (/\b(?:caf|cnaf|rsa|apl|allocation|logement social|hlm|bail|dossier locatif)\b/i.test(q)) {
    return /\b(?:logement|bail|hlm|apl)\b/i.test(q) ? "housing" : "social";
  }
  if (/\b(?:ameli|cpam|carte vitale|assurance maladie|secu|sécurité sociale)\b/i.test(q)) {
    return "health";
  }
  if (/\b(?:passeport|carte d['']identite|carte d['']identité|titre de sejour|naturalisation|casier|acte de naissance|livret de famille)\b/i.test(q)) {
    return "identity";
  }
  if (/\b(?:carte grise|permis de conduire|ants|prefecture|préfecture)\b/i.test(q)) {
    return "transport";
  }
  if (/\b(?:tribunal|juridiction|greffe|inpi|douane|justice)\b/i.test(q)) {
    return "legal";
  }
  if (/\b(?:micro[- ]entreprise|auto[- ]entrepreneur|inpi|greffe)\b/i.test(q)) {
    return "business";
  }
  return "general_admin";
}

/**
 * @param {string} query
 * @returns {AdminJurisdiction}
 */
export function extractAdminJurisdiction(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:france|francais|français|metropole|métropole|dom[- ]tom|guadeloupe|martinique|reunion|réunion)\b/i.test(q)) {
    return "fr";
  }
  if (/\b(?:ue|union europeenne|union européenne|schengen)\b/i.test(q)) {
    return "eu";
  }
  if (ADMIN_INSTITUTION_RE.test(q)) return "fr";
  return "unknown";
}

/**
 * @param {string} query
 * @returns {FreshnessRisk}
 */
export function extractAdminFreshnessRisk(query = "") {
  const q = normalizeQuery(query);
  if (/\b(?:202[4-9]|reforme|réforme|nouveau|nouvelle|derniere|dernière|a jour|à jour|actualise|actualisé)\b/i.test(q)) {
    return "high";
  }
  if (/\b(?:montant|plafond|delai|délai|date limite|tarif|barème|barème)\b/i.test(q)) {
    return "high";
  }
  return "medium";
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractAdminTopic(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  for (const pattern of ADMIN_TOPIC_PATTERNS) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || "").trim();
    if (raw.length >= 3) {
      return raw.replace(/\s+/g, " ").trim();
    }
  }

  if (ADMIN_INSTITUTION_RE.test(q)) {
    const token = q.match(ADMIN_INSTITUTION_RE);
    return token ? token[0] : null;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {AdminProcedureSlots|null}
 */
export function parseAdminProcedure(query = "") {
  const topicLabel = extractAdminTopic(query);
  if (!topicLabel && !isAdminInstitutionContext(query)) return null;

  const topic = topicLabel
    ? topicLabel.toLowerCase().replace(/\s+/g, " ").trim()
    : null;

  return {
    intent: "admin_procedure",
    topic,
    topicLabel,
    domain: extractAdminDomain(query),
    jurisdiction: extractAdminJurisdiction(query),
    freshnessRisk: extractAdminFreshnessRisk(query),
    requiresOfficialSource: true,
    confidence:
      isAdminInstitutionContext(query) && isAdminProcedureShell(query)
        ? "high"
        : isAdminProcedureShell(query)
          ? "medium"
          : "low",
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isAdminProcedureRequest(query = "") {
  const q = normalizeQuery(query);
  if (!q || q.length < 12) return false;

  if (!isAdminProcedureShell(query)) return false;

  if (ADMIN_INFO_ONLY_RE.test(q) && !/\b(?:etapes|étapes|demarche|démarche|procedure|procédure)\b/i.test(q)) {
    return false;
  }

  if (isExploitableProcedureIntent(query)) return false;
  if (STUDIO_PROCEDURE_EXCLUDE_RE.test(q)) return false;
  if (TECH_INSTALL_EXCLUDE_RE.test(q) && TECH_DOMAIN_ONLY_RE.test(q)) return false;

  if (isBeginnerTopicOverviewRequest(query)) return false;
  if (isPedagogicalOverviewRequest(query)) return false;
  if (isTechnicalOverviewRequest(query)) return false;
  if (isDebugDiagnosticRequest(query)) return false;
  if (isCompareChooseRequest(query)) return false;

  const selective = classifySelectiveDecisionIntent(query);
  if (selective.detected && /\b(?:vs|versus|comparer|meilleur|choisir)\b/i.test(q)) {
    return false;
  }

  if (!isAdminInstitutionContext(query) && !extractAdminTopic(query)) {
    return false;
  }

  return Boolean(parseAdminProcedure(query));
}

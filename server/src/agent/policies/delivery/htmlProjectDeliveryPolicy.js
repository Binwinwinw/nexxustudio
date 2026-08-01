/**
 * HTML_PROJECT_DELIVERY_V1 — toute demande de livrable HTML = projet web à construire ou cadrer.
 * Sous-profils facultatifs ; clarification progressive (2–5 questions max) seulement si décisionnel.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { suppressesBuildIntentForTechnicalLearning } from "../../utils/technicalLearningPathIntentGuards.js";
import { detectCodeDeliveryLanguage } from "../code/codeDeliveryPolicy.js";
import { isCodeConceptExplainRequest } from "../code/codeConceptExplainPolicy.js";
import {
  buildNotionWorkshopProductionDelivery,
  buildHtmlWorkshopQualitySystemAddon,
  buildHtmlWorkshopQualityUserAddon,
  extractHtmlFromDelivery,
  isHtmlWorkshopQualityViolation,
} from "./htmlWorkshopDeliveryContract.js";
import { buildGenericHtmlProjectProductionDelivery } from "../../templates/htmlGenericProjectTemplate.js";
import { HTML_PROJECT_THRESHOLDS } from "./htmlProjectDeliveryThresholds.js";
import { isExistingSourceAnalysisRequest } from "../../utils/localFileUriIntentGuards.js";

export { HTML_PROJECT_THRESHOLDS } from "./htmlProjectDeliveryThresholds.js";

export const HTML_PROJECT_DELIVERY_CONTRACT_ID = "HTML_PROJECT_DELIVERY_V1";

export const HTML_PROJECT_PROFILES = Object.freeze({
  WORKSHOP: "html_workshop",
  TEMPLATE: "html_template",
  LANDING: "html_landing",
  DASHBOARD: "html_dashboard",
  INFO_PAGE: "html_info_page",
  GENERIC: "html_generic",
});

const HTML_FORMAT_PATTERN =
  /\b(?:fichier html|page html|\.html\b|doctype|<html|site web|landing|one.?page)\b/i;

const CREATE_INTENT_PATTERN =
  /\b(?:cree|créer|creer|generer|générer|genere|ecris|écris|produis|produire|construis|construire|developpe|développe|fais|fait|sais tu|peux tu|tu peux|template|maquette|prototype)\b/i;

const STRUCTURE_PATTERN =
  /\b(?:header|sidebar|aside|footer|section|sections|menu|navigation|carte|cartes|formulaire|hero|grille|dashboard|tableau de bord)\b/i;

const SUBJECT_PATTERN =
  /\b(?:notion|teams|portfolio|produit|saas|restaurant|école|ecole|cours|formation|startup|contact|blog|cv|profil)\b/i;

const PROFILE_PATTERNS = {
  [HTML_PROJECT_PROFILES.WORKSHOP]:
    /\b(?:atelier|formation|initiation|support|parcours|module|modules|tutorial|cours)\b/i,
  [HTML_PROJECT_PROFILES.TEMPLATE]:
    /\b(?:template|maquette|exemple|démo|demo|test|starter|boilerplate|squelette)\b/i,
  [HTML_PROJECT_PROFILES.LANDING]:
    /\b(?:landing|page d'accueil|page de vente|vitrine|one.?page|conversion|cta)\b/i,
  [HTML_PROJECT_PROFILES.DASHBOARD]:
    /\b(?:dashboard|tableau de bord|admin|back.?office|panel|panneau|stats|métriques|metriques)\b/i,
  [HTML_PROJECT_PROFILES.INFO_PAGE]:
    /\b(?:page de présentation|page informative|à propos|a propos|documentation|faq|présentation)\b/i,
};

/**
 * Livrable HTML explicite (tout type de projet).
 * @param {string} query
 */
export function isHtmlProjectDeliverable(query = "") {
  if (isCodeConceptExplainRequest(query)) return false;
  if (isExistingSourceAnalysisRequest(query)) return false;
  if (suppressesBuildIntentForTechnicalLearning(query)) return false;

  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < HTML_PROJECT_THRESHOLDS.htmlDetectMinQueryLength) return false;

  const isHtml =
    detectCodeDeliveryLanguage(query) === "html" || HTML_FORMAT_PATTERN.test(q);
  if (!isHtml) return false;

  return (
    CREATE_INTENT_PATTERN.test(q) ||
    STRUCTURE_PATTERN.test(q) ||
    SUBJECT_PATTERN.test(q) ||
    q.length >= HTML_PROJECT_THRESHOLDS.htmlDetectMinLength
  );
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveHtmlProjectProfile(query = "") {
  if (!isHtmlProjectDeliverable(query)) return null;

  const q = normalizeFamiliarityQuery(query);
  for (const [profile, pattern] of Object.entries(PROFILE_PATTERNS)) {
    if (pattern.test(q)) return profile;
  }

  if (
    /\b(?:sidebar|aside)\b/.test(q) &&
    /\b(?:sections?|modules?|th[eè]mes?|menus?)\b/.test(q)
  ) {
    return HTML_PROJECT_PROFILES.WORKSHOP;
  }
  if (STRUCTURE_PATTERN.test(q) && SUBJECT_PATTERN.test(q)) {
    return HTML_PROJECT_PROFILES.INFO_PAGE;
  }

  return HTML_PROJECT_PROFILES.GENERIC;
}

/**
 * @typedef {'build_v1'|'clarify_then_build'|'build_with_smart_defaults'} HtmlProjectStrategy
 */

/**
 * @param {string} query
 * @returns {{
 *   isHtmlProject: boolean,
 *   profile: string|null,
 *   strategy: HtmlProjectStrategy,
 *   clarificationQuestions: string[],
 *   smartDefaults: Record<string, string>,
 *   canBuildDirectly: boolean,
 * }}
 */
export function evaluateHtmlProjectDelivery(query = "") {
  const empty = {
    isHtmlProject: false,
    profile: null,
    strategy: "build_v1",
    clarificationQuestions: [],
    smartDefaults: {},
    canBuildDirectly: false,
  };

  if (!isHtmlProjectDeliverable(query)) return empty;

  const q = normalizeFamiliarityQuery(query);
  const profile = resolveHtmlProjectProfile(query);
  const hasStructure = STRUCTURE_PATTERN.test(q);
  const hasSubject = SUBJECT_PATTERN.test(q);
  const hasExplicitLayout = /\b(?:header|sidebar|aside|hero|section)\b/.test(q);
  const isTemplateLike = PROFILE_PATTERNS[HTML_PROJECT_PROFILES.TEMPLATE].test(q);
  const isVeryVague =
    q.length < HTML_PROJECT_THRESHOLDS.veryVagueMaxLength &&
    !hasStructure &&
    !hasSubject &&
    !profile;

  const smartDefaults = {
    usage: isTemplateLike ? "template de démonstration" : "page unique structurée",
    fidelity: isTemplateLike ? "maquette sobre présentable" : "V1 exploitable",
    content: "contenu d'exemple réaliste (pas de lorem ipsum)",
    scope: "page HTML autonome (un fichier)",
    style: "sobre, responsive, slate + accent bleu",
  };

  if (isVeryVague) {
    return {
      isHtmlProject: true,
      profile: profile || HTML_PROJECT_PROFILES.GENERIC,
      strategy: "clarify_then_build",
      clarificationQuestions: pickClarificationQuestions(q, profile),
      smartDefaults,
      canBuildDirectly: false,
    };
  }

  const partiallyAmbiguous =
    !hasExplicitLayout &&
    !hasSubject &&
    profile === HTML_PROJECT_PROFILES.GENERIC &&
    q.length < HTML_PROJECT_THRESHOLDS.partiallyAmbiguousMaxLength;

  if (partiallyAmbiguous) {
    const questions = pickClarificationQuestions(q, profile).slice(0, 3);
    if (questions.length >= HTML_PROJECT_THRESHOLDS.minClarifyQuestionsForPartial) {
      return {
        isHtmlProject: true,
        profile,
        strategy: "clarify_then_build",
        clarificationQuestions: questions,
        smartDefaults,
        canBuildDirectly: false,
      };
    }
  }

  if (isTemplateLike && !hasSubject) {
    return {
      isHtmlProject: true,
      profile: HTML_PROJECT_PROFILES.TEMPLATE,
      strategy: "build_with_smart_defaults",
      clarificationQuestions: [],
      smartDefaults,
      canBuildDirectly: true,
    };
  }

  return {
    isHtmlProject: true,
    profile,
    strategy: "build_v1",
    clarificationQuestions: [],
    smartDefaults,
    canBuildDirectly: true,
  };
}

/**
 * @param {string} q
 * @param {string|null} profile
 */
function pickClarificationQuestions(q, profile) {
  const questions = [];

  if (!SUBJECT_PATTERN.test(q)) {
    questions.push("Quel est le sujet ou le produit de la page (ex. Notion, portfolio, SaaS) ?");
  }
  if (!PROFILE_PATTERNS[HTML_PROJECT_PROFILES.TEMPLATE].test(q) && !profile) {
    questions.push(
      "Quel usage visé : vitrine/landing, support de formation, dashboard, template de test, ou page informative ?",
    );
  }
  if (!STRUCTURE_PATTERN.test(q)) {
    questions.push("Quelle structure souhaitée : header seul, header + sections, sidebar + contenu, ou grille de cartes ?");
  }
  if (questions.length < 2) {
    questions.push("Niveau de finition : maquette rapide ou page déjà présentable avec contenu d'exemple ?");
  }

  return questions.slice(0, 5);
}

/**
 * Qualité minimale selon le profil (pas de règle « atelier » sur une landing).
 * @param {string} query
 * @param {string} text
 */
export function isHtmlProjectQualityViolation(query = "", text = "") {
  const evaluation = evaluateHtmlProjectDelivery(query);
  if (!evaluation.isHtmlProject || evaluation.strategy === "clarify_then_build") {
    return false;
  }

  const profile = evaluation.profile || HTML_PROJECT_PROFILES.GENERIC;

  if (profile === HTML_PROJECT_PROFILES.WORKSHOP) {
    return isHtmlWorkshopQualityViolation(query, text);
  }

  const html = extractHtmlFromDelivery(text).toLowerCase();
  if (!html) return true;
  if (!/<!doctype\s+html/i.test(html) && !/<html[\s>]/i.test(html)) return true;
  if (!/<main[\s>]/i.test(html) && !/<body[\s>]/i.test(html)) return true;
  if (!/@media\s*\(/.test(html)) return true;
  if (/©\s*202[0-3]\b/.test(html)) return true;

  switch (profile) {
    case HTML_PROJECT_PROFILES.LANDING:
      if (html.length < 500) return true;
      if (!/<header[\s>]/i.test(html)) return true;
      if (!/<section[\s>]/i.test(html) && !/class=["'][^"']*hero/i.test(html)) return true;
      return false;

    case HTML_PROJECT_PROFILES.DASHBOARD:
      if (html.length < 800) return true;
      if (!/<aside[\s>]/i.test(html) && !/<nav[\s>]/i.test(html)) return true;
      if (!/<main[\s>]/i.test(html)) return true;
      return false;

    case HTML_PROJECT_PROFILES.TEMPLATE:
      if (html.length < 700) return true;
      return false;

    case HTML_PROJECT_PROFILES.INFO_PAGE:
    case HTML_PROJECT_PROFILES.GENERIC:
    default:
      if (html.length < 900) return true;
      return false;
  }
}

export function buildHtmlProjectSystemAddon(query = "") {
  const evaluation = evaluateHtmlProjectDelivery(query);
  if (!evaluation.isHtmlProject) return "";

  const profileLabel = evaluation.profile || HTML_PROJECT_PROFILES.GENERIC;
  const workshopAddon =
    evaluation.profile === HTML_PROJECT_PROFILES.WORKSHOP
      ? buildHtmlWorkshopQualitySystemAddon(query)
      : "";

  let strategyBlock = "";

  if (evaluation.strategy === "clarify_then_build") {
    const qLines = evaluation.clarificationQuestions
      .map((q, i) => `   ${i + 1}. ${q}`)
      .join("\n");
    strategyBlock = `
STRATÉGIE : CLARIFICATION PROGRESSIVE (max ${evaluation.clarificationQuestions.length} questions)
- Commence par « Oui, je peux te générer une première version HTML. »
- Pose UNIQUEMENT ces questions (pas de questionnaire interminable) :
${qLines}
- Propose aussi de partir sur les défauts intelligents si l'utilisateur préfère avancer tout de suite :
  · Usage : ${evaluation.smartDefaults.usage}
  · Finition : ${evaluation.smartDefaults.fidelity}
  · Contenu : ${evaluation.smartDefaults.content}
  · Périmètre : ${evaluation.smartDefaults.scope}
- INTERDIT : refus défensif « pas assez d'éléments ».`;
  } else if (evaluation.strategy === "build_with_smart_defaults") {
    strategyBlock = `
STRATÉGIE : CONSTRUCTION V1 AVEC DÉFAUTS INTELLIGENTS
- Commence par « Oui, je peux… » puis livre le HTML complet dans un bloc \`\`\`html.
- Type probable : ${profileLabel} — contenu de démonstration réaliste, responsive, présentable.
- Défauts appliqués : ${Object.entries(evaluation.smartDefaults).map(([k, v]) => `${k}=${v}`).join(" ; ")}.`;
  } else {
    strategyBlock = `
STRATÉGIE : CONSTRUCTION V1 DIRECTE
- Commence par « Oui, je peux… » puis livre le fichier HTML complet (bloc \`\`\`html).
- Profil détecté : ${profileLabel}.
- Si un détail manque : valeur par défaut raisonnable + mention brève.
- INTERDIT : refus ou clarification défensive quand le sujet/structure sont déjà identifiables.`;
  }

  const profileHints = {
    [HTML_PROJECT_PROFILES.LANDING]:
      "Hero + sections valeur/CTA, sémantique, responsive, pas de sidebar obligatoire.",
    [HTML_PROJECT_PROFILES.DASHBOARD]:
      "Nav latérale ou topbar + panneaux/grille, cartes stats, responsive.",
    [HTML_PROJECT_PROFILES.TEMPLATE]:
      "Template sobre documenté, sections commentées, contenu démo.",
    [HTML_PROJECT_PROFILES.INFO_PAGE]:
      "Header, sections informatives, typographie claire, accessibilité de base.",
    [HTML_PROJECT_PROFILES.GENERIC]:
      "Page unique structurée (header, main, footer), CSS intégré, @media mobile.",
  };

  return `
CONTRAT PROJET HTML (${HTML_PROJECT_DELIVERY_CONTRACT_ID}) :
Toute demande de livrable HTML = projet web, pas seulement un « atelier ».
${strategyBlock}

RÈGLES TRANSVERSES (tous profils HTML) :
- Doctype HTML5, lang="fr", viewport, balises sémantiques.
- Responsive (@media), focus visible, pas de footer © 2023 générique.
- ${profileHints[profileLabel] || profileHints[HTML_PROJECT_PROFILES.GENERIC]}
${workshopAddon ? `\n${workshopAddon}` : ""}`.trim();
}

export function buildHtmlProjectUserAddon(query = "") {
  const evaluation = evaluateHtmlProjectDelivery(query);
  if (!evaluation.isHtmlProject) return "";

  if (evaluation.profile === HTML_PROJECT_PROFILES.WORKSHOP) {
    return buildHtmlWorkshopQualityUserAddon(query);
  }

  if (evaluation.strategy === "clarify_then_build") {
    return `MODE PROJET HTML — clarification ciblée autorisée (pas de refus).`;
  }

  return `MODE PROJET HTML — livrer une V1 ${evaluation.profile || "html_generic"} complète et ouvrable dans le navigateur.`;
}

/**
 * @param {string} query
 */
export function buildHtmlProjectFallback(query = "") {
  const evaluation = evaluateHtmlProjectDelivery(query);
  if (!evaluation.isHtmlProject) return "";

  if (evaluation.profile === HTML_PROJECT_PROFILES.WORKSHOP && /\bnotion\b/i.test(query)) {
    return buildNotionWorkshopProductionDelivery();
  }

  return buildGenericHtmlProjectProductionDelivery(query, evaluation.profile);
}


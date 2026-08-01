/**
 * JUST_INTENT_DETECTION_V1 — détection multicouche : domaine → action → livrable → stratégie.
 * Complète intentTriage (routage pipeline) sans le remplacer.
 */
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";
import { suppressesBuildIntentForTechnicalLearning } from "../../utils/technicalLearningPathIntentGuards.js";
import { isCasualSocialCheckInQuery } from "../../utils/genericGreetingGuards.js";
import { isKnownSocialPattern } from "../socialPatternPolicy.js";
import { isOpenExplorationFrame } from "../openExplorationFramePolicy.js";
import { isIdeationIntent } from "../../utils/ideationIntentGuards.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import {
  isMultiTargetTranslationRequest,
  isTranslationDerivedRequest,
  isTranslationPipelineReady,
  isTranslationShell,
  requiresTranslationClarification,
} from "../../utils/translationIntentGuards.js";
import {
  isLearningRequestForTechnicalDomain,
  isLearningRequestWithTarget,
} from "../../utils/learningRequestIntentGuards.js";
import { isExistingSourceAnalysisRequest } from "../../utils/localFileUriIntentGuards.js";
import { isRepoAnalysisRequest } from "../../utils/repoAnalysisIntentGuards.js";
import { isUiNavigationRestructureFeedback } from "../../utils/uiNavigationFeedbackGuards.js";
import {
  resolveClarificationGate,
} from "../clarificationDecisionPolicy.js";
import {
  normalizeFamiliarityQuery,
  parseFamiliarityQuery,
} from "../../utils/familiarityIntentGuards.js";
import { extractSubjectCandidate } from "../../micro/continuity/sessionSubjectReferenceGuards.js";
import {
  classifyCodeIntent,
  hasCodeContext,
  hasExecutableSnippet,
} from "../codeIntentPolicy.js";
import { isCodeConceptExplainRequest } from "../codeConceptExplainPolicy.js";
import { isPedagogicalStructuredExplainRequest } from "../pedagogical/index.js";
import {
  evaluateHtmlProjectDelivery,
  isHtmlProjectDeliverable,
  resolveHtmlProjectProfile,
} from "../delivery/index.js";
import { resolveAiVerificationNotice } from "../epistemic/index.js";
import { JUST_INTENT_THRESHOLDS } from "./justIntentThresholds.js";
import {
  INTENT_DOMAINS,
  INTENT_ACTIONS,
  DELIVERABLE_TYPES,
  EXECUTION_STRATEGIES,
  CODE_KIND_TO_ACTION,
  getDomainLabel,
  getActionLabel,
  getDeliverableLabel,
} from "../../../../../shared/justIntentCatalog.js";

export { JUST_INTENT_THRESHOLDS } from "./justIntentThresholds.js";
export const JUST_INTENT_CONTRACT_ID = "JUST_INTENT_DETECTION_V1";

const CREATE_RE =
  /\b(cree|créer|creer|generer|générer|genere|fais|fait|produis|produire|construis|construire|developpe|développe|redige|rédige|ecris|écris|prepare|prépare)\b/i;

const SIMPLE_FACTUAL_START_RE =
  /^(qui|que|qu['’]est[- ]?ce que|quel(le)?s?|où|ou|quand|combien|est[- ]?ce que|dans quel(le)?)\b/i;

const GREETING_PREFIX_RE =
  /^(?:salut|bonjour|hello|coucou|hey|bonsoir|yo|yop|yépa|yepa)\s+(?:nexxus\s*,?\s*)?/i;

const SIMPLE_FACTUAL_EXCLUSION_RE =
  /\b(vaut[- ]?il[- ]?mieux|mieux\s+(?:de|pour)\b|investir|\bplan\b|proposes?[- ]?tu|propose[- ]?tu|proposes?[- ]?vous|propose[- ]?vous|conseille|recommande|recommandes?)\b/i;

const SIMPLE_FACTUAL_QUESTION_RE =
  /\b(où|ou|qui|quel|quels|quelle|quelles|quand|combien|dans quel|dans quelle|est[- ]?ce que|pourquoi|comment)\b/i;

const SIMPLE_FACTUAL_HINT_RE =
  /\b(est|sont|a|ont|date|jour|capitale|nom|heure|version)\b/i;

const SIMPLE_IDENTITY_QUESTION_RE =
  /\b(comment\s+tu\s+t['’]appelles|comment\s+t['’]appelles[-\s]?tu|tu\s+t['’]appelles\s+comment|quel\s+est\s+ton\s+nom|qui\s+es[-\s]?tu|comment\s+t['’]appelles\s+tu)\b/i;

const NON_FACTUAL_REQUEST_RE =
  /\b(cree|créer|creer|generer|générer|genere|fais|fait|produis|produire|construis|construire|developpe|développe|redige|rédige|ecris|écris|prepare|prépare|analyse|analyser|compare|comparer|planifie|planifier|corrige|corriger|debug|débug|diagnostique|diagnostiquer|audit|auditer)\b/i;

export function isSimpleFactualQuestion(query = "") {
  const raw = String(query || "").trim();
  if (isKnownSocialPattern(raw)) return false;
  if (isCasualSocialCheckInQuery(raw)) return false;
  if (isIdeationIntent(raw)) return false;

  let q = normalizeFamiliarityQuery(query);
  if (!q) return false;

  if (SIMPLE_IDENTITY_QUESTION_RE.test(q)) return true;

  q = q.replace(GREETING_PREFIX_RE, "").trim();
  if (!q) return false;

  if (q.length < 8) return false;
  if (q.length >= JUST_INTENT_THRESHOLDS.partiallyAmbiguousMaxLength)
    return false;
  if (
    /^(salut|bonjour|hello|coucou|hey|merci|ok|d'accord|dacord|bien|bonsoir)\b/i.test(
      q,
    )
  )
    return false;
  if (NON_FACTUAL_REQUEST_RE.test(q)) return false;
  if (SIMPLE_FACTUAL_EXCLUSION_RE.test(q)) return false;
  if (parseFamiliarityQuery(raw)) return false;
  if (extractSubjectCandidate(raw)) return false;
  if (isInformationSeekingWithTarget(raw)) return false;
  if (isTranslationShell(raw)) return false;

  const startsInterrogative = SIMPLE_FACTUAL_START_RE.test(q);
  const hasInterrogative = SIMPLE_FACTUAL_QUESTION_RE.test(q);
  const isQuestionForm =
    raw.endsWith("?") || SIMPLE_FACTUAL_HINT_RE.test(q);

  if (startsInterrogative) return true;
  if (hasInterrogative && isQuestionForm) return true;

  return false;
}

const DOMAIN_RULES = [
  {
    domain: INTENT_DOMAINS.SOCIAL,
    detect: (q) =>
      isOpenExplorationFrame(q) ||
      isKnownSocialPattern(q) ||
      (q.length < 25 &&
        /^(salut|bonjour|hello|coucou|hey|yépa|yepa|merci|ok|d'accord|dacord|bien|bonsoir|bien ou bien|ça va|ca va|tranquille|good|yo|yop|top|au top|c'est top|tout bon|carré|carre|ok top)\b/i.test(
          q,
        )),
  },
  {
    domain: INTENT_DOMAINS.SECURITY_POLICY,
    pattern:
      /\b(règles? de sécurité|regles? de securite|politique de sécurité|politique de securite|charte sécurité|conformité|conformite|rgpd|gdpr|garde[- ]?fou|classification sensibilité|audit sécurité|audit securite)\b/i,
  },
  {
    domain: INTENT_DOMAINS.PRESENTATION,
    pattern:
      /\b(powerpoint|power point|pptx?|slides?|présentation|presentation|deck|soutenance|pitch deck|diaporama)\b/i,
  },
  {
    domain: INTENT_DOMAINS.WEB_HTML,
    detect: () => false,
  },
  {
    domain: INTENT_DOMAINS.DOCUMENT,
    pattern:
      /\b(cv|curriculum vitae|lettre de motivation|rapport|compte rendu|compte-rendu|procédure|procedure|fiche de poste|cahier des charges|charte|note de service|memo|mémo)\b/i,
  },
  {
    domain: INTENT_DOMAINS.DATA,
    // « sous forme de tableau » pédagogique (cycle de l'eau…) ≠ domaine DATA / tableur
    detect: (q) => {
      if (isPedagogicalStructuredExplainRequest(q)) return false;
      return /\b(tableau|spreadsheet|excel|csv|json tabulaire|agrég|agreg|données structurées|donnees structurees|pivot)\b/i.test(
        q,
      );
    },
  },
  {
    domain: INTENT_DOMAINS.CODE,
    detect: (q) =>
      classifyCodeIntent(q) !== null ||
      (hasCodeContext(q) && CREATE_RE.test(q)),
  },
  {
    domain: INTENT_DOMAINS.WRITING,
    pattern:
      /\b(rédige|rédiger|redige|dissertation|essai|article|post|email|e-mail|courrier|lettre|reformule|reformuler|résume|résumer|resumer|synthèse|synthese|argumente|argumenter|traduis|traduire)\b/i,
  },
  {
    domain: INTENT_DOMAINS.ANALYSIS,
    pattern:
      /\b(compare|comparer|diagnostique|diagnostiquer|évalue|evalue|evaluer|critique|priorise|prioriser|planifie|planifier|cadrage|stratégie|strategie|matrice|risques?|analyse comparative)\b/i,
  },
];

const ACTION_RULES = [
  {
    action: INTENT_ACTIONS.DEBUG,
    pattern: /\b(debug|débug|bug|ne s'exécute|ne compile)\b/i,
  },
  {
    action: INTENT_ACTIONS.REFACTOR,
    pattern: /\b(refactor|restructur|sans changer le comportement)\b/i,
  },
  {
    action: INTENT_ACTIONS.EXPLAIN,
    pattern:
      /\b(explique|expliquer|comprendre|à quoi sert|comment fonctionne)\b/i,
  },
  {
    action: INTENT_ACTIONS.CORRECT,
    pattern: /\b(corrige|corriger|fix|répare|repare|correctif)\b/i,
  },
  {
    action: INTENT_ACTIONS.AUDIT,
    pattern: /\b(audit|auditer|checklist|conformité|conformite)\b/i,
  },
  {
    action: INTENT_ACTIONS.REVIEW,
    pattern: /\b(revue|review|analyse du code|inspecte)\b/i,
  },
  {
    action: INTENT_ACTIONS.SUMMARIZE,
    pattern: /\b(résume|résumer|resumer|synthèse|synthese|synthétise)\b/i,
  },
  {
    action: INTENT_ACTIONS.COMPARE,
    pattern: /\b(compare|comparer|versus|vs\.?|différences?)\b/i,
  },
  {
    action: INTENT_ACTIONS.PLAN,
    pattern: /\b(planifie|planifier|roadmap|cadrage|stratégie|strategie)\b/i,
  },
  {
    action: INTENT_ACTIONS.TRANSLATE,
    pattern: /\b(traduis|traduire|translation)\b/i,
  },
  {
    action: INTENT_ACTIONS.CONVERT,
    pattern: /\b(convertis|convertir|transforme en slides|document →)\b/i,
  },
  {
    action: INTENT_ACTIONS.STRUCTURE,
    pattern: /\b(structure|structurer|plan détaillé|plan detaille)\b/i,
  },
  {
    action: INTENT_ACTIONS.ARGUE,
    pattern: /\b(argumente|argumenter|dissertation|thèse|these)\b/i,
  },
  {
    action: INTENT_ACTIONS.DIAGNOSE,
    pattern: /\b(diagnostique|diagnostiquer|cause racine)\b/i,
  },
  {
    action: INTENT_ACTIONS.EVALUATE,
    pattern: /\b(évalue|evalue|evaluer|critique|noter)\b/i,
  },
  {
    action: INTENT_ACTIONS.SECURE,
    pattern: /\b(sécurise|securise|durcir|hardening)\b/i,
  },
  {
    action: INTENT_ACTIONS.TEST,
    pattern: /\b(teste|tester|tests unitaires|couverture)\b/i,
  },
  { action: INTENT_ACTIONS.MIGRATE, pattern: /\b(migre|migrer|migration)\b/i },
  {
    action: INTENT_ACTIONS.GENERATE,
    pattern: /\b(generer|générer|genere|produis|produire)\b/i,
  },
  { action: INTENT_ACTIONS.CREATE, pattern: CREATE_RE },
];

const DELIVERABLE_RULES = [
  {
    deliverable: DELIVERABLE_TYPES.HTML,
    pattern: /\b(html|page web|landing|fichier html|\.html)\b/i,
  },
  { deliverable: DELIVERABLE_TYPES.CV, pattern: /\b(cv|curriculum vitae)\b/i },
  {
    deliverable: DELIVERABLE_TYPES.PPT_SLIDES,
    pattern: /\b(powerpoint|pptx?|slides?|deck|présentation|presentation)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.POLICY_RULES,
    pattern: /\b(règles?|regles?|politique|charte|conformité|conformite)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.ESSAY,
    pattern: /\b(dissertation|essai|mémoire|memoire)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.EMAIL,
    pattern: /\b(email|e-mail|courriel|mail)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.LETTER,
    pattern: /\b(lettre de motivation|courrier)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.PROCEDURE,
    pattern: /\b(procédure|procedure|playbook|pas à pas)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.DOC_REPORT,
    pattern: /\b(rapport|compte rendu|compte-rendu)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.SPREADSHEET,
    pattern: /\b(tableau|excel|csv|spreadsheet)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.CHECKLIST,
    pattern: /\b(checklist|liste de contrôle|liste de controle)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.COMPONENT,
    pattern: /\b(composant|component|widget|module react|module vue)\b/i,
  },
  {
    deliverable: DELIVERABLE_TYPES.CODE_SNIPPET,
    pattern: /\b(code|script|snippet|fonction|classe)\b/i,
  },
];

const DOMAIN_DEFAULT_ACTION = Object.freeze({
  [INTENT_DOMAINS.CODE]: INTENT_ACTIONS.REVIEW,
  [INTENT_DOMAINS.WRITING]: INTENT_ACTIONS.CREATE,
  [INTENT_DOMAINS.DOCUMENT]: INTENT_ACTIONS.CREATE,
  [INTENT_DOMAINS.PRESENTATION]: INTENT_ACTIONS.CREATE,
  [INTENT_DOMAINS.WEB_HTML]: INTENT_ACTIONS.CREATE,
  [INTENT_DOMAINS.DATA]: INTENT_ACTIONS.STRUCTURE,
  [INTENT_DOMAINS.ANALYSIS]: INTENT_ACTIONS.EVALUATE,
  [INTENT_DOMAINS.SECURITY_POLICY]: INTENT_ACTIONS.CREATE,
  [INTENT_DOMAINS.SOCIAL]: INTENT_ACTIONS.SOCIAL_CHECKIN,
  [INTENT_DOMAINS.GENERAL]: INTENT_ACTIONS.EXPLAIN,
});

const DOMAIN_DEFAULT_DELIVERABLE = Object.freeze({
  [INTENT_DOMAINS.CODE]: DELIVERABLE_TYPES.CODE_SNIPPET,
  [INTENT_DOMAINS.WRITING]: DELIVERABLE_TYPES.PLAIN_ANSWER,
  [INTENT_DOMAINS.DOCUMENT]: DELIVERABLE_TYPES.DOC_REPORT,
  [INTENT_DOMAINS.PRESENTATION]: DELIVERABLE_TYPES.PPT_SLIDES,
  [INTENT_DOMAINS.WEB_HTML]: DELIVERABLE_TYPES.HTML,
  [INTENT_DOMAINS.DATA]: DELIVERABLE_TYPES.SPREADSHEET,
  [INTENT_DOMAINS.ANALYSIS]: DELIVERABLE_TYPES.PLAIN_ANSWER,
  [INTENT_DOMAINS.SECURITY_POLICY]: DELIVERABLE_TYPES.POLICY_RULES,
  [INTENT_DOMAINS.SOCIAL]: DELIVERABLE_TYPES.PLAIN_ANSWER,
  [INTENT_DOMAINS.GENERAL]: DELIVERABLE_TYPES.PLAIN_ANSWER,
});

/**
 * @param {string} query
 * @returns {string}
 */
export function resolveIntentDomain(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return INTENT_DOMAINS.GENERAL;

  if (isCodeConceptExplainRequest(query)) {
    return INTENT_DOMAINS.CODE;
  }

  if (isExistingSourceAnalysisRequest(query)) {
    return INTENT_DOMAINS.ANALYSIS;
  }

  if (isRepoAnalysisRequest(query)) {
    return INTENT_DOMAINS.ANALYSIS;
  }

  if (suppressesBuildIntentForTechnicalLearning(query)) {
    return INTENT_DOMAINS.GENERAL;
  }

  if (isLearningRequestWithTarget(query)) {
    return INTENT_DOMAINS.GENERAL;
  }

  for (const rule of DOMAIN_RULES) {
    if (rule.domain === INTENT_DOMAINS.WEB_HTML) {
      if (isHtmlProjectDeliverable(query)) return rule.domain;
      continue;
    }
    if (rule.detect?.(q)) return rule.domain;
    if (rule.pattern?.test(q)) return rule.domain;
  }

  return INTENT_DOMAINS.GENERAL;
}

/**
 * @param {string} query
 * @param {string} domain
 * @returns {string}
 */
export function resolveIntentAction(
  query = "",
  domain = INTENT_DOMAINS.GENERAL,
) {
  const q = normalizeFamiliarityQuery(query);

  if (isUiNavigationRestructureFeedback(query)) {
    return INTENT_ACTIONS.EVALUATE;
  }

  if (suppressesBuildIntentForTechnicalLearning(query)) {
    return INTENT_ACTIONS.PLAN;
  }

  if (isLearningRequestWithTarget(query)) {
    return INTENT_ACTIONS.PLAN;
  }

  if (isExistingSourceAnalysisRequest(query) || isRepoAnalysisRequest(query) || domain === INTENT_DOMAINS.ANALYSIS) {
    if (!isUiNavigationRestructureFeedback(query) && /\b(?:audit|audite)\b/i.test(q)) {
      return INTENT_ACTIONS.AUDIT;
    }
    if (/\b(?:r[eé]sume|summar)/i.test(q)) return INTENT_ACTIONS.SUMMARIZE;
    if (/\b(?:explique|explain)\b/i.test(q)) return INTENT_ACTIONS.EXPLAIN;
    return INTENT_ACTIONS.REVIEW;
  }

  if (domain === INTENT_DOMAINS.CODE) {
    const codeIntent = classifyCodeIntent(q);
    if (codeIntent?.kind && CODE_KIND_TO_ACTION[codeIntent.kind]) {
      return CODE_KIND_TO_ACTION[codeIntent.kind];
    }
  }

  for (const rule of ACTION_RULES) {
    if (rule.action === INTENT_ACTIONS.AUDIT && isUiNavigationRestructureFeedback(query)) {
      continue;
    }
    if (rule.pattern.test(q)) return rule.action;
  }

  return DOMAIN_DEFAULT_ACTION[domain] || INTENT_ACTIONS.EXPLAIN;
}

/**
 * @param {string} query
 * @param {string} domain
 * @returns {string}
 */
export function resolveDeliverableType(
  query = "",
  domain = INTENT_DOMAINS.GENERAL,
) {
  const q = normalizeFamiliarityQuery(query);

  if (suppressesBuildIntentForTechnicalLearning(query)) {
    return DELIVERABLE_TYPES.PLAIN_ANSWER;
  }

  // Tableau pédagogique sciences → réponse structurée, pas livrable spreadsheet
  if (isPedagogicalStructuredExplainRequest(query)) {
    return DELIVERABLE_TYPES.PLAIN_ANSWER;
  }

  if (domain === INTENT_DOMAINS.WEB_HTML && isHtmlProjectDeliverable(q)) {
    return DELIVERABLE_TYPES.HTML;
  }

  for (const rule of DELIVERABLE_RULES) {
    if (rule.pattern.test(q)) return rule.deliverable;
  }

  return DOMAIN_DEFAULT_DELIVERABLE[domain] || DELIVERABLE_TYPES.PLAIN_ANSWER;
}

/**
 * @param {string} query
 * @param {string} domain
 * @param {string} deliverable
 */
function pickClarificationQuestions(query, domain, deliverable) {
  const questions = [];

  if (domain === INTENT_DOMAINS.GENERAL) {
    questions.push(
      "Ton objectif principal (informer, créer un livrable, corriger, analyser) ?",
    );
    questions.push(
      "Le format que tu attends (une réponse courte, un document, du code, une présentation en slides) ?",
    );
    return questions.slice(0, 3);
  }

  if (
    domain === INTENT_DOMAINS.DOCUMENT &&
    deliverable === DELIVERABLE_TYPES.CV
  ) {
    questions.push(
      "Quel profil cible (métier, séniorité) et quel ton (sobre, moderne, créatif) ?",
    );
    questions.push(
      "Sections obligatoires (expériences, compétences, formation) ?",
    );
  } else if (domain === INTENT_DOMAINS.PRESENTATION) {
    questions.push("Public et durée de la présentation (5, 10 ou 20 min) ?");
    questions.push("Nombre de slides souhaité et message clé ?");
  } else if (domain === INTENT_DOMAINS.WRITING) {
    questions.push("Sujet, longueur cible et niveau (scolaire, pro, expert) ?");
    questions.push("Ton attendu (neutre, persuasif, pédagogique) ?");
  } else if (domain === INTENT_DOMAINS.SECURITY_POLICY) {
    questions.push(
      "Périmètre (équipe, outil, données) et niveau de criticité ?",
    );
    questions.push("Contraintes réglementaires ou référentiels à respecter ?");
  } else {
    questions.push(
      "Quel livrable exact attends-tu (format, structure, contraintes) ?",
    );
    questions.push("Public cible et niveau de détail ?");
  }

  return questions.slice(0, 5);
}

/**
 * @param {string} query
 * @param {string} domain
 * @param {string} deliverable
 */
function resolveExecutionStrategy(query, domain, deliverable) {
  const q = normalizeFamiliarityQuery(query);

  if (isInformationSeekingWithTarget(q)) {
    return EXECUTION_STRATEGIES.BUILD_V1;
  }

  if (isTranslationPipelineReady(query)) {
    return EXECUTION_STRATEGIES.BUILD_V1;
  }
  if (requiresTranslationClarification(query)) {
    return EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD;
  }

  if (domain === INTENT_DOMAINS.WEB_HTML && isHtmlProjectDeliverable(q)) {
    const htmlEval = evaluateHtmlProjectDelivery(q);
    return htmlEval.strategy;
  }

  if (isSimpleFactualQuestion(q)) {
    return EXECUTION_STRATEGIES.BUILD_V1;
  }

  if (parseFamiliarityQuery(query)) {
    return EXECUTION_STRATEGIES.BUILD_V1;
  }

  if (domain === INTENT_DOMAINS.SOCIAL) {
    return EXECUTION_STRATEGIES.BUILD_V1;
  }

  const hasExplicitSubject =
    hasExecutableSnippet(q) ||
    isInformationSeekingWithTarget(q) ||
    /\b(pour|sur|concernant|à propos|a propos|notion|python|saas|équipe|equipe)\b/i.test(
      q,
    ) ||
    q.length >= JUST_INTENT_THRESHOLDS.partiallyAmbiguousMaxLength;

  const hasExplicitFormat =
    DELIVERABLE_RULES.some(
      (r) => r.deliverable === deliverable && r.pattern.test(q),
    ) || domain !== INTENT_DOMAINS.GENERAL;

  const isVeryVague =
    q.length < JUST_INTENT_THRESHOLDS.veryVagueMaxLength &&
    !hasExplicitSubject &&
    !hasExplicitFormat;

  if (isVeryVague) {
    return EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD;
  }

  const partiallyAmbiguous =
    !hasExplicitSubject &&
    domain === INTENT_DOMAINS.GENERAL &&
    q.length < JUST_INTENT_THRESHOLDS.partiallyAmbiguousMaxLength;

  if (partiallyAmbiguous) {
    const qs = pickClarificationQuestions(q, domain, deliverable);
    if (qs.length >= JUST_INTENT_THRESHOLDS.minClarifyQuestionsForPartial) {
      return EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD;
    }
  }

  if (
    domain === INTENT_DOMAINS.PRESENTATION &&
    CREATE_RE.test(q) &&
    !/\b(slides?|ppt|powerpoint|soutenance|pitch)\b/i.test(q)
  ) {
    return EXECUTION_STRATEGIES.BUILD_WITH_SMART_DEFAULTS;
  }

  if (
    (domain === INTENT_DOMAINS.DOCUMENT || domain === INTENT_DOMAINS.WRITING) &&
    CREATE_RE.test(q) &&
    q.length < JUST_INTENT_THRESHOLDS.partiallyAmbiguousMaxLength &&
    !hasExplicitSubject
  ) {
    return EXECUTION_STRATEGIES.BUILD_WITH_SMART_DEFAULTS;
  }

  return EXECUTION_STRATEGIES.BUILD_V1;
}

/**
 * @param {string} query
 * @returns {{
 *   contract: string,
 *   domain: string,
 *   action: string,
 *   deliverable: string,
 *   strategy: string,
 *   domainLabel: string,
 *   actionLabel: string,
 *   deliverableLabel: string,
 *   clarificationQuestions: string[],
 *   canBuildDirectly: boolean,
 *   confidence: 'high'|'medium'|'low',
 *   signals: string[],
 *   verification: ReturnType<typeof resolveAiVerificationNotice>,
 *   codeIntentKind: string|null,
 *   htmlProfile: string|null,
 * }}
 */
export function evaluateJustIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  const signals = [];

  if (suppressesBuildIntentForTechnicalLearning(query)) {
    signals.push("preempt:technical_learning_path");
  }

  if (isInformationSeekingWithTarget(query)) {
    signals.push("preempt:information_seeking");
  }

  if (isTranslationShell(query)) {
    signals.push("preempt:translation_request");
  }
  if (isTranslationDerivedRequest(query)) {
    signals.push("preempt:translation_followup");
  }
  if (isMultiTargetTranslationRequest(query)) {
    signals.push("preempt:translation_multi_target");
  }

  if (isLearningRequestWithTarget(query)) {
    signals.push("preempt:learning_request");
  }
  if (isLearningRequestForTechnicalDomain(query)) {
    signals.push("preempt:technical_learning_path");
  }

  if (isExistingSourceAnalysisRequest(query)) {
    signals.push("preempt:existing_source_analysis");
  }
  if (isRepoAnalysisRequest(query)) {
    signals.push("preempt:repo_analysis");
  }

  const domain = resolveIntentDomain(query);
  signals.push(`domain:${domain}`);

  const action = resolveIntentAction(q, domain);
  signals.push(`action:${action}`);

  const deliverable = resolveDeliverableType(q, domain);
  signals.push(`deliverable:${deliverable}`);

  const strategy = resolveExecutionStrategy(query, domain, deliverable);
  signals.push(`strategy:${strategy}`);

  const clarificationQuestions =
    strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD
      ? pickClarificationQuestions(q, domain, deliverable)
      : [];

  const codeIntent =
    domain === INTENT_DOMAINS.CODE ? classifyCodeIntent(q) : null;
  const htmlProfile =
    domain === INTENT_DOMAINS.WEB_HTML && isHtmlProjectDeliverable(q)
      ? resolveHtmlProjectProfile(q)
      : null;

  let confidence = "medium";
  if (codeIntent?.confidence === "explicit" || htmlProfile) confidence = "high";
  else if (
    domain === INTENT_DOMAINS.GENERAL &&
    strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD
  ) {
    confidence = "low";
  }

  const verification = resolveAiVerificationNotice({
    domain,
    deliverable,
    action,
    query: q,
  });

  return {
    contract: JUST_INTENT_CONTRACT_ID,
    domain,
    action,
    deliverable,
    strategy,
    domainLabel: getDomainLabel(domain),
    actionLabel: getActionLabel(action),
    deliverableLabel: getDeliverableLabel(deliverable),
    clarificationQuestions,
    canBuildDirectly: strategy !== EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD,
    confidence,
    signals,
    verification,
    codeIntentKind: codeIntent?.kind || null,
    htmlProfile,
  };
}

/**
 * Addon prompt système — intention détectée + stratégie + vérification IA.
 * @param {string} query
 */
export function buildJustIntentAddon(query = "") {
  if (suppressesBuildIntentForTechnicalLearning(query)) {
    return "";
  }

  const evaluation = evaluateJustIntent(query);
  if (
    !evaluation ||
    (evaluation.domain === INTENT_DOMAINS.GENERAL &&
      evaluation.strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD)
  ) {
    return "";
  }

  const lines = [
    "[INTENTION JUSTE — DÉTECTION AUTOMATIQUE]",
    `Domaine : ${evaluation.domainLabel}`,
    `Action : ${evaluation.actionLabel}`,
    `Livrable attendu : ${evaluation.deliverableLabel}`,
    `Stratégie : ${evaluation.strategy}`,
  ];

  if (evaluation.htmlProfile) {
    lines.push(`Profil web : ${evaluation.htmlProfile.replace(/^html_/, "")}`);
  }

  if (evaluation.strategy === EXECUTION_STRATEGIES.BUILD_WITH_SMART_DEFAULTS) {
    lines.push(
      "Applique des défauts intelligents sobres (structure claire, contenu d'exemple réaliste) sans bloquer sur des détails manquants non décisionnels.",
    );
  }

  if (evaluation.strategy === EXECUTION_STRATEGIES.BUILD_V1) {
    lines.push(
      "Le cadrage est suffisant : produis une V1 exploitable directement.",
    );
  }

  if (
    evaluation.verification?.injectInPrompt &&
    evaluation.verification.message
  ) {
    lines.push(`Vérification IA : ${evaluation.verification.message}`);
  }

  return lines.join("\n");
}

/**
 * Message de clarification structuré (remplace le bandeau UI).
 * @param {ReturnType<typeof evaluateJustIntent>} evaluation
 */
export function buildJustIntentClarificationMessage(evaluation = {}, query = "") {
  const qs = evaluation.clarificationQuestions || [];
  if (!qs.length) return "";

  let prefix = "";
  if (evaluation.domain === INTENT_DOMAINS.GENERAL && query) {
    const cleanQuery = query.trim();
    if (cleanQuery.length > 0 && cleanQuery.length < 200) {
      prefix = `Je n'ai pas compris ce que tu entends par "${cleanQuery}".\n`;
    }
  }

  const header = `Il faudrait que tu arrives à préciser :`;
  const body = qs.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return `${prefix}${header}\n${body}\nRéponds en une phrase et je s'occupe de tout, tu s'occupes de rien!!!`;
}

/**
 * Clarification juste intention — délègue à CLARIFICATION_DECISION_V1.
 * @param {string} query
 * @param {ReturnType<typeof evaluateJustIntent>} evaluation
 * @param {{ top_intent?: string, confidence?: string, routing_action?: string }|null} intentTriage
 */
export function shouldApplyJustIntentClarification(
  query = "",
  evaluation = {},
  intentTriage = null,
) {
  return resolveClarificationGate(query, {
    justIntent: evaluation,
    intentTriage,
  }).shouldClarify;
}

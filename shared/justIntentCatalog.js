/**
 * Catalogue partagé — détection d'intention juste (domaine × action × livrable).
 * Source unique pour labels UI, télémétrie et politiques serveur.
 */

export const INTENT_DOMAINS = Object.freeze({
  CODE: "code",
  WRITING: "writing",
  DOCUMENT: "document",
  PRESENTATION: "presentation",
  WEB_HTML: "web_html",
  DATA: "data",
  ANALYSIS: "analysis",
  SECURITY_POLICY: "security_policy",
  SOCIAL: "social",
  /** Observabilité uniquement — routage métier = SC meta, pas JUST. */
  META: "meta",
  GENERAL: "general",
});

export const INTENT_ACTIONS = Object.freeze({
  CREATE: "create",
  CORRECT: "correct",
  REVIEW: "review",
  DEBUG: "debug",
  EXPLAIN: "explain",
  REFACTOR: "refactor",
  AUDIT: "audit",
  SUMMARIZE: "summarize",
  COMPARE: "compare",
  PLAN: "plan",
  TRANSLATE: "translate",
  FORMAT: "format",
  CONVERT: "convert",
  GENERATE: "generate",
  STRUCTURE: "structure",
  ARGUE: "argue",
  SYNTHESIZE: "synthesize",
  DIAGNOSE: "diagnose",
  EVALUATE: "evaluate",
  PRIORITIZE: "prioritize",
  SECURE: "secure",
  TEST: "test",
  DOCUMENT: "document",
  MIGRATE: "migrate",
  COMPLETE: "complete",
  SOCIAL_CHECKIN: "social_checkin",
  /** Observabilité — catalogue / formats de livrables (P6). */
  DELIVERABLE_TYPES: "deliverable_types",
  CAPABILITIES: "capabilities",
});

export const DELIVERABLE_TYPES = Object.freeze({
  PLAIN_ANSWER: "plain_answer",
  HTML: "html",
  DOC_REPORT: "doc_report",
  CV: "cv",
  PPT_SLIDES: "ppt_slides",
  SPREADSHEET: "spreadsheet",
  POLICY_RULES: "policy_rules",
  ESSAY: "essay",
  EMAIL: "email",
  CHECKLIST: "checklist",
  PROCEDURE: "procedure",
  LETTER: "letter",
  CODE_SNIPPET: "code_snippet",
  COMPONENT: "component",
});

export const EXECUTION_STRATEGIES = Object.freeze({
  BUILD_V1: "build_v1",
  BUILD_WITH_SMART_DEFAULTS: "build_with_smart_defaults",
  CLARIFY_THEN_BUILD: "clarify_then_build",
});

export const VERIFICATION_LEVELS = Object.freeze({
  NONE: "none",
  LIGHT: "light",
  EXPLICIT: "explicit",
  SOURCED: "sourced",
});

export const DOMAIN_LABELS = Object.freeze({
  [INTENT_DOMAINS.CODE]: "Code",
  [INTENT_DOMAINS.WRITING]: "Rédaction",
  [INTENT_DOMAINS.DOCUMENT]: "Document professionnel",
  [INTENT_DOMAINS.PRESENTATION]: "Présentation",
  [INTENT_DOMAINS.WEB_HTML]: "Web / HTML",
  [INTENT_DOMAINS.DATA]: "Données",
  [INTENT_DOMAINS.ANALYSIS]: "Analyse / réflexion",
  [INTENT_DOMAINS.SECURITY_POLICY]: "Gouvernance / sécurité",
  [INTENT_DOMAINS.SOCIAL]: "Social / Conversation",
  [INTENT_DOMAINS.META]: "Méta / Capacités",
  [INTENT_DOMAINS.GENERAL]: "Général",
});

export const ACTION_LABELS = Object.freeze({
  [INTENT_ACTIONS.CREATE]: "Créer",
  [INTENT_ACTIONS.CORRECT]: "Corriger",
  [INTENT_ACTIONS.REVIEW]: "Revue",
  [INTENT_ACTIONS.DEBUG]: "Debug",
  [INTENT_ACTIONS.EXPLAIN]: "Expliquer",
  [INTENT_ACTIONS.REFACTOR]: "Refactoriser",
  [INTENT_ACTIONS.AUDIT]: "Auditer",
  [INTENT_ACTIONS.SUMMARIZE]: "Résumer",
  [INTENT_ACTIONS.COMPARE]: "Comparer",
  [INTENT_ACTIONS.PLAN]: "Planifier",
  [INTENT_ACTIONS.TRANSLATE]: "Traduire",
  [INTENT_ACTIONS.FORMAT]: "Mettre en forme",
  [INTENT_ACTIONS.CONVERT]: "Convertir",
  [INTENT_ACTIONS.GENERATE]: "Générer",
  [INTENT_ACTIONS.STRUCTURE]: "Structurer",
  [INTENT_ACTIONS.ARGUE]: "Argumenter",
  [INTENT_ACTIONS.SYNTHESIZE]: "Synthétiser",
  [INTENT_ACTIONS.DIAGNOSE]: "Diagnostiquer",
  [INTENT_ACTIONS.EVALUATE]: "Évaluer",
  [INTENT_ACTIONS.PRIORITIZE]: "Prioriser",
  [INTENT_ACTIONS.SECURE]: "Sécuriser",
  [INTENT_ACTIONS.TEST]: "Tester",
  [INTENT_ACTIONS.DOCUMENT]: "Documenter",
  [INTENT_ACTIONS.MIGRATE]: "Migrer",
  [INTENT_ACTIONS.COMPLETE]: "Compléter",
  [INTENT_ACTIONS.SOCIAL_CHECKIN]: "Social Check-in",
  [INTENT_ACTIONS.DELIVERABLE_TYPES]: "Types de livrables",
  [INTENT_ACTIONS.CAPABILITIES]: "Capacités",
});

export const DELIVERABLE_LABELS = Object.freeze({
  [DELIVERABLE_TYPES.PLAIN_ANSWER]: "Réponse",
  [DELIVERABLE_TYPES.HTML]: "Page HTML",
  [DELIVERABLE_TYPES.DOC_REPORT]: "Rapport",
  [DELIVERABLE_TYPES.CV]: "CV",
  [DELIVERABLE_TYPES.PPT_SLIDES]: "Slides / PowerPoint",
  [DELIVERABLE_TYPES.SPREADSHEET]: "Tableur",
  [DELIVERABLE_TYPES.POLICY_RULES]: "Règles / politique",
  [DELIVERABLE_TYPES.ESSAY]: "Dissertation / essai",
  [DELIVERABLE_TYPES.EMAIL]: "E-mail",
  [DELIVERABLE_TYPES.CHECKLIST]: "Checklist",
  [DELIVERABLE_TYPES.PROCEDURE]: "Procédure",
  [DELIVERABLE_TYPES.LETTER]: "Lettre",
  [DELIVERABLE_TYPES.CODE_SNIPPET]: "Code",
  [DELIVERABLE_TYPES.COMPONENT]: "Composant UI",
});

/** Mapping kind codeIntentPolicy → action juste */
export const CODE_KIND_TO_ACTION = Object.freeze({
  code_review: INTENT_ACTIONS.REVIEW,
  code_debug: INTENT_ACTIONS.DEBUG,
  code_correction: INTENT_ACTIONS.CORRECT,
  code_audit: INTENT_ACTIONS.AUDIT,
  code_explain: INTENT_ACTIONS.EXPLAIN,
  code_refactor: INTENT_ACTIONS.REFACTOR,
});

export function getDomainLabel(domain) {
  return DOMAIN_LABELS[domain] || domain || "Général";
}

export function getActionLabel(action) {
  return ACTION_LABELS[action] || action || "—";
}

export function getDeliverableLabel(deliverable) {
  return DELIVERABLE_LABELS[deliverable] || deliverable || "Réponse";
}

export function formatJustIntentSummary(evaluation = {}) {
  const parts = [
    getDomainLabel(evaluation.domain),
    getActionLabel(evaluation.action),
    getDeliverableLabel(evaluation.deliverable),
  ].filter(Boolean);
  return parts.join(" · ");
}

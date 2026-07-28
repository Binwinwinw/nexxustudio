/**
 * Composer — parcours d'apprentissage technique (plan / fiches, local generative).
 */
import {
  isTechnicalLearningPathRequest,
  isJvmJavaScriptHybridLearningTopic,
  parseTechnicalLearningPath,
} from "../../utils/technicalLearningPathIntentGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";
import {
  isCssLearningTopic,
  resolveTechnicalLearningBlueprint,
} from "./technicalLearningBlueprints.js";

export { isCssLearningTopic } from "./technicalLearningBlueprints.js";
export {
  TECHNICAL_LEARNING_BLUEPRINTS,
  TECHNICAL_LEARNING_BLUEPRINT_BY_ID,
  normalizeTechnicalLearningTarget,
  resolveTechnicalLearningBlueprint,
  hasDedicatedTechnicalLearningBlueprint,
} from "./technicalLearningBlueprints.js";

export const TECHNICAL_LEARNING_PATH_COMPOSER_RULE =
  "technical_learning_path_local_generative";

const GOAL_LABELS = {
  mastery: "maîtrise du sujet",
  learn: "apprentissage structuré",
  refresh: "remise à niveau",
  unknown: "objectif d'étude",
};

const DELIVERABLE_LABELS = {
  knowledge_sheets: "fiches de révision",
  flashcards: "flashcards / cartes mémoire",
  roadmap: "roadmap par phases",
  mixed: "plan mixte (fiches + progression)",
};

const GOAL_VERBS = {
  mastery: "maîtriser",
  learn: "apprendre",
  refresh: "réviser",
  unknown: "progresser sur",
};

export const TECHNICAL_LEARNING_PATH_PRESENTATION_V1 =
  "technical_learning_path_presentation_v1";

export const MAX_SELF_CHECK_QUESTIONS_PER_MODULE = 2;
export const MAX_MODULE_RESOURCE_LINKS = 1;
export const DEFAULT_MODULE_RESOURCE_SECTION_LABEL = "Ressource officielle";

/**
 * @param {unknown} raw
 * @returns {{ url: string, title: string, sectionLabel: string }|null}
 */
export function normalizeModuleResourceLink(raw) {
  if (!raw || typeof raw !== "object") return null;

  const url = String(/** @type {{ url?: string }} */ (raw).url || "").trim();
  if (!/^https:\/\//i.test(url)) return null;

  const title = String(
    /** @type {{ title?: string, label?: string }} */ (raw).title ||
      /** @type {{ label?: string }} */ (raw).label ||
      "",
  ).trim();

  const sectionLabel = String(
    /** @type {{ sectionLabel?: string }} */ (raw).sectionLabel ||
      DEFAULT_MODULE_RESOURCE_SECTION_LABEL,
  ).trim();

  return {
    url,
    title: title || url,
    sectionLabel: sectionLabel || DEFAULT_MODULE_RESOURCE_SECTION_LABEL,
  };
}

/** @type {Record<string, RegExp>} */
export const TECHNICAL_LEARNING_PRESENTATION_MARKERS = Object.freeze({
  intro: /Tu veux \*\*(?:maîtriser|apprendre|réviser|progresser sur)/i,
  overview: /\*\*En bref\*\*/i,
  moduleHeader: /^## Module \d+ —/m,
  objective: /\*\*Objectif\*\*/i,
  retain: /\*\*À retenir\*\*/i,
  practice: /\*\*Fiche pratique\*\*/i,
  selfCheck: /\*\*Auto-vérification\*\*/i,
  outro: /\*\*Comment avancer\*\*/i,
  bannedMeta: /Plan local structuré/i,
});

/**
 * @param {string} text
 * @returns {boolean}
 */
export function meetsTechnicalLearningPathPresentationContract(text = "") {
  const body = String(text || "");
  if (!body.trim()) return false;
  return (
    TECHNICAL_LEARNING_PRESENTATION_MARKERS.intro.test(body) &&
    TECHNICAL_LEARNING_PRESENTATION_MARKERS.overview.test(body) &&
    TECHNICAL_LEARNING_PRESENTATION_MARKERS.objective.test(body) &&
    TECHNICAL_LEARNING_PRESENTATION_MARKERS.selfCheck.test(body) &&
    TECHNICAL_LEARNING_PRESENTATION_MARKERS.outro.test(body) &&
    !TECHNICAL_LEARNING_PRESENTATION_MARKERS.bannedMeta.test(body)
  );
}

/**
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null} slots
 * @param {string} domainLabel
 * @param {number} moduleCount
 * @returns {string}
 */
function buildTechnicalLearningPathIntro(slots, domainLabel, moduleCount) {
  const deliverable =
    DELIVERABLE_LABELS[slots?.deliverable || ""] ||
    DELIVERABLE_LABELS.knowledge_sheets;
  const goalVerb =
    GOAL_VERBS[slots?.goal || ""] || GOAL_VERBS.unknown;

  return `Tu veux **${goalVerb} ${domainLabel}** avec des **${deliverable}**. Voici un parcours en **${moduleCount} modules**, du socle à la pratique — une fiche par module, à valider avant de passer au suivant.`;
}

/**
 * @param {import("./technicalLearningBlueprints.js").LearningModule} mod
 * @param {number} index
 * @returns {string[]}
 */
function formatTechnicalLearningModuleBlock(mod, index) {
  const lines = [
    `## Module ${index + 1} — ${mod.title}`,
    "",
    "**Objectif**",
    mod.objective,
    "",
    "**À retenir**",
    mod.concepts,
    "",
    "**Fiche pratique**",
    mod.practice,
    "",
    "**Auto-vérification**",
    mod.mastery,
  ];

  const questions = (mod.selfCheckQuestions || [])
    .map((q) => String(q || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SELF_CHECK_QUESTIONS_PER_MODULE);

  if (questions.length > 0) {
    lines.push("", "**Pour te tester**");
    questions.forEach((question, qIndex) => {
      lines.push(`${qIndex + 1}. ${question}`);
    });
  }

  const resourceLink = normalizeModuleResourceLink(mod.resourceLink);
  if (resourceLink) {
    lines.push(
      "",
      `**${resourceLink.sectionLabel}**`,
      `- [${resourceLink.title}](${resourceLink.url})`,
    );
  }

  lines.push("");
  return lines;
}

/**
 * Présentation canonique — lisible humain, alignée doc § forme de réponse.
 * @param {{
 *   slots?: import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null,
 *   domainLabel: string,
 *   modules: import("./technicalLearningBlueprints.js").LearningModule[],
 *   reframeNote?: string|null,
 * }} params
 * @returns {string}
 */
export function formatTechnicalLearningPathPresentation({
  slots = null,
  domainLabel,
  modules,
  reframeNote = null,
} = {}) {
  const safeModules = Array.isArray(modules) ? modules : [];
  const lines = [
    buildTechnicalLearningPathIntro(slots, domainLabel, safeModules.length),
    "",
  ];

  if (reframeNote) {
    lines.push(`> ${reframeNote}`, "");
  }

  lines.push("**En bref**", "");
  safeModules.forEach((mod, index) => {
    lines.push(`${index + 1}. **${mod.title}** — ${mod.objective}`);
  });
  lines.push("", "---", "");

  safeModules.forEach((mod, index) => {
    lines.push(...formatTechnicalLearningModuleBlock(mod, index));
    if (index < safeModules.length - 1) {
      lines.push("---", "");
    }
  });

  lines.push(
    "---",
    "",
    "**Comment avancer**",
    "Commence par le module 1. Rédige ta fiche, puis vérifie le critère d'auto-vérification, les mini-questions et la ressource officielle si présentes. Si un point bloque, demande le détail de ce module ou un exercice ciblé.",
  );

  return lines.join("\n");
}

/** @type {import("./technicalLearningBlueprints.js").LearningModule[]} */
const GENERIC_LEARNING_MODULES = (domainLabel = "le domaine visé") => [
  {
    title: "Socle et vocabulaire",
    objective: `Poser les bases de ${domainLabel}.`,
    concepts: "définitions, cartographie du sujet, prérequis",
    practice: "fiche glossaire + schéma mental",
    mastery: "Je peux expliquer le sujet à un pair junior",
  },
  {
    title: "Mécanismes clés",
    objective: "Comprendre le fonctionnement interne utile au quotidien.",
    concepts: "flux, composants, invariants",
    practice: "3 exercices guidés progressifs",
    mastery: "Je prédits le comportement dans des cas standard",
  },
  {
    title: "Pratique et pièges",
    objective: "Consolider par la pratique et éviter les erreurs classiques.",
    concepts: "patterns, anti-patterns, debugging ciblé",
    practice: "mini-projet ou kata court",
    mastery: "Je corrige un cas réel sans aide extérieure",
  },
  {
    title: "Approfondissement ciblé",
    objective: "Aller plus loin selon ton objectif (perf, architecture, ops…).",
    concepts: "trade-offs, limites, écosystème adjacent",
    practice: "fiche « quand passer au niveau suivant »",
    mastery: "Je sais ce que je ne sais pas encore et quoi apprendre ensuite",
  },
];

/**
 * @param {string} query
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null} [slots]
 * @returns {string}
 */
function resolveTechnicalLearningDisplayLabel(query = "", slots = null) {
  const blueprint = resolveTechnicalLearningBlueprint(query, slots);
  if (blueprint) return blueprint.displayLabel;
  return (
    slots?.domainLabel ||
    slots?.domain ||
    parseTechnicalLearningPath(query)?.domainLabel ||
    "le domaine visé"
  );
}

/**
 * Fallback local structuré — plan de fiches si le LLM simpleFast échoue ou répond vide.
 * @param {string} query
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null} [slots]
 * @returns {string|null}
 */
export function buildTechnicalLearningPathOutlineFallback(query = "", slots = null) {
  const resolved = slots || parseTechnicalLearningPath(query);
  if (!resolved && !isTechnicalLearningPathRequest(query)) return null;

  const blueprint = resolveTechnicalLearningBlueprint(query, resolved);
  const domainLabel = resolveTechnicalLearningDisplayLabel(query, resolved);
  const modules = blueprint?.modules || GENERIC_LEARNING_MODULES(domainLabel);

  return formatTechnicalLearningPathPresentation({
    slots: resolved,
    domainLabel,
    modules,
    reframeNote: blueprint?.reframeNote ?? null,
  });
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveTechnicalLearningPathLocalFallback(query = "") {
  if (!isTechnicalLearningPathRequest(query)) return null;
  return buildTechnicalLearningPathOutlineFallback(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveCssLearningPathLocalFallback(query = "") {
  if (!isTechnicalLearningPathRequest(query)) return null;
  const slots = parseTechnicalLearningPath(query);
  if (!isCssLearningTopic(query, slots)) return null;
  return buildTechnicalLearningPathOutlineFallback(query, slots);
}

/**
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots} slots
 * @returns {string}
 */
export function buildTechnicalLearningPathSystemAddonFromSlots(slots) {
  const blueprint = resolveTechnicalLearningBlueprint("", slots);
  const reframed = isJvmJavaScriptHybridLearningTopic("", slots);
  const displayLabel = blueprint?.displayLabel
    || slots.domainLabel
    || slots.domain
    || "le domaine visé";

  const parts = [
    displayLabel,
    slots.targetStack && !reframed ? `stack / contexte : ${slots.targetStack}` : null,
    GOAL_LABELS[slots.goal] || GOAL_LABELS.unknown,
    DELIVERABLE_LABELS[slots.deliverable] || DELIVERABLE_LABELS.mixed,
    slots.depth === "deep"
      ? "profidence avancée"
      : slots.depth === "intro"
        ? "niveau introductif"
        : "niveau intermédiaire",
  ].filter(Boolean);

  return [
    "VARIANTE APPRENTISSAGE TECHNIQUE (plan / fiches, pas aperçu ponctuel) :",
    `- Cible : **${parts.join(" · ")}**.`,
    reframed
      ? "- RECADRAGE OBLIGATOIRE : la demande mélange JVM et JavaScript — reformuler le sujet en « JavaScript sur la JVM (GraalVM / héritage Nashorn) » avant le plan."
      : null,
    blueprint
      ? `- BLUEPRINT DÉDIÉ : utiliser le plan canonique **${blueprint.displayLabel}** (${blueprint.modules.length} modules).`
      : null,
    "STYLE DE PRÉSENTATION (obligatoire si génération LLM) :",
    "- Commencer par reformuler la demande en une phrase simple (« Tu veux maîtriser X avec des fiches… »).",
    "- Ajouter un bloc **En bref** : liste numérotée titre + objectif par module.",
    "- Détailler chaque module avec : **Objectif**, **À retenir**, **Fiche pratique**, **Auto-vérification**.",
    "- Terminer par **Comment avancer** (commencer module 1, valider, demander détail si blocage).",
    "- Ton pédagogique pour quelqu'un qui révise — pas de jargon interne (« plan local », « merge », etc.).",
    "FORMAT OBLIGATOIRE :",
    "1) Reformuler l'objectif d'étude et le livrable attendu (fiches, roadmap…).",
    "2) Proposer un plan ordonné en 4 à 8 modules/thèmes (du socle à l'avancé).",
    "3) Pour chaque module : objectif, concepts clés, pratique suggérée, critère « je maîtrise ».",
    "4) Indiquer pièges courants et ordre de lecture/exercices recommandé.",
    blueprint?.llmAddonLine ?? null,
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » si le domaine est identifiable.`,
    "- Aperçu conceptuel unique « c'est quoi X » — ce n'est PAS un technical_overview.",
    "- Tutoriel install/config/deploy — rester sur la progression de connaissances.",
    "- Parcours métier / reconversion — ce n'est PAS career_learning_path sauf objectif emploi explicite.",
    "- Réponse tronquée à 2 phrases ou liste de buzzwords sans séquence.",
    "- Plan générique « socle / mécanismes clés » si un blueprint dédié existe pour la stack.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildTechnicalLearningPathSystemAddon(query = "") {
  const slots = parseTechnicalLearningPath(query);
  if (slots) return buildTechnicalLearningPathSystemAddonFromSlots(slots);
  return buildTechnicalLearningPathSystemAddonFromSlots({
    intent: "technical_learning_path",
    domain: null,
    domainLabel: "le domaine visé",
    targetStack: null,
    goal: "unknown",
    deliverable: "mixed",
    depth: "standard",
    horizon: "unknown",
    confidence: "low",
  });
}

/**
 * @param {string} query
 * @returns {{ path: string, reply?: string, deferToLlm?: boolean, reflectiveHint?: string, technicalLearningPath: boolean, slots?: import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots }|null}
 */
export function resolveTechnicalLearningPathShortCircuit(query = "") {
  if (!isTechnicalLearningPathRequest(query)) return null;

  const slots = parseTechnicalLearningPath(query);
  const reply = buildTechnicalLearningPathOutlineFallback(query, slots);

  if (reply) {
    return {
      path: "technical_learning_path",
      reply,
      technicalLearningPath: true,
      slots,
    };
  }

  return {
    path: "technical_learning_path",
    deferToLlm: true,
    reflectiveHint: buildTechnicalLearningPathSystemAddon(query),
    technicalLearningPath: true,
    slots,
  };
}

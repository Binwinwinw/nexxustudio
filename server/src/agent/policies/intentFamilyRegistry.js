/**
 * Registre gouverné des familles d'intent v1 — source de vérité exécutable.
 *
 * Doctrine : intent → slots → coverage decision → delivery mode
 * Philosophie (famille vs couloir vs blueprint) : docs/agents/intent-families-philosophy.md
 * Ce registre documente et teste les familles lots 6–12 ; il ne remplace pas
 * les guards/composers existants, il les référence et les ordonne.
 */
import { isBeginnerTopicOverviewRequest } from "../utils/beginnerTopicOverviewIntentGuards.js";
import { isCareerLearningPathRequest } from "../utils/careerLearningPathIntentGuards.js";
import { isTechnicalLearningPathRequest } from "../utils/technicalLearningPathIntentGuards.js";
import { isTechnicalOverviewRequest } from "../utils/technicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "../utils/debugDiagnosticIntentGuards.js";
import { isCompareChooseRequest } from "../utils/compareChooseIntentGuards.js";
import { isAdminProcedureRequest } from "../utils/adminProcedureIntentGuards.js";
import { isPedagogicalOverviewRequest } from "../utils/pedagogicalOverviewIntentGuards.js";

export const INTENT_FAMILY_REGISTRY_V1 = "intent_family_registry_v1";

export const FAMILY_DELIVERY_MODES = Object.freeze({
  LOCAL_GENERATIVE: "local_generative",
  LOCAL_DETERMINISTIC: "local_deterministic",
  FULL_PIPELINE: "full_pipeline",
  WEB_RAG_GROUNDED: "web_rag_grounded",
});

export const FAMILY_FALLBACK_POLICIES = Object.freeze({
  SIMPLE_FAST_RETRY: "simple_fast_retry_message",
  FULL_PIPELINE_ORCHESTRATOR: "full_pipeline_orchestrator",
  LOCAL_KB_REPLY: "local_kb_reply",
});

/**
 * Ordre short-circuit v1 (extrait familles gouvernées — après familiarité sociale).
 * @type {readonly string[]}
 */
export const INTENT_FAMILY_SHORT_CIRCUIT_ORDER_V1 = Object.freeze([
  "beginner_topic_overview",
  "career_learning_path",
  "technical_learning_path",
  "technical_overview",
  "debug_diagnostic",
  "compare_choose",
  "admin_procedure",
  "pedagogical_overview",
]);

/**
 * @typedef {Object} CanonicalRoutingCase
 * @property {string} query
 * @property {string} expectedPath
 * @property {string} [label]
 */

/**
 * @typedef {Object} IntentFamilyEntry
 * @property {string} id
 * @property {string} promise
 * @property {string[]} slots
 * @property {string} deliveryMode
 * @property {number} shortCircuitOrder
 * @property {string} shortCircuitPath
 * @property {string[]} [allowedPaths]
 * @property {string[]} mustInclude
 * @property {string[]} mustExclude
 * @property {string} fallbackPolicy
 * @property {boolean} deferToFullPipeline
 * @property {boolean} preferWebResearch
 * @property {(query: string) => boolean} detect
 * @property {string} guardModule
 * @property {string} composerModule
 * @property {CanonicalRoutingCase[]} canonicalQueries
 */

/** @type {IntentFamilyEntry[]} */
export const INTENT_FAMILIES_V1 = [
  {
    id: "beginner_topic_overview",
    promise:
      "Initiation hobby / découverte hors curriculum scolaire — notions de base et prudence.",
    slots: ["topic", "topicLabel"],
    deliveryMode: FAMILY_DELIVERY_MODES.LOCAL_GENERATIVE,
    shortCircuitOrder: 10,
    shortCircuitPath: "beginner_topic_overview",
    mustInclude: ["débutant", "se lancer", "par où commencer", "initiation"],
    mustExclude: ["6e", "élève", "devenir", "reconversion", "maîtriser la"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.SIMPLE_FAST_RETRY,
    deferToFullPipeline: false,
    preferWebResearch: false,
    detect: isBeginnerTopicOverviewRequest,
    guardModule: "utils/beginnerTopicOverviewIntentGuards.js",
    composerModule: "micro/replies/beginnerTopicOverviewComposer.js",
    canonicalQueries: [
      {
        label: "débutant crypto",
        query:
          "que doit apprendre un débutant qui veut se lancer dans la cryptomonnaie",
        expectedPath: "beginner_topic_overview",
      },
    ],
  },
  {
    id: "career_learning_path",
    promise:
      "Trajectoire métier / reconversion — phases, compétences, employabilité.",
    slots: [
      "targetRole",
      "targetRoleLabel",
      "experienceLevel",
      "horizon",
      "domain",
      "scope",
    ],
    deliveryMode: FAMILY_DELIVERY_MODES.LOCAL_GENERATIVE,
    shortCircuitOrder: 20,
    shortCircuitPath: "career_learning_path",
    mustInclude: ["devenir", "reconversion", "parcours pour", "métier", "carrière"],
    mustExclude: ["6e", "fractions", "explique Redis", "crash", "vs"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.SIMPLE_FAST_RETRY,
    deferToFullPipeline: false,
    preferWebResearch: false,
    detect: isCareerLearningPathRequest,
    guardModule: "utils/careerLearningPathIntentGuards.js",
    composerModule: "micro/replies/careerLearningPathComposer.js",
    canonicalQueries: [
      {
        label: "devenir développeur",
        query: "comment devenir développeur web en reconversion",
        expectedPath: "career_learning_path",
      },
    ],
  },
  {
    id: "technical_learning_path",
    promise:
      "Apprentissage technique structuré — plan / fiches pour maîtriser un domaine.",
    slots: [
      "domain",
      "domainLabel",
      "targetStack",
      "goal",
      "deliverable",
      "depth",
      "horizon",
    ],
    deliveryMode: FAMILY_DELIVERY_MODES.LOCAL_GENERATIVE,
    shortCircuitOrder: 25,
    shortCircuitPath: "technical_learning_path",
    mustInclude: [
      "maîtriser",
      "apprendre",
      "fiches de connaissance",
      "plan d'apprentissage",
      "roadmap pour apprendre",
    ],
    mustExclude: ["devenir", "explique", "c'est quoi", "crash", "vs Memcached"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.SIMPLE_FAST_RETRY,
    deferToFullPipeline: false,
    preferWebResearch: false,
    detect: isTechnicalLearningPathRequest,
    guardModule: "utils/technicalLearningPathIntentGuards.js",
    composerModule: "micro/replies/technicalLearningPathComposer.js",
    canonicalQueries: [
      {
        label: "fiches JVM+JS (reformulation)",
        query:
          "je veux créer des fiches de connaissances afin maitriser la jvm pour javascript",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches JSX (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser le jsx et ses regles",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches CSS (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser le css et ses regles",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches HTML (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser le html",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches JavaScript (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser javascript",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches Tailwind (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser tailwind",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches Python (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser python",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches TypeScript (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser typescript",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches React (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser react",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches SQL (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser sql",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches Docker (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser docker",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches Git (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser git",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches Node.js (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser nodejs",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches Express (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser express",
        expectedPath: "technical_learning_path",
      },
      {
        label: "fiches Fastify (plan standard)",
        query:
          "je veux créer des fiches de connaissances afin maitriser fastify",
        expectedPath: "technical_learning_path",
      },
    ],
  },
  {
    id: "technical_overview",
    promise:
      "Compréhension conceptuelle d'une techno — définition, mécanismes, limites (pas debug, pas how-to).",
    slots: ["tech", "techLabel", "scope", "audience"],
    deliveryMode: FAMILY_DELIVERY_MODES.LOCAL_GENERATIVE,
    shortCircuitOrder: 30,
    shortCircuitPath: "technical_overview",
    mustInclude: ["explique", "c'est quoi", "comment fonctionne", "bases de"],
    mustExclude: ["crash", "erreur", "vs", "maîtriser", "fiches", "devenir"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.SIMPLE_FAST_RETRY,
    deferToFullPipeline: false,
    preferWebResearch: false,
    detect: isTechnicalOverviewRequest,
    guardModule: "utils/technicalOverviewIntentGuards.js",
    composerModule: "micro/replies/technicalOverviewComposer.js",
    canonicalQueries: [
      {
        label: "explique Redis",
        query: "explique Redis",
        expectedPath: "technical_overview",
      },
    ],
  },
  {
    id: "debug_diagnostic",
    promise:
      "Incident technique — symptôme, causes probables, vérifications, infos manquantes.",
    slots: [
      "symptom",
      "component",
      "componentLabel",
      "context",
      "severity",
      "hasCodeSnippet",
    ],
    deliveryMode: FAMILY_DELIVERY_MODES.LOCAL_GENERATIVE,
    shortCircuitOrder: 40,
    shortCircuitPath: "debug_diagnostic",
    mustInclude: ["erreur", "crash", "ne marche pas", "pourquoi", "502", "ECONNREFUSED"],
    mustExclude: ["explique", "c'est quoi", "vs", "devenir", "6e"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.SIMPLE_FAST_RETRY,
    deferToFullPipeline: false,
    preferWebResearch: false,
    detect: isDebugDiagnosticRequest,
    guardModule: "utils/debugDiagnosticIntentGuards.js",
    composerModule: "micro/replies/debugDiagnosticComposer.js",
    canonicalQueries: [
      {
        label: "Redis crash",
        query: "pourquoi mon Redis crash avec cette erreur ECONNREFUSED",
        expectedPath: "debug_diagnostic",
      },
    ],
  },
  {
    id: "compare_choose",
    promise:
      "Charge décisionnelle — comparer, recommander, trancher avec critère explicite.",
    slots: [
      "primaryTask",
      "tasks",
      "options",
      "criterion",
      "domain",
      "directArbitration",
    ],
    deliveryMode: FAMILY_DELIVERY_MODES.FULL_PIPELINE,
    shortCircuitOrder: 50,
    shortCircuitPath: "compare_choose",
    mustInclude: ["vs", "comparer", "meilleur", "choisir", "recommand"],
    mustExclude: ["explique", "crash", "6e", "déclarer mes impôts"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.FULL_PIPELINE_ORCHESTRATOR,
    deferToFullPipeline: true,
    preferWebResearch: false,
    detect: isCompareChooseRequest,
    guardModule: "utils/compareChooseIntentGuards.js",
    composerModule: "micro/replies/compareChooseComposer.js",
    canonicalQueries: [
      {
        label: "Redis vs Memcached",
        query: "Redis vs Memcached que choisir pour un cache session",
        expectedPath: "compare_choose",
      },
    ],
  },
  {
    id: "admin_procedure",
    promise:
      "Démarche administrative officielle — étapes actionnables, sources institutionnelles.",
    slots: [
      "topic",
      "topicLabel",
      "domain",
      "jurisdiction",
      "freshnessRisk",
      "requiresOfficialSource",
    ],
    deliveryMode: FAMILY_DELIVERY_MODES.WEB_RAG_GROUNDED,
    shortCircuitOrder: 60,
    shortCircuitPath: "admin_procedure",
    mustInclude: ["comment déclarer", "comment obtenir", "démarche", "s'inscrire"],
    mustExclude: ["explique", "c'est quoi la CAF", "Redis", "6e", "devenir dev"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.FULL_PIPELINE_ORCHESTRATOR,
    deferToFullPipeline: true,
    preferWebResearch: true,
    detect: isAdminProcedureRequest,
    guardModule: "utils/adminProcedureIntentGuards.js",
    composerModule: "micro/replies/adminProcedureComposer.js",
    canonicalQueries: [
      {
        label: "déclarer impôts",
        query: "comment déclarer mes impôts en ligne",
        expectedPath: "admin_procedure",
      },
    ],
  },
  {
    id: "pedagogical_overview",
    promise:
      "Socle scolaire — notions par niveau (KB locale, generative ou web selon couverture).",
    slots: [
      "topic",
      "topicLabel",
      "level",
      "levelLabel",
      "lyceeGrade",
      "educationBand",
      "depth",
    ],
    deliveryMode: FAMILY_DELIVERY_MODES.LOCAL_DETERMINISTIC,
    shortCircuitOrder: 70,
    shortCircuitPath: "pedagogical_overview",
    allowedPaths: [
      "pedagogical_overview_deterministic",
      "pedagogical_overview",
      "pedagogical_overview_web",
    ],
    mustInclude: ["élève", "6e", "apprendre", "socle", "programme"],
    mustExclude: ["débutant crypto", "devenir", "Redis vs", "crash"],
    fallbackPolicy: FAMILY_FALLBACK_POLICIES.LOCAL_KB_REPLY,
    deferToFullPipeline: false,
    preferWebResearch: false,
    detect: isPedagogicalOverviewRequest,
    guardModule: "utils/pedagogicalOverviewIntentGuards.js",
    composerModule: "micro/replies/pedagogicalOverviewComposer.js",
    canonicalQueries: [
      {
        label: "fractions 6e",
        query:
          "que dois apprendre un élève de 6eme sur les fractions simples ?",
        expectedPath: "pedagogical_overview_deterministic",
      },
    ],
  },
];

/** Index rapide id → entrée. */
export const INTENT_FAMILY_BY_ID = Object.freeze(
  Object.fromEntries(INTENT_FAMILIES_V1.map((entry) => [entry.id, entry])),
);

/**
 * Matrice plate dérivée du registre — une ligne par requête canonique.
 * @returns {Array<CanonicalRoutingCase & { familyId: string }>}
 */
export function getIntentFamilyCanonicalMatrixV1() {
  const rows = [];
  for (const family of INTENT_FAMILIES_V1) {
    for (const canonical of family.canonicalQueries) {
      rows.push({
        familyId: family.id,
        label: canonical.label,
        query: canonical.query,
        expectedPath: canonical.expectedPath,
      });
    }
  }
  return rows;
}

/**
 * Résout la première famille registre qui matche (ordre short-circuit v1).
 * @param {string} query
 * @returns {IntentFamilyEntry|null}
 */
export function resolveIntentFamilyFromRegistry(query = "") {
  const ordered = [...INTENT_FAMILIES_V1].sort(
    (a, b) => a.shortCircuitOrder - b.shortCircuitOrder,
  );
  for (const family of ordered) {
    if (family.detect(query)) return family;
  }
  return null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveExpectedPrimaryPathFromRegistry(query = "") {
  return resolveIntentFamilyFromRegistry(query)?.shortCircuitPath ?? null;
}

/**
 * Vérifie la cohérence interne du registre (ordre, détecteurs, chemins).
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateIntentFamilyRegistryV1() {
  const errors = [];
  const ids = new Set();
  const orders = new Set();

  for (const family of INTENT_FAMILIES_V1) {
    if (ids.has(family.id)) {
      errors.push(`duplicate family id: ${family.id}`);
    }
    ids.add(family.id);

    if (orders.has(family.shortCircuitOrder)) {
      errors.push(`duplicate shortCircuitOrder: ${family.shortCircuitOrder}`);
    }
    orders.add(family.shortCircuitOrder);

    if (typeof family.detect !== "function") {
      errors.push(`family ${family.id}: detect is not a function`);
    }

    for (const canonical of family.canonicalQueries) {
      if (!family.detect(canonical.query)) {
        errors.push(
          `family ${family.id}: detect failed on canonical « ${canonical.label || canonical.query} »`,
        );
      }
    }
  }

  const orderIds = INTENT_FAMILY_SHORT_CIRCUIT_ORDER_V1;
  const registryIds = [...INTENT_FAMILIES_V1]
    .sort((a, b) => a.shortCircuitOrder - b.shortCircuitOrder)
    .map((f) => f.id);

  if (orderIds.join("|") !== registryIds.join("|")) {
    errors.push(
      "INTENT_FAMILY_SHORT_CIRCUIT_ORDER_V1 diverges from registry shortCircuitOrder",
    );
  }

  return { ok: errors.length === 0, errors };
}

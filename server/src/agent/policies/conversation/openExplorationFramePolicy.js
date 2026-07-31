/**
 * Open exploration frame P0 — forme conversationnelle (slots), pas un intent lexical.
 *
 * Frame = opener collectif + coquille d’activité + absence d’objet concret.
 * Les modaux (peut / pourrait / pourrais…) sont du bruit entre slots, jamais le signal.
 *
 * Spec : docs/agents/posture-deliverable-epistemic-spec-v1.md §2.3.2
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";

/** Mandat d’exécution local — évite l’import circulaire via genericGreetingGuards. */
const SUBSTANTIVE_MANDATE_RE =
  /\b(?:cr[eé]e|creer|g[eé]n[eè]re|impl[eé]mente|d[eé]veloppe|corrig[eé]|patch|forge|handoff)\b/i;

export const OPEN_EXPLORATION_FRAME_ID = "OPEN_EXPLORATION_FRAME_V1";
export const SURFACE_FRAME_OPEN_EXPLORATION = "open_exploration";

/**
 * Sujet collectif interrogatif / implicite — structure, pas modal.
 * Après sanitize : « qu est-ce qu on … ».
 * Ne pas matcher « tu/je veux faire quoi » (meta_who_drives).
 */
const COLLECTIVE_OPENER_RE =
  /\b(?:qu['']?\s*est[- ]ce\s+qu['']?\s*on|on\s+fait\s+quoi|quoi\s+(?:on\s+)?(?:fait|faire)|que\s+(?:peut|peux|dois|doit|veux|veut)[- ]?on\s+faire|on(?:\s+\w+){0,4}\s+(?:faire|fait)\s+quoi)\b/i;

/** « faire quoi ? » nu — sans sujet personnel tu/je. */
const BARE_OPEN_FIELD_RE =
  /^(?:alors|bon|ben|d['']accord|ok)?\s*(?:faire\s+quoi|quoi\s+faire)\b/i;

/** Pilotage perso (« tu veux faire quoi ») — autre surface. */
const PERSONAL_DRIVER_RE =
  /\b(?:tu|je|vous)\s+(?:veux|voudrais|veut)\s+(?:faire\s+)?quoi\b/i;

/** Verbe d’activité large — la cible précise est un anti-slot séparé. */
const OPEN_ACTIVITY_SHELL_RE =
  /\b(?:faire|fait|discut(?:e|er|ons)|bosser|commencer|tenter|explorer)\b/i;

/**
 * Objet concret / mandat — casse le frame (idéation, web, analyse, forge…).
 * Pas de dépendance au modal.
 */
const CONCRETE_OBJECT_RE =
  /\b(?:projet|livrable|forge|handoff|agent|code|script|module|api|appli(?:cation)?|site|html|css|json|fichier|audit|d[eé]p[oô]t|depot|repo|github|recherche(?:\s+sur)?\s+(?:le\s+)?web|rechercher\s+sur\s+(?:le\s+)?web|python|javascript|typescript|react|slides?|pr[eé]sentation|document|rapport)\b/i;

const CONSTRAINT_HEAVY_RE =
  /\b(?:en\s+(?:python|js|html)|avec\s+(?:contrainte|deadline)|format\s+\w+|niveau\s+\w+|pour\s+lundi|avant\s+demain)\b/i;

/**
 * @param {string} query
 * @returns {{
 *   hasCollectiveOpener: boolean,
 *   hasOpenActivityShell: boolean,
 *   hasConcreteObject: boolean,
 *   isShortAndUnderspecified: boolean,
 *   isExplorationFrame: boolean,
 * }}
 */
export function assessOpenExplorationSlots(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) {
    return {
      hasCollectiveOpener: false,
      hasOpenActivityShell: false,
      hasConcreteObject: false,
      isShortAndUnderspecified: false,
      isExplorationFrame: false,
    };
  }

  const words = q.split(/\s+/).filter(Boolean);
  const hasCollectiveOpener =
    !PERSONAL_DRIVER_RE.test(q) &&
    (COLLECTIVE_OPENER_RE.test(q) || BARE_OPEN_FIELD_RE.test(q));
  const hasOpenActivityShell = OPEN_ACTIVITY_SHELL_RE.test(q);
  const hasConcreteObject = CONCRETE_OBJECT_RE.test(q);
  const isShortAndUnderspecified =
    q.length <= 120 &&
    words.length <= 16 &&
    !CONSTRAINT_HEAVY_RE.test(q) &&
    !SUBSTANTIVE_MANDATE_RE.test(q);

  const isExplorationFrame =
    hasCollectiveOpener &&
    hasOpenActivityShell &&
    !hasConcreteObject &&
    isShortAndUnderspecified;

  return {
    hasCollectiveOpener,
    hasOpenActivityShell,
    hasConcreteObject,
    isShortAndUnderspecified,
    isExplorationFrame,
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isOpenExplorationFrame(query = "") {
  return assessOpenExplorationSlots(query).isExplorationFrame;
}

/**
 * Contribution compréhension (avant JUST) — pas un rail autonome.
 * @param {string} query
 */
export function resolveOpenExplorationFrame(query = "") {
  const slots = assessOpenExplorationSlots(query);
  if (!slots.isExplorationFrame) {
    return {
      contract: OPEN_EXPLORATION_FRAME_ID,
      matched: false,
      surfaceFrame: null,
      promisedValue: null,
      clarificationRequired: null,
      slots,
      telemetry: {
        openExplorationFrame: false,
        surfaceFrame: null,
      },
    };
  }

  return {
    contract: OPEN_EXPLORATION_FRAME_ID,
    matched: true,
    surfaceFrame: SURFACE_FRAME_OPEN_EXPLORATION,
    promisedValue: "exploration_proposal",
    clarificationRequired: false,
    slots,
    telemetry: {
      openExplorationFrame: true,
      surfaceFrame: SURFACE_FRAME_OPEN_EXPLORATION,
      collective: slots.hasCollectiveOpener,
      activityShell: slots.hasOpenActivityShell,
      targetObject: "absent",
      clarificationRequired: false,
      promisedValue: "exploration_proposal",
    },
  };
}

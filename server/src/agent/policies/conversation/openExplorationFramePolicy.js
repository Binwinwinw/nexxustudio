/**
 * Open exploration frame P0 — forme conversationnelle (slots), pas un intent lexical.
 *
 * Frame = opener collectif + coquille d’activité + absence d’objet concret.
 * Les modaux (peut / pourrait / pourrais…) sont du bruit entre slots, jamais le signal.
 *
 * Spec : docs/agents/posture-deliverable-epistemic-spec-v1.md §2.3.2
 */
import { normalizeFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";

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
  /\b(?:qu['\u2019]?\s*est[- ]?ce\s+que\s+(?:tu|vous)(?:\s+tu)?\s+(?:veux|voudrais|veut|voulez)\s+(?:faire|continuer)|(?:tu|je|vous)\s+(?:veux|voudrais|veut)\s+(?:faire\s+)?quoi|que\s+veux[- ]?(?:tu|vous)\s+(?:faire|continuer))\b/i;

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

/** Soirée / week-end / midi — relance sociale, pas un menu de chantier. */
const LEISURE_TIME_RE =
  /\b(?:ce\s+soir|cet?\s+apr[eè]s[- ]?midi|ce\s+we(?:ek(?:[- ]?end)?)?|cette\s+nuit|demain\s+soir|ce\s+midi)\b/i;

const SOCIAL_RELANCE_LEAD_RE =
  /^(?:ok(?:e|é|ey|éy|ay)?y?|okay|okey|sympa|cool|nice|bon|du\s+coup|et\s+sinon|allez|bah|ben)\b/i;

const PROJECT_INTENT_RE =
  /\b(?:projet|livrable|forge|handoff|agent|code|script|audit|d[eé]p[oô]t|depot|repo|atelier|feature|ticket|sprint|backlog|architecture|\brag\b)\b/i;

const SOCIAL_OPENING_RE =
  /(?:comment\s+(?:(?:ça|ca)\s+)?(?:va|se\s+passe|roule)|(?:^|\s)(?:salut|bonjour|hello|coucou|hey|yop|yo)\b|(?:^|\s)(?:ça|ca)\s+roule|(?:^|\s)tout\s+roule)/i;

/** « qu'est-ce qu'on fait » nu = statut projet, pas loisir / menu exploration. */
const PROJECT_STATUS_ON_FAIT_RE =
  /\bqu\s+est[- ]ce\s+qu\s+on\s+fait\b(?!\s+quoi\b)/i;

function isProjectStatusOnFait(q = "") {
  return PROJECT_STATUS_ON_FAIT_RE.test(q) && !LEISURE_TIME_RE.test(q);
}

function lastUserText(history = []) {
  if (!Array.isArray(history)) return "";
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "user" && String(history[i]?.content || "").trim()) {
      return String(history[i].content).trim();
    }
  }
  return "";
}

/**
 * Relance small-talk (« ce soir ? », filler après check-in) — pas open_exploration.
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function isSocialLeisureRelance(query = "", history = []) {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  if (PERSONAL_DRIVER_RE.test(q)) return false;
  if (CONCRETE_OBJECT_RE.test(q) || PROJECT_INTENT_RE.test(q)) return false;
  if (SUBSTANTIVE_MANDATE_RE.test(q) || CONSTRAINT_HEAVY_RE.test(q)) return false;

  const hasCollectiveOpener =
    COLLECTIVE_OPENER_RE.test(q) || BARE_OPEN_FIELD_RE.test(q);
  if (!hasCollectiveOpener) return false;
  if (!OPEN_ACTIVITY_SHELL_RE.test(q)) return false;
  if (isProjectStatusOnFait(q)) return false;

  if (LEISURE_TIME_RE.test(q)) return true;
  if (SOCIAL_RELANCE_LEAD_RE.test(q)) return true;

  const previous = normalizeFamiliarityQuery(lastUserText(history));
  return Boolean(previous && SOCIAL_OPENING_RE.test(previous));
}

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
export function assessOpenExplorationSlots(query = "", history = []) {
  const q = normalizeFamiliarityQuery(query);
  if (!q) {
    return {
      hasCollectiveOpener: false,
      hasOpenActivityShell: false,
      hasConcreteObject: false,
      isShortAndUnderspecified: false,
      isExplorationFrame: false,
      isLeisureRelance: false,
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
  const isLeisureRelance = isSocialLeisureRelance(query, history);
  const projectStatusOnFait = isProjectStatusOnFait(q);

  const isExplorationFrame =
    hasCollectiveOpener &&
    hasOpenActivityShell &&
    !hasConcreteObject &&
    isShortAndUnderspecified &&
    !isLeisureRelance &&
    !projectStatusOnFait;

  return {
    hasCollectiveOpener,
    hasOpenActivityShell,
    hasConcreteObject,
    isShortAndUnderspecified,
    isExplorationFrame,
    isLeisureRelance,
  };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isOpenExplorationFrame(query = "", history = []) {
  return assessOpenExplorationSlots(query, history).isExplorationFrame;
}

/**
 * Contribution compréhension (avant JUST) — pas un rail autonome.
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function resolveOpenExplorationFrame(query = "", history = []) {
  const slots = assessOpenExplorationSlots(query, history);
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

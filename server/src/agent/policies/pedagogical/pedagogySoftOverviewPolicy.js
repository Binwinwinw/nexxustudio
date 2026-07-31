/**
 * pedagogy_soft_overview — aperçu intro minimal utile (lot #35).
 */
import {
  isPedagogySoftOverviewRequest,
  parsePedagogySoftOverviewTask,
} from "../../utils/pedagogySoftOverviewIntentGuards.js";
import {
  buildPedagogySoftOverviewSystemAddon,
  resolvePedagogySoftCanonicalReply,
} from "./pedagogySoftOverviewKnowledge.js";

export const PEDAGOGY_SOFT_OVERVIEW_POLICY = "pedagogy_soft_overview_policy_v1";

/** Batterie #35 — histoire. */
export const PEDAGOGY_SOFT_CANONICAL_REVOLUTION_QUERY =
  "parle-moi de la Révolution française";

/** Batterie #35 — géographie. */
export const PEDAGOGY_SOFT_CANONICAL_CANADA_QUERY =
  "explique-moi la géographie du Canada en général";

/** Batterie #35 — sciences. */
export const PEDAGOGY_SOFT_CANONICAL_VOLCANO_QUERY =
  "dis-moi l'essentiel sur les volcans";

/** Batterie #35 — curriculum scolaire, pas ce patron. */
export const PEDAGOGY_SOFT_CANONICAL_SCHOOL_QUERY =
  "que doit apprendre un élève de 6e sur les fractions simples ?";

/** Batterie #35 — technique, pas ce patron. */
export const PEDAGOGY_SOFT_CANONICAL_REDIS_QUERY = "explique Redis";

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPedagogySoftOverviewSatisfiable(query = "") {
  return isPedagogySoftOverviewRequest(query);
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply?: string, deferToLlm?: boolean, reflectiveHint?: string, task: object }|null}
 */
export function resolvePedagogySoftOverviewShortCircuit(query = "") {
  if (!isPedagogySoftOverviewRequest(query)) return null;

  const task = parsePedagogySoftOverviewTask(query);
  if (!task) return null;

  const canonicalReply = resolvePedagogySoftCanonicalReply(task);
  if (canonicalReply) {
    return {
      path: "pedagogy_soft_overview_deterministic",
      kind: task.kind,
      reply: canonicalReply,
      task,
    };
  }

  return {
    path: "pedagogy_soft_overview",
    kind: task.kind,
    deferToLlm: true,
    reflectiveHint: buildPedagogySoftOverviewSystemAddon(task),
    task,
  };
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildPedagogySoftOverviewRecoveryMessage(
  query = "",
  reason = "empty_output",
) {
  const task = parsePedagogySoftOverviewTask(query);
  const canonical = task ? resolvePedagogySoftCanonicalReply(task) : null;
  if (canonical) return canonical;
  if (task) {
    return (
      `Je peux te donner un aperçu structuré sur **${task.subjectLabel}** (${reason}). ` +
      "Réessaie ou précise l'angle (chronologie, cartes, exemples…)."
    );
  }
  return (
    "Je peux te donner un aperçu général sur un sujet d'histoire, de géographie ou de sciences. " +
    "Nomme le thème (ex. Révolution française, géographie du Canada, volcans)."
  );
}

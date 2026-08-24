/**
 * Dictionnaire déterministe de cas de routage — bibliothécaire-catalogue, pas un agent LLM.
 * Lookup explicable : cas connu → règle connue → path + régime piste/COMPOSER.
 */
import {
  isIdleConfirmedSocialCheckin,
  isGreetingOnlyIntent,
  isGratitudeClosureIntent,
} from "../social/socialPatternPolicy.js";
import { isOpenExplorationFrame } from "../conversation/openExplorationFramePolicy.js";
import {
  inferActiveGoal,
  isEllipticGoalFollowUp,
} from "../conversation/activeGoalPolicy.js";
import { resolveNamedCreateStartShortCircuit } from "../conversation/currentTurnAnchoringPolicy.js";
import { isAcknowledgmentRequest } from "../../utils/intent-guards/acknowledgmentIntentGuards.js";
import { resolveMetaFeedbackShortCircuit } from "../../micro/replies/metaFeedbackReplyBuilder.js";
import { isAttachmentWorkRequest } from "../attachment/index.js";

export const ROUTING_CASE_DICTIONARY_RULE = "routing_case_dictionary_v1";

/**
 * Hiérarchie — plages stables. Nouvelle fiche : choisir une plage, pas un entier au hasard.
 * 900–999  protections critiques / document (réservé, pas encore de fiche)
 * 800–899  méta-feedback explicite
 * 700–799  tâche active + follow-up elliptique
 * 600–699  create explicite avec objet nommé
 * 400–599  social_checkin / greeting / gratitude
 * 300–399  open_prompt / open_exploration
 *    <300  ne pas descendre : en dessous = orchestrateur, puis piste en dernier recours
 */
export const ROUTING_PRIORITY_BANDS = Object.freeze({
  CRITICAL_RESERVED: { min: 900, max: 999 },
  META_FEEDBACK: { min: 800, max: 899 },
  ACTIVE_GOAL: { min: 700, max: 799 },
  NAMED_CREATE: { min: 600, max: 699 },
  SOCIAL: { min: 400, max: 599 },
  OPEN_EXPLORATION: { min: 300, max: 399 },
});

/**
 * @typedef {{
 *   id: string,
 *   priority: number,
 *   path: string,
 *   forbidPiste: boolean,
 *   forbidComposer?: boolean,
 *   requiresActiveGoalNull?: boolean,
 *   requiresActiveGoal?: boolean,
 *   reason: string,
 *   canonicalQueries: string[],
 *   counterQueries: string[],
 *   detect: (query: string, ctx?: object) => boolean,
 * }} RoutingCaseFiche
 */

/** @type {RoutingCaseFiche[]} */
export const ROUTING_CASES = Object.freeze([
  {
    id: "document_attached_guard",
    priority: 920,
    path: "attachment_task_full_pipeline",
    forbidPiste: true,
    forbidComposer: false,
    reason:
      "attachment work requires read+anchor; piste and objective-clarify are forbidden",
    canonicalQueries: [
      "analyse le fichier joint pour proposer des axes d'améliorations de celui-ci",
    ],
    counterQueries: ["comment allez-vous ?", "salut", "fais quelque chose"],
    detect: (query, ctx = {}) =>
      isAttachmentWorkRequest(query, ctx.attachments || []),
  },
  {
    id: "meta_feedback",
    priority: 800,
    path: "meta_feedback_deterministic",
    forbidPiste: true,
    forbidComposer: true,
    reason:
      "explicit meta-feedback on the assistant must not fall through to composer piste",
    canonicalQueries: [
      "ta réponse était hors sujet",
      "ce n'est pas une réponse correcte",
    ],
    counterQueries: ["comment allez-vous ?", "créer une carte de visite"],
    detect: (query, ctx = {}) =>
      Boolean(resolveMetaFeedbackShortCircuit(query, ctx)?.reply),
  },
  {
    id: "active_goal_elliptic_followup",
    priority: 700,
    path: "active_goal_continue",
    forbidPiste: true,
    forbidComposer: true,
    requiresActiveGoal: true,
    reason: "elliptic follow-up of an active task must continue the goal",
    canonicalQueries: ["et en HTML ?"],
    counterQueries: ["comment ça va ?", "qu'est-ce qu'on peut faire ?"],
    detect: (query, ctx = {}) =>
      isEllipticGoalFollowUp(query, ctx.activeGoal || null),
  },
  {
    id: "explicit_named_create",
    priority: 600,
    path: "named_create_start",
    forbidPiste: true,
    forbidComposer: true,
    reason: "named create with a concrete object is an operational start",
    canonicalQueries: ["créer une carte de visite"],
    counterQueries: ["comment allez-vous ?", "salut"],
    detect: (query) => Boolean(resolveNamedCreateStartShortCircuit(query)?.reply),
  },
  {
    id: "social_wellbeing_checkin",
    priority: 500,
    path: "social_deterministic",
    forbidPiste: true,
    forbidComposer: true,
    requiresActiveGoalNull: true,
    reason:
      "explicit social check-in with no active goal must not reach composer",
    canonicalQueries: [
      "comment allez-vous ?",
      "comment ça va ?",
      "comment allez vous monsieur ou madame ??",
    ],
    counterQueries: [
      "créer une carte de visite",
      "et en HTML ?",
      "salut comment ca va ??? tu es prêt à tafer ?",
    ],
    detect: (query, ctx = {}) => isIdleConfirmedSocialCheckin(query, ctx),
  },
  {
    id: "greeting_only",
    priority: 450,
    path: "social_deterministic",
    forbidPiste: true,
    forbidComposer: true,
    requiresActiveGoalNull: true,
    reason: "pure greeting is social instant, not an operational objective ask",
    canonicalQueries: ["salut", "bonjour", "bonsoir"],
    counterQueries: ["comment ça va ?", "créer une carte de visite"],
    detect: (query) => isGreetingOnlyIntent(query),
  },
  {
    id: "gratitude_ack",
    priority: 440,
    path: "social_deterministic",
    forbidPiste: true,
    forbidComposer: true,
    requiresActiveGoalNull: true,
    reason: "gratitude or acknowledgment is closure, not a missing objective",
    canonicalQueries: ["merci", "merci beaucoup"],
    counterQueries: ["comment allez-vous ?", "fais quelque chose"],
    detect: (query) =>
      isGratitudeClosureIntent(query) || isAcknowledgmentRequest(query),
  },
  {
    id: "open_exploration_prompt",
    priority: 300,
    path: "social_deterministic",
    forbidPiste: true,
    forbidComposer: true,
    requiresActiveGoalNull: true,
    reason:
      "open exploration asks for orientation, not an objective-in-one-sentence refusal",
    canonicalQueries: [
      "qu'est-ce qu'on peut faire ?",
      "qu'est-ce qu'on pourrait faire??",
    ],
    counterQueries: ["comment ça va ?", "créer une carte de visite"],
    detect: (query, ctx = {}) =>
      isOpenExplorationFrame(query, ctx.history || []),
  },
]);

function resolveActiveGoalFromCtx(ctx = {}) {
  if (ctx.activeGoal !== undefined) return ctx.activeGoal;
  return inferActiveGoal(ctx.history || [], ctx.priorState || null);
}

/**
 * Lookup déterministe — une fiche gagnante, liste des matchs, régime piste.
 * @param {string} query
 * @param {{ history?: object[], priorState?: object, activeGoal?: object|null, justIntent?: object, hasNonSocialWork?: boolean }} [ctx]
 */
export function lookupRoutingCase(query = "", ctx = {}) {
  const activeGoal = resolveActiveGoalFromCtx(ctx);
  const detectCtx = { ...ctx, activeGoal };
  const matched = [];

  for (const fiche of ROUTING_CASES) {
    if (fiche.requiresActiveGoalNull && activeGoal) continue;
    if (fiche.requiresActiveGoal && !activeGoal) continue;
    if (!fiche.detect(query, detectCtx)) continue;
    matched.push(fiche);
  }

  matched.sort((a, b) => b.priority - a.priority);
  const winner = matched[0] || null;
  const forbidPiste = Boolean(winner?.forbidPiste);
  const forbidComposer = Boolean(winner?.forbidComposer);

  return {
    rule: ROUTING_CASE_DICTIONARY_RULE,
    routing_case_id: winner?.id || null,
    matched_rules: matched.map((f) => f.id),
    winning_rule: winner?.id || null,
    reason: winner?.reason || null,
    path: winner?.path || null,
    forbidPiste,
    forbidComposer,
    forbidden_routes: forbidComposer ? ["COMPOSER", "Planner"] : [],
    piste_blocked_by_dictionary: forbidPiste,
    final_path: winner?.path || null,
    fiche: winner,
    activeGoal: activeGoal || null,
  };
}

export function formatRoutingCaseLog(lookup = {}) {
  return (
    `[ROUTING_CASE] id=${lookup.routing_case_id || "none"} ` +
    `winning=${lookup.winning_rule || "none"} ` +
    `path=${lookup.final_path || "none"} ` +
    `matched=${(lookup.matched_rules || []).join(",") || "none"} ` +
    `forbidPiste=${Boolean(lookup.piste_blocked_by_dictionary)} ` +
    `forbidden=${(lookup.forbidden_routes || []).join(",") || "none"} ` +
    `reason=${lookup.reason || "none"}`
  );
}

function bandForPriority(priority) {
  return Object.entries(ROUTING_PRIORITY_BANDS).find(
    ([, band]) => priority >= band.min && priority <= band.max,
  )?.[0] || null;
}

/**
 * Audit statique — ids uniques, plage connue, canonical/counter/reason présents.
 * À relancer quand une fiche est ajoutée ou qu'une autre devient redondante.
 */
export function validateRoutingCaseDictionary() {
  const errors = [];
  const ids = new Set();
  const priorities = new Set();

  for (const fiche of ROUTING_CASES) {
    if (ids.has(fiche.id)) errors.push(`duplicate id: ${fiche.id}`);
    ids.add(fiche.id);

    if (priorities.has(fiche.priority)) {
      errors.push(`duplicate priority ${fiche.priority} (${fiche.id})`);
    }
    priorities.add(fiche.priority);

    if (!bandForPriority(fiche.priority)) {
      errors.push(`${fiche.id}: priority ${fiche.priority} hors plage`);
    }
    if (fiche.priority < 300) {
      errors.push(`${fiche.id}: priority < 300 réserve le fallback orchestrateur`);
    }
    if (typeof fiche.detect !== "function") {
      errors.push(`${fiche.id}: detect manquant`);
    }
    if (!fiche.reason) errors.push(`${fiche.id}: reason manquant`);
    if (!fiche.path) errors.push(`${fiche.id}: path manquant`);
    if (!fiche.canonicalQueries?.length) {
      errors.push(`${fiche.id}: canonicalQueries vide`);
    }
    if (!fiche.counterQueries?.length) {
      errors.push(`${fiche.id}: counterQueries vide`);
    }
  }

  return { ok: errors.length === 0, errors };
}

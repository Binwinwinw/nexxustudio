/**
 * active_goal — état de tâche conversationnelle, inféré de l'historique
 * (et optionnellement persisté dans sessionWorkMemory).
 * Pas de magie modèle : un objet nommé créé = goal ; social/méta = null.
 */
import { isIdeationIntent, isProjectIdeaCritiqueRequest } from "../../utils/intent-guards/ideationIntentGuards.js";
import { isMetaAssistantBehaviorRequest } from "../../utils/intent-guards/metaAssistantBehaviorGuards.js";
import {
  extractCurrentTurnAnchors,
  buildNamedCreateOperationalReply,
} from "./currentTurnAnchoringPolicy.js";

export const ACTIVE_GOAL_RULE = "active_goal_v1";

const ELLIPTIC_FORMAT_RE =
  /\b(?:html|pdf|print|impression|imprim(?:e(?:r|s|z)?)?|recto|verso|qr|format|coordonn|infos?)\b/i;
const ELLIPTIC_RESUME_RE =
  /\b(?:continue|la suite|pareil|comme ça|comme ca|reprends)\b/i;
const EXPLICIT_NEW_TECH_TASK_RE =
  /(?:cr[eé]e(?:r)?|corrige(?:r)?|[eé]cris|[eé]crire|d[eé]veloppe(?:r)?)/i;

/**
 * @param {string} text
 * @returns {{ label: string, kind: "create" }|null}
 */
export function extractCreateGoalFromText(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (isIdeationIntent(raw) || isProjectIdeaCritiqueRequest(raw)) return null;
  if (isMetaAssistantBehaviorRequest(raw)) return null;
  const anchors = extractCurrentTurnAnchors(raw);
  if (anchors.goal !== "create" || !anchors.spans[0]) return null;
  return { label: anchors.spans[0], kind: "create" };
}

/**
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {{ activeGoal?: { label?: string, kind?: string }|null }} [priorState]
 * @returns {{ label: string, kind: string, source: string }|null}
 */
export function inferActiveGoal(history = [], priorState = null) {
  const turns = Array.isArray(history) ? history : [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role !== "user") continue;
    const hit = extractCreateGoalFromText(turns[i].content);
    if (hit) return { ...hit, source: "history" };
  }
  const stored = priorState?.activeGoal;
  if (stored?.label) {
    return {
      label: String(stored.label),
      kind: stored.kind || "create",
      source: "session",
    };
  }
  return null;
}

/**
 * @param {{
 *   query?: string,
 *   history?: Array<{ role?: string, content?: string }>,
 *   priorState?: object|null,
 * }} [input]
 * @returns {{ label: string, kind: string, source: string }|null}
 */
export function resolveActiveGoal(input = {}) {
  const opened = extractCreateGoalFromText(input.query || "");
  if (opened) return { ...opened, source: "current_turn" };
  return inferActiveGoal(input.history || [], input.priorState || null);
}

/**
 * @param {string} query
 * @param {{ label?: string }|null} goal
 */
export function isEllipticGoalFollowUp(query = "", goal = null) {
  if (!goal?.label) return false;
  const q = String(query || "").trim();
  if (!q || q.length > 140) return false;
  if (extractCreateGoalFromText(q)) return false;
  if (isMetaAssistantBehaviorRequest(q)) return false;
  if (EXPLICIT_NEW_TECH_TASK_RE.test(q)) return false;
  if (ELLIPTIC_FORMAT_RE.test(q) && q.length < 80) return true;
  return ELLIPTIC_RESUME_RE.test(q) && q.length < 80;
}

/**
 * @param {{ label?: string }|null} goal
 */
export function buildWhoDrivesContinuityReply(goal = null) {
  if (!goal?.label) {
    return (
      "Rien n'est lancé pour l'instant — **aucune tâche active**. " +
      "C'est toi qui choisis : on papote, ou tu poses un objectif concret."
    );
  }
  return (
    `On a déjà **${goal.label}** en cours. ` +
    "Tu veux continuer là-dessus, ou changer ?"
  );
}

/**
 * @param {{ label?: string }|null} goal
 * @param {string} [threadHint]
 */
export function buildMetaConversationFeedbackReply(goal = null, threadHint = "") {
  const stateLine = goal?.label
    ? `Tâche active : **${goal.label}**.`
    : "Rien n'est lancé dans ce fil — **aucune tâche active**. « Ce qui est en cours » est une formule générique : je ne dois pas inventer un projet.";
  const threadLine = threadHint
    ? ` Fil récent : « ${String(threadHint).slice(0, 100)} ».`
    : "";

  return [
    "Tu as raison de pointer ça — ce tour porte sur **ma façon de répondre**, pas sur un livrable à produire.",
    "",
    "Je route ta phrase vers des rails (social, réparation, métier…) puis je réponds dans ce cadre. Une bascule vers un plan de projets ou un orchestrateur lourd sur une critique comme celle-ci est hors sujet.",
    "",
    `${stateLine}${threadLine}`,
    "",
    "Si tu veux avancer concrètement, donne le sujet — on y va sans plan de présentation. Si tu veux ajuster comment je clarifie, précise ce qui t'a gêné sur le tour précédent.",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ history?: object[], priorState?: object|null }} [options]
 * @returns {{ path: string, reply: string, activeGoal: object }|null}
 */
export function resolveActiveGoalContinuationShortCircuit(query = "", options = {}) {
  const goal = inferActiveGoal(options.history || [], options.priorState || null);
  if (!isEllipticGoalFollowUp(query, goal)) return null;

  const format = /\bhtml\b/i.test(query)
    ? "HTML"
    : /\bpdf\b/i.test(query)
      ? "PDF"
      : /\b(?:print|imprim)/i.test(query)
        ? "print"
        : null;
  const head = format
    ? `On reste sur **${goal.label}**, support **${format}**.`
    : `On reste sur **${goal.label}**.`;

  return {
    path: "active_goal_continue",
    reply: `${head}\n\n${buildNamedCreateOperationalReply(goal.label, query)}`,
    activeGoal: goal,
  };
}

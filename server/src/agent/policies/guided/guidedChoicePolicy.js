/**
 * Guided choice après panel exploration_proposal (open_prompt).
 * Mappe 1–5 / mots d’option → aide au choix (pas inventer un livrable UX/UI).
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import {
  isExplorationPanelOffer,
  isGuidedChoiceSurface,
} from "../deliverableContractPolicy.js";

export const GUIDED_CHOICE_RULE = "guided_choice_continuity_p1";
export const GUIDED_CHOICE_PIPELINE_PATH = "guided_choice_deterministic";

/** Options du panel OPEN_PROMPT_EXPLORATION (ordre stable). */
export const OPEN_PROMPT_MENU = Object.freeze([
  {
    id: 1,
    key: "discussion_libre",
    label: "discussion libre",
    keywords: /\b(?:discussion\s+libre|papoter|discuter)\b/i,
  },
  {
    id: 2,
    key: "brainstorm",
    label: "brainstorm léger",
    keywords: /\b(?:brainstorm(?:er|ing)?|idée|idee|germe)\b/i,
  },
  {
    id: 3,
    key: "recherche_web",
    label: "recherche web sur un thème",
    keywords: /\b(?:recherche(?:r)?(?:\s+web)?|web|internet)\b/i,
  },
  {
    id: 4,
    key: "livrable_tech",
    label: "petit livrable tech",
    keywords: /\b(?:livrable|petit\s+livrable|code|snippet|script)\b/i,
  },
  {
    id: 5,
    key: "apprendre",
    label: "apprendre un sujet",
    keywords: /\b(?:apprendre|apprentissage|sujet\s+[àa]\s+apprendre)\b/i,
  },
]);

const CHOICE_REPLIES = Object.freeze({
  discussion_libre:
    "Parfait — discussion libre. On peut papoter sans agenda.\n" +
    "Tu as un thème en tête, ou on part sur ce qui te passe ?",
  brainstorm:
    "Ok — brainstorm léger. On jette des pistes sans se figer.\n" +
    "Sur quel thème tu veux brainstormer (même vague) ?",
  recherche_web:
    "Ça marche — recherche web. Je peux chercher dès que le thème est clair.\n" +
    "Tu veux fouiller quoi exactement ?",
  livrable_tech:
    "Noté — petit livrable tech (script, page, snippet, mini-module…).\n" +
    "Tu vises quoi comme livrable, et dans quel langage ?",
  apprendre:
    "Allons-y — apprendre un sujet. Je peux expliquer + donner un mini-exemple.\n" +
    "Quel sujet tu veux attaquer ?",
});

/**
 * @param {Array<{ role?: string, content?: string }>} history
 */
function lastAssistantText(history = []) {
  const turns = Array.isArray(history) ? history : [];
  const last = [...turns]
    .reverse()
    .find((m) => m?.role === "assistant" || m?.role === "model");
  return String(last?.content || "");
}

/**
 * @param {string} query
 * @returns {{ id: number, key: string, label: string }|null}
 */
export function parseOpenPromptMenuChoice(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length > 120) return null;

  const numbered = q.match(/^([1-5])(?:\b|[).:\s])/);
  if (numbered) {
    const id = Number(numbered[1]);
    const opt = OPEN_PROMPT_MENU.find((o) => o.id === id);
    return opt ? { id: opt.id, key: opt.key, label: opt.label } : null;
  }

  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 6) return null;

  for (const opt of OPEN_PROMPT_MENU) {
    if (opt.keywords.test(q)) {
      return { id: opt.id, key: opt.key, label: opt.label };
    }
  }
  return null;
}

/**
 * @param {{ key: string, label: string }} choice
 * @returns {string}
 */
export function buildGuidedChoiceReply(choice = {}) {
  const key = String(choice.key || "");
  const canned = CHOICE_REPLIES[key];
  if (canned) return canned;
  const label = String(choice.label || "cette option").trim();
  return (
    `Ok — on part sur ${label}.\n` +
    "Dis-moi juste le détail manquant (sujet, langage ou angle) et on avance."
  );
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{
 *   path: string,
 *   reply: string,
 *   guidedChoice: true,
 *   choiceId: number,
 *   choiceKey: string,
 *   choiceLabel: string,
 * }|null}
 */
export function resolveGuidedChoiceShortCircuit(query = "", options = {}) {
  const history = options.history || [];
  if (!isExplorationPanelOffer(lastAssistantText(history))) return null;
  if (!isGuidedChoiceSurface(query, history)) return null;

  const choice = parseOpenPromptMenuChoice(query);
  if (!choice) return null;

  return {
    path: GUIDED_CHOICE_PIPELINE_PATH,
    reply: buildGuidedChoiceReply(choice),
    guidedChoice: true,
    choiceId: choice.id,
    choiceKey: choice.key,
    choiceLabel: choice.label,
  };
}

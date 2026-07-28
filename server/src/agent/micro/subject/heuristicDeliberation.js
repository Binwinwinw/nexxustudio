import { USAGE_INTENTS } from "./subjectUsageIntent.js";
import {
  isForgeProjectScopingQuery,
  buildForgeProjectScopingReply,
  shouldRescueProcedureDraft,
} from "./forgeProjectScoping.js";

/**
 * Délibération synchrone (sans LLM) — substance minimale garantie.
 * @param {{
 *   query: string,
 *   state: object,
 *   policy: object,
 *   autoDraft?: string|null,
 * }} input
 */
export function buildHeuristicDeliberation(input = {}) {
  const { query = "", state = {}, policy = {}, autoDraft = null } = input;

  if (policy.forgeProjectScoping || isForgeProjectScopingQuery(query)) {
    const answerDraft = buildForgeProjectScopingReply(query);
    return {
      interpretedGoal: "Cadrage projet Forge suffisant — brief ou squelette Vite/React.",
      missingInfo: [],
      answerDraft,
      shouldAskClarification: false,
      clarificationQuestion: "",
      addsValue: true,
      source: "heuristic_forge_scoping",
    };
  }

  if (shouldRescueProcedureDraft(query, autoDraft)) {
    const answerDraft = buildForgeProjectScopingReply(query);
    return {
      interpretedGoal: "Recadrage Forge — brouillon install/Steam rejeté.",
      missingInfo: [],
      answerDraft,
      shouldAskClarification: false,
      clarificationQuestion: "",
      addsValue: true,
      source: "heuristic_forge_rescue",
    };
  }

  const composite = policy.composite || {};
  const publicEntities = composite.publicEntities || [];
  const game = publicEntities.find((e) => e.relations?.includes("is_game") || /game/i.test(e.kind || ""));

  let interpretedGoal =
    "Clarifier ce que tu veux accomplir avant d'appliquer une procédure générique.";
  const missingInfo = [];
  let shouldAskClarification = true;
  let clarificationQuestion =
    "De quoi s'agit-il exactement — projet interne Citadelle, ou sujet externe ?";

  if (composite.composite && game) {
    interpretedGoal =
      "Lier un projet interne à un jeu public (lancement / intégration / orchestration).";
    missingInfo.push(
      "plateforme cible pour le jeu (Steam, console, EA App…)",
      "rôle du projet (automation, démo, pipeline, ou simple lancement manuel)",
    );
    shouldAskClarification = true;
    clarificationQuestion =
      "Tu veux surtout **lancer le jeu Need for Speed**, ou **structurer un projet Nexxus** qui le déclenche ?";
  } else if (state.usage === USAGE_INTENTS.EXECUTE_LAUNCH && game) {
    interpretedGoal = `Lancer ou démarrer ${game.label}.`;
    missingInfo.push("plateforme ou environnement d'exécution");
    clarificationQuestion = `Sur quelle plateforme veux-tu lancer **${game.label}** ?`;
  } else if (state.usage === USAGE_INTENTS.INTERNAL_HANDOFF) {
    interpretedGoal = "Opération interne (projet / Forge / session).";
    missingInfo.push("étape bloquante (cadrage, validation, handoff)");
    clarificationQuestion =
      "À quelle étape es-tu bloqué : cadrage, validation, ou déclenchement Forge ?";
  }

  const answerDraft = buildCompositeAnswerDraft({
    query,
    state,
    composite,
    game,
    autoDraft,
  });

  const addsValue =
    !autoDraft ||
    /procédure générale applicable/i.test(autoDraft) ||
    answerDraft.length > (autoDraft?.length || 0) + 40;

  return {
    interpretedGoal,
    missingInfo,
    answerDraft,
    shouldAskClarification,
    clarificationQuestion,
    addsValue,
    source: "heuristic",
  };
}

function buildCompositeAnswerDraft({ composite, game, autoDraft }) {
  if (!composite.composite) {
    return autoDraft || "";
  }

  const gameLabel = game?.label || "le jeu mentionné";
  const gameDef = game?.definition || "entité ludique externe";

  return [
    "Je vois **deux registres** dans ta demande : un **projet** (côté Nexxus / Citadelle) et **" + gameLabel + "** (" + gameDef + ").",
    "",
    "Une procédure du type « clarifier les livrables » ne suffit pas ici — il faut d'abord trancher l'objectif :",
    "",
    "1. **Lancer le jeu** → indique la plateforme (Steam, EA App, console…).",
    "2. **Structurer un projet interne** qui déclenche ou référence ce jeu → précise le rôle (handoff Forge, script, démo, automation).",
    "",
    "Dis-moi lequel tu vises en priorité, et j'applique le bon chemin opérationnel.",
  ].join("\n");
}

/**
 * @param {object} deliberation
 * @param {string|null} [clarificationFallback]
 */
export function materializeDeliberationReply(deliberation, clarificationFallback = null) {
  if (!deliberation) return clarificationFallback;
  if (deliberation.shouldAskClarification && deliberation.answerDraft) {
    return deliberation.answerDraft;
  }
  if (deliberation.answerDraft?.trim()) return deliberation.answerDraft.trim();
  return clarificationFallback;
}

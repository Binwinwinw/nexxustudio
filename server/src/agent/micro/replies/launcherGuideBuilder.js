/**
 * Guide de lancement — consomme uniquement état interprété + plan (pas de résolution NLP).
 */
import { buildSubjectInterpretedState } from "../subject/subjectInterpretedState.js";
import {
  planGeneralSubjectIntent,
  SUBJECT_ROUTER_ACTIONS,
} from "../subject/subjectIntentRouter.js";
import { buildSubjectClarificationReply } from "../subject/subjectResponseBuilder.js";
import {
  DETERMINISTIC_ROUTES,
  resolveDeterministicRouteHint,
} from "../subject/subjectRoutingHints.js";
import { assertDirectAnswerAllowed } from "../subject/subjectAmbiguityContract.js";
import { USAGE_INTENTS } from "../subject/subjectUsageIntent.js";
import { SUBJECT_NATURES } from "../subject/subjectIntelligenceLayer.js";
import { getEntityPlatforms, hasRelation } from "../subject/subjectGraph.js";
import { classifyConversationTurn } from "../classifiers/conversationTurnType.js";
import { isBeginnerTopicOverviewRequest } from "../../utils/beginnerTopicOverviewIntentGuards.js";

const PLATFORM_PATTERNS = [
  { id: "steam", pattern: /\bsteam\b/i, label: "Steam" },
  { id: "ea_app", pattern: /\b(ea app|origin|ea desktop)\b/i, label: "EA App" },
  {
    id: "playstation",
    pattern: /\b(playstation|ps4|ps5|psn)\b/i,
    label: "PlayStation",
  },
  { id: "xbox", pattern: /\b(xbox|xbox series|game pass)\b/i, label: "Xbox" },
  { id: "nintendo", pattern: /\b(nintendo|switch)\b/i, label: "Nintendo Switch" },
  { id: "pc", pattern: /\b(pc|windows|epic games)\b/i, label: "PC" },
];

/**
 * @param {string} query
 * @returns {string|null}
 */
export function detectLauncherPlatformHint(query = "") {
  const q = String(query || "");
  for (const entry of PLATFORM_PATTERNS) {
    if (entry.pattern.test(q)) return entry.label;
  }
  return null;
}

function isVideoGameEntity(resolvedEntityId) {
  return hasRelation(resolvedEntityId, "is_game");
}

/**
 * @param {string} label
 * @param {string|null} platform
 */
export function buildPublicGameLauncherGuide(label, platform = null, entityId = null) {
  const game = label || "ce jeu";
  const lines = [
    `Si tu veux **lancer le jeu ${game}**, le plus utile est d’abord cadrer l’environnement — ce n’est pas un handoff Forge / projet Nexxus.`,
  ];

  if (platform) {
    lines.push(
      "",
      `**${platform}** — repères usuels :`,
      `1. Ouvre la bibliothèque **${platform}** et vérifie que ${game} est installé.`,
      `2. Lance le titre depuis la bibliothèque (ou raccourci bureau si présent).`,
      `3. En cas d’échec : vérifie mises à jour du client, espace disque et connexion au compte lié.`,
    );
  } else {
    const hintPlatforms = entityId ? getEntityPlatforms(entityId) : [];
    const platformList =
      hintPlatforms.length > 0
        ? hintPlatforms.join(", ")
        : "Steam, EA App, PlayStation, Xbox";
    lines.push(
      "",
      `Il me manque surtout la **plateforme cible** : ${platformList} ou autre.`,
      `Indique-la et je pourrai te donner les étapes concrètes pour cette stack.`,
    );
  }

  lines.push(
    "",
    "Si tu parlais d’un **projet interne** qui déclenche ce jeu (script, handoff, automation), reformule avec « projet », « Forge » ou « handoff » — ce n’est pas le même chemin qu’un lancement joueur.",
  );

  return lines.join("\n");
}

/**
 * @param {object} interpreted
 * @param {object} plan
 * @param {{ query?: string }} [options]
 * @returns {{
 *   handled: boolean,
 *   reply: string|null,
 *   followupQuestion?: string|null,
 *   telemetry: object,
 * }}
 */
export function buildLauncherGuideReply(interpreted = {}, plan = {}, options = {}) {
  const state = interpreted.state || {};
  const ambiguity = interpreted.ambiguity || {};
  const query = options.query || "";
  const telemetry = {
    routeHint: plan.routeHint ?? null,
    resolvedEntityId: state.resolvedEntityId ?? null,
    usage: state.usage ?? null,
    nature: state.nature ?? null,
    memoryRecall: Boolean(state.memoryRecall),
  };

  const directGuard = assertDirectAnswerAllowed(state, ambiguity);
  if (!directGuard.ok) {
    const reply = buildSubjectClarificationReply(state, ambiguity, {
      routeHint: plan.routeHint ?? DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER,
    });
    return { handled: false, reply, followupQuestion: null, telemetry };
  }

  if (
    plan.action !== SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC ||
    plan.routeHint !== DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER
  ) {
    return { handled: false, reply: null, telemetry };
  }

  if (state.nature === SUBJECT_NATURES.COMPOSITE_MIXED) {
    const reply = buildSubjectClarificationReply(state, ambiguity, {
      routeHint: plan.routeHint,
    });
    return { handled: false, reply, followupQuestion: null, telemetry };
  }

  if (state.usage !== USAGE_INTENTS.EXECUTE_LAUNCH) {
    return { handled: false, reply: null, telemetry };
  }

  const label = state.entity?.label || state.target || "ce sujet";
  const platform = detectLauncherPlatformHint(query);

  if (isVideoGameEntity(state.resolvedEntityId)) {
    const reply = buildPublicGameLauncherGuide(label, platform, state.resolvedEntityId);
    const followupQuestion = platform
      ? null
      : `Quelle plateforme utilises-tu pour ${label} ? (Steam, EA App, PlayStation, Xbox…)`;
    return { handled: true, reply, followupQuestion, telemetry };
  }

  const reply = [
    `Tu sembles vouloir **lancer ou démarrer** ${label}.`,
    platform
      ? `Environnement détecté : **${platform}** — ouvre le client correspondant et lance l’élément depuis la bibliothèque.`
      : "Précise la **plateforme ou l’application** (Steam, console, IDE, terminal…) pour un guide pas à pas.",
    "",
    "Si c’est une **opération Citadelle / Forge**, reformule avec « projet » ou « forge ».",
  ].join("\n");

  return {
    handled: true,
    reply,
    followupQuestion: platform
      ? null
      : `Quelle plateforme ou application pour ${label} ?`,
    telemetry,
  };
}

/**
 * @param {string} query
 * @param {{ sessionId?: string|null, sessionContext?: object }} [options]
 * @returns {Promise<{ path: string, reply: string, plan: object, telemetry: object, followupQuestion?: string|null }|null>}
 */
export async function resolveLauncherGuideShortCircuit(query = "", options = {}) {
  if (isBeginnerTopicOverviewRequest(query)) return null;

  const turn = classifyConversationTurn(query, { history: options.history || [] });
  if (turn.disableLauncherHints) return null;

  const interpreted = buildSubjectInterpretedState({ query, turn, ...options });
  if (interpreted.state?.nature === SUBJECT_NATURES.COMPOSITE_MIXED) {
    return null;
  }
  const routeHint = resolveDeterministicRouteHint(interpreted.state);
  if (routeHint !== DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER) {
    return null;
  }

  const plan = planGeneralSubjectIntent(interpreted.state, interpreted.ambiguity);
  const built = buildLauncherGuideReply(interpreted, plan, { query });

  if (!built.handled) {
    if (built.reply) {
      return {
        path: "launcher_guide_clarify",
        reply: built.reply,
        plan,
        telemetry: built.telemetry,
      };
    }
    return null;
  }

  return {
    path: "launcher_guide_deterministic",
    reply: built.reply,
    plan,
    telemetry: built.telemetry,
    followupQuestion: built.followupQuestion ?? null,
  };
}

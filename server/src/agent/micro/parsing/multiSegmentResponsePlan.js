/**
 * Plan de réponse multi-segments : préambule signal + suite sur but primaire.
 */
import { resolveQueryGoals } from "./goalRoleResolver.js";
import {
  buildParseState,
  evaluateAutoReplySufficiency,
  SUFFICIENCY_TIER,
} from "./responseSufficiencyEvaluator.js";

function formatCurrentDateFr() {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function formatCurrentTimeFr() {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function buildIdentitySignal() {
  return "Je m'appelle NEXXUS, l'assistant souverain de La Citadelle.";
}

/**
 * @param {string} segmentType
 * @param {string} [segmentText]
 */
export function buildSignalPreamble(segmentType, segmentText = "") {
  const t = String(segmentText || "").toLowerCase();

  if (segmentType === "identity_lookup") {
    return buildIdentitySignal();
  }

  const wantsTime = /\b(heure|time)\b/.test(t);
  const wantsDate =
    segmentType === "time_lookup" && (/\b(date|jour)\b/.test(t) || !wantsTime);

  if (wantsDate && wantsTime) {
    return `Nous sommes le ${formatCurrentDateFr()} et il est ${formatCurrentTimeFr()}.`;
  }
  if (segmentType === "time_lookup" && wantsTime) {
    return `Il est ${formatCurrentTimeFr()}.`;
  }
  if (segmentType === "time_lookup") {
    return `Nous sommes le ${formatCurrentDateFr()}.`;
  }
  return null;
}

/**
 * Ouverture humaine vers le but primaire (sans clore la conversation).
 */
export function buildResidualFollowUpOpening(primaryGoal, primaryText = "") {
  const topic = String(primaryText || "").slice(0, 120);
  switch (primaryGoal) {
    case "purchase_advice":
      if (/\b(carte graphique|gpu|graphique|\d+\s*go)\b/i.test(topic)) {
        return "Pour une carte graphique 8 Go, le bon choix dépend surtout de ton budget, de la résolution visée (1080p, 1440p) et des jeux ou logiciels que tu utilises — je peux t'orienter sur des options cohérentes avec le marché actuel.";
      }
      return "Pour cet achat, le meilleur choix dépend de ton budget et de l'usage visé — précise ces deux points et je te propose une shortlist réaliste.";
    case "recommendation":
      return "Pour te recommander quelque chose de pertinent, j'ai besoin de cadrer l'usage et le budget — on peut affiner à partir de là.";
    case "how_to":
      return "Voici comment je peux t'accompagner sur la suite, étape par étape.";
    default:
      return "Je poursuis sur le cœur de ta demande.";
  }
}

/**
 * @param {string} rawQuery
 */
export function resolveMultiSegmentPlan(rawQuery = "") {
  const parseState = buildParseState(rawQuery);
  const { primarySegment, supportSegments, isMultiIntent, primaryGoal } =
    parseState;

  const identitySegment =
    supportSegments.find((s) => s.type === "identity_lookup") ||
    (primaryGoal === "identity_lookup" ? primarySegment : null);

  const timeSegment =
    supportSegments.find((s) => s.type === "time_lookup") ||
    (primaryGoal === "time_lookup" ? primarySegment : null);

  const signalReplies = [
    identitySegment
      ? buildSignalPreamble(identitySegment.type, identitySegment.text)
      : null,
    timeSegment
      ? buildSignalPreamble(timeSegment.type, timeSegment.text)
      : null,
  ].filter(Boolean);

  const preamble = signalReplies.length ? signalReplies.join(" ") : null;

  const detectedSignal = identitySegment
    ? "identity_lookup"
    : timeSegment
      ? "time_lookup"
      : null;

  const sufficiency = evaluateAutoReplySufficiency({
    query: rawQuery,
    detectedSignal,
    parseState,
    candidateReply: preamble,
  });

  const signalOnly =
    sufficiency.sufficient &&
    ["time_lookup", "identity_lookup"].includes(primaryGoal) &&
    supportSegments.length === 0;

  const hasResidualPrimaryGoal =
    isMultiIntent &&
    primaryGoal &&
    !["time_lookup", "identity_lookup"].includes(primaryGoal);

  const shouldDeferToPipeline =
    !sufficiency.sufficient &&
    sufficiency.tier === SUFFICIENCY_TIER.DEFER_PIPELINE;

  const followUpOpening =
    hasResidualPrimaryGoal && primarySegment
      ? buildResidualFollowUpOpening(primaryGoal, primarySegment.text)
      : null;

  return {
    ...parseState,
    preamble,
    followUpOpening,
    signalOnly,
    hasResidualPrimaryGoal,
    shouldDeferToPipeline,
    sufficiency,
    responsePlan: signalOnly
      ? ["answer_signal_only"]
      : preamble
        ? ["answer_context_briefly", "continue_on_primary_goal"]
        : ["continue_on_primary_goal"],
  };
}

/**
 * Hint système pour SIMPLE_FAST / méta — ne pas s'arrêter au préambule.
 */
export function buildMultiSegmentSystemHint(plan) {
  if (!plan?.shouldDeferToPipeline) return "";
  const parts = [
    "RÈGLE MULTI-SEGMENTS : la requête comporte un contexte ET un but principal.",
    "Tu dois produire une réponse en deux temps dans un seul message :",
  ];
  if (plan.preamble) {
    parts.push(`1) Commence exactement par : « ${plan.preamble} »`);
  }
  if (plan.followUpOpening) {
    parts.push(
      `2) Enchaîne immédiatement avec une suite utile du type : « ${plan.followUpOpening} » puis développe si nécessaire (concis, concret, pas de méta-discours).`,
    );
  } else {
    parts.push(
      "2) Réponds ensuite au but principal de la requête sans t'arrêter au contexte.",
    );
  }
  parts.push(
    "Ne traite jamais le signal contextuel (date/heure) comme la réponse finale unique.",
  );
  return parts.join("\n");
}

/**
 * Réponse déterministe composée (signaux seuls ou préambule + ouverture légère).
 */
export function buildCompositeDeterministicReply(plan) {
  if (!plan) return null;
  if (plan.signalOnly && plan.preamble) {
    return plan.preamble;
  }
  if (plan.preamble && plan.followUpOpening && !plan.shouldDeferToPipeline) {
    return `${plan.preamble}\n\n${plan.followUpOpening}`;
  }
  return plan.preamble || null;
}

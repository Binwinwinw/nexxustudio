/**
 * P4 — Interprète de requête gouverné (normaliser → hypothétiser → clarifier si nécessaire).
 * Ne remplace pas les micro-outils de réponse : prépare une lecture fiable de la demande.
 */
import { parseFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { extractConversationState, readRecentTurns } from "../continuity/conversationContinuityContext.js";
import {
  canonicalizeRequest,
  normalizeRequest,
  needsRequestInterpretation,
} from "./requestNormalizer.js";
import { buildIntentHypotheses, pickBestHypothesis } from "./intentHypothesisBuilder.js";
import { detectAmbiguities } from "./ambiguityDetector.js";
import {
  decideInterpreterAction,
  INTERPRETER_ACTIONS,
  REQUEST_INTERPRETER_RULE,
} from "./clarificationPolicy.js";

export { REQUEST_INTERPRETER_RULE, INTERPRETER_ACTIONS };

export function isRequestInterpreterEnabled() {
  const flag = process.env.REQUEST_INTERPRETER;
  if (flag === "0" || flag === "false") return false;
  return true;
}

function shouldRunInterpreter(raw = "", normalized = "") {
  if (parseFamiliarityQuery(raw) && !needsRequestInterpretation(normalized)) {
    return false;
  }
  if (needsRequestInterpretation(normalized)) return true;
  if (parseFamiliarityQuery(raw)) return true;
  if (/\b(truc|je sais pas comment dire|tu vois)\b/.test(normalized)) return true;
  if (/\b(ca|cela|ce truc)\b/.test(normalized)) return true;
  return false;
}

/**
 * @param {string} rawQuery
 * @param {{ history?: Array<{ role: string, content: string }>, enabled?: boolean }} [options]
 */
export function interpretRequest(rawQuery = "", options = {}) {
  const enabled = options.enabled ?? isRequestInterpreterEnabled();
  const norm = normalizeRequest(rawQuery);

  const base = {
    rawQuery: norm.raw,
    normalizedQuery: norm.normalized,
    canonicalQuery: null,
    hypotheses: [],
    ambiguities: [],
    bestHypothesis: null,
    confidence: 0,
    nextAction: INTERPRETER_ACTIONS.ROUTE,
    clarificationReply: null,
    pendingSubjectLabel: null,
    rule: REQUEST_INTERPRETER_RULE,
  };

  if (!enabled || !norm.normalized) {
    return { ...base, nextAction: INTERPRETER_ACTIONS.ROUTE, canonicalQuery: rawQuery };
  }

  if (!shouldRunInterpreter(norm.raw, norm.normalized)) {
    return { ...base, nextAction: INTERPRETER_ACTIONS.ROUTE, canonicalQuery: rawQuery };
  }

  const turns = readRecentTurns(options.history || []);
  const state = extractConversationState(turns);
  const contextSubjectLabel = state.activeSubjectLabel || null;

  const { canonical, reason: canonicalReason } = canonicalizeRequest(
    norm.normalized,
    norm.stripped,
  );

  const hypotheses = buildIntentHypotheses({
    raw: norm.raw,
    normalized: norm.normalized,
    canonical,
    contextSubjectLabel,
  });

  const ambiguities = detectAmbiguities({
    normalized: norm.normalized,
    hypotheses,
    contextSubjectLabel,
  });

  const best = pickBestHypothesis(hypotheses);
  const decision = decideInterpreterAction({
    best,
    ambiguities,
    hypotheses,
    canonical,
  });

  return {
    ...base,
    canonicalQuery: decision.canonicalQuery || canonical || null,
    canonicalReason: canonicalReason || null,
    hypotheses,
    ambiguities,
    bestHypothesis: best,
    confidence: decision.confidence ?? best?.confidence ?? 0,
    nextAction: decision.action,
    clarificationReply: decision.reply ?? null,
    pendingSubjectLabel: decision.pendingSubjectLabel ?? null,
    hypothesis: decision.hypothesis ?? best,
  };
}

/**
 * Applique l'interprétation au texte effectivement routé vers les micro-outils.
 */
export function resolveEffectiveQuery(rawQuery = "", interpretation = null) {
  if (!interpretation) return rawQuery;
  if (interpretation.nextAction === INTERPRETER_ACTIONS.RESPOND && interpretation.canonicalQuery) {
    return interpretation.canonicalQuery;
  }
  return rawQuery;
}

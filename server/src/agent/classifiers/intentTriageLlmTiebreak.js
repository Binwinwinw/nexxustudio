/**
 * Tie-break LLM local optionnel pour le tri d'intention.
 * Activé uniquement si confidence === "low" et INTENT_TRIAGE_OLLAMA=1.
 * Fail-closed : retour au tri règles+scores si Ollama indisponible ou JSON invalide.
 */
import {
  TRIAGE_CONFIDENCE,
  TRIAGE_INTENTS,
  TRIAGE_ROUTING_ACTION,
} from "./intentTriageClassifier.js";

const DEFAULT_MODEL = process.env.OLLAMA_INTENT_TRIAGE_MODEL || "zephyr";
const TIMEOUT_MS = parseInt(process.env.INTENT_TRIAGE_TIMEOUT_MS || "3500", 10);

function isTieBreakEnabled() {
  return process.env.INTENT_TRIAGE_OLLAMA === "1";
}

const VALID_INTENTS = new Set(Object.values(TRIAGE_INTENTS));
const VALID_CONFIDENCE = new Set(Object.values(TRIAGE_CONFIDENCE));

const SYSTEM_PROMPT = `Tu es un micro-classifieur d'intention pour Nexxus Studio (100% local).
Réponds UNIQUEMENT en JSON valide, sans markdown, avec exactement ces clés :
top_intent (string),
runner_up (string|null),
confidence ("high"|"medium"|"low"),
confidence_score (number 0.05-0.99),
needs_clarification (boolean).

Intentions autorisées : ${[...VALID_INTENTS].join(", ")}.
Si le texte contient du code exécutable et des erreurs, privilégie code_review ou code_debug plutôt que document_analysis.
Si la demande est un résumé sans code, privilégie document_analysis.
Un seul tour. Aucun texte hors JSON.`;

function safeJsonParse(text = "") {
  const trimmed = String(text).trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function resolveRoutingAction(confidence, needs_clarification) {
  if (needs_clarification) return TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION;
  if (confidence === TRIAGE_CONFIDENCE.HIGH) return TRIAGE_ROUTING_ACTION.ROUTE_DIRECT;
  return TRIAGE_ROUTING_ACTION.ROUTE_LABELED;
}

function normalizeLlmTriage(parsed, ruleTriage) {
  if (!parsed || typeof parsed !== "object") return null;

  const top_intent = VALID_INTENTS.has(parsed.top_intent)
    ? parsed.top_intent
    : ruleTriage.top_intent;
  const runner_up =
    parsed.runner_up === null || parsed.runner_up === undefined
      ? ruleTriage.runner_up
      : VALID_INTENTS.has(parsed.runner_up)
        ? parsed.runner_up
        : ruleTriage.runner_up;

  const confidence = VALID_CONFIDENCE.has(parsed.confidence)
    ? parsed.confidence
    : TRIAGE_CONFIDENCE.MEDIUM;

  let confidence_score = Number(parsed.confidence_score);
  if (!Number.isFinite(confidence_score)) {
    confidence_score = ruleTriage.confidence_score;
  }
  confidence_score = Math.min(0.99, Math.max(0.05, confidence_score));

  const needs_clarification =
    typeof parsed.needs_clarification === "boolean"
      ? parsed.needs_clarification
      : confidence === TRIAGE_CONFIDENCE.LOW;

  const routing_action = resolveRoutingAction(confidence, needs_clarification);

  return {
    top_intent,
    runner_up,
    confidence,
    confidence_score: Number(confidence_score.toFixed(3)),
    needs_clarification,
    routing_action,
    score_gap: ruleTriage.score_gap,
    signals: [...(ruleTriage.signals || []), "llm_tiebreak"],
    scores: ruleTriage.scores,
    tiebreak_source: "ollama",
  };
}

export function isIntentTriageLlmEnabled() {
  return isTieBreakEnabled();
}

export function shouldAttemptLlmTiebreak(triage = {}) {
  return isTieBreakEnabled() && triage.confidence === TRIAGE_CONFIDENCE.LOW;
}

/**
 * @param {{
 *   query: string,
 *   ruleTriage: object,
 *   llmClient?: { chat: Function },
 *   model?: string,
 * }} input
 */
export async function applyIntentTriageLlmTiebreak(input = {}) {
  const { query, ruleTriage, llmClient, model = DEFAULT_MODEL } = input;

  if (!shouldAttemptLlmTiebreak(ruleTriage)) {
    return { triage: ruleTriage, usedLlm: false, source: "rules_only" };
  }

  const llmTriage = await tryOllamaTiebreak({
    query,
    ruleTriage,
    llmClient,
    model,
  });

  if (!llmTriage) {
    return { triage: ruleTriage, usedLlm: false, source: "rule_fallback" };
  }

  return { triage: llmTriage, usedLlm: true, source: "ollama_tiebreak", model };
}

async function tryOllamaTiebreak({ query, ruleTriage, llmClient, model }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const client =
      llmClient ?? (await import("../../llm/ollama.js")).default;

    const userPayload = JSON.stringify(
      {
        query: String(query || "").slice(0, 1200),
        rule_top_intent: ruleTriage.top_intent,
        rule_runner_up: ruleTriage.runner_up,
        rule_confidence: ruleTriage.confidence,
        rule_confidence_score: ruleTriage.confidence_score,
        rule_signals: (ruleTriage.signals || []).slice(-6),
      },
      null,
      0,
    );

    const raw = await client.chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      model,
      {
        temperature: 0.05,
        num_predict: 120,
        signal: controller.signal,
      },
    );

    const text =
      typeof raw === "string"
        ? raw
        : raw?.message?.content || raw?.content || "";
    const parsed = safeJsonParse(text);
    return normalizeLlmTriage(parsed, ruleTriage);
  } catch (err) {
    console.warn("[intentTriageLlmTiebreak] Ollama skip:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

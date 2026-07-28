import { getClientForModel } from "../../../llm/llmFactory.js";
import { AGENT_ROLES } from "../../policies/agentRolePolicy.js";
import { shouldBypassLocalDatetimeShortCircuit } from "../../utils/externalCalendarLookupIntentGuards.js";
import {
  isComprehensionDemonstrationRequest,
  isMetaAssistantBehaviorRequest,
} from "../../utils/metaAssistantBehaviorGuards.js";
import { shouldSuppressTurnFamilyPath } from "./conversationTurnClassifier.js";

const SYSTEM_PROMPT = `You are a semantic intent resolver for a conversational assistant.
Your job is not to answer the user.
Your job is to classify the message into one canonical intent and output strict JSON only.

Available intents:
- social_checkin
- time_lookup
- identity_lookup
- familiarity
- how_to
- recommendation
- purchase_advice
- general_explain
- unknown

Rules:
- Prefer the most specific intent over general_explain.
- If the user asks for date/day/time, use time_lookup.
- If the user asks how the assistant feels or is doing, use social_checkin.
- If uncertain, lower confidence rather than guessing.
- If ambiguity remains, set needsClarification=true and provide one short clarification question.
- Output valid JSON only, exactly matching this schema:
{
  "version": "1.0",
  "intent": "string",
  "subIntent": "string|null",
  "confidence": 0.0 to 1.0,
  "entities": {
    "subject": "string|null",
    "datetimeKind": "string|null",
    "target": "string|null",
    "action": "string|null"
  },
  "multiIntent": boolean,
  "needsClarification": boolean,
  "clarificationQuestion": "string|null",
  "recommendedPipeline": "deterministic_reply" | "micro_reply" | "clarify_then_build" | "main_llm",
  "reason": "string"
}
No markdown, no explanation, only the JSON block.`;

const VALID_INTENTS = new Set([
  "social_checkin",
  "time_lookup",
  "identity_lookup",
  "familiarity",
  "how_to",
  "recommendation",
  "purchase_advice",
  "general_explain",
  "unknown"
]);

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

export function validateSemanticIntentResolution(json) {
  if (!json || typeof json !== "object") return null;
  if (!VALID_INTENTS.has(json.intent)) return null;
  if (typeof json.confidence !== "number") return null;

  return {
    version: json.version || "1.0",
    intent: json.intent,
    subIntent: json.subIntent || null,
    confidence: json.confidence,
    entities: json.entities || { subject: null, datetimeKind: null, target: null, action: null },
    multiIntent: Boolean(json.multiIntent),
    needsClarification: Boolean(json.needsClarification),
    clarificationQuestion: json.clarificationQuestion || null,
    recommendedPipeline: json.recommendedPipeline || "main_llm",
    reason: json.reason || ""
  };
}

export function shouldUseSemanticResolution(resolution, context = { mode: "shadow" }) {
  if (!resolution) return false;
  if (context.mode === "shadow") return false;

  const q = context.query || "";
  if (isComprehensionDemonstrationRequest(q) || isMetaAssistantBehaviorRequest(q)) {
    return false;
  }
  if (shouldSuppressTurnFamilyPath(context.turnClassification, "semantic_intent_resolver")) {
    return false;
  }

  if (
    resolution.intent === "time_lookup" &&
    shouldBypassLocalDatetimeShortCircuit(context.query || "")
  ) {
    return false;
  }

  // Assist mode whitelist - ONLY these intents are allowed for now
  const allowedInAssistMode = new Set(["time_lookup", "social_checkin"]);
  if (!allowedInAssistMode.has(resolution.intent)) {
    return false;
  }

  if (resolution.confidence >= 0.85) return true;
  
  if (resolution.confidence >= 0.60 && resolution.confidence < 0.85) {
    // Both time_lookup and social_checkin are safe enough at medium confidence
    return true;
  }

  return false;
}

export async function resolveSemanticIntent(input = {}) {
  const { query, normalizedQuery, conversationContext, deterministicSignals } = input;
  
  const startTime = performance.now();
  let rawResponse = "";
  let parsed = null;
  let validated = null;
  
  try {
    const client = getClientForModel(AGENT_ROLES.SEMANTIC_ROUTER);
    
    const userPayload = JSON.stringify({
      query,
      normalizedQuery,
      conversationContext: conversationContext || { lastIntent: null, lastResolvedSubject: null, turnIndex: 0 },
      deterministicSignals: deterministicSignals || { matched: false, matchedType: null }
    }, null, 2);

    const result = await client.chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPayload }
    ], AGENT_ROLES.SEMANTIC_ROUTER, {
      temperature: 0.05,
      num_predict: 250,
      format: "json"
    });

    rawResponse = typeof result === "string" ? result : (result?.message?.content || result?.content || "");
    parsed = safeJsonParse(rawResponse);
    validated = validateSemanticIntentResolution(parsed);
  } catch (err) {
    console.warn("[semanticIntentResolver] LLM error:", err.message);
  }

  const latencyMs = performance.now() - startTime;
  const jsonValid = !!validated;
  
  const logEntry = {
    stage: "semantic_intent_resolver",
    query,
    intent: validated?.intent || null,
    subIntent: validated?.subIntent || null,
    confidence: validated?.confidence || null,
    recommendedPipeline: validated?.recommendedPipeline || null,
    needsClarification: validated?.needsClarification || false,
    jsonValid,
    latencyMs: Math.round(latencyMs)
  };

  return {
    resolution: validated,
    logEntry,
    rawResponse
  };
}

import {
  buildHeuristicDeliberation,
  materializeDeliberationReply,
} from "./heuristicDeliberation.js";
import { DELIBERATION_MODES } from "./subjectDeliberationPolicy.js";
import {
  isForgeProjectScopingQuery,
  buildForgeProjectScopingReply,
  shouldRescueProcedureDraft,
  isInstallClarificationDraft,
} from "./forgeProjectScoping.js";

const DEFAULT_MINI_MODEL =
  process.env.OLLAMA_MINI_DELIBERATION_MODEL || "zephyr";
/** Opt-in : MINI_DELIBERATION_OLLAMA=1 pour Zephyr (sinon heuristique sync). */
const MINI_DELIBERATION_ENABLED = process.env.MINI_DELIBERATION_OLLAMA === "1";
const MINI_TIMEOUT_MS = parseInt(process.env.MINI_DELIBERATION_TIMEOUT_MS || "4500", 10);

const SYSTEM_PROMPT = `Tu fais une vérification de compréhension courte pour Nexxus Studio.
Réponds UNIQUEMENT en JSON valide, sans markdown, avec les clés :
interpretedGoal (string ~80 chars max),
missingInfo (array of strings),
answerDraft (string ~400 chars max, français, utile, pas de procédure vide),
shouldAskClarification (boolean),
clarificationQuestion (string ~120 chars max),
shouldUseRewrite (boolean),
detectedDraftIssue (string ~80 chars max).
Ne répète pas une procédure générique sans substance.
Si cadrage projet Forge (React/Vite, livrables, MVP), ne demande jamais Steam, OS ou install logicielle.
Réécris le brouillon : brief Forge exécutable ou squelette projet.`;

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

function deliberationAddsValue(parsed, heuristic, autoDraft, query = "") {
  if (!parsed?.answerDraft) return false;
  if (/procédure générale applicable/i.test(parsed.answerDraft)) return false;
  if (isInstallClarificationDraft(parsed.answerDraft)) return false;
  if (isForgeProjectScopingQuery(query) && isInstallClarificationDraft(autoDraft)) {
    return parsed.shouldUseRewrite !== false;
  }
  if (!autoDraft) return true;
  return (
    parsed.answerDraft.length > autoDraft.length + 30 ||
    (parsed.missingInfo?.length > 0 && heuristic.addsValue)
  );
}

/**
 * Mini slow path — heuristique d'abord, Zephyr/Ollama si activé et rapide.
 * @param {{
 *   query: string,
 *   interpreted: object,
 *   policy: object,
 *   autoDraft?: string|null,
 *   llmClient?: object,
 * }} input
 */
export async function runMiniDeliberation(input = {}) {
  const { query, interpreted, policy, autoDraft = null, llmClient, forceForgeScoping = false } =
    input;
  const state = interpreted?.state || {};
  const policyWithForge =
    forceForgeScoping || isForgeProjectScopingQuery(query)
      ? { ...policy, forgeProjectScoping: true }
      : policy;

  const heuristic = buildHeuristicDeliberation({
    query,
    state,
    policy: policyWithForge,
    autoDraft,
  });

  if (shouldRescueProcedureDraft(query, autoDraft) && !forceForgeScoping) {
    return {
      ...heuristic,
      enrichedReply: buildForgeProjectScopingReply(query),
      usedLlm: false,
      source: "forge_scoping_rescue",
    };
  }

  if (policy.deliberationMode === DELIBERATION_MODES.NONE) {
    return {
      ...heuristic,
      enrichedReply: autoDraft || heuristic.answerDraft,
      usedLlm: false,
    };
  }

  let llmResult = null;
  if (
    MINI_DELIBERATION_ENABLED &&
    policy.deliberationMode !== DELIBERATION_MODES.NONE
  ) {
    llmResult = await tryOllamaDeliberation({
      query,
      state,
      policy,
      heuristic,
      llmClient,
    });
  }

  if (llmResult && deliberationAddsValue(llmResult, heuristic, autoDraft, query)) {
    return {
      ...llmResult,
      enrichedReply: materializeDeliberationReply(llmResult, heuristic.answerDraft),
      usedLlm: true,
      source: "ollama",
      model: DEFAULT_MINI_MODEL,
    };
  }

  return {
    ...heuristic,
    enrichedReply: materializeDeliberationReply(heuristic, autoDraft),
    usedLlm: false,
    source: "heuristic",
  };
}

async function tryOllamaDeliberation({ query, state, policy, heuristic, llmClient }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MINI_TIMEOUT_MS);

  try {
    const client =
      llmClient ?? (await import("../../../llm/ollama.js")).default;
    const userPayload = JSON.stringify(
      {
        query,
        subject: {
          nature: state.nature,
          label: state.entity?.label ?? state.target,
          resolvedEntityId: state.resolvedEntityId,
          confidence: state.confidence,
          usage: state.usage,
        },
        composite: policy.composite,
        heuristicGoal: heuristic.interpretedGoal,
      },
      null,
      0,
    );

    const raw = await client.chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      DEFAULT_MINI_MODEL,
      {
        temperature: 0.15,
        num_predict: 280,
        signal: controller.signal,
      },
    );

    const text =
      typeof raw === "string"
        ? raw
        : raw?.message?.content || raw?.content || "";
    const parsed = safeJsonParse(text);
    if (!parsed) return null;

    return {
      interpretedGoal: String(parsed.interpretedGoal || heuristic.interpretedGoal),
      missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [],
      answerDraft: String(parsed.answerDraft || ""),
      shouldAskClarification: Boolean(parsed.shouldAskClarification),
      clarificationQuestion: String(
        parsed.clarificationQuestion || heuristic.clarificationQuestion,
      ),
      addsValue: true,
    };
  } catch (err) {
    console.warn("[miniDeliberation] Ollama skip:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

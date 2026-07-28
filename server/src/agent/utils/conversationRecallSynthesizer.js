/**
 * Tier 2 — synthèse conversationnelle via LLM léger + contrat strict.
 * Fallback template (Tier 1) si historique vide ou erreur LLM.
 */
import { AGENT_ROLES } from "../policies/agentRolePolicy.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../config/modeResponseContracts.js";
import responseThinkingCleaner from "./responseThinkingCleaner.js";
import {
  buildConversationRecallResponse,
  buildRecallFooter,
  filterRecallHistoryEntries,
  formatRecallTranscript,
} from "./conversationGuards.js";
import validateRecallGrounding from "./recallGroundingValidator.js";

const RECALL_SYSTEM_PROMPT = `Tu es NEXXUS, gardien de La Citadelle.
Mode RAPPEL CONVERSATIONNEL (Tier 2) :
- Synthétise le fil fourni en français, 80 à 140 mots.
- Ne cite QUE ce qui figure dans l'historique transmis.
- N'invente PAS de dates (« hier », « la semaine dernière ») sauf si elles apparaissent dans l'historique.
- Pas de balises XML, pas de méta-discours, pas de consignes recopiées.
- Règle de politesse (Mixte Social + Tâche) : Si la requête de l'utilisateur contient une salutation ou un check-in social en ouverture (ex: "yépa", "salut l'ami", "ça va"), réponds TOUJOURS d'abord par un micro-check-in naturel et chaleureux en une phrase avant de traiter la demande.
- Structure : un paragraphe de synthèse, puis 2 à 4 puces des sujets ou décisions clés.
- Si l'historique est trop pauvre, dis-le honnêtement sans refuser brutalement.`;

const MIN_ENTRIES_FOR_LLM = 2;

function extractAssistantText(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  return (
    response.message?.content ||
    response.content ||
    response.response ||
    ""
  );
}

function isLowQualityRecall(text = "") {
  const cleaned = String(text).trim();
  if (cleaned.length < 24) return true;
  if (cleaned.includes(INSUFFICIENT_SIGNAL_REFUSAL)) return true;
  if (/je n'ai pas assez d'éléments fiables/i.test(cleaned)) return true;
  if (/La réponse visible ne doit contenir aucune balise/i.test(cleaned)) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @param {Array<{ role: string, content: string }>} history
 * @param {{ onStep?: Function, llmClient?: object, model?: string }} [options]
 */
export async function synthesizeConversationRecall(
  query = "",
  history = [],
  { onStep, llmClient, model = AGENT_ROLES.CHAT } = {},
) {
  const fallback = () => buildConversationRecallResponse(query, history);
  const entries = filterRecallHistoryEntries(query, history, 20);

  if (entries.length < MIN_ENTRIES_FOR_LLM) {
    return fallback();
  }

  const client =
    llmClient ??
    (await import("../../llm/llmFactory.js")).getClientForModel(model);
  const transcript = formatRecallTranscript(entries);

  if (onStep) onStep("🧠 Synthèse conversationnelle (Tier 2)...");

  try {
    const response = await client.chat(
      [
        { role: "system", content: RECALL_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Demande utilisateur : ${query}\n\nHistorique du fil :\n${transcript}`,
        },
      ],
      model,
      { num_predict: 320, temperature: 0.15 },
    );

    let text = responseThinkingCleaner.clean(extractAssistantText(response));
    if (isLowQualityRecall(text)) {
      return fallback();
    }

    const grounding = validateRecallGrounding(text, entries);
    if (!grounding.ok) {
      console.warn(
        "[RecallSynthesizer] Violation grounding, fallback template:",
        grounding.violations.map((v) => v.token).join(", "),
      );
      return fallback();
    }

    const footer = buildRecallFooter(query);
    return `${text.trim()}\n\n${footer}`;
  } catch (error) {
    console.warn("[RecallSynthesizer] Fallback template:", error.message);
    return fallback();
  }
}

export default synthesizeConversationRecall;

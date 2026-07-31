/**
 * P3 — Synthèse LLM bornée pour sujets generic_topic après acceptation d'aperçu.
 * Fallback déterministe si LLM indisponible ou réponse de mauvaise qualité.
 */
import { AGENT_ROLES } from "../../policies/core/index.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";
import responseThinkingCleaner from "../../utils/responseThinkingCleaner.js";
import { sanitizeQuery } from "../normalization/querySanitizer.js";

const DEEPENING_SYSTEM_PROMPT = `Tu es NEXXUS, gardien de La Citadelle.
Mode APERÇU SUJET (P3 borné) :
- Donne un aperçu simple et honnête du sujet demandé, en français, 60 à 100 mots.
- Reste généraliste si tu manques de certitude ; n'invente pas de dates, chiffres ou faits précis douteux.
- Pas de balises XML, pas de méta-discours, pas de consignes recopiées.
- Termine par une question courte pour préciser l'angle souhaité.`;

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

function labelTokens(label = "") {
  return sanitizeQuery(label)
    .replace(/^(le|la|les|l)\s+/, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function isLowQualityDeepening(text = "", subject = {}) {
  const cleaned = String(text).trim();
  if (cleaned.length < 36) return true;
  if (cleaned.length > 900) return true;
  if (cleaned.includes(INSUFFICIENT_SIGNAL_REFUSAL)) return true;
  if (/je n'ai pas assez d'éléments fiables/i.test(cleaned)) return true;
  if (/La réponse visible ne doit contenir aucune balise/i.test(cleaned)) return true;
  if (/<\/?[a-z]/i.test(cleaned)) return true;

  const tokens = labelTokens(subject.label || "");
  if (!tokens.length) return false;
  const probe = sanitizeQuery(cleaned);
  const hit = tokens.some((token) => probe.includes(token));
  return !hit;
}

function wrapDeepeningReply(body = "", subject = {}) {
  const trimmed = body.trim();
  if (/^D'accord, voici un aperçu rapide/i.test(trimmed)) return trimmed;
  return `D'accord, voici un aperçu rapide.\n${trimmed}`;
}

/**
 * @param {object} subject
 * @param {{ onStep?: Function, llmClient?: object, model?: string, fallbackReply?: string }} [options]
 */
export async function synthesizeBoundedSubjectDeepening(
  subject = {},
  { onStep, llmClient, model = AGENT_ROLES.CHAT, fallbackReply = null } = {},
) {
  const fallback = () =>
    fallbackReply ||
    `D'accord, voici un aperçu rapide sur ${subject.label || "ce sujet"}.\nDis-moi ce que tu veux approfondir et je te réponds précisément.`;

  if (!subject?.label) return fallback();

  const client =
    llmClient ??
    (await import("../../../llm/llmFactory.js")).getClientForModel(model);

  if (onStep) onStep("📖 Aperçu sujet — enrichissement borné (P3)...");

  try {
    const response = await client.chat(
      [
        { role: "system", content: DEEPENING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Sujet : ${subject.label}\nForme : ${subject.subjectShape || "generic_topic"}\nConsigne : donne un aperçu simple, accessible, sans spéculation risquée.`,
        },
      ],
      model,
      { num_predict: 220, temperature: 0.2 },
    );

    let text = responseThinkingCleaner.clean(extractAssistantText(response));
    if (isLowQualityDeepening(text, subject)) {
      return fallback();
    }

    return wrapDeepeningReply(text, subject);
  } catch (error) {
    console.warn("[SubjectDeepening P3] Fallback déterministe:", error.message);
    return fallback();
  }
}

export default synthesizeBoundedSubjectDeepening;

/**
 * G45 — grounding explicite : preuve de compréhension conversationnelle.
 * Distinct du social_checkin (« comment ça va ») et du meta_feedback routage.
 */
import { isComprehensionDemonstrationRequest } from "../utils/metaAssistantBehaviorGuards.js";
import { isIdeationIntent } from "../utils/ideationIntentGuards.js";

export const COMPREHENSION_GROUNDING_RULE = "comprehension_grounding_g45";

const GREETING_RE = /\b(?:salut|bonjour|coucou|hello)\b/i;
const IDEATION_RE =
  /\b(?:quel projet|mettre sur pied|mettre en place|projet pourrions|quoi construire|quoi faire)\b/i;
const REPAIR_RE = /\b(?:pas compris|mal interpr|pas compris ce que)\b/i;
const META_CRITIQUE_RE =
  /\b(?:ne veut pas reflechir|ne veux pas reflechir|ne veut pas réfléchir|ne veux pas réfléchir|uniquement repondre|uniquement répondre)\b/i;

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string[]}
 */
function extractConversationBullets(history = []) {
  const userTexts = (Array.isArray(history) ? history : [])
    .filter((m) => m?.role === "user")
    .map((m) => String(m.content || "").trim())
    .filter(Boolean);

  const bullets = [];

  if (userTexts.some((t) => GREETING_RE.test(t))) {
    bullets.push(
      "Tu m'as salué pour ouvrir la conversation — accueil neutre, sans projet actif en session.",
    );
  }
  if (userTexts.some((t) => IDEATION_RE.test(t) || isIdeationIntent(t))) {
    bullets.push(
      "Tu as demandé **quels projets on pourrait mettre sur pied** — dans un contexte dev / La Citadelle, pas des idées génériques déconnectées (bibliothèque locale, salles publiques…).",
    );
  }
  if (userTexts.some((t) => REPAIR_RE.test(t))) {
    bullets.push(
      "Tu as signalé que ma réponse précédente n'était pas assez claire ou pas assez ancrée.",
    );
  }
  if (userTexts.some((t) => META_CRITIQUE_RE.test(t))) {
    bullets.push(
      "Tu m'as reproché de **répondre sans réfléchir** à ta demande — tu veux une réponse qui montre qu'on a saisi ton intention, pas un pipeline par défaut.",
    );
  }

  if (bullets.length === 0) {
    const lastUser = userTexts[userTexts.length - 1];
    if (lastUser) {
      bullets.push(
        `Dernier message utilisateur notable : « ${lastUser.slice(0, 120)}${lastUser.length > 120 ? "…" : ""} ».`,
      );
    }
  }

  return bullets;
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string}
 */
export function buildConversationGroundingReply(query = "", history = []) {
  const bullets = extractConversationBullets(history);

  const stateBlock =
    bullets.length > 0
      ? bullets.map((b) => `- ${b}`).join("\n")
      : "- Fil court — pas encore de sujet métier précis.";

  return [
    "Tu demandes **quand** je peux montrer que j'ai compris — voici ce que je retiens de notre conversation :",
    "",
    stateBlock,
    "",
    "Pour te le prouver concrètement, je peux :",
    "1. **Reformuler** ton besoin actuel en une phrase (tu valides ou tu corriges).",
    "2. **Proposer 2–3 premiers pas** ancrés La Citadelle (SaaS React/Vite, doc, orchestration locale légère) — sans orchestrateur ni plan de présentation lourd.",
    "",
    "Si ton besoin actuel, c'est bien *« un projet tech qu'on attaque ensemble »*, dis-le — ou précise l'angle (code, doc, archi). Je m'aligne et on avance étape par étape.",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string, groundingKind: string }|null}
 */
export function resolveComprehensionGroundingShortCircuit(
  query = "",
  options = {},
) {
  if (!isComprehensionDemonstrationRequest(query)) return null;
  return {
    path: "comprehension_grounding_deterministic",
    reply: buildConversationGroundingReply(query, options.history || []),
    groundingKind: "conversation_state_dump",
  };
}

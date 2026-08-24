/**
 * Langue de sortie = langue dominante de l'utilisateur.
 * Jamais la langue des sources / titres / extraits.
 */
import {
  LANGUAGE_NAME_FROM_CODE,
  normalizeLanguageLabel,
} from "../../utils/intent-guards/translationIntentGuards.js";

export const OUTPUT_LANGUAGE_RULE = "output_language_follows_user_v1";

export const OUTPUT_LANGUAGE_CODES = Object.freeze(["fr", "en", "es", "de"]);

const PRODUCT_NOISE_RE =
  /\b(?:windows(?:\s*\d+(?:\.\d+)?)?|win\s*\d+|microsoft|linux|macos|android|ios|github|gitlab|pdf|office|chrome|firefox|iphone|ipad|macbook|google|softonic|tecnovortex)\b/gi;

const URL_RE = /https?:\/\/[^\s]+/gi;

const EXPLICIT_OUTPUT_LANGUAGE_RE =
  /\b(?:r[ée]ponds(?:[- ]?moi)?|r[ée]pondez|answer|respond|reply|responde|contesta|traduis|traduire|translate|analyse(?:r)?|analyze|analiza)\b[\s\S]{0,80}?\b(?:en|in|into|vers)\s+(?:l['']?)?(anglais|english|fran[cç]ais|francais|french|espagnol|spanish|espa[nñ]ol|allemand|german|deutsch|italien|italian|portugais|portuguese)\b/i;

const EXPLICIT_ANSWER_IN_RE =
  /\b(?:answer|respond|reply|responde|contesta)\s+in\s+(english|french|spanish|german|italiano?|portuguese)\b/i;

const FR_MARKERS =
  /\b(?:que|qui|les?|une?|des|dans|pour|avec|pas|est|sont|tu|je|nous|vous|mon|ton|mes|tes|cette|cet|aux|du|au|sur|mais|donc|aussi|très|tres|bien|plus|sans|comme|quand|comment|pourquoi|peux|peut|fait|faire|être|etre|avoir|suis|été|ete|ça|ca|penses?|avis)\b/gi;

const EN_MARKERS =
  /\b(?:the|and|you|what|do|does|did|think|about|with|for|this|that|not|are|was|were|have|has|from|your|my|can|would|could|should|please|thanks|how|why|when|which|into|about)\b/gi;

const ES_MARKERS =
  /\b(?:qué|que|piensas?|opinas?|est[áa]|estoy|como|cómo|para|con|una?|los|las|del|por|más|mas|pero|muy|también|tambien|gracias|puedes?|hacer|sobre|desde|este|esta|estos|estas)\b/gi;

const DE_MARKERS =
  /\b(?:was|denkst|über|uber|und|der|die|das|ein|eine|nicht|ist|sind|mit|für|fur|auf|ich|du|sie|bitte|warum|wie)\b/gi;

const BLOCK_REPLY = Object.freeze({
  fr: "Je n'ai pas pu garder cette réponse dans ta langue. Réessaie.",
  en: "I couldn't keep this answer in your language. Please retry.",
  es: "No pude mantener esta respuesta en tu idioma. Inténtalo de nuevo.",
  de: "Ich konnte die Antwort nicht in deiner Sprache halten. Bitte erneut versuchen.",
});

const LANGUAGE_LABEL = Object.freeze({
  fr: "français",
  en: "English",
  es: "español",
  de: "Deutsch",
});

function stripNoise(text = "") {
  return String(text || "")
    .replace(URL_RE, " ")
    .replace(PRODUCT_NOISE_RE, " ")
    .replace(/[^\p{L}\s¿¡']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text, re) {
  const src = re.source;
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const matches = String(text || "").match(new RegExp(src, flags));
  return matches ? matches.length : 0;
}

/**
 * @param {string} text
 * @returns {{ code: string, scores: Record<string, number>, confidence: "high"|"medium"|"low" }}
 */
export function detectDominantLanguage(text = "") {
  const cleaned = stripNoise(text);
  const scores = {
    fr: countMatches(cleaned, FR_MARKERS),
    en: countMatches(cleaned, EN_MARKERS),
    es: countMatches(cleaned, ES_MARKERS),
    de: countMatches(cleaned, DE_MARKERS),
  };
  if (/[àâçéèêëîïôùûœ]/i.test(cleaned)) scores.fr += 2;
  if (/[ñ¿¡]/i.test(String(text || ""))) scores.es += 3;
  if (/[äöüß]/i.test(cleaned)) scores.de += 2;

  let code = "fr";
  let best = -1;
  for (const lang of OUTPUT_LANGUAGE_CODES) {
    if (scores[lang] > best) {
      best = scores[lang];
      code = lang;
    }
  }
  const second = OUTPUT_LANGUAGE_CODES.map((l) => scores[l])
    .sort((a, b) => b - a)[1] || 0;
  const confidence =
    best >= 3 && best >= second + 2 ? "high" : best >= 2 ? "medium" : "low";
  if (best <= 0) {
    return { code: "fr", scores, confidence: "low" };
  }
  return { code, scores, confidence };
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractExplicitOutputLanguage(query = "") {
  const raw = String(query || "");
  const hit =
    raw.match(EXPLICIT_OUTPUT_LANGUAGE_RE) || raw.match(EXPLICIT_ANSWER_IN_RE);
  if (!hit?.[1]) return null;
  const code = normalizeLanguageLabel(hit[1]);
  return code || null;
}

function detectConversationLanguage(history = []) {
  const turns = (Array.isArray(history) ? history : [])
    .filter((m) => m?.role === "user" && String(m.content || "").trim())
    .slice(-4);
  if (!turns.length) return null;
  const blob = turns.map((m) => m.content).join(" ");
  const detected = detectDominantLanguage(blob);
  return detected.confidence === "low" ? null : detected.code;
}

/**
 * Priorité : consigne explicite > input courant > continuité user > jamais les sources.
 * @param {string} query
 * @param {{ history?: object[], sourceLanguage?: string|null }} [options]
 * @returns {{
 *   outputLanguage: string,
 *   explicitOverride: boolean,
 *   preserveUserLanguage: true,
 *   currentUserInputLanguage: string,
 *   conversationLanguage: string|null,
 *   sourceLanguage: string|null,
 *   rule: string,
 * }}
 */
export function resolveOutputLanguagePolicy(query = "", options = {}) {
  const explicit = extractExplicitOutputLanguage(query);
  const current = detectDominantLanguage(query);
  const conversationLanguage = detectConversationLanguage(options.history || []);
  const sourceLanguage = options.sourceLanguage || null;

  let outputLanguage = "fr";
  let explicitOverride = false;
  if (explicit) {
    outputLanguage = explicit;
    explicitOverride = true;
  } else if (current.confidence !== "low") {
    outputLanguage = current.code;
  } else if (conversationLanguage) {
    outputLanguage = conversationLanguage;
  }

  return {
    outputLanguage,
    explicitOverride,
    preserveUserLanguage: true,
    currentUserInputLanguage: current.code,
    conversationLanguage,
    sourceLanguage,
    rule: OUTPUT_LANGUAGE_RULE,
  };
}

export function buildOutputLanguageSystemAddon(policy = null) {
  if (!policy?.outputLanguage) return "";
  const label = LANGUAGE_LABEL[policy.outputLanguage] || policy.outputLanguage;
  return [
    "LANGUE DE SORTIE (obligatoire) :",
    `- Écris TOUTE la prose utilisateur en ${label} (${policy.outputLanguage}).`,
    "- Une source, un titre, une URL, un nom de produit ou un extrait étranger NE changent PAS la langue.",
    "- Tu peux citer un titre étranger entre guillemets, puis commenter dans la langue de sortie.",
    policy.explicitOverride
      ? "- Consigne explicite de langue : respecte-la même si le reste de la phrase est dans une autre langue."
      : "- Pas de consigne explicite : reste sur la langue de l'utilisateur.",
    "- INTERDIT : basculer parce que les résultats web sont dans une autre langue.",
  ].join("\n");
}

export function isTextInLanguage(text = "", language = "fr") {
  const detected = detectDominantLanguage(text);
  if (detected.confidence === "low") return true;
  return detected.code === language;
}

export function buildLanguageMismatchBlock(language = "fr") {
  return BLOCK_REPLY[language] || BLOCK_REPLY.fr;
}

/**
 * @param {string} text
 * @param {{ outputLanguage?: string, explicitOverride?: boolean }} [policy]
 * @param {{ pipelinePath?: string }} [options]
 * @returns {{ text: string, ok: boolean, blocked: boolean }}
 */
export function enforceOutputLanguage(text = "", policy = null, options = {}) {
  const expected = policy?.outputLanguage || "fr";
  const path = String(options.pipelinePath || "");
  if (
    path === "file_analysis_awaiting_source" ||
    path === "CLARIFY" ||
    path === "SQL_SOURCE_ANALYSIS"
  ) {
    return { text, ok: true, blocked: false };
  }
  const raw = String(text || "").trim();
  if (!raw) return { text, ok: true, blocked: false };
  if (raw.startsWith("{") && raw.endsWith("}")) {
    return { text, ok: true, blocked: false };
  }
  if (isTextInLanguage(raw, expected)) {
    return { text, ok: true, blocked: false };
  }
  return {
    text: buildLanguageMismatchBlock(expected),
    ok: false,
    blocked: true,
  };
}

export function languageLabel(code = "fr") {
  return LANGUAGE_LABEL[code] || LANGUAGE_NAME_FROM_CODE[code] || code;
}

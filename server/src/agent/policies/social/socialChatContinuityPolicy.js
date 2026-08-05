/**
 * Continuité du fil « on discute » après social/chat_invite (et offres papoter).
 * Un mot / groupe de mots devient un sujet de conversation, pas un clarify livrable.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/genericGreetingGuards.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";
import { isExplicitWebSearchRequest } from "../routing/explicitWebSearchRequestPolicy.js";
import { isConversationMemoryRecallRequest, isAttachedVisionRequest } from "../../utils/conversationGuards.js";
import {
  classifySocialPattern,
  isGreetingOnlyIntent,
  isPersonalDiscomfortIntent,
  isPhaticSocialCheckinIntent,
  isWellbeingCheckinIntent,
} from "./socialPatternPolicy.js";
import { isMetaConversationIntent } from "../../utils/metaConversationIntentGuards.js";

export const SOCIAL_CHAT_CONTINUITY_RULE = "social_chat_continuity_g46_2";

const ASSISTANT_CHAT_OPEN_RE =
  /\b(?:on discute|on peut discuter|sujet en t[eê]te|particulier [àa] faire|passe par la t[eê]te|on peut papoter|papoter de|tu penches vers quoi|qu['']est-ce qui t['']int[eé]resse|simplement continuer [àa] papoter|on part sur ce qui te passe|dis-moi ce qui t['']int[eé]resse|pas (?:un )?m[eé]decin|changer les id[eé]es|plut[oô]t discuter|papoter pour te|avis m[eé]dical|rester dans l['']?absurde|autre sujet en t[eê]te)\b|si oui,?\s*je vois|tu parles de .{2,60}\?/i;

const HARD_TASK_BREAK_RE =
  /\b(?:cr[eé]e|creer|g[eé]n[eè]re|genere|impl[eé]mente|forge|analyse le fichier|corrige|debug|recherche sur (?:internet|le web|la toile)|on bosse|au travail|passons au|travaill(?:e|er) sur|fais[- ]moi|code[- ]moi)\b/i;

const SOFT_CHAT_MARKER_RE =
  /\b(?:j[' ]aime|surtout|plut[oô]t|genre|par exemple|et aussi|ouais|bah|ben|tiens|sinon|en fait|du coup|heu+|euh+|je pense|je crois|ca te dit|ça te dit|tu connais|tu as entendu|quelque chose)\b/i;

/** Relance conversationnelle avec sujet flou (« je pense à… ça te dit ? »). */
const TOPIC_PROPOSAL_RE =
  /\b(?:je pense (?:a|à)|j[' ]ai pens[eé] (?:a|à)|ca te dit|ça te dit|tu connais|tu as entendu|te dit quelque chose|ligue\s+\w+)\b/i;

/** Questions factuelles / info-seeking — ne doivent pas rester en exploratory chat. */
const FACTUAL_OR_INFO_QUESTION_RE =
  /\b(?:c['']?est quoi|qu['']?est[- ]ce que(?: c['']?est)?|qui (?:est|a|sont)|combien|quand (?:est[- ]ce|a|est)|o[uù] (?:est|se trouve|habite)|comment (?:fonctionne|marche|faire|se dit)|pourquoi|d[eé]finition|capitale|population|quelle? (?:est|sont)|cherche(?:r)?|recherche|wikipedia|wiki)\b/i;

/**
 * Termes culturels semi-spécifiques → hypothèse lexicale (confiance medium).
 * Plus spécifique d'abord. `confirmLabel` sert à la question fermée.
 * @type {Array<{ id: string, re: RegExp, confirmLabel: string, alreadyNamedRe?: RegExp }>}
 */
const CULTURAL_REFERENCE_LEXICON = [
  {
    id: "wwe_nxt",
    re: /\bnxt\b/i,
    confirmLabel: "la WWE NXT",
    alreadyNamedRe: /\bwwe\s*nxt\b/i,
  },
  {
    id: "wwe",
    re: /\bwwe\b/i,
    confirmLabel: "la WWE",
  },
  {
    id: "ufc",
    re: /\bufc\b/i,
    confirmLabel: "l'UFC",
  },
  {
    id: "nba",
    re: /\bnba\b/i,
    confirmLabel: "la NBA",
  },
  {
    id: "nhl",
    re: /\bnhl\b/i,
    confirmLabel: "la NHL",
  },
  {
    id: "mlb",
    re: /\bmlb\b/i,
    confirmLabel: "la MLB",
  },
  {
    id: "ligue_1",
    re: /\bligue\s*1\b/i,
    confirmLabel: "la Ligue 1",
  },
  {
    id: "premier_league",
    re: /\bpremier\s*league\b/i,
    confirmLabel: "la Premier League",
  },
  {
    id: "formule_1",
    re: /\bformule\s*1\b|\bf1\b/i,
    confirmLabel: "la Formule 1",
  },
  {
    id: "champions_league",
    re: /\bchampions\s*league\b|\bligue\s*des\s*champions\b/i,
    confirmLabel: "la Ligue des champions",
  },
];

/**
 * @param {string} text
 */
function norm(text = "") {
  return normalizeFamiliarityQuery(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} assistantText
 * @returns {boolean}
 */
export function isAssistantChatOpenOffer(assistantText = "") {
  return ASSISTANT_CHAT_OPEN_RE.test(String(assistantText || ""));
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string}
 */
function lastAssistantText(history = []) {
  const turns = Array.isArray(history) ? history : [];
  const last = [...turns]
    .reverse()
    .find((m) => m?.role === "assistant" || m?.role === "model");
  return String(last?.content || "");
}

/**
 * Fil papoter encore ouvert dans la fenêtre récente.
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {boolean}
 */
export function isSocialChatThreadActive(history = []) {
  const turns = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-8);

  let openIdx = -1;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const role = turns[i]?.role;
    if (
      (role === "assistant" || role === "model") &&
      isAssistantChatOpenOffer(turns[i].content)
    ) {
      openIdx = i;
      break;
    }
  }
  if (openIdx < 0) return false;

  for (let i = openIdx + 1; i < turns.length; i += 1) {
    if (turns[i]?.role !== "user") continue;
    const content = String(turns[i].content || "");
    if (
      isSubstantiveWorkRequest(content) ||
      HARD_TASK_BREAK_RE.test(norm(content)) ||
      isExplicitWebSearchRequest(content)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Sujet court / relance conversationnelle (pas une demande métier claire).
 * @param {string} query
 * @returns {boolean}
 */
export function isSoftSocialChatFollowup(query = "") {
  const q = norm(query);
  if (!q || q.length < 2 || q.length > 180) return false;
  // Tours sociaux autonomes — pas un sujet à injecter dans le fil papoter.
  if (isGreetingOnlyIntent(query)) return false;
  if (isWellbeingCheckinIntent(query)) return false;
  if (isPhaticSocialCheckinIntent(query)) return false;
  if (classifySocialPattern(query)) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (HARD_TASK_BREAK_RE.test(q)) return false;
  if (isExplicitWebSearchRequest(query)) return false;
  if (isConversationMemoryRecallRequest(query)) return false;
  // Fil papoter ouvert ≠ rail factuel / culture générale / info-seeking / corporel
  if (isInformationSeekingWithTarget(query)) return false;
  if (isGeneralKnowledgeRequest(query)) return false;
  if (isPersonalDiscomfortIntent(query)) return false;
  if (isMetaConversationIntent(query)) return false;
  if (FACTUAL_OR_INFO_QUESTION_RE.test(q)) return false;

  const words = q.split(/\s+/).filter(Boolean);
  const isTopicProposal = TOPIC_PROPOSAL_RE.test(q) || SOFT_CHAT_MARKER_RE.test(q);

  // Hesitations / propositions de sujet : plus large qu'un simple nom
  if (isTopicProposal && words.length <= 32) return true;
  if (words.length > 16) return false;

  if (words.length <= 8) return true;
  return words.length <= 14 && !/[;:]/.test(q);
}

/**
 * @param {string} query
 * @returns {string}
 */
export function extractSocialChatTopic(query = "") {
  const raw = norm(query);
  const ligue = raw.match(/\bligue\s+([a-z0-9]{2,20})\b/i);
  if (ligue?.[1]) return `la ligue ${ligue[1]}`;

  const ouIlYa = raw.match(/\bou il y a\s+(.+?)(?:\s*,|\s+ca te|\s+ça te|\s*\?|$)/i);
  if (ouIlYa?.[1]) return ouIlYa[1].trim().slice(0, 80);

  const pense = raw.match(
    /\bje pense (?:a|à)\s+(.+?)(?:\s*,|\s+ca te|\s+ça te|\s*\?|$)/i,
  );
  if (pense?.[1]) return pense[1].trim().slice(0, 80);

  const q = raw
    .replace(
      /^(?:heu+|euh+|ouais|oui|ok|bah|ben|tiens|surtout|plutot|plutôt|genre|et aussi|du coup)\s+/i,
      "",
    )
    .replace(/\b(?:ca|ça) te dit(?: quelque chose)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return (q || raw).slice(0, 80);
}

/**
 * @param {string} topic
 * @returns {string}
 */
export function buildSocialChatContinuityAddon(topic = "ce sujet") {
  const label = String(topic || "ce sujet").slice(0, 80);
  return [
    "VARIANTE CHAT SOCIAL CONTINU (fil papoter ouvert) :",
    `- Sujet lancé par l'utilisateur : **${label}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Accueille le sujet naturellement (1–2 phrases).",
    "2) Partage 2–3 angles légers, curiosités ou pistes de discussion.",
    "3) Une question ouverte pour continuer le fil.",
    "INTERDIT :",
    "- Clarification objectif / format / livrable.",
    "- Récap mémoire du type « Voici ce que je retrouve dans ce fil ».",
    "- Refus « Je vois la piste, mais pas encore la destination… ».",
    "- Encyclopédie / Molière / recherche web non demandée.",
    "- Pivot projet / Forge / handoff technique non demandé.",
    "- Exposer ta réflexion interne (« L'utilisateur… », « Je dois… », « selon les consignes… »).",
    "- Parler de toi à la 3e personne comme un commentaire de rédaction.",
  ].join("\n");
}

/**
 * Hypothèse culturelle medium : terme semi-spécifique → label probable.
 * @param {string} query
 * @returns {{ id: string, confirmLabel: string, confidence: "medium"|"high" }|null}
 */
export function resolveCulturalReferenceHypothesis(query = "") {
  const q = norm(query);
  if (!q) return null;

  for (const entry of CULTURAL_REFERENCE_LEXICON) {
    if (!entry.re.test(q)) continue;
    if (entry.alreadyNamedRe?.test(q)) {
      return {
        id: entry.id,
        confirmLabel: entry.confirmLabel,
        confidence: "high",
      };
    }
    return {
      id: entry.id,
      confirmLabel: entry.confirmLabel,
      confidence: "medium",
    };
  }
  return null;
}

/**
 * Mini-clarification fermée — reste en social, pas en clarify routeur.
 * @param {{ confirmLabel: string }} hypothesis
 * @returns {string}
 */
export function buildCulturalHypothesisReply(hypothesis = {}) {
  const label = String(hypothesis.confirmLabel || "ce sujet").trim();
  return `Tu parles de ${label} ? Si oui, je vois.`;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{
 *   path: string,
 *   reply?: string|null,
 *   deferToLlm?: boolean,
 *   reflectiveHint?: string,
 *   continuityEffectiveQuery?: string,
 *   socialChatContinuity: boolean,
 *   culturalHypothesis?: boolean,
 *   topic: string,
 * }|null}
 */
export function resolveSocialChatContinuityShortCircuit(query = "", options = {}) {
  const history = options.history || [];
  if (isAttachedVisionRequest(query, options.attachments || [])) return null;
  if (
    isGreetingOnlyIntent(query) ||
    isWellbeingCheckinIntent(query) ||
    isPhaticSocialCheckinIntent(query) ||
    classifySocialPattern(query)
  ) {
    return null;
  }
  if (!isSocialChatThreadActive(history) && !isAssistantChatOpenOffer(lastAssistantText(history))) {
    return null;
  }
  if (!isSoftSocialChatFollowup(query)) return null;

  // Hypothèse culturelle medium → couche épistémique (clarification ciblée)
  const cultural = resolveCulturalReferenceHypothesis(query);
  if (cultural && cultural.confidence === "medium") {
    return null;
  }

  const topic =
    (cultural?.confidence === "high" && cultural.confirmLabel) ||
    extractSocialChatTopic(query);
  if (!topic) return null;

  return {
    path: "exploratory_conversation_light",
    reply: null,
    deferToLlm: true,
    reflectiveHint: buildSocialChatContinuityAddon(topic),
    continuityEffectiveQuery: `On discute de ${topic}.`,
    socialChatContinuity: true,
    topic,
  };
}

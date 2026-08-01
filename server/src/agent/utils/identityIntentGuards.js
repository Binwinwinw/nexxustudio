/* server/src/agent/utils/identityIntentGuards.js */
import { normalizeText } from "./normalizationGuards.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../policies/posture/index.js";

export const IDENTITY_MAX_WORDS = 12;

export const IDENTITY_NAME_PATTERN =
  /\b(comment\s+(tu\s+)?t\s*appell|t\s*appell|\bton\s+nom\b|\bquelle?\s+est\s+ton\s+nom\b|\bnom\s+c\s*est\s+quoi\b)/;

export const IDENTITY_WHO_PATTERN =
  /\b(qui es[- ]?tu|qui est tu|qui etes[- ]?vous|presente[- ]?toi|ta name)\b/;

export const IDENTITY_NATURE_PATTERN =
  /\b(?:es[- ]?tu|tu es)\s+intelligent\b|\b(?:es[- ]?tu|tu es)\s+smart\b/;

export const IDENTITY_EXTERNAL_PATTERN =
  /\b(c\s*est\s+qui\s+nexxus|qui\s+est\s+nexxus)\b/;

export const IDENTITY_NAME_REPLY =
  "Je m'appelle NEXXUS, l'assistant souverain de La Citadelle.";

export const IDENTITY_WHO_REPLY =
  "Salut ! Je suis NEXXUS, l'assistant souverain de La Citadelle / Nexxus Studio. Je peux t'aider à cadrer un projet, analyser des documents, explorer du code ou préparer un passage vers la Forge. Comment puis-je t'aider ?";

/** Normalisation alignée sur getDeterministicSocialResponse (apostrophes → espaces). */
export function normalizeIdentityQuery(query = "") {
  return normalizeText(query)
    .toLowerCase()
    .replace(/[?!.]+$/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getIdentityWordCount(query = "") {
  return normalizeIdentityQuery(query).split(/\s+/).filter(Boolean).length;
}

export function isIdentityNameIntent(query = "") {
  const q = normalizeIdentityQuery(query);
  return (
    getIdentityWordCount(query) <= IDENTITY_MAX_WORDS &&
    IDENTITY_NAME_PATTERN.test(q)
  );
}

export function isIdentityWhoIntent(query = "") {
  const q = normalizeIdentityQuery(query);
  return (
    getIdentityWordCount(query) <= IDENTITY_MAX_WORDS &&
    IDENTITY_WHO_PATTERN.test(q)
  );
}

export function isIdentityNatureIntent(query = "") {
  const q = normalizeIdentityQuery(query);
  return (
    getIdentityWordCount(query) <= IDENTITY_MAX_WORDS &&
    IDENTITY_NATURE_PATTERN.test(q)
  );
}

export function isIdentityExternalIntent(query = "") {
  const q = normalizeIdentityQuery(query);
  return (
    getIdentityWordCount(query) <= IDENTITY_MAX_WORDS &&
    IDENTITY_EXTERNAL_PATTERN.test(q)
  );
}

export function isIdentityIntent(query = "") {
  return (
    isIdentityNameIntent(query) ||
    isIdentityWhoIntent(query) ||
    isIdentityExternalIntent(query) ||
    isIdentityNatureIntent(query)
  );
}

export function getIdentityDeterministicReply(query = "", options = {}) {
  if (isIdentityNameIntent(query)) {
    return composeMannerReply({
      family: RESPONSE_MANNER_FAMILIES.IDENTITY_NAME,
      history: options.history || [],
      salt: query,
    });
  }
  if (isIdentityNatureIntent(query)) {
    return (
      "Je suis un assistant IA spécialisé en orchestration — pas une conscience générale. " +
      "Je suis efficace sur dev, architecture, doc et le routage gouverné de La Citadelle. " +
      "Précise l'angle si tu vises un type d'intelligence en particulier."
    );
  }
  if (isIdentityWhoIntent(query) || isIdentityExternalIntent(query)) {
    return composeMannerReply({
      family: RESPONSE_MANNER_FAMILIES.IDENTITY_WHO,
      history: options.history || [],
      salt: query,
    });
  }
  return null;
}

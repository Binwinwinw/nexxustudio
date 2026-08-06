/* server/src/agent/utils/identityIntentGuards.js */
import { normalizeText } from "./normalizationGuards.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../policies/posture/index.js";

export const IDENTITY_MAX_WORDS = 14;

export const IDENTITY_NAME_PATTERN =
  /\b(comment\s+(tu\s+)?t\s*appell|t\s*appell|\bton\s+nom\b|\bquelle?\s+est\s+ton\s+nom\b|\bnom\s+c\s*est\s+quoi\b)/;

export const IDENTITY_WHO_PATTERN =
  /\b(qui es[- ]?tu|qui est tu|qui etes[- ]?vous|presente[- ]?toi|ta name)\b/;

export const IDENTITY_NATURE_PATTERN =
  /\b(?:es[- ]?tu|tu es)\s+intelligent\b|\b(?:es[- ]?tu|tu es)\s+smart\b/;

export const IDENTITY_EXTERNAL_PATTERN =
  /\b(c\s*est\s+qui\s+nexxus|qui\s+est\s+nexxus)\b/;

/** Spécialités / domaines — pas general/explain. */
export const IDENTITY_SPECIALTIES_PATTERN =
  /\b(?:quelles?\s+sont\s+tes\s+specialites|tes\s+specialites|en\s+quoi\s+(?:es[- ]?tu|tu\s+es)\s+specialis[eé]?|tes\s+domaines?\s+(?:de\s+)?(?:competence|specialite))\b/;

/** Rôle assistant — identité légère, pas méta inventaire. */
export const IDENTITY_ROLE_PATTERN =
  /\b(?:quel\s+est\s+ton\s+role|c\s*est\s+quoi\s+ton\s+role|ton\s+role(?:\s+(?:exact|ici|dans\s+la\s+citadelle))?)\b/;

export const IDENTITY_NAME_REPLY =
  "Je m'appelle NEXXUS, l'assistant souverain de La Citadelle.";

export const IDENTITY_WHO_REPLY =
  "Salut ! Je suis NEXXUS, l'assistant souverain de La Citadelle / Nexxus Studio. Je peux t'aider à cadrer un projet, analyser des documents, explorer du code ou préparer un passage vers la Forge. Comment puis-je t'aider ?";

export const IDENTITY_SPECIALTIES_REPLY =
  "Je suis NEXXUS, l'assistant de La Citadelle. Mes spécialités actuelles :\n" +
  "- cadrage de projet / architecture\n" +
  "- analyse de documents\n" +
  "- exploration et revue de code\n" +
  "- recherche web sourcée\n" +
  "- orientation vers la Forge pour du prototypage local\n" +
  "Dis-moi l'angle qui t'intéresse et on avance.";

export const IDENTITY_ROLE_REPLY =
  "Mon rôle : assistant souverain de La Citadelle / Nexxus Studio. " +
  "J'orchestre la conversation, je route vers les bons outils, et je t'aide à cadrer, analyser ou produire — sans inventer un livrable hors preuves.";

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

export function isIdentitySpecialtiesIntent(query = "") {
  const q = normalizeIdentityQuery(query);
  return (
    getIdentityWordCount(query) <= IDENTITY_MAX_WORDS &&
    IDENTITY_SPECIALTIES_PATTERN.test(q)
  );
}

export function isIdentityRoleIntent(query = "") {
  const q = normalizeIdentityQuery(query);
  if (getIdentityWordCount(query) > IDENTITY_MAX_WORDS) return false;
  if (!IDENTITY_ROLE_PATTERN.test(q)) return false;
  // Évite « ton rôle dans mon script » / tâches métier
  if (/\b(?:script|fichier|code|fonction|classe|projet|agent\s+ia)\b/.test(q)) {
    return false;
  }
  return true;
}

export function isIdentityIntent(query = "") {
  return (
    isIdentityNameIntent(query) ||
    isIdentityWhoIntent(query) ||
    isIdentityExternalIntent(query) ||
    isIdentityNatureIntent(query) ||
    isIdentitySpecialtiesIntent(query) ||
    isIdentityRoleIntent(query)
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
  if (isIdentitySpecialtiesIntent(query)) {
    return IDENTITY_SPECIALTIES_REPLY;
  }
  if (isIdentityRoleIntent(query)) {
    return IDENTITY_ROLE_REPLY;
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

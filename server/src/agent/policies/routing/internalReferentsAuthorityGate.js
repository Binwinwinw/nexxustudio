/**
 * Gate d’autorité — référents internes figés.
 *
 * Cause : un lookup « c’est quoi X » sur un nom propre déjà déclaré
 * (Nexxus / La Citadelle / Nexxus Studio) partait en
 * information_seeking_full_pipeline + web. Le pivot appartient à
 * l’identité locale, pas au monde.
 *
 * Même autorité pour les questions d’identité interne sans nom propre
 * dans la phrase (« comment t’appelles-tu », « comment s’appelle la
 * plateforme sur laquelle tu opères ») : réponse figée, pas factual
 * générique ni web.
 *
 * Consultable, déclaratif, pas un inventaire. Pas de nom commun seul
 * (une citadelle ≠ La Citadelle).
 *
 * Cadre figé : La Citadelle = plateforme ; Nexxus = assistant ;
 * Nexxus Studio = studio / dépôt. Phrase courte « ce que c’est »,
 * pas la fiche sociale longue « qui es-tu ».
 */

import {
  isIdentityExternalIntent,
  isIdentityNameIntent,
  isIdentityWhoIntent,
  resolveAssistantSelfAttributeHit,
} from "../../utils/intent-guards/identityIntentGuards.js";
import { extractConfirmationProposition } from "../conversation/confirmationCheckArticulation.js";

/** [RÉFÉRENTS INTERNES] — liste figée, 3 entrées. */
export const INTERNAL_REFERENTS = Object.freeze([
  "Nexxus Studio",
  "La Citadelle",
  "Nexxus",
]);

/** Une phrase par référent — ce que c'est, pas une présentation d'identité. */
const INTERNAL_REFERENT_REPLIES = Object.freeze({
  "La Citadelle":
    "La Citadelle, c'est la plateforme, NEXXUS est l'assistant IA qui y vit, exécute les tâches et prend les décisions.",
  Nexxus:
    "NEXXUS, c'est l'assistant IA de La Citadelle. La Citadelle, c'est la plateforme.",
  "Nexxus Studio":
    "Nexxus Studio, c'est le studio (produit / dépôt). La Citadelle est le nom visible de la plateforme dans l'interface. NEXXUS est l'assistant qui y tourne.",
});

const REFERENT_CONFIRM_REPLY =
  "Oui. NEXXUS, c'est l'assistant. La Citadelle, c'est la plateforme. Il ne faut pas les confondre.";
const REFERENT_REJECT_REPLY =
  "Non. NEXXUS, c'est l'assistant. La Citadelle, c'est la plateforme.";

function normalizeReferentQuery(query = "") {
  return String(query || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Terme pivot = nom propre de la liste, tel qu’il apparaît dans la requête.
 * @param {string} query
 * @returns {"Nexxus Studio"|"La Citadelle"|"Nexxus"|null}
 */
export function matchInternalReferent(query = "") {
  const q = normalizeReferentQuery(query);
  if (!q) return null;
  if (/\bnexxus\s+studio\b/.test(q)) return "Nexxus Studio";
  if (/\bla\s+citadelle\b/.test(q)) return "La Citadelle";
  if (/\bnexxus\b/.test(q)) return "Nexxus";
  return null;
}

/**
 * Nom de la plateforme d’opération, sans « La Citadelle » dans la phrase.
 * Ex. « comment s’appelle la plateforme sur laquelle tu opères ».
 * @param {string} query
 */
export function isOperatingPlatformNameAsk(query = "") {
  const q = normalizeReferentQuery(query);
  if (!q || !/\b(?:plateforme|plate[- ]forme)\b/.test(q)) return false;
  const asksName =
    /\b(?:comment\s+s['']?appelle|quel\s+est\s+le\s+nom(?:\s+de)?)\b/.test(q);
  if (!asksName) return false;
  return (
    /\bsur\s+laquelle\s+tu\b/.test(q) ||
    /\btu\s+(?:operes?|tournes?|vis|fonctionnes?)\b/.test(q)
  );
}

function hasStudio(q) {
  return /\bnexxus\s+studio\b/.test(q);
}
function hasCitadelle(q) {
  return /\bla\s+citadelle\b/.test(q);
}
function hasNexxusAssistant(q) {
  return /\bnexxus\b/.test(q.replace(/\bnexxus\s+studio\b/g, " "));
}

function swappedReferentRoles(q) {
  return (
    (hasNexxusAssistant(q) &&
      /\bnexxus\b.{0,48}\b(?:c['']est|est)\s+(?:la\s+)?plateforme\b/.test(q)) ||
    (hasCitadelle(q) &&
      /\bcitadelle\b.{0,48}\b(?:c['']est|est)\s+(?:l['']?)?assistant\b/.test(q))
  );
}

function trueReferentRole(q) {
  const nexxusAssistant =
    hasNexxusAssistant(q) &&
    /\bnexxus\b.{0,48}\b(?:c['']est|est)\s+(?:l['']?)?assistant\b/.test(q);
  const citadellePlatform =
    hasCitadelle(q) &&
    /\bcitadelle\b.{0,48}\b(?:c['']est|est)\s+(?:la\s+)?plateforme\b/.test(q);
  return nexxusAssistant || citadellePlatform;
}

/**
 * « si j'ai bien compris » + proposition sur les référents internes.
 * Confirme ou invalide. Pas un greeting, pas un lookup générique.
 * @param {string} query
 * @returns {{ referent: string, reply: string }|null}
 */
export function resolveInternalReferentConfirmationCheck(query = "") {
  const proposition = extractConfirmationProposition(query);
  if (!proposition) return null;
  const q = normalizeReferentQuery(proposition);
  if (!q) return null;

  if (swappedReferentRoles(q)) {
    return { referent: "Nexxus", reply: REFERENT_REJECT_REPLY };
  }

  const twoReferents =
    [hasNexxusAssistant(q), hasCitadelle(q), hasStudio(q)].filter(Boolean)
      .length >= 2;
  const negatedConfondre = /\bne\s+(?:faut\s+)?pas\s+confondre\b|\bpas\s+confondre\b/.test(
    q,
  );
  const alignedRoles =
    hasNexxusAssistant(q) &&
    hasCitadelle(q) &&
    /\bassistant\b/.test(q) &&
    /\bplateforme\b/.test(q);

  if ((twoReferents && negatedConfondre) || alignedRoles || trueReferentRole(q)) {
    return { referent: "Nexxus", reply: REFERENT_CONFIRM_REPLY };
  }
  return null;
}

/**
 * Identité interne sans nom propre dans la phrase
 * (nom / qui-es-tu / nom de la plateforme d’opération).
 * @param {string} query
 * @returns {{ referent: string, reply: string }|null}
 */
export function resolveUnnamedInternalIdentityHit(query = "") {
  // « qui est NEXXUS / c'est qui NEXXUS » : nom propre, mais pas un shell « c'est quoi ».
  // Tiers (« qui est Victor Hugo ») exclus : isIdentityExternalIntent exige nexxus.
  if (
    isIdentityExternalIntent(query) &&
    matchInternalReferent(query) === "Nexxus"
  ) {
    return {
      referent: "Nexxus",
      reply: INTERNAL_REFERENT_REPLIES.Nexxus,
    };
  }
  if (matchInternalReferent(query)) return null;
  const selfAttr = resolveAssistantSelfAttributeHit(query);
  if (selfAttr) {
    return { referent: selfAttr.referent, reply: selfAttr.reply };
  }
  if (isOperatingPlatformNameAsk(query)) {
    return {
      referent: "La Citadelle",
      reply: INTERNAL_REFERENT_REPLIES["La Citadelle"],
    };
  }
  if (isIdentityNameIntent(query) || isIdentityWhoIntent(query)) {
    return {
      referent: "Nexxus",
      reply: INTERNAL_REFERENT_REPLIES.Nexxus,
    };
  }
  return null;
}

/**
 * Court-circuit local si le pivot est un référent interne,
 * ou une question d’identité interne sans nom propre.
 * @param {string} query
 * @returns {{ referent: string, reply: string }|null}
 */
export function resolveInternalReferentAuthorityHit(query = "") {
  const named = matchInternalReferent(query);
  if (named) {
    return { referent: named, reply: INTERNAL_REFERENT_REPLIES[named] };
  }
  return resolveUnnamedInternalIdentityHit(query);
}

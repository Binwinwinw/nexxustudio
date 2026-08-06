/**
 * Intents méta-conversationnels — champ sémantique + sous-intents (nuances).
 * Le motif large ne suffit pas : les marqueurs de nuance priment sur l'overview générique.
 */
import { normalizeText as normalizeTextBase } from "./normalizationGuards.js";
import { isPhaticSocialCheckinIntent } from "../policies/social/index.js";
import { isIdentityIntent } from "./identityIntentGuards.js";
import {
  isNexxusCockpitUiDiscussion,
  isUiNavigationRestructureFeedback,
} from "./uiNavigationFeedbackGuards.js";

export { isNexxusCockpitUiDiscussion } from "./uiNavigationFeedbackGuards.js";

export const META_CONVERSATION_MAX_WORDS = 42;

const CAPABILITY_GAPS_PATTERNS = [
  /\b(pas encore|pas dispo|pas disponible|manque|manquent)\b/,
  /\b(n as pas|tu n as pas)\b(?!\s+(compris|saisi|pige|vu|lu|entendu|fait|retenu|enregistre))/i,
  /\b(fonctionnalit|capacit|feature).{0,40}(pas encore|a venir|futures?|pourraient)\b/,
  /\b(pourraient|seraient|devraient)\s+(etre|exister|arriver)\b/,
  /\bce que tu n as pas\b(?!\s+(compris|saisi|pige|vu|lu|entendu|fait|retenu|enregistre))/i,
  /\bce qui n est pas encore\b/,
  /\broadmap\b/,
  /\ben cours de (dev|developpement|construction)\b/,
];

const CAPABILITY_LEARN_PATTERNS = [
  /\b(qu est ce que tu peux|ce que tu peux)\s+m apprendre\b/,
  /\bapprendre sur tes\s+(fonctionnalit|capacit)\b/,
  /\benseigne[- ]?moi\b/,
  /\bexplique[- ]?moi (tes|ton)\b/,
];

const CAPABILITY_OVERVIEW_PATTERNS = [
  /\b(quelles? sont tes|tes)\s+(fonctionnalit|capacit|possibilit)/,
  /\b(fonctionnalit|capacit).{0,24}phares?\b/,
  /\b(qu est ce que tu peux|ce que tu peux)\s+(faire|m expliquer|m dire)\b/,
  /\b(qu est ce que tu sais|ce que tu sais)\s+faire\b/,
  /\b(que peux tu faire|tu peux faire quoi)\b/,
  /\b(presente tes|decris tes)\s+(fonctionnalit|capacit|services)\b/,
  // ton role / spécialités → identityIntentGuards (social_deterministic), pas méta inventaire
  /\bton perimetre\b/,
  /\bwhat can you do\b/,
];

const HELP_SCOPE_PATTERNS = [
  /\bcomment (peux tu|tu peux) m aider\b/,
  /\b(peux tu|tu peux) m aider sur quoi\b/,
  /\bsur quoi (peux tu|tu peux) m aider\b/,
  /\baide moi a comprendre ce que tu fais\b/,
  /\bcomment utiliser (nexxus|la citadelle|l assistant)\b/,
  /\bcomment (?:ca|ça) se passe si\b.{0,80}\b(?:ton|ta) aide\b/,
  /\b(?:ton|ta) aide\b.{0,80}\bbout en bout\b/,
  /\b(?:ton|ta) aide\b.{0,80}\bprojet\b/,
];

/** Jugement / confiance sur la qualité de conseil (pas un sujet papoter). */
const ASSISTANT_TRUST_PATTERNS = [
  /\b(?:peut on|on peut) dire\b.{0,50}\b(?:tu es|t es|tes)\b.{0,40}\b(?:bon|bons|bonne|bonnes)\b.{0,25}\b(?:conseil|conseils|conseiller)\b/,
  /\b(?:tu es|es tu|t es)\b.{0,35}\b(?:bon|bons|bonne|bonnes)\b.{0,25}\b(?:conseil|conseils|conseiller)\b/,
  /\b(?:de|des) bons conseils\b/,
  /\btu sais (?:bien )?conseiller\b/,
  /\btu es(?:-|\s)?(?:fiable|pertinent|solide)\b.{0,30}\b(?:conseil|conseiller|pour conseiller)\b/,
];

const FORGE_STATUS_PATTERNS = [
  /\b(la )?forge\b.{0,30}\b(fonctionnel|fonctionne|operationnel|operationnelle|disponible|active|marche|pret|ready)\b/,
  /\bforge est elle\b/,
  /\best ce que la forge\b/,
  /\bla forge fonctionne\b/,
  /\bforge\b.{0,20}\b(operationnel|operationnelle)\b/,
];

const SELF_ANALYSIS_PATTERNS = [
  /\b(auto[- ]?analys|t auto[- ]?analys)\b/,
  /\b(tes|ton) (dernieres?|dernières?) (ameliorations?|améliorations?)\b/,
  /\blister (tes|ton) (ameliorations?|améliorations?|capacites|capacités)\b/,
  /\b(tu es|es tu) en capacite de t\b/,
  /\b(tu es|es tu) en capacité de t\b/,
  /\btes (ameliorations?|améliorations?) (cote|coté|structure|reponse|réponse|conversation)\b/,
];

/** Identité assistant — social_deterministic, pas self_analysis méta. */
const ASSISTANT_IDENTITY_PATTERNS = [
  /\bcomment t appelles\b/,
  /\bcomment tu t appelles\b/,
  /\bquel est ton nom\b/,
  /\bqui es tu\b/,
  /\bqui tu es\b/,
  /\bqui est nexxus\b/,
  /\bqui est nexus\b/,
  /\bquelles? sont tes specialites\b/,
  /\btes specialites\b/,
  /\bquel est ton role\b/,
  /\bc est quoi ton role\b/,
  /\bton role\b/,
];

const TEMPORAL_AWARENESS_PATTERNS = [
  /\b(sens de l heure|maitriser le sens de l heure|maîtriser le sens de l'heure)\b/,
  /\b(prendre conscience).{0,30}(heure|temps|date)\b/,
  /\b(conscience|conscient).{0,30}(heure|temps|date|moment)\b/,
  /\b(te faire|te faire).{0,25}(maitriser|maîtriser|connaitre|connaître).{0,25}(heure|temps)\b/,
  /\bcomment faire pour te faire\b.{0,40}(heure|temps)\b/,
];

const PROJECT_ABOUT_PATTERNS = [
  /\bquel est le projet\b/,
  /\bc est quoi le projet\b/,
  /\b(on travaille|vous travaillez) sur quoi\b/,
  /\bqu est ce qu on construit\b/,
  /\bqu est ce qu on fait\b/,
  /\b(rappelle|resume) (moi )?(le |ce )?projet\b/,
  /\b(rappelle|resume) (moi )?ce qu on (construit|fait|aborde)\b/,
  /\b(peux tu|tu peux) (me )?rappeler ce qu on (construit|fait)\b/,
  /\bprojet (en cours|actuel|du moment)\b/,
  /\bde quoi parle (ce fil|la session|cette session)\b/,
];

function normalizeText(input = "") {
  return normalizeTextBase(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(query = "") {
  return normalizeText(query).split(/\s+/).filter(Boolean).length;
}

function withinMetaWordLimit(query = "") {
  return wordCount(query) <= META_CONVERSATION_MAX_WORDS;
}

function matchesAny(text, patterns) {
  return patterns.some((p) => p.test(text));
}

/**
 * Question d'identité pure (« comment t'appelles-tu ? », « qui es-tu ? »).
 * @param {string} query
 * @returns {boolean}
 */
export function isAssistantIdentityQuestion(query = "") {
  const text = normalizeText(query);
  if (!text) return false;
  return matchesAny(text, ASSISTANT_IDENTITY_PATTERNS);
}

function isMetaFieldBroad(text) {
  return (
    isUiNavigationRestructureFeedback(text) ||
    matchesAny(text, CAPABILITY_OVERVIEW_PATTERNS) ||
    matchesAny(text, CAPABILITY_LEARN_PATTERNS) ||
    matchesAny(text, CAPABILITY_GAPS_PATTERNS) ||
    matchesAny(text, HELP_SCOPE_PATTERNS) ||
    matchesAny(text, ASSISTANT_TRUST_PATTERNS) ||
    matchesAny(text, PROJECT_ABOUT_PATTERNS) ||
    matchesAny(text, SELF_ANALYSIS_PATTERNS) ||
    matchesAny(text, TEMPORAL_AWARENESS_PATTERNS) ||
    (/\b(nexxus|la citadelle|citadelle|assistant)\b/.test(text) &&
      /\b(fonctionnalit|capacit|role|projet|aide)\b/.test(text))
  );
}

function looksIncompleteQuery(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1] || "";
  return last.length > 0 && last.length <= 3 && !/^(oui|non|ok)$/.test(last);
}

/**
 * @returns {{ kind: string, label: string, tier: 'deterministic'|'reflective', wordCount: number }|null}
 */
export function classifyMetaConversationIntent(query = "") {
  if (isPhaticSocialCheckinIntent(query)) return null;
  // P0 identity_questions : nom / qui / spécialités / rôle → social, pas méta
  if (isAssistantIdentityQuestion(query) || isIdentityIntent(query)) return null;

  const text = normalizeText(query);
  const wc = wordCount(query);

  if (!withinMetaWordLimit(query) && !isMetaFieldBroad(text)) {
    return null;
  }

  if (!isMetaFieldBroad(text) && !matchesAny(text, FORGE_STATUS_PATTERNS)) {
    return null;
  }

  if (isUiNavigationRestructureFeedback(query)) {
    return {
      kind: "cockpit_ui_feedback",
      label: "cockpit_ui_feedback",
      tier: "reflective",
      wordCount: wc,
    };
  }

  if (matchesAny(text, FORGE_STATUS_PATTERNS)) {
    return {
      kind: "forge_status",
      label: "forge_operational_status",
      tier: "deterministic",
      wordCount: wc,
    };
  }

  if (matchesAny(text, TEMPORAL_AWARENESS_PATTERNS)) {
    return {
      kind: "temporal_awareness",
      label: "temporal_awareness",
      tier: "deterministic",
      wordCount: wc,
    };
  }

  if (matchesAny(text, SELF_ANALYSIS_PATTERNS)) {
    return {
      kind: "self_analysis",
      label: "self_analysis",
      tier: "deterministic",
      wordCount: wc,
    };
  }

  if (matchesAny(text, CAPABILITY_GAPS_PATTERNS)) {
    return {
      kind: "capability_gaps",
      label: "capability_gaps",
      tier: "deterministic",
      wordCount: wc,
    };
  }

  if (matchesAny(text, ASSISTANT_TRUST_PATTERNS)) {
    return {
      kind: "assistant_trust",
      label: "assistant_trust",
      tier: "reflective",
      wordCount: wc,
    };
  }

  if (matchesAny(text, HELP_SCOPE_PATTERNS)) {
    return { kind: "help_scope", label: "assistant_help_scope", tier: "deterministic", wordCount: wc };
  }

  if (matchesAny(text, PROJECT_ABOUT_PATTERNS)) {
    return { kind: "project_about", label: "project_about", tier: "deterministic", wordCount: wc };
  }

  if (matchesAny(text, CAPABILITY_LEARN_PATTERNS)) {
    return {
      kind: "capability_learn",
      label: "capability_learn",
      tier: wc > 20 ? "reflective" : "deterministic",
      wordCount: wc,
    };
  }

  if (matchesAny(text, CAPABILITY_OVERVIEW_PATTERNS)) {
    const tier =
      wc > 22 || looksIncompleteQuery(text) ? "reflective" : "deterministic";
    return {
      kind: "capability_overview",
      label: "capability_overview",
      tier,
      wordCount: wc,
    };
  }

  if (withinMetaWordLimit(query)) {
    return {
      kind: "meta_general",
      label: "meta_general",
      tier: wc > 18 ? "reflective" : "deterministic",
      wordCount: wc,
    };
  }

  return {
    kind: "meta_general",
    label: "meta_general",
    tier: "reflective",
    wordCount: wc,
  };
}

export function isMetaConversationIntent(query = "") {
  return classifyMetaConversationIntent(query) !== null;
}

export function isMetaCapabilityOverviewIntent(query = "") {
  const hit = classifyMetaConversationIntent(query);
  return hit?.kind === "capability_overview";
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCapabilityOverviewRequest(query = "") {
  const text = normalizeText(query);
  if (!text) return false;
  return matchesAny(text, CAPABILITY_OVERVIEW_PATTERNS);
}

export function isMetaHelpScopeIntent(query = "") {
  const hit = classifyMetaConversationIntent(query);
  return hit?.kind === "help_scope";
}

export function isMetaProjectAboutIntent(query = "") {
  const hit = classifyMetaConversationIntent(query);
  return hit?.kind === "project_about";
}

/**
 * Extrait un indice de sujet depuis l'historique récent (fil session).
 */
export function extractRecentThreadTopicHint(history = []) {
  const turns = (Array.isArray(history) ? history : []).filter(
    (m) => m?.role === "user" && String(m.content || "").trim(),
  );
  const skip = /^(oui|ok|non|salut|bonjour|merci)\.?$/i;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const raw = String(turns[i].content || "").trim();
    if (skip.test(raw)) continue;
    if (isMetaConversationIntent(raw)) continue;
    const snippet = raw.replace(/\s+/g, " ").slice(0, 140);
    if (snippet.length >= 12) return snippet;
  }
  return null;
}

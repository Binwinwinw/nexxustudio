/**
 * Résolution anaphorique conversationnelle (tour n−1 → tour n).
 *
 * Doctrine :
 * 1. Détection générique des relances (« détaille », « celui-là », etc.)
 * 2. Extraction structurelle des antécédents (pas de lexique métier obligatoire)
 * 3. Clarification déterministe si N candidats
 * 4. Si 1 candidat + fiche locale optionnelle → réponse déterministe
 * 5. Si 1 candidat sans fiche → defer LLM avec hint de continuité (véhicules, avions, chaussures…)
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { readRecentTurns } from "./conversationContinuityContext.js";
import { assessConversationTopicShift } from "./topicShiftGuard.js";
import { extractSalientSpansFromAssistantText } from "./salientSpanExtractor.js";

export const ANAPHORA_REFERENCE_RULE =
  "resolve_salient_assistant_antecedent_before_insufficiency";

/** Fiches locales optionnelles — enrichissement, pas condition d'activation. */
const LOCAL_DETAIL_LEXICON = {
  carbonara: {
    label: "carbonara",
    domain: "recipe",
    detail: `Oui — si tu parles de la **carbonara**, voici une version traditionnelle pour 4 personnes :
- Fais cuire **400 g de spaghetti** al dente.
- Fais revenir **120 à 150 g de guanciale** (ou pancetta) sans excès de matière grasse.
- Mélange **3 à 4 jaunes d'œufs** avec **80 à 100 g de pecorino** (ou parmesan) et beaucoup de **poivre noir**.
- Hors du feu, incorpore les pâtes chaudes et un peu d'**eau de cuisson** pour obtenir une sauce crémeuse par émulsion — **sans crème** et sans faire coaguler les œufs.

Tu veux une variante (plus de poivre, sans guanciale, portion double) ?`,
  },
  amatriciana: {
    label: "amatriciana",
    domain: "recipe",
    detail: `Oui — pour l'**amatriciana** (4 personnes) :
- Spaghetti ou bucatini al dente.
- Sauce tomate avec **guanciale**, **pecorino** et **piment** (peperoncino).
- Pas d'ail ni de basilic dans la version romaine stricte.

Tu veux que je détaille les quantités au gramme près ?`,
  },
  "cacio e pepe": {
    label: "cacio e pepe",
    domain: "recipe",
    detail: `Oui — pour le **cacio e pepe** :
- Pâtes courtes ou longues, très al dente.
- Beaucoup de **pecorino romano** râpé + **poivre noir** concassé.
- Émulsion hors du feu avec eau de cuisson — technique proche de la carbonara, sans œuf ni guanciale.

Tu veux le pas-à-pas minute par minute ?`,
  },
  "sagrada familia": {
    label: "la Sagrada Família",
    domain: "landmark",
    detail: `Oui — si tu parles de la **Sagrada Família** à Barcelone :
- Basilique emblématique d'**Antoni Gaudí**, toujours en chantier depuis 1882.
- Extérieur : façades sculptées façon « livre de pierre » ; intérieur : colonnes en forme d'arbre et vitraux colorés.
- **Conseil visite** : réserve un créneau à l'avance (affluence forte), prévois 1h30 à 2h.

Tu veux des horaires types, un budget billet ou un mini-itinéraire quartier ?`,
  },
  alhambra: {
    label: "l'Alhambra",
    domain: "landmark",
    detail: `Oui — pour l'**Alhambra** à Grenade :
- Ensemble palatial et fortifié des derniers rois **nasrides**, chef-d'œuvre de l'art islamique en Espagne.
- Incontournables : **Palais nasrides**, **Cour des Lions**, **Generalife** (jardins).
- **Conseil visite** : billet couplé très demandé — réserve plusieurs semaines à l'avance en haute saison.

Tu veux le déroulé d'une visite en 3h ou des alternatives si les billets sont complets ?`,
  },
};

const LEXICON_ALIAS_TO_KEY = {
  "sagrada família": "sagrada familia",
};

const ANAPHORA_FOLLOWUP_PATTERN =
  /\b(?:la recette|le modele|le modèle|les modeles|les modèles|le monument|les monuments|le site|la cathedrale|la cathédrale|l attraction|l'attraction|la detailler|la détailler|detaille la recette|détaille la recette|detaille le monument|détaille le monument|detaille la|détaille la|detaille le|détaille le|tu peux la detailler|tu peux la détailler|tu peux le detailler|tu peux le détailler|peux tu la detailler|peux-tu la détailler|peux tu le detailler|peux-tu le détailler|explique[- ]?la|explique[- ]?le|developpe|développe|developper|développer|en dire plus|celle[- ]?la|celui[- ]?la|celle ci|celle-ci|celui ci|celui-ci|sur celle[- ]?la|sur celui[- ]?la|la meme|la même|le meme|le même|detaille ca|détaille ça|detaille cela|détaille cela|explique ca|explique ça)\b/i;

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function findLastAssistantContent(history = []) {
  const turns = readRecentTurns(history, 8);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role === "assistant" && String(turns[i].content || "").trim()) {
      return String(turns[i].content).trim();
    }
  }
  return null;
}

function canonicalizeEntityKey(raw = "") {
  const key = normalizeQuery(raw).toLowerCase().trim();
  return LEXICON_ALIAS_TO_KEY[key] || key;
}

function resolveLocalLexiconEntry(span = "") {
  const key = canonicalizeEntityKey(span);
  if (LOCAL_DETAIL_LEXICON[key]) {
    return { key, entry: LOCAL_DETAIL_LEXICON[key] };
  }

  for (const [lexKey, lexEntry] of Object.entries(LOCAL_DETAIL_LEXICON)) {
    if (key.startsWith(`${lexKey} `) || key.includes(lexKey)) {
      return { key: lexKey, entry: lexEntry };
    }
  }

  return { key, entry: null };
}

function enrichFromLocalLexicon(span = "") {
  const { key, entry } = resolveLocalLexiconEntry(span);
  if (entry) {
    return {
      id: key,
      label: entry.label,
      domain: entry.domain,
      detail: entry.detail,
      hasLocalDetail: true,
    };
  }
  return {
    id: key,
    label: span,
    domain: "entity",
    detail: null,
    hasLocalDetail: false,
  };
}

/**
 * @param {string} text
 * @returns {Array<{ id: string, label: string, domain: string, detail: string|null, hasLocalDetail: boolean }>}
 */
export function extractSalientCandidatesFromText(text = "") {
  const spans = extractSalientSpansFromAssistantText(text);
  const store = new Map();

  for (const span of spans) {
    const candidate = enrichFromLocalLexicon(span);
    if (!store.has(candidate.id)) {
      store.set(candidate.id, candidate);
    }
  }

  return [...store.values()];
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractRecipeCandidatesFromText(text = "") {
  return extractSalientCandidatesFromText(text)
    .filter((c) => c.domain === "recipe")
    .map((c) => c.id);
}

function resolveDetailKind(domain = "entity", clarify = false) {
  if (clarify) return "anaphora_entity_clarify";
  if (domain === "recipe") return "anaphora_recipe_detail";
  if (domain === "landmark") return "anaphora_landmark_detail";
  return "anaphora_entity_detail";
}

export function buildAnaphoraCarryoverHint({
  query = "",
  resolvedLabel = "",
  lastAssistant = "",
  candidates = [],
} = {}) {
  const antecedent =
    resolvedLabel || (candidates.length === 1 ? candidates[0] : "");
  const snippet = String(lastAssistant || "").slice(0, 420);
  return [
    "RÈGLE CONTINUITÉ ANAPHORIQUE : l'utilisateur fait référence à une entité que tu viens de citer.",
    antecedent
      ? `Antécédent résolu (unique) : **${antecedent}**.`
      : `Candidats détectés : ${candidates.join(", ")}.`,
    snippet ? `Extrait du tour assistant précédent : « ${snippet} »` : "",
    "Consigne : développe cet antécédent de façon utile et concrète.",
    "INTERDIT : refuser pour « manque d'éléments » si l'antécédent est identifiable dans le fil.",
    `Relance utilisateur : ${String(query).slice(0, 200)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function isAnaphoricReferenceFollowup(query = "") {
  const q = normalizeQuery(query);
  if (!q || q.length > 120) return false;
  return ANAPHORA_FOLLOWUP_PATTERN.test(q);
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isAnaphoraReferenceResolvable(query = "", history = []) {
  return resolveAnaphoraReference(query, history) !== null;
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function resolveAnaphoraReference(query = "", history = []) {
  if (assessConversationTopicShift(query, history).detected) return null;
  if (!isAnaphoricReferenceFollowup(query)) return null;

  const lastAssistant = findLastAssistantContent(history);
  if (!lastAssistant) return null;

  const candidates = extractSalientCandidatesFromText(lastAssistant);
  if (candidates.length === 0) return null;

  const ids = candidates.map((c) => c.id);

  if (candidates.length > 1) {
    const labels = candidates.map((c) => c.label);
    return {
      kind: "anaphora_entity_clarify",
      reply: `Tu veux **${labels.join("** ou **")}** ?`,
      candidates: ids,
      antecedentSource: "assistant_turn",
      hasLocalDetail: true,
      lastAssistant,
    };
  }

  const candidate = candidates[0];
  if (candidate.hasLocalDetail && candidate.detail) {
    return {
      kind: resolveDetailKind(candidate.domain, false),
      reply: candidate.detail,
      candidates: ids,
      antecedentSource: "assistant_turn",
      domain: candidate.domain,
      hasLocalDetail: true,
      resolvedLabel: candidate.label,
      lastAssistant,
    };
  }

  return {
    kind: "anaphora_carryover_defer",
    reply: null,
    candidates: ids,
    antecedentSource: "assistant_turn",
    domain: candidate.domain,
    hasLocalDetail: false,
    resolvedLabel: candidate.label,
    lastAssistant,
  };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function resolveAnaphoraReferenceShortCircuit(query = "", history = []) {
  const resolved = resolveAnaphoraReference(query, history);
  if (!resolved) return null;

  if (resolved.kind === "anaphora_carryover_defer") {
    return {
      path: "anaphora_reference_carryover",
      kind: resolved.kind,
      deferToLlm: true,
      reflectiveHint: buildAnaphoraCarryoverHint({
        query,
        resolvedLabel: resolved.resolvedLabel,
        lastAssistant: resolved.lastAssistant,
        candidates: resolved.candidates,
      }),
      candidates: resolved.candidates,
      domain: resolved.domain,
    };
  }

  if (!resolved.reply) return null;

  return {
    path: "anaphora_reference_deterministic",
    kind: resolved.kind,
    reply: resolved.reply,
    candidates: resolved.candidates,
    domain: resolved.domain,
  };
}

/**
 * Contrat composer — culture générale humaine (recettes, monuments, produits, classiques connus).
 */
import {
  extractGeneralKnowledgeSubject,
  isGeneralKnowledgeRequest,
} from "../../utils/generalKnowledgeIntentGuards.js";
import { isRecipeKnowledgeRequest } from "../../utils/recipeKnowledgeIntentGuards.js";
import {
  isCulturalContentSummaryRequest,
  extractCulturalSummarySubject,
} from "../../policies/culturalContentSummaryPolicy.js";

export const GENERAL_KNOWLEDGE_COMPOSER_RULE =
  "general_knowledge_generous_human_response";

const BOEUF_BOURGUIGNON_DETAIL = `Oui, je connais bien le **bœuf bourguignon**.

C'est un grand classique de la cuisine française, de Bourgogne : un plat mijoté longuement au vin rouge, avec de la viande de bœuf (souvent paleron ou joue), des carottes, des oignons grelots, des lardons, des champignons et un bouquet garni (thym, laurier, ail, genièvre).

La viande est généralement marinée 12 à 24 h, puis saisie, les légumes sont revenus, et le tout mijote 2 à 3 h à feu doux dans le vin et un bouillon. On obtient une viande fondante dans une sauce riche et profonde.

**Temps total** : environ 3 h 30 à 4 h (dont ~30 min de préparation active).

Tu veux que je te détaille une étape précise, ou tu veux des variantes ?`;

const LOCAL_KNOWLEDGE_FICHES = {
  "boeuf bourguignon": BOEUF_BOURGUIGNON_DETAIL,
  "bœuf bourguignon": BOEUF_BOURGUIGNON_DETAIL,
  "le boeuf bourguignon": BOEUF_BOURGUIGNON_DETAIL,
  "le bœuf bourguignon": BOEUF_BOURGUIGNON_DETAIL,
};

function normalizeFicheKey(subject = "") {
  return String(subject || "")
    .toLowerCase()
    .replace(/^(?:la |le |les |l')/, "")
    .trim();
}

export function requiresGeneralKnowledgeComposerContract(query = "") {
  return isGeneralKnowledgeRequest(query);
}

/** @deprecated alias recette */
export const requiresRecipeKnowledgeComposerContract = requiresGeneralKnowledgeComposerContract;

export function resolveLocalGeneralKnowledgeDetail(query = "") {
  const subject = extractGeneralKnowledgeSubject(query);
  if (!subject) return null;
  const key = normalizeFicheKey(subject);
  return LOCAL_KNOWLEDGE_FICHES[key] || LOCAL_KNOWLEDGE_FICHES[subject.toLowerCase().trim()] || null;
}

/** @deprecated alias */
export const resolveLocalRecipeKnowledgeDetail = resolveLocalGeneralKnowledgeDetail;

export function buildGeneralKnowledgeSystemAddon(query = "") {
  const subject = extractGeneralKnowledgeSubject(query) || "le sujet demandé";
  const isRecipe = isRecipeKnowledgeRequest(query);

  const formatLines = isRecipe
    ? [
        "1) « Oui, je connais… » puis description du plat et de son esprit.",
        "2) Ingrédients et étapes si pertinent — temps de préparation/cuisson.",
      ]
    : [
        "1) « Oui, je connais… » (ou équivalent naturel et direct).",
        "2) Explication claire : qu'est-ce que c'est, d'où ça vient, pourquoi c'est connu.",
        "3) Détails utiles (composition, fonctionnement, caractéristiques, contexte).",
      ];

  return [
    "VARIANTE CULTURE GÉNÉRALE (réponse humaine, pas questionnaire) :",
    `- Sujet visé : **${subject}**.`,
    "FORMAT OBLIGATOIRE :",
    ...formatLines,
    "4) Rester sur le sujet demandé — ne pas lister d'autres options non sollicitées.",
    "5) Terminer par une ouverture courte optionnelle (approfondir une étape, variante, angle).",
    "INTERDIT :",
    "- Liste de mots-clés ou menu d'options sans contenu.",
    "- Clarify-first quand le sujet est déjà nommé.",
    "- Remplacer le sujet demandé par un autre sans le dire explicitement (ex. tiramisu → tarte aux pommes).",
    "- « Je n'ai pas assez d'éléments » pour un classique de culture générale.",
    "- Promettre webSummarize ou recherche web non exécutée.",
    "- Réponse tronquée à 2 phrases.",
    "- Ton robotique ou télégraphique.",
  ].join("\n");
}

/** @deprecated alias */
export const buildRecipeKnowledgeSystemAddon = buildGeneralKnowledgeSystemAddon;

/**
 * @param {string} query
 * @returns {string}
 */
export function buildCulturalContentSummarySystemAddon(query = "") {
  const subject =
    extractCulturalSummarySubject(query) ||
    extractGeneralKnowledgeSubject(query) ||
    "l'œuvre demandée";
  return [
    "VARIANTE RÉSUMÉ ŒUVRE CULTURELLE (G38.2 — borné, factuel, pas document joint) :",
    `- Œuvre visée : **${subject}**.`,
    "FORMAT STRICT (3 à 5 phrases maximum, prose continue) :",
    "1) Une phrase d'accroche factuelle.",
    "2) Synopsis court de l'intrigue ou du thème central.",
    "3) Optionnel : réalisateur ou auteur uniquement si tu es certain.",
    "INTERDIT :",
    "- Rubriques artificielles (« C'est quoi ? », « Où ça vient ? », « Pourquoi c'est connu ? »).",
    "- Casting, voix ou acteurs si non certains.",
    "- Enrichissements spéculatifs (élite génétique, stimulants, inventions de prémisse).",
    "- Demander un document, un passage collé ou un fichier joint.",
    "- « Colle le passage » — l'utilisateur demande ta connaissance, pas une pièce jointe.",
    "- Clarify-first quand l'œuvre est déjà nommée.",
    "- Réponse au-delà de 5 phrases ou tronquée à 2 phrases sans contenu.",
    "- Inventer plutôt que dire « Je n'ai pas de synopsis fiable en local ».",
  ].join("\n");
}

export function buildGeneralKnowledgeUserPrompt(query = "", ctx = {}) {
  const subject = extractGeneralKnowledgeSubject(query) || "le sujet demandé";
  const local = resolveLocalGeneralKnowledgeDetail(query);
  const expertSynthesis = String(ctx.expertSynthesis || "").trim();
  const quickAnswer = String(ctx.quickAnswer || "").trim();

  if (local) {
    return `Demande : "${String(query || "").trim()}"

CONSIGNE : livre la réponse ci-dessous (tu peux l'adapter légèrement au ton, sans la vider ni la tronquer) :

${local}`;
  }

  const contextBlock =
    expertSynthesis || quickAnswer
      ? `Contexte expert :\n${expertSynthesis || quickAnswer}\n\n`
      : "";

  return `${contextBlock}Demande utilisateur :
"${String(query || "").trim()}"

CONSIGNE CULTURE GÉNÉRALE :
- Réponds pour **${subject}** uniquement.
- Réponse humaine complète : oui je connais + explication + détails utiles.
- Pas de menu d'options, pas de clarify-first.`;
}

/** @deprecated alias */
export const buildRecipeKnowledgeUserPrompt = buildGeneralKnowledgeUserPrompt;

/**
 * @param {string} query
 */
export function resolveGeneralKnowledgeShortCircuit(query = "") {
  if (!isGeneralKnowledgeRequest(query)) return null;
  const local = resolveLocalGeneralKnowledgeDetail(query);
  if (local) {
    return {
      path: "general_knowledge_deterministic",
      reply: local,
    };
  }
  if (isCulturalContentSummaryRequest(query)) {
    return {
      path: "cultural_content_summary",
      deferToLlm: true,
      culturalContentSummary: true,
      generalKnowledge: true,
      reflectiveHint: buildCulturalContentSummarySystemAddon(query),
    };
  }
  return {
    path: "general_knowledge_full_pipeline",
    deferToFullPipeline: true,
  };
}

/** @deprecated alias */
export const resolveRecipeKnowledgeShortCircuit = resolveGeneralKnowledgeShortCircuit;

export function isGeneralKnowledgeContractViolation(query = "", text = "") {
  if (!isGeneralKnowledgeRequest(query)) return false;
  const body = String(text || "").trim();
  if (!body || body.length < 80) return true;
  if (/je n['']?ai pas assez d'elements fiables/i.test(body)) return true;

  const subject = extractGeneralKnowledgeSubject(query);
  if (subject) {
    const token = subject.split(/\s+/).find((w) => w.length >= 4);
    if (token && !body.toLowerCase().includes(token.toLowerCase())) {
      const unrelatedHits = (
        body.match(/\b(carbonara|cacio e pepe|bolognaise|pesto|tesla|rolex|tarte aux pommes|apple pie)\b/gi) || []
      ).length;
      if (unrelatedHits >= 1) return true;
    }
  }

  if (/\b(?:critere|critère|tu veux)\b.{0,50}\b(?:ou|carbonara|bolognaise|cacio)\b/i.test(body)) {
    return true;
  }

  if ((body.match(/\bou\b/gi) || []).length >= 3 && body.length < 200) {
    return true;
  }

  if (/^tu veux\b/i.test(body) && body.length < 120) return true;

  return false;
}

/** @deprecated alias */
export const isRecipeKnowledgeContractViolation = isGeneralKnowledgeContractViolation;

/**
 * Contrat composer — culture générale humaine (recettes, monuments, produits, classiques connus).
 */
import {
  extractGeneralKnowledgeSubject,
  isGeneralKnowledgeRequest,
} from "../../utils/intent-guards/generalKnowledgeIntentGuards.js";
import { isRecipeKnowledgeRequest } from "../../utils/intent-guards/recipeKnowledgeIntentGuards.js";
import { isHowToRequestShell } from "../../utils/intent-guards/howToRequestIntentGuards.js";
import { hasCompoundKnowledgeAsk } from "../../utils/parsing-normalization/queryEntityUnderstanding.js";
import {
  isCulturalContentSummaryRequest,
  extractCulturalSummarySubject,
} from "../../policies/summary/index.js";

export const GENERAL_KNOWLEDGE_COMPOSER_RULE =
  "general_knowledge_generous_human_response";

export const GK_VOLUME_TIER_LIGHT = "light";
export const GK_VOLUME_TIER_STANDARD = "standard";
export const GK_VOLUME_TIER_DEEP = "deep";

/** Aligné workUnitCountAndPlanPolicy — pas un nouveau pipeline. */
const DETAILED_RE =
  /\b(?:en detail|en détail|detaille|détaillé|approfond|avec des details|avec des détails)\b/i;
const CEST_QUOI_RE =
  /\b(?:c'est quoi|c est quoi|qu'est ce que|qu est ce que|qu'est-ce que|definition|définition)\b/i;
const YES_NO_RE =
  /\b(?:oui ou non|juste oui|dis[- ]?moi oui|réponds oui|oui\/non)\b/i;
const STEP_BY_STEP_RE =
  /\b(?:étape par étape|etape par etape|pas a pas|pas à pas|étapes? pour|etapes? pour)\b/i;
const INSTALL_PROCEDURE_RE =
  /\b(?:installe|installer|installation|dual[- ]?boot)\b/i;
/** Lecture seule du lexique P5 — pas un driver de shape. */
const STRUCTURED_REPORT_RE =
  /\b(?:r[eé]sum[eé]\s+ex[eé]cuti[fv]e?|analyse\s+(?:de\s+|du\s+)?march[eé]|analyse\s+concurrentielle|opportunit[eé]s\s+de\s+croissance|tableau\s+strat[eé]gique|rapport(?:\s+(?:long|professionnel|structur[eé]|d[eé]taill[eé]))?|compte[- ]rendu)\b/i;

/**
 * Palier de charge réelle — consignes + budget, pas un pipeline.
 * @param {string} query
 * @param {{
 *   hasWebEvidence?: boolean,
 *   codeDelivery?: boolean,
 *   repoAnalysis?: boolean,
 *   factualResearch?: boolean,
 *   structuredContent?: boolean,
 *   multiUnit?: boolean,
 * }} [ctx]
 * @returns {"light"|"standard"|"deep"}
 */
export function resolveGeneralKnowledgeVolumeTier(query = "", ctx = {}) {
  const q = String(query || "").trim();
  if (!q) return GK_VOLUME_TIER_STANDARD;

  if (
    ctx.codeDelivery ||
    ctx.repoAnalysis ||
    ctx.structuredContent ||
    ctx.multiUnit
  ) {
    return GK_VOLUME_TIER_DEEP;
  }
  if (isRecipeKnowledgeRequest(q) || isHowToRequestShell(q)) {
    return GK_VOLUME_TIER_DEEP;
  }
  if (DETAILED_RE.test(q) || STEP_BY_STEP_RE.test(q) || INSTALL_PROCEDURE_RE.test(q)) {
    return GK_VOLUME_TIER_DEEP;
  }
  if (STRUCTURED_REPORT_RE.test(q)) {
    return GK_VOLUME_TIER_DEEP;
  }
  if (resolveLocalGeneralKnowledgeDetail(q)) {
    return GK_VOLUME_TIER_DEEP;
  }
  if (ctx.factualResearch) {
    return GK_VOLUME_TIER_STANDARD;
  }

  const yesNo = YES_NO_RE.test(q);
  const cestQuoi = CEST_QUOI_RE.test(q);
  const compound = hasCompoundKnowledgeAsk(q);
  const hasWeb = Boolean(ctx.hasWebEvidence);

  if (yesNo) return GK_VOLUME_TIER_LIGHT;
  if (compound) return GK_VOLUME_TIER_STANDARD;
  if (cestQuoi) return hasWeb ? GK_VOLUME_TIER_STANDARD : GK_VOLUME_TIER_LIGHT;
  if (isGeneralKnowledgeRequest(q)) {
    return hasWeb ? GK_VOLUME_TIER_STANDARD : GK_VOLUME_TIER_LIGHT;
  }
  return hasWeb ? GK_VOLUME_TIER_STANDARD : GK_VOLUME_TIER_LIGHT;
}

/**
 * @param {"light"|"standard"|"deep"} tier
 * @returns {number}
 */
export function resolveGeneralKnowledgeNumPredict(tier = GK_VOLUME_TIER_STANDARD) {
  if (tier === GK_VOLUME_TIER_DEEP) return 4000;
  if (tier === GK_VOLUME_TIER_STANDARD) return 900;
  return 700;
}

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

export function buildGeneralKnowledgeSystemAddon(query = "", ctx = {}) {
  const subject = extractGeneralKnowledgeSubject(query) || "le sujet demandé";
  const isRecipe = isRecipeKnowledgeRequest(query);
  const tier =
    ctx.volumeTier || resolveGeneralKnowledgeVolumeTier(query, ctx);
  const hasWeb = Boolean(ctx.hasWebEvidence);

  if (tier === GK_VOLUME_TIER_LIGHT) {
    return [
      "VARIANTE CULTURE GÉNÉRALE (réponse courte et naturelle) :",
      `- Sujet visé : **${subject}**.`,
      "FORMAT :",
      "- 2 à 5 phrases suffisent. Dis ce que c'est, sans plan ni rubriques.",
      "- Si la question est oui/non : tranche d'abord, puis 1 ou 2 phrases d'appui.",
      hasWeb
        ? "- Sources : une ligne en fin si le contexte en fournit — pas de dump de résultats."
        : "- Pas de rubriques « C'est quoi / D'où ça vient / Pourquoi c'est connu ».",
      "INTERDIT :",
      "- Liste de mots-clés ou menu d'options sans contenu.",
      "- Clarify-first quand le sujet est déjà nommé.",
      "- Six sections, plan de rapport, ou ton robotique.",
    ].join("\n");
  }

  if (tier === GK_VOLUME_TIER_STANDARD) {
    return [
      "VARIANTE CULTURE GÉNÉRALE (brief structuré, pas questionnaire) :",
      `- Sujet visé : **${subject}**.`,
      "FORMAT :",
      "- 1 à 2 paragraphes : ce que c'est, d'où ça vient, pourquoi c'est connu.",
      "- Un court bloc de points utiles si ça aide (composition, usage).",
      hasWeb
        ? "- Sources en appui ou en fin — pas de dump SERP ni de liste de fiches web."
        : "- Rester sur le sujet demandé.",
      "INTERDIT :",
      "- Liste de mots-clés ou menu d'options sans contenu.",
      "- Clarify-first quand le sujet est déjà nommé.",
      "- Remplacer le sujet demandé par un autre sans le dire.",
      "- Promettre une recherche web non exécutée.",
    ].join("\n");
  }

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
    "- Inventer un synopsis. Si des sources web sont fournies, résume-les (3 à 5 phrases) — INTERDIT de dire « pas de synopsis fiable en local ».",
    "- Sans sources web et sans certitude factuelle : ne pas inventer.",
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

  const tier = resolveGeneralKnowledgeVolumeTier(query, ctx);
  const consigne =
    tier === GK_VOLUME_TIER_LIGHT
      ? `- Réponds pour **${subject}** uniquement.
- Quelques phrases naturelles suffisent.
- Pas de menu d'options, pas de plan en sections.`
      : tier === GK_VOLUME_TIER_STANDARD
        ? `- Réponds pour **${subject}** uniquement.
- Brief : explication + points utiles. Sources en fin si le contexte en fournit.
- Pas de menu d'options, pas de clarify-first.`
        : `- Réponds pour **${subject}** uniquement.
- Réponse humaine complète : oui je connais + explication + détails utiles.
- Pas de menu d'options, pas de clarify-first.`;

  return `${contextBlock}Demande utilisateur :
"${String(query || "").trim()}"

CONSIGNE CULTURE GÉNÉRALE :
${consigne}`;
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
  const tier = resolveGeneralKnowledgeVolumeTier(query);
  if (!body) return true;
  if (tier !== GK_VOLUME_TIER_LIGHT && body.length < 80) return true;
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

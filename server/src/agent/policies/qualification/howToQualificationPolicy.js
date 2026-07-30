/**
 * Qualification des unités how_to_request — portée, ambiguïté, risque.
 * Une procédure détectée n'est pas automatiquement satisfiable localement.
 */
import { normalizeForParse } from "../../micro/parsing/requestSegmentParser.js";
import { isRecipeKnowledgeRequest } from "../../utils/recipeKnowledgeIntentGuards.js";
import { resolveLocalGeneralKnowledgeDetail } from "../../micro/replies/generalKnowledgeComposerContract.js";
import { HOW_TO_SHELL_RE, isHowToRequestShell } from "../../utils/howToRequestIntentGuards.js";
import {
  INSUFFICIENT_SIGNAL_REFUSAL,
  isInsufficientSignalRefusal,
} from "../../config/modeResponseContracts.js";

const HOW_TO_PSEUDO_CLARIFY_RE =
  /\b(?:je vois la piste|pas encore la destination|pas encore l['']objectif|donne[- ]moi l['']objectif|pr[ée]cise(?:\s+ton|\s+ta|\s+le|\s+la)?\s+(?:besoin|objectif|demande)|quel(?:le)?\s+format|il faudrait que tu arrives|pour avancer sur|en une phrase|tu veux quel angle|pr[ée]ciser ton)\b/i;

/** Ouverture sociale hors-sujet sur path procédural (registre smalltalk). */
const HOW_TO_SOCIAL_DRIFT_RE =
  /\b(?:bonjour|salut|coucou|hello|hey|bonsoir)\b.*\b(?:comment puis[- ]je t['']aider|tout va bien|comment puis[- ]je vous aider|en quoi puis[- ]je)\b|\bcomment puis[- ]je t['']aider\b/i;

const HOW_TO_TOPIC_STOPWORDS = new Set([
  "avec",
  "pour",
  "dans",
  "sans",
  "vers",
  "chez",
  "entre",
  "sous",
  "une",
  "des",
  "les",
  "sur",
  "comment",
  "faire",
  "fait",
  "faire",
  "bon",
  "bonne",
  "bonnes",
  "bien",
  "tres",
  "très",
  "plus",
  "moins",
  "tout",
  "toute",
  "toutes",
  "tous",
  "cette",
  "celui",
  "celle",
  "ceux",
  "celles",
  "votre",
  "notre",
]);

export const HOW_TO_QUALIFICATIONS = Object.freeze({
  SIMPLE_BENIGN_LOCAL: "simple_benign_local",
  COMPLEX_BUT_BENIGN: "complex_but_benign",
  AMBIGUOUS: "ambiguous",
  SENSITIVE_OR_RESTRICTED: "sensitive_or_restricted",
});

const SIMPLE_LOCAL_TOPIC_RE =
  /\b(smoothie|omelette|crepe|crêpe|pancake|gaufre|noeud|nœud|cravate|tisane|salade\s+composee|salade\s+composée|soupe|potage|bouillon|consomme|consommé|veloute|velouté|puree|purée|gratin|quiche|risotto|pates|pâtes|riz|sauce|gateau|gâteau|tarte|brocoli|carotte|champignon|tiramisu|mousse|brownie|cookie|cookies|muffin|flan|creme\s+brulee|crème\s+brûlée|macaron|eclair|éclair|profiterole|clafoutis|crumble|cheesecake|mousse\s+au\s+chocolat)\b/i;

const CULINARY_PROCEDURAL_RE =
  /\b(recette|plat|cuisine|cuisiner|mijot|mijoter|preparer|préparer|cuire|tiramisu|soupe|smoothie|omelette|gateau|gâteau|dessert|entree|entrée|patisserie|pâtisserie)\b/i;

const PAPER_CRAFT_RE = /\b(?:en\s+papier|origami)\b/i;

const AMBIGUOUS_BROAD_TOPIC_RE =
  /\b(avion|fusee|fusée|voiture|bateau|moteur|fusible|robot|maison)\b/i;

const COMPLEX_SIGNAL_RE =
  /\b(vrai|veritable|véritable|fabrique|fabriquer|construire\s+un\s+vrai|industriel|aeronautique|aéronautique|site\s+web|application|projet\s+react)\b/i;

const SENSITIVE_TOPIC_RE =
  /\b(bombe|explosif|arme|drogue|poison|hack|pirater|casser\s+un)\b/i;

/**
 * @param {string} payload
 */
export function extractHowToTopic(payload = "") {
  const normalized = normalizeForParse(payload);
  const patterns = [
    /comment\s+(?:on\s+)?(?:fait|faire|fabrique|fabriquer|preparer|preparer)\s+(?:un\s+|une\s+|des\s+)?(.+?)(?:\s*\?|$)/,
    /sais\s+tu\s+comment\s+(?:on\s+)?(?:fait|faire)\s+(?:un\s+|une\s+)?(.+?)(?:\s*\?|$)/,
    /savoir\s+si\s+tu\s+sais\s+comment\s+(?:on\s+)?(?:fait|faire)\s+(?:un\s+|une\s+)?(.+?)(?:\s*\?|$)/,
    /voudrais\s+savoir\s+comment\s+(?:faire\s+)?(?:un\s+|une\s+)?(.+?)(?:\s*\?|$)/,
    /aimerais\s+savoir\s+comment\s+(?:faire\s+)?(?:un\s+|une\s+)?(.+?)(?:\s*\?|$)/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "ça";
}

export { isHowToRequestShell };

/**
 * @param {string} payload
 * @returns {{ qualification: string, topic: string }}
 */
export function classifyHowToScopeAndRisk(payload = "") {
  const normalized = normalizeForParse(payload);
  const topic = extractHowToTopic(payload);
  const topicNorm = normalizeForParse(topic);

  if (SENSITIVE_TOPIC_RE.test(normalized) || SENSITIVE_TOPIC_RE.test(topicNorm)) {
    return { qualification: HOW_TO_QUALIFICATIONS.SENSITIVE_OR_RESTRICTED, topic };
  }

  if (COMPLEX_SIGNAL_RE.test(normalized)) {
    return { qualification: HOW_TO_QUALIFICATIONS.COMPLEX_BUT_BENIGN, topic };
  }

  if (SIMPLE_LOCAL_TOPIC_RE.test(topicNorm) || SIMPLE_LOCAL_TOPIC_RE.test(normalized)) {
    return { qualification: HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL, topic };
  }

  if (
    PAPER_CRAFT_RE.test(normalized) &&
    AMBIGUOUS_BROAD_TOPIC_RE.test(topicNorm)
  ) {
    return { qualification: HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL, topic };
  }

  if (AMBIGUOUS_BROAD_TOPIC_RE.test(topicNorm) && !PAPER_CRAFT_RE.test(normalized)) {
    return { qualification: HOW_TO_QUALIFICATIONS.AMBIGUOUS, topic };
  }

  if (HOW_TO_SHELL_RE.test(normalized)) {
    return { qualification: HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL, topic };
  }

  return { qualification: HOW_TO_QUALIFICATIONS.AMBIGUOUS, topic };
}

/**
 * Requête procédurale « comment faire X » sans ambiguïté bloquante ni sujet sensible.
 * @param {string} query
 */
export function isBenignProceduralHowToRequest(query = "") {
  if (!isHowToRequestShell(query)) return false;
  const { qualification } = classifyHowToScopeAndRisk(query);
  return (
    qualification !== HOW_TO_QUALIFICATIONS.SENSITIVE_OR_RESTRICTED &&
    qualification !== HOW_TO_QUALIFICATIONS.COMPLEX_BUT_BENIGN
  );
}

/**
 * @param {string} qualification
 */
export function isHowToLocallySatisfiable(qualification) {
  return qualification === HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL;
}

/**
 * Template local riche (pas le fallback générique « réunis ce qu'il te faut »).
 * @param {string} payload
 */
export function hasRichHowToLocalTemplate(payload = "") {
  const topic = extractHowToTopic(payload);
  const normalized = normalizeForParse(payload);

  if (/\bsmoothie\b/i.test(topic) || /\bsmoothie\b/i.test(normalized)) return true;
  if (/\bsoupe\b|\bpotage\b/i.test(topic) || /\bsoupe\b|\bpotage\b/i.test(normalized)) {
    return true;
  }
  if (/\btiramisu\b/i.test(topic) || /\btiramisu\b/i.test(normalized)) return true;
  if (
    (/\bavion\b/i.test(topic) || /\bavion\b/i.test(normalized)) &&
    PAPER_CRAFT_RE.test(normalized)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} payload
 */
export function buildHowToProceduralLlmSystemAddon(payload = "") {
  const topic = extractHowToTopic(payload);
  const normalized = normalizeForParse(payload);
  const culinary =
    CULINARY_PROCEDURAL_RE.test(topic) || CULINARY_PROCEDURAL_RE.test(normalized);

  const formatLines = culinary
    ? [
        "1) Ingrédients principaux (liste courte).",
        "2) Étapes numérotées, ordre chronologique, temps de préparation/cuisson si pertinent.",
        "3) Un ou deux conseils pratiques (texture, repos au frais, pièges à éviter).",
      ]
    : [
        "1) Prérequis / matériel si utile.",
        "2) Étapes numérotées, ordre chronologique.",
        "3) Conseils ou variantes courtes si pertinent.",
      ];

  return [
    "VARIANTE HOW-TO PROCÉDURAL (réponse directe, pas questionnaire) :",
    `- Sujet visé : **${topic}**.`,
    "FORMAT OBLIGATOIRE :",
    ...formatLines,
    "INTERDIT :",
    "- Clarification objectif/format/livrable.",
    `- Répondre « ${INSUFFICIENT_SIGNAL_REFUSAL} » ou toute variante équivalente.`,
    "- Demander l'objectif en une phrase, de préciser le besoin, ou de reformuler la demande.",
    "- Remplacer le sujet demandé par un autre (ex. tiramisu → tarte aux pommes).",
    "- Réponse générique sans étapes (« réunis ce qu'il te faut » sans détail).",
    "- Menu d'options ou « tu veux quel angle ? » quand le sujet est déjà nommé.",
    "- Salutation générique ou smalltalk (« Bonjour, comment puis-je t'aider ? ») sans procédure.",
    "- Si tu n'as pas de procédure fiable pour ce sujet précis, dis-le clairement au lieu d'inventer un autre plat.",
  ].join("\n");
}

/**
 * @param {string} topic
 * @returns {string[]}
 */
export function extractHowToTopicTokens(topic = "") {
  const normalized = normalizeForParse(topic);
  return normalized
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9àâäéèêëïîôùûüç'-]/gi, ""))
    .filter((word) => word.length >= 4 && !HOW_TO_TOPIC_STOPWORDS.has(word));
}

/**
 * @param {string} text
 */
export function hasHowToProceduralStructure(text = "") {
  const probe = String(text || "").trim();
  if (!probe) return false;
  return (
    /\b(?:étape|etape|prérequis|prerequis|ingrédients|ingredients|conseils?)\b/i.test(
      probe,
    ) ||
    /^\s*\d+[\).\):]/m.test(probe) ||
    /\b1[\).\):]\s/m.test(probe)
  );
}

/**
 * @param {string} text
 * @param {string} query
 */
export function howToResponseMentionsTopic(text = "", query = "") {
  const topic = extractHowToTopic(query);
  const tokens = extractHowToTopicTokens(topic);
  if (tokens.length === 0) return true;
  const norm = normalizeForParse(text);
  return tokens.some((token) => norm.includes(token));
}

/**
 * @param {string} text
 */
export function isHowToProceduralSocialDrift(text = "") {
  const probe = String(text || "").trim();
  if (!probe) return false;
  const norm = normalizeForParse(probe);
  if (HOW_TO_SOCIAL_DRIFT_RE.test(norm)) return true;
  if (
    /^(?:bonjour|salut|coucou|hello)[!.]?\s*(?:tout va bien[^.!?]*[!.]?)?/i.test(
      probe,
    ) &&
    !hasHowToProceduralStructure(probe)
  ) {
    return true;
  }
  return false;
}

/**
 * Dérive de topic — réponse sans ancrage sujet ni structure procédurale.
 * @param {string} text
 * @param {string} query
 */
export function isHowToProceduralTopicViolation(text = "", query = "") {
  const cleaned = String(text || "").trim();
  if (!cleaned) return true;
  if (isHowToProceduralSocialDrift(cleaned)) return true;
  const hasStructure = hasHowToProceduralStructure(cleaned);
  const hasTopic = howToResponseMentionsTopic(cleaned, query);
  return !hasStructure && !hasTopic;
}

/**
 * Violation P3 complète — directness + topic adherence.
 * @param {string} text
 * @param {string} query
 */
export function isHowToProceduralContractViolation(text = "", query = "") {
  return (
    isHowToProceduralPseudoClarify(text) ||
    isHowToProceduralTopicViolation(text, query)
  );
}

/**
 * Canevas procédural minimal quand le LLM retombe sur un refus (P3).
 * @param {string} query
 */
export function buildHowToProceduralDirectFallback(query = "") {
  const topic = extractHowToTopic(query);
  const normalized = normalizeForParse(query);
  const culinary =
    CULINARY_PROCEDURAL_RE.test(topic) || CULINARY_PROCEDURAL_RE.test(normalized);

  if (culinary) {
    return [
      `Pour ${topic} :`,
      "1) Rassemble les ingrédients principaux et le matériel de base.",
      "2) Prépare les éléments dans l'ordre (découpe, mélange, précuisson si besoin).",
      "3) Cuisine étape par étape en respectant temps et températures.",
      "4) Laisse reposer ou refroidir si nécessaire avant de servir.",
    ].join("\n");
  }

  return [
    `Pour ${topic} :`,
    "1) Identifie les composants, outils ou matériaux nécessaires.",
    "2) Prépare l'espace de travail et vérifie la sécurité de base.",
    "3) Réalise les étapes dans l'ordre logique, en contrôlant chaque étape.",
    "4) Ajuste selon ton contexte (budget, matériaux, niveau de détail visé).",
  ].join("\n");
}

/**
 * @param {string} text
 */
export function isHowToProceduralPseudoClarify(text = "") {
  const probe = String(text || "").trim();
  if (!probe) return true;
  return isInsufficientSignalRefusal(probe) || HOW_TO_PSEUDO_CLARIFY_RE.test(probe);
}

/**
 * Verrou P3 — remplace une pseudo-clarification par un canevas procédural direct.
 * @param {string} text
 * @param {string} query
 */
export function enforceHowToProceduralDirectness(text = "", query = "") {
  const cleaned = String(text || "").trim();
  if (!isHowToProceduralContractViolation(cleaned, query)) {
    return cleaned;
  }
  return buildHowToProceduralDirectFallback(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isProceduralCulinaryRequest(query = "") {
  return isHowToRequestShell(query);
}

/**
 * @param {string} payload
 * @param {"natural"|"labeled"} [tone]
 */
export function buildHowToSimpleLocalContent(payload = "", tone = "natural") {
  const topic = extractHowToTopic(payload);
  const normalized = normalizeForParse(payload);

  if (/\bsmoothie\b/i.test(topic) || /\bsmoothie\b/i.test(normalized)) {
    if (tone === "labeled") {
      return (
        "Pour faire un smoothie : choisis un fruit (banane, fraise…), ajoute un liquide " +
        "(lait, eau ou lait végétal), puis mixe 30 à 60 secondes. Tu peux ajouter du yaourt, " +
        "des glaçons ou un peu de miel selon le goût."
      );
    }
    return (
      "Pour faire un smoothie, choisis un fruit comme une banane ou des fraises, ajoute un liquide " +
      "comme du lait, de l'eau ou un lait végétal, puis mixe pendant 30 à 60 secondes ; tu peux " +
      "ajouter du yaourt, des glaçons ou un peu de miel selon le goût."
    );
  }

  if (
    (/\bavion\b/i.test(topic) || /\bavion\b/i.test(normalized)) &&
    PAPER_CRAFT_RE.test(normalized)
  ) {
    return (
      "Pour faire un avion en papier, plie une feuille rectangulaire en deux, ouvre-la, plie les coins " +
      "vers le centre, replie les côtés pour former le fuselage, puis les ailes — quelques plis suffisent " +
      "pour un premier vol."
    );
  }

  if (/\bsoupe\b|\bpotage\b/i.test(topic) || /\bsoupe\b|\bpotage\b/i.test(normalized)) {
    if (tone === "labeled") {
      return (
        "Pour une bonne soupe : fais revenir oignon et ail dans un peu d'huile, ajoute légumes et bouillon, " +
        "laisse mijoter 20 à 30 minutes, puis mixe ou laisse en morceaux selon la texture voulue ; assaisonne " +
        "en fin de cuisson (sel, poivre, herbes)."
      );
    }
    return (
      "Pour une bonne soupe, fais revenir oignon et ail dans un peu d'huile, ajoute tes légumes et du bouillon, " +
      "laisse mijoter 20 à 30 minutes, puis mixe ou laisse en morceaux selon la texture voulue, et assaisonne " +
      "en fin de cuisson avec sel, poivre et herbes."
    );
  }

  if (/\btiramisu\b/i.test(topic) || /\btiramisu\b/i.test(normalized)) {
    if (tone === "labeled") {
      return (
        "Pour un tiramisu : fouette 3 jaunes avec du sucre et du mascarpone, incorpore des blancs montés, " +
        "trempe des biscuits dans du café tiède, alterne biscuits et crème, saupoudre de cacao, et laisse " +
        "reposer au frais au moins 4 h."
      );
    }
    return (
      "Pour un tiramisu classique, fouette des jaunes d'œufs avec du sucre et du mascarpone, incorpore des " +
      "blancs montés en neige, trempe rapidement des biscuits à la cuillère dans du café tiède, alterne " +
      "couches de biscuits et de crème dans un plat, termine par du cacao amer et laisse reposer au frais " +
      "au moins 4 h (idéal une nuit)."
    );
  }

  if (tone === "labeled") {
    return (
      `Pour ${topic} : réunis ce qu'il te faut, avance étape par étape, et ajuste selon le résultat visé.`
    );
  }
  return (
    `Pour ${topic}, réunis ce qu'il te faut, avance étape par étape, et ajuste selon le résultat visé.`
  );
}

/**
 * @param {string} payload
 */
export function buildHowToAmbiguousClarifyReply(payload = "") {
  const { topic } = classifyHowToScopeAndRisk(payload);
  if (/\bavion\b/i.test(topic)) {
    return "Tu parles d'un avion en papier, d'une maquette ou d'un vrai avion ?";
  }
  if (/\bfusee\b|\bfusée\b/i.test(topic)) {
    return "Tu parles d'une fusée en papier, d'un modèle réduit ou d'un vrai lanceur ?";
  }
  if (/\bbateau\b/i.test(topic)) {
    return "Tu parles d'un bateau jouet, d'une maquette ou d'un vrai bateau ?";
  }
  return `Tu peux préciser de quel type de « ${topic} » il s'agit ?`;
}

/**
 * @param {string} payload
 */
export function buildHowToComplexReply(payload = "") {
  const { topic } = classifyHowToScopeAndRisk(payload);
  if (/\bavion\b/i.test(topic)) {
    return (
      "Fabriquer un vrai avion relève de l'aéronautique industrielle. Tu veux une vue d'ensemble du " +
      "domaine, ou tu parles d'une maquette / d'un projet pédagogique ?"
    );
  }
  return (
    `Pour ${topic}, le sujet est assez vaste — précise l'échelle visée (débutant, maquette, projet réel) ` +
    "et je t'oriente mieux."
  );
}

/**
 * @param {{ unitType?: string, howToQualification?: string, satisfiable?: boolean }} unit
 */
export function enrichHowToUnit(unit) {
  if (unit?.unitType !== "how_to_request") return unit;
  const { qualification, topic } = classifyHowToScopeAndRisk(unit.payload || "");
  return {
    ...unit,
    howToTopic: topic,
    howToQualification: qualification,
    satisfiable: isHowToLocallySatisfiable(qualification),
  };
}

/**
 * Short-circuit how-to / recette procédurale — avant culture générale et lexique.
 * @param {string} query
 * @returns {{
 *   path: string,
 *   reply?: string|null,
 *   deferToLlm?: boolean,
 *   reflectiveHint?: string,
 *   howToProcedural?: boolean,
 *   howToQualification?: string,
 * }|null}
 */
export function resolveHowToShortCircuit(query = "") {
  const recipeRequest = isRecipeKnowledgeRequest(query);
  const howToShell = isHowToRequestShell(query);
  if (!howToShell && !recipeRequest) return null;

  if (recipeRequest && !howToShell) {
    const localRecipe = resolveLocalGeneralKnowledgeDetail(query);
    if (localRecipe) {
      return {
        path: "how_to_simple_local",
        reply: localRecipe,
        howToQualification: HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL,
      };
    }
    return {
      path: "how_to_procedural_llm",
      reply: null,
      deferToLlm: true,
      reflectiveHint: buildHowToProceduralLlmSystemAddon(query),
      howToProcedural: true,
      howToQualification: HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL,
    };
  }

  const { qualification } = classifyHowToScopeAndRisk(query);

  if (qualification === HOW_TO_QUALIFICATIONS.AMBIGUOUS) {
    return {
      path: "how_to_clarify",
      reply: buildHowToAmbiguousClarifyReply(query),
      howToQualification: qualification,
    };
  }

  if (qualification === HOW_TO_QUALIFICATIONS.COMPLEX_BUT_BENIGN) {
    return {
      path: "how_to_complex_clarify",
      reply: buildHowToComplexReply(query),
      howToQualification: qualification,
    };
  }

  if (qualification === HOW_TO_QUALIFICATIONS.SENSITIVE_OR_RESTRICTED) {
    return null;
  }

  if (hasRichHowToLocalTemplate(query)) {
    return {
      path: "how_to_simple_local",
      reply: buildHowToSimpleLocalContent(query, "natural"),
      howToQualification: qualification,
    };
  }

  return {
    path: "how_to_procedural_llm",
    reply: null,
    deferToLlm: true,
    reflectiveHint: buildHowToProceduralLlmSystemAddon(query),
    howToProcedural: true,
    howToQualification: qualification,
  };
}

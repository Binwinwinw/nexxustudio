/* server/src/agent/utils/ideationIntentGuards.js */
import { normalizeText } from "./normalizationGuards.js";
import { isMetaModelStackOpinionQuery, isMetaPredictionLimitsQuery, isMetaPeerAssistantsQuery } from "../policies/meta/metaCapabilitiesPolicy.js";
import { isInformationSeekingLightQuery } from "../policies/routing/informationSeekingLightPolicy.js";
import { isCasualExplanationFollowUp } from "../policies/social/index.js";
import { isProgrammingPedagogyLightRequest } from "./programmingPedagogyLightIntentGuards.js";
import { isExplicitWebSearchRequest } from "../policies/routing/explicitWebSearchRequestPolicy.js";

export const IDEATION_MAX_WORDS = 25;

export const IDEATION_ANTI_MARKERS = [
  "fichier",
  "fonction",
  "composant",
  "class",
  "api",
  "endpoint",
  "debug",
  "erreur",
  "bug",
  "log",
  "crash",
  "corrige",
  "corriger",
  "implement",
  "implément",
];

const IDEATION_TRIGGERS = [
  "quoi faire",
  "quoi construire",
  "quoi créer",
  "quoi creer",
  "que construire",
  "des idées",
  "des idees",
  "idée de projet",
  "idee de projet",
  "que proposer",
  "que me proposes",
  "que peux-tu me proposer",
  "pourrais proposer",
  "pourrais me proposer",
  "tu pourrais proposer",
  "proposer d attaquer",
  "proposer d'attaquer",
  "attaquer d autres",
  "attaquer d'autres",
  "attaquer autre",
  "projet avec l'ia",
  "projet avec l ia",
  "projet ia",
  "projet avec ia",
  "mettre en place un projet",
  "mettre en place un",
  "mettre sur pied",
  "mettre sur pied un",
  "pourrions mettre",
  "pourrait mettre",
  "j'ai envie de construire",
  "j ai envie de construire",
  "je ne sais pas quoi",
  "ne sais pas quoi",
  "quelque chose en ia",
  "quelque chose avec l'ia",
  "construire quelque chose",
  "pas compliqué",
  "pas complique",
  "quelque chose de simple",
  "un projet simple",
  "quelque chose d'intéressant",
  "pas trop ambitieux",
  "facile à construire",
  "facile a construire",
  "pour commencer",
  "pour débuter",
  "pour debutant",
  "sans idées sophistiquées",
  "sans idees sophistiquees",
  "quelque chose à faire",
  "quelque chose a faire",
  "par quoi commencer",
  "par ou commencer",
  "quelle piste",
  "quelles pistes",
  "proposes-moi",
  "propose-moi",
  "proposes moi",
  "propose moi",
  "fais-moi un truc",
  "fais moi un truc",
  "je veux créer",
  "je veux creer",
  "je veux construire",
  "lancer un projet",
  "piste ia",
  "piste en ia",
];

const IDEATION_PATTERNS = [
  /\b(que|quoi)\s+(construire|creer|créer|faire|lancer)\b/,
  /\b(par quoi|par ou)\s+commencer\b/,
  /\bquelle?s?\s+(piste|idee|idée|projet)\b/,
  /\b(projet|idee|idée)\s+(ia|ai|intelligence artificielle)\b/,
  /\b(ia|ai|intelligence artificielle)\b.*\b(projet|construire|lancer|idee|idée|commencer)\b/,
  /\bje\s+(ne\s+)?sais\s+pas\s+(quoi|par quoi|par ou)\b/,
  /\bpropos(e|es)[-\s]?moi\b/,
  /\b(?:pourrais|peux)\s+(?:me\s+)?proposer\b/,
  /\bproposer\s+d['']?attaquer\b/,
  /\battaquer\s+d['']?autres?\b/,
  /\bfais[-\s]?moi\s+(un\s+)?truc\b/,
  /\b(un\s+)?truc\s+(bien|cool|sympa|utile)\b/,
  // « je veux faire une recherche… » exclu ; « je veux faire un projet » OK.
  /\bje veux (creer|créer|construire)\b/,
  /\bje veux faire\b(?!\s+(?:une\s+)?recherche\b)/,
  /\bquel projet\b.*\b(lancer|ia|ai|mettre|pourrions|pourrait)\b/,
  /\b(?:quel|quelle)\s+projet\b.*\b(?:mettre sur pied|mettre en place)\b/,
  /\b(?:pourrions|pourrait|peut[- ]on)\b.*\bprojet\b.*\b(?:mettre|lancer|construire|creer|créer)\b/,
];

const VAGUE_IDEATION_PATTERNS = [
  /\bfais[-\s]?moi\s+(un\s+)?truc\s*(bien|cool|sympa|utile)?\b/,
  /\b(un\s+)?truc\s+(bien|cool|sympa)\b/,
  /\bje veux creer quelque chose d utile\b/,
  /\bje veux créer quelque chose d utile\b/,
  /\bquelque chose d utile\b(?!.*\b(ia|app|projet|metier|client)\b)/,
];

const DOMAIN_HINT_PATTERN =
  /\b(ia|intelligence artificielle|ai|app|application|site|web|rag|api|local|forge|data|agent|chatbot|automat|script|projet|metier|métier|client|equipe|équipe|outil|saas|workflow)\b/;

export const IDEATION_FRAMING_REPLY =
  "Pour te proposer des pistes utiles, j'ai besoin d'un repère : tu vises plutôt un outil perso, un projet pro/client, ou une expérience pour apprendre l'IA en local ?";

export function normalizeIdeationQuery(query = "") {
  return normalizeText(query)
    .toLowerCase()
    .replace(/[?!.]+$/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getIdeationWordCount(query = "") {
  return normalizeIdeationQuery(query).split(/\s+/).filter(Boolean).length;
}

export function isIdeationIntent(query = "") {
  if (isProgrammingPedagogyLightRequest(query)) return false;
  if (isMetaModelStackOpinionQuery(query)) return false;
  if (isMetaPredictionLimitsQuery(query)) return false;
  if (isMetaPeerAssistantsQuery(query)) return false;
  if (isInformationSeekingLightQuery(query)) return false;
  if (isCasualExplanationFollowUp(query)) return false;
  // « je veux faire une recherche sur internet » ≠ idéation projet.
  if (isExplicitWebSearchRequest(query)) return false;
  const q = normalizeIdeationQuery(query);
  if (!q) return false;
  if (getIdeationWordCount(query) > IDEATION_MAX_WORDS) return false;
  if (IDEATION_ANTI_MARKERS.some((m) => q.includes(m))) return false;
  // Anti-faux positif : recherche web / internet.
  if (/\brecherche\b/.test(q) && /\b(internet|web|toile)\b/.test(q)) return false;

  if (IDEATION_TRIGGERS.some((t) => q.includes(t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
    return true;
  }

  return IDEATION_PATTERNS.some((pattern) => pattern.test(q));
}

/** @returns {"explorable"|"vague"|null} */
export function classifyIdeationSignal(query = "") {
  if (!isIdeationIntent(query)) return null;

  const q = normalizeIdeationQuery(query);
  if (VAGUE_IDEATION_PATTERNS.some((pattern) => pattern.test(q))) {
    return "vague";
  }

  const wordCount = q.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 7 && !DOMAIN_HINT_PATTERN.test(q)) {
    return "vague";
  }

  return "explorable";
}

export function buildIdeationOptionsReply(_query = "") {
  return `Voici 3 pistes concrètes :
1. **Assistant RAG local** — Interroger tes docs et notes sans cloud. Premier pas : indexer un dossier Obsidian ou des PDF dans La Citadelle.
2. **Automatisation métier légère** — Petit agent qui trie, résume ou route des tâches répétitives. Premier pas : lister 3 actions que tu fais chaque semaine.
3. **Mini-app souveraine** — Interface simple branchée sur tes modèles locaux (chat, cockpit, formulaire). Premier pas : définir l'écran principal et une seule action utile.
Laquelle t'intéresse ?`;
}

export function getIdeationDeterministicReply(query = "") {
  const signal = classifyIdeationSignal(query);
  if (!signal) return null;
  if (signal === "vague") return IDEATION_FRAMING_REPLY;
  return buildIdeationOptionsReply(query);
}

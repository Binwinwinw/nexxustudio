/**
 * PEDAGOGY_EXPLAIN_LIGHT — apprentissage langage (Python, HTML, JS, PHP…)
 * vs livraison de code (CODE_DELIVERY_V1).
 * « par quoi commencer en Python ? » ≠ « écris-moi un script Python ».
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";

export const PEDAGOGY_EXPLAIN_LIGHT_ROUTING_RULE = "pedagogy_explain_light_v1";

export const PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY =
  "Je suis débutant en Python : par quoi commencer pour ma première leçon, sur quel point mettre l'accent ?";

const PROGRAMMING_LANG_RE =
  /\b(?:python|javascript|typescript|php|html|css|jsx|react|node\.?js|java|kotlin|rust|go|sql|bash|shell|zsh|powershell|sh\b|langage bash|\.py\b|\.js\b|\.php\b|\.html\b)\b/i;

const PEDAGOGY_LEARNING_SHELL_RE =
  /\b(?:par ou commencer|par quoi commencer|comment (?:bien )?(?:apprendre|commencer|debuter|débuter|se lancer)|comment faire pour apprendre|premiere le(?:ç|c)on|première le(?:ç|c)on|premiers pas|mettre l'accent|sur quel point|sur quoi (?:me )?concentrer|quoi apprendre en premier|notions? de base|les bases (?:de|du|d)|initiation (?:a|à|en|sur)|je (?:veux|souhaite|aimerais) apprendre|apprendre (?:le |la |les |l')?|cours (?:d')?initiation|premier(?:e)? (?:etape|étape|module|chapitre)|explique(?:r|-moi)?(?:\s+les)?\s+bases)\b/i;

const BEGINNER_MARKER_RE =
  /\b(?:debutant|débutant|debutante|débutante|novice|neophyte|néophyte|zero|zéro|sans experience|sans expérience|newbie|grand(?:e)? debutant)\b/i;

const CODE_DELIVERY_VERB_RE =
  /\b(?:genere|génère|genère|ecris|écris|ecrire|écrire|cree|crée|creer|créer|developpe|développe|implemente|implémente|code complet|livre le code|donne le code|produis le code|ecris moi|écris moi|fais moi un script|fais un script|crée un script|crée une fonction|écris une fonction|implémente une|implémente un)\b/i;

const CODE_DELIVERABLE_ARTIFACT_RE =
  /\b(?:code complet|script complet|programme complet|fichier\.(?:py|js|php|html)|fonction qui|classe qui|composant react|```|algorithme qui|usestate|useeffect|doctype|<html)\b/i;

const PEDAGOGICAL_PLAN_ARTIFACT_RE =
  /\b(?:plan (?:de|pour|d')|programme de cours|progression pedagogique|progression pédagogique|formation(?: structurée)?|atelier d initiation|animation pedagogique|animation pédagogique|objectifs? pédagogiques)\b/i;

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractProgrammingPedagogySubject(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!PROGRAMMING_LANG_RE.test(q)) return null;

  const patterns = [
    /\b(?:en|sur|dans|a|à)\s+(python|javascript|typescript|php|html|css|jsx|react|node\.?js|java)\b/i,
    /\bapprendre\s+(?:le\s+)?(python|javascript|typescript|php|html|css|jsx|react|java|bash|shell|zsh)\b/i,
    /\b(?:initiation|premiere le(?:ç|c)on|première le(?:ç|c)on|bases)\s+(?:en|de|sur|a|à)\s+(python|javascript|typescript|php|html|css|jsx|react|java)\b/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) return String(match[1]).trim();
  }

  const token = q.match(PROGRAMMING_LANG_RE);
  return token ? token[0] : null;
}

/**
 * Question pédagogique légère sur un langage — pas livraison de code.
 * @param {string} query
 * @returns {boolean}
 */
export function isProgrammingPedagogyLightRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 15) return false;

  const hasProgrammingContext = PROGRAMMING_LANG_RE.test(q);
  if (!hasProgrammingContext) return false;

  if (CODE_DELIVERABLE_ARTIFACT_RE.test(q)) return false;

  if (PEDAGOGICAL_PLAN_ARTIFACT_RE.test(q)) return true;

  if (
    /\b(?:atelier|animation|formation)\b/i.test(q) &&
    hasProgrammingContext
  ) {
    return true;
  }

  if (CODE_DELIVERY_VERB_RE.test(q)) return false;

  const hasLearningShell = PEDAGOGY_LEARNING_SHELL_RE.test(q);
  const hasBeginner = BEGINNER_MARKER_RE.test(q);

  if (hasLearningShell) return true;
  if (
    hasBeginner &&
    /\b(?:apprendre|le(?:ç|c)on|commencer|initiation|accent|bases|premier)\b/i.test(q)
  ) {
    return true;
  }

  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesCodeGenerationForProgrammingPedagogy(query = "") {
  return isProgrammingPedagogyLightRequest(query);
}

/**
 * Doctrine : livrable clair → mode construction V1, pas clarification défensive.
 * Si sujet + format + intention de création sont compris, Nexxus produit une première version.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import {
  detectCodeDeliveryLanguage,
  hasCodeDeliveryStructure,
  isCodeGenerationRequest,
  resolveCodeDeliveryLanguage,
} from "../code/codeDeliveryPolicy.js";
import {
  buildHtmlProjectFallback,
  buildHtmlProjectUserAddon,
  evaluateHtmlProjectDelivery,
  isHtmlProjectDeliverable,
  isHtmlProjectQualityViolation,
  resolveHtmlProjectProfile,
  HTML_PROJECT_PROFILES,
} from "./htmlProjectDeliveryPolicy.js";
import { NOTION_WORKSHOP_MODULES } from "../../templates/notionWorkshopHtmlTemplate.js";

export const CONSTRUCTIVE_DELIVERY_RULE = "constructive_deliverable_v1_no_defensive_refusal";

const CREATE_INTENT_PATTERN =
  /\b(?:cree|créer|creer|generer|générer|genere|ecris|écris|produis|produire|construis|construire|developpe|développe|fournir|fournis|donne|donne-moi|donne moi|sais tu|saurais|peux tu|tu peux)\b/i;

const FORMAT_EXPLICIT_PATTERN =
  /\b(?:fichier html|page html|\.html\b|header|sidebar|doctype|feuille de style|\.css\b|composant react|jsx)\b/i;

const UI_STRUCTURE_PATTERN = /\b(?:header|sidebar|menu|navigation|section|sections|aside)\b/i;

const WORKSHOP_PATTERN = /\b(?:atelier|formation|initiation|support|parcours|module|modules)\b/i;

const KNOWN_SUBJECT_PATTERN =
  /\b(?:notion|teams|microsoft|excel|python|javascript|react|php|html|css|wordpress|figma)\b/i;

export const NOTION_WORKSHOP_DEFAULT_MODULES = NOTION_WORKSHOP_MODULES.map((m) => m.title);

/**
 * Livrable suffisamment cadré pour produire une V1 sans demander plus de contexte.
 * @param {string} query
 */
export function isClearConstructiveDeliverable(query = "") {
  if (!isCodeGenerationRequest(query)) return false;

  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 30) return false;

  const hasCreateIntent = CREATE_INTENT_PATTERN.test(q);
  const hasFormat =
    Boolean(detectCodeDeliveryLanguage(query)) || FORMAT_EXPLICIT_PATTERN.test(q);
  const hasStructure = UI_STRUCTURE_PATTERN.test(q) || WORKSHOP_PATTERN.test(q);
  const hasKnownSubject = KNOWN_SUBJECT_PATTERN.test(q);

  if (!hasCreateIntent || !hasFormat) return false;

  return hasStructure || hasKnownSubject || q.length >= 55;
}

/**
 * @param {string} query
 */
export function isNotionWorkshopDeliverable(query = "") {
  const q = normalizeFamiliarityQuery(query);
  return (
    /\bnotion\b/.test(q) &&
    WORKSHOP_PATTERN.test(q) &&
    FORMAT_EXPLICIT_PATTERN.test(q) &&
    resolveHtmlProjectProfile(query) === HTML_PROJECT_PROFILES.WORKSHOP
  );
}

/**
 * @param {string} query
 */
export function resolveConstructiveDeliveryModules(query = "") {
  if (isNotionWorkshopDeliverable(query)) {
    return NOTION_WORKSHOP_DEFAULT_MODULES;
  }
  return [];
}

export function buildConstructiveDeliverySystemAddon(query = "") {
  if (!isClearConstructiveDeliverable(query)) return "";

  const modules = resolveConstructiveDeliveryModules(query);
  const moduleLines =
    modules.length > 0
      ? modules.map((m, i) => `   ${i + 1}. ${m}`).join("\n")
      : "   (déduis 4 à 6 sections pédagogiques cohérentes avec le sujet)";

  return `
VARIANTE LIVRABLE CONSTRUCTIF V1 (CODE_DELIVERY — pas de refus défensif) :
- La demande décrit déjà un livrable concret : ENTRE EN MODE CONSTRUCTION.
- INTERDIT : « Je n'ai pas assez d'éléments », « précisez », « fournissez plus de contexte » si le sujet et le format sont identifiables.
- OBLIGATOIRE : commencer par « Oui, je peux… » puis livrer le code ou la structure demandée.
- Si un détail manque : choisir une valeur par défaut raisonnable et l'indiquer brièvement.
- Pour un livrable HTML : mode projet HTML (atelier, landing, dashboard, template…) — pas de réduction à un seul cas.
${modules.length > 0 ? `- Sections suggérées (profil atelier) :\n${moduleLines}` : ""}
`.trim();
}

/**
 * @param {string} query
 */
/**
 * Refus défensif (clarification) sur un livrable déjà cadré.
 * @param {string} text
 */
export function isDefensiveDeliveryRefusal(text = "") {
  const body = String(text || "").trim();
  if (!body) return false;

  return (
    /je n['']?ai pas assez d['']?éléments fiables/i.test(body) ||
    /précise(z)?\s+(ta|votre)\s+demande/i.test(body) ||
    /fournis(sez)?\s+plus de contexte/i.test(body) ||
    /demande\s+(semble\s+)?incomplète/i.test(body) ||
    /veuillez\s+préciser/i.test(body) ||
    /une fois ces détails fournis/i.test(body) ||
    /manque de contexte/i.test(body)
  );
}

/**
 * @param {string} query
 * @param {string} text
 */
export function isCodeDeliveryContractViolation(query = "", text = "") {
  if (!isCodeGenerationRequest(query) && !isClearConstructiveDeliverable(query)) {
    return false;
  }

  const body = String(text || "").trim();
  if (!body || isDefensiveDeliveryRefusal(body)) return true;

  if (isHtmlProjectDeliverable(query)) {
    const evaluation = evaluateHtmlProjectDelivery(query);
    if (evaluation.strategy === "clarify_then_build") {
      return isDefensiveDeliveryRefusal(body);
    }
    return isHtmlProjectQualityViolation(query, body);
  }

  const lang = resolveCodeDeliveryLanguage(query);
  if (hasCodeDeliveryStructure(body, lang)) return false;
  if (/```(?:html|css|javascript|jsx|php|python)/i.test(body)) return false;
  if (/<!doctype|<html[\s>]/i.test(body) && /<header/i.test(body) && /<aside/i.test(body)) {
    return false;
  }

  return isClearConstructiveDeliverable(query);
}

/**
 * Repli déterministe quand le composer LLM refuse malgré un livrable clair.
 * @param {string} query
 */
export function buildConstructiveDeliveryFallback(query = "") {
  const htmlFallback = buildHtmlProjectFallback(query);
  if (htmlFallback) return htmlFallback;

  const lang = resolveCodeDeliveryLanguage(query);
  return `✅ Objectif : livrable ${lang} demandé.

📋 Je peux générer le code complet — relancez la demande si ce repli statique ne suffit pas.

🚀 Mode d'emploi : précisez le langage (${lang}) et les sections attendues pour une version personnalisée.`;
}

export function buildConstructiveDeliveryUserPrompt(query = "") {
  const lang = resolveCodeDeliveryLanguage(query);
  const htmlEval = evaluateHtmlProjectDelivery(query);
  const htmlAddon = buildHtmlProjectUserAddon(query);
  const modules = resolveConstructiveDeliveryModules(query);
  const moduleBlock =
    modules.length > 0
      ? `\nSections suggérées (profil atelier) :\n${modules.map((m) => `- ${m}`).join("\n")}`
      : "";

  const strategyLine =
    htmlEval.isHtmlProject && htmlEval.strategy === "clarify_then_build"
      ? "- STRATÉGIE : clarification ciblée (2–5 questions max) OU construction avec défauts intelligents — pas de refus."
      : "- STRATÉGIE : construction V1 directe si le cadrage suffit ; défauts intelligents sinon.";

  return `Demande utilisateur :
"${query}"

CONSIGNE CRITIQUE — LIVRABLE CONSTRUCTIF V1 (langage: ${lang}) :
${strategyLine}
${htmlAddon ? `- ${htmlAddon}` : `- Produis le livrable ${lang} complet et exécutable.`}
- INTERDIT : refus défensif « pas assez d'éléments » quand format + sujet ou structure sont identifiables.
- Structure réponse : ✅ Objectif → 📋 Code (ou questions ciblées si clarification) → 🚀 Mode d'emploi.
- Ne mentionne aucun sujet de conversation précédent non lié.${moduleBlock}`;
}

export {
  isHtmlProjectDeliverable,
  isHtmlProjectQualityViolation,
  evaluateHtmlProjectDelivery,
} from "./htmlProjectDeliveryPolicy.js";

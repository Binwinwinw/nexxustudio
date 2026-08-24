/**
 * Doctrine : livrable clair → mode construction V1, pas clarification défensive.
 * Si sujet + format + intention de création sont compris, Nexxus produit une première version.
 */
import { normalizeFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";
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

/** Fiche / guide / mémo — pas du code, mais besoin d’un budget composer long. */
const STRUCTURED_CONTENT_RE =
  /\b(?:fiche(?:\s+(?:d[e']?\s*)?(?:usage|pratique|synth[eè]se|m[eé]mo))?|guide\s+pratique|m[eé]mo\s+d['']?usage|document\s+structur[eé]|cas\s+d['']emploi)\b/i;

const NOMINAL_DELIVERABLE_NOUN_RE =
  /\b(?:une?\s+)?(?:fiche|guide(?:\s+pratique)?|m[eé]mo(?:\s+d['']?usage)?|synth[eè]se(?:\s+[eé]crite)?|document(?:\s+structur[eé])?)\b/i;

const NOMINAL_PRODUCE_RE =
  /\b(?:(?:fais|fait|faire|r[eé]dige|r[eé]diger|produis|produire|pr[eé]pare|pr[eé]parer|livre|livrer|cr[eé]e|cr[eé]er|g[eé]n[eè]re|g[eé]n[eé]rer)(?:[- ]moi)?|(?:tu\s+)?(?:pourras|peux|pourrais)\s+(?:me\s+)?(?:faire|r[eé]diger|produire|pr[eé]parer)|me\s+faire)\b/i;

const NOMINAL_SUBJECT_LINK_RE =
  /\b(?:sur|de|d'|traitant(?:\s+de)?|portant\s+sur|au\s+sujet\s+de|concernant|autour\s+de)\b/i;

const CONTINUE_STRUCTURED_WORK_RE =
  /\b(?:travaillons|travaille(?:r)?\s+(?:sur|d[eé]j[aà])|mon\s+id[eé]e|continue(?:r)?(?:\s+(?:sur|avec|la|le))?|on\s+avance|fais[- ]la|r[eé]dige[- ]?la|livre[- ]?la|passons?\s+directement)\b/i;

/**
 * Livrable textuel nominal déjà explicite (« fais-moi une fiche sur X »).
 * Doit préempter PRESENTATION_OUTLINE / OPEN_PROPOSITION (pas de menu de formats).
 * @param {string} query
 */
export function isExplicitNominalDocumentDeliverable(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 18) return false;
  // Plan slides / atelier pédagogique → autre rail
  if (
    /\b(?:slides?|powerpoint|pptx?|diaporama|pitch\s+deck)\b/i.test(q) ||
    /\b(?:sc[eé]nario\s+p[eé]dagogique|sommaire\s+des\s+titres)\b/i.test(q)
  ) {
    return false;
  }
  // Parcours « fiches pour maîtriser » → rail learning path
  if (
    /\bfiches?\b/i.test(q) &&
    /\b(?:ma[iî]triser|apprendre|r[eé]vision|connaissance)\b/i.test(q) &&
    /\b(?:afin|pour)\b/i.test(q)
  ) {
    return false;
  }
  if (!NOMINAL_DELIVERABLE_NOUN_RE.test(q)) return false;
  if (!NOMINAL_PRODUCE_RE.test(q)) return false;
  return NOMINAL_SUBJECT_LINK_RE.test(q);
}

/**
 * Sujet extrait d'une demande de fiche/guide nominale.
 * @param {string} query
 * @returns {string|null}
 */
export function extractNominalDocumentSubject(query = "") {
  if (!isExplicitNominalDocumentDeliverable(query)) return null;
  const q = normalizeFamiliarityQuery(query);
  const patterns = [
    /\b(?:fiche|guide(?:\s+pratique)?|m[eé]mo|synth[eè]se|document)\s+(?:traitant\s+de|portant\s+sur|au\s+sujet\s+de|concernant|sur|de|d'|autour\s+de)\s+(.+?)(?:\s*[?.!]|$)/i,
    /\b(?:usage|utilisation)\s+de\s+(.+?)(?:\s*[?.!]|$)/i,
  ];
  for (const re of patterns) {
    const m = q.match(re);
    const raw = String(m?.[1] || "")
      .trim()
      .replace(/\s+/g, " ");
    if (raw.length >= 3) return raw.slice(0, 120);
  }
  return null;
}

/**
 * Budget composer long pour fiche/guide (évite troncature mid-liste en mode OPERATIONAL).
 * Couvre demande explicite + suite sticky (« travaillons mon idée ») si le contexte expert porte encore le sujet.
 * @param {string} query
 * @param {Array<{ content?: string }>|string} [expertContext]
 */
export function requiresStructuredContentComposerBudget(query = "", expertContext = []) {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  if (isExplicitNominalDocumentDeliverable(q) || STRUCTURED_CONTENT_RE.test(q)) return true;
  if (!CONTINUE_STRUCTURED_WORK_RE.test(q)) return false;

  const blob = Array.isArray(expertContext)
    ? expertContext.map((o) => String(o?.content || "")).join("\n")
    : String(expertContext || "");
  const sample = blob.slice(0, 6000);
  return (
    STRUCTURED_CONTENT_RE.test(sample) ||
    /\b(?:copilot|excel|microsoft\s+365)\b/i.test(sample)
  );
}

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

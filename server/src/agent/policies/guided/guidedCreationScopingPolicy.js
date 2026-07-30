/**
 * GUIDED_CREATION_SCOPING — réflexion orientée via LLM warm pour intents créatifs.
 * Les patterns déterministes restent des fallbacks de sécurité uniquement.
 */
import { evaluateJustIntent } from "../justIntentDetectionPolicy.js";
import {
  INTENT_DOMAINS,
  INTENT_ACTIONS,
} from "../../../../../shared/justIntentCatalog.js";
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isCodeConceptExplainRequest } from "../codeConceptExplainPolicy.js";
import { isExistingSourceAnalysisRequest } from "../../utils/localFileUriIntentGuards.js";
import { isExistingFilePathAnalysisRequest } from "../../../../../shared/generatorFirstPolicy.js";
import { isLearningRequestWithTarget } from "../../utils/learningRequestIntentGuards.js";

export const GUIDED_CREATION_SCOPING_RULE = "guided_creation_scoping_v1";
export const GUIDED_CREATION_SCOPING_CONTRACT_ID = "GUIDED_CREATION_SCOPING";
export const DIRECT_CODE_STARTER_RULE = "direct_code_starter_when_deliverable_is_obvious";

const OBVIOUS_DELIVERABLE_OBJECT_RE =
  /\b(?:todo|to-do|liste|application|app|script|programme|outil|class|module|gui|interface|horloge|alarme|timer|rappel|notification|crud|api|bot|agent)\b/i;

const OBVIOUS_DELIVER_INTENT_RE =
  /\b(?:code|script|python|fournir|fournis|donne|donne-moi|donne moi|generer|générer|genere|ecris|écris|cree|créer|creer|developpe|développe|peux tu|tu peux|sais tu|saurais)\b/i;

/**
 * @typedef {{ key: string, value: string }} CreationConstraint
 */

/**
 * @param {string} query
 * @returns {CreationConstraint[]}
 */
export function extractCreationConstraints(query = "") {
  const q = normalizeFamiliarityQuery(query).toLowerCase();
  /** @type {CreationConstraint[]} */
  const constraints = [];

  if (/\bpython\b/.test(q)) {
    constraints.push({ key: "langage", value: "Python" });
  }
  if (/\b(?:javascript|typescript|php|java|rust|go)\b/.test(q)) {
    const lang = q.match(
      /\b(?:javascript|typescript|php|java|rust|go)\b/,
    )?.[0];
    if (lang) constraints.push({ key: "langage", value: lang });
  }
  if (/\b(?:html|\.html|page web|site web)\b/.test(q)) {
    constraints.push({ key: "format", value: "HTML / CSS / JS" });
  }
  if (/\bjson\b/.test(q)) {
    constraints.push({ key: "persistance", value: "fichiers JSON" });
  }
  if (/\b(?:localstorage|indexeddb|sqlite)\b/.test(q)) {
    const store = q.match(/\b(?:localstorage|indexeddb|sqlite)\b/)?.[0];
    if (store) constraints.push({ key: "persistance", value: store });
  }
  if (/\b(?:agent|assistant|bot)\b/.test(q)) {
    constraints.push({ key: "cible", value: "agent IA" });
  }
  if (
    /\b(?:carte(?:s)? de membre|gestion de membre|gestion des membres|membres)\b/.test(
      q,
    )
  ) {
    constraints.push({
      key: "domaine",
      value: "gestion de cartes de membre",
    });
  }
  if (/\b(?:application|app|outil)\b/.test(q)) {
    constraints.push({ key: "type", value: "application" });
  }
  if (
    /\b(?:peu de membres|petit volume|petite echelle|peu d utilisateurs|pas beaucoup)\b/.test(
      q,
    )
  ) {
    constraints.push({ key: "echelle", value: "petit volume / peu d'utilisateurs" });
  }
  if (/\b(?:crud|ajouter|modifier|supprimer|liste)\b/.test(q)) {
    constraints.push({ key: "fonctions", value: "CRUD / gestion de fiches" });
  }

  return constraints;
}

/**
 * Livrable code déjà cadré (langage + objet + fonction) — pas de scoping défensif.
 * @param {string} query
 * @returns {boolean}
 */
export function isObviousCodeDeliverableRequest(query = "") {
  const q = normalizeFamiliarityQuery(query).toLowerCase();
  if (!q || q.length < 35) return false;

  const constraints = extractCreationConstraints(query);
  const hasLanguage = constraints.some((c) => c.key === "langage");
  if (!hasLanguage) return false;

  if (
    isLearningRequestWithTarget(query) &&
    !OBVIOUS_DELIVER_INTENT_RE.test(q)
  ) {
    return false;
  }

  const ji = evaluateJustIntent(query);
  if (ji.domain !== INTENT_DOMAINS.CODE || ji.action !== INTENT_ACTIONS.CREATE) {
    return false;
  }
  if (!OBVIOUS_DELIVER_INTENT_RE.test(q)) return false;

  const isVagueAgentAsk =
    /\bagent\s*(?:ia|ai|inteligent|intelligent)?\b/.test(q) &&
    !/\b(?:cli|api|memoire|mémoire|telegram|discord|rag|todo|liste|rappel|horloge|timer|gui|interface)\b/.test(
      q,
    );
  if (isVagueAgentAsk) return false;

  const hasConcreteFeature =
    /\b(?:todo|to-do|liste|rappel|horloge|alarme|timer|notification|crud|gui|interface|renommer|fichiers|scraper)\b/.test(
      q,
    );
  const hasMultipleConstraints =
    constraints.length >= 2 && OBVIOUS_DELIVERABLE_OBJECT_RE.test(q);

  return hasConcreteFeature || hasMultipleConstraints;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
/**
 * Cadrage produit explicite (pas « aide moi » nu).
 * @param {string} query
 * @returns {boolean}
 */
export function isProjectScopingAssistRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 12) return false;
  if (
    /\baide[- ]?moi\b.*\b(?:preciser|préciser|cadrer|structurer|affiner|clarifier)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  if (/\b(?:preciser|préciser|cadrer|structurer|affiner)\b.*\bprojet\b/i.test(q)) {
    return true;
  }
  if (/\bprojet\b.*\bbonnes pratiques\b/i.test(q)) {
    return true;
  }
  return false;
}

/**
 * Brainstorm / brief produit collé dans le chat (gros texte).
 * @param {string} query
 * @returns {boolean}
 */
export function isInlineProductBriefPaste(query = "") {
  const raw = String(query || "");
  if (raw.length < 500) return false;
  const q = normalizeFamiliarityQuery(raw);
  const markers = [
    /\bbrainstorm/i,
    /\bmvp\b/i,
    /\bconcept\b/i,
    /\bpositionnement\b/i,
    /\bproduit\b/i,
    /\btagline\b/i,
  ];
  const hits = markers.filter((re) => re.test(q)).length;
  return hits >= 2 || (raw.length >= 1200 && hits >= 1);
}

export function isGuidedCreationScopingRequest(query = "") {
  if (isObviousCodeDeliverableRequest(query)) return false;
  if (isCodeConceptExplainRequest(query)) return false;
  // Analyse d'un fichier existant ≠ création web/code.
  if (isExistingSourceAnalysisRequest(query)) return false;
  if (isExistingFilePathAnalysisRequest(query)) return false;
  if (isProjectScopingAssistRequest(query)) return true;
  if (isInlineProductBriefPaste(query)) return true;
  const ji = evaluateJustIntent(query);
  const isCodeCreate =
    ji.domain === INTENT_DOMAINS.CODE &&
    ji.action === INTENT_ACTIONS.CREATE;
  const isWebCreate =
    ji.domain === INTENT_DOMAINS.WEB_HTML &&
    ji.action === INTENT_ACTIONS.CREATE;
  return isCodeCreate || isWebCreate;
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildGuidedCreationScopingSystemAddon(query = "") {
  const ji = evaluateJustIntent(query);
  const constraints = extractCreationConstraints(query);
  const constraintBlock =
    constraints.length > 0
      ? constraints.map((c) => `- **${c.key}** : ${c.value}`).join("\n")
      : "- (aucune contrainte explicite — inférer prudemment depuis la formulation)";

  return [
    "VARIANTE CRÉATION GUIDÉE (GUIDED_CREATION_SCOPING — réflexion orientée, pas gabarit) :",
    `Intention : ${ji.domainLabel} · ${ji.actionLabel} · stratégie ${ji.strategy}.`,
    "",
    "CONTRAINTES DÉJÀ DANS LA REQUÊTE (à réutiliser explicitement) :",
    constraintBlock,
    "",
    "RÈGLES OBLIGATOIRES :",
    "1) Ouvre en reformulant ce que tu as compris — en citant les contraintes ci-dessus, pas en les ignorant.",
    "2) Propose une première orientation concrète (plan, architecture ou prochaine étape) ancrée dans CES éléments.",
    "3) Pose AU MAXIMUM 2 questions, uniquement sur ce qui bloque vraiment la suite.",
    "4) INTERDIT : taxonomies génériques hors contexte (SharePoint, WordPress, vitrine, intranet si non mentionnés).",
    "5) INTERDIT : matrices « 3 approches », slogans RAG/industriel, ou « Je partirais plutôt sur… ».",
    "6) INTERDIT : long squelette de code non demandé — reste concis tant que la variante n'est pas choisie.",
    "7) Ton : partenaire technique qui raisonne avec la demande, pas formulaire de cadrage.",
    "",
    "FORMAT : 2–4 paragraphes courts + éventuellement 1–2 questions numérotées.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {{
 *   path: string,
 *   deferToLlm: boolean,
 *   guidedCreationScoping: boolean,
 *   reflectiveHint: string,
 *   step: string,
 * }|null}
 */
export function resolveGuidedCreationScopingShortCircuit(query = "") {
  if (!isGuidedCreationScopingRequest(query)) return null;

  const ji = evaluateJustIntent(query);
  const isWeb = ji.domain === INTENT_DOMAINS.WEB_HTML;

  return {
    path: "guided_creation_scoping",
    deferToLlm: true,
    guidedCreationScoping: true,
    reflectiveHint: buildGuidedCreationScopingSystemAddon(query),
    step: isWeb
      ? "🌐 Création web — réflexion guidée (LLM local)..."
      : "🐍 Création code — réflexion guidée (LLM local)...",
  };
}

/**
 * @param {string} query
 * @param {{ meta?: object }} [packet]
 * @returns {boolean}
 */
export function isGuidedCreationScopingContractRequest(query = "", packet = {}) {
  const forced = packet?.meta?.intent_contract_id;
  if (forced === GUIDED_CREATION_SCOPING_CONTRACT_ID) return true;
  return isGuidedCreationScopingRequest(query);
}

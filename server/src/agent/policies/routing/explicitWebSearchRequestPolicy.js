/**
 * Requêtes avec demande explicite de recherche web — factual compare matériel/prix.
 * Doctrine : web réel OU refus honnête, jamais faux « je n'ai pas pu vérifier ».
 * Aussi : offre d'aide « je veux faire une recherche sur internet » (clarify sujet).
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import {
  isCompareChooseRequest,
  extractCompareDomain,
} from "../../utils/compareChooseIntentGuards.js";
import { resolveWebSearchThreadMaintenanceShortCircuit } from "../web/index.js";

export const EXPLICIT_WEB_SEARCH_REQUEST_RULE = "explicit_web_search_request_v1";

/** Cluster web + citations + rapport — prime sur marqueur lexical « présentation » (sauf slides/PPT explicites). */
export const WEB_CITATIONS_STRUCTURED_REPORT_CLUSTER_RULE =
  "web_citations_structured_report_cluster_v1";

const EXPLICIT_WEB_SEARCH_RE =
  /\b(?:(?:faire|fais|fait|lance|utilise|veux\s+faire)\s+(?:une\s+)?recherche\s+sur\s+(?:la\s+)?(?:toile|web|internet)|recherche\s+sur\s+(?:la\s+)?(?:toile|web|internet)|(?:fais|fait|lance|utilise)\s+(?:une\s+)?recherche\s+(?:sur\s+)?(?:la\s+)?(?:toile|web|internet)|cherche(?:z|r)?\s+(?:sur\s+)?(?:la\s+)?(?:toile|web|internet)|(?:derni[eè]res?\s+)?informations?\s+sur\s+la\s+toile|va\s+sur\s+(?:le\s+)?(?:web|internet)|recherche\s+web|navigation\s+web|cherche\s+(?:pour\s+moi\s+)?sur\s+(?:le\s+)?(?:web|internet)|sur\s+(?:la\s+)?(?:toile|web|internet)\s+(?:trouve|trouver|cherche|chercher|trouve[- ]moi|cherche[- ]moi)|(?:trouve|trouver|cherche|chercher)(?:\s+\w+){0,12}\s+sur\s+(?:la\s+)?(?:toile|web|internet))\b/i;

/** Slides / PPT explicites — « présentation » seul ne suffit pas. */
const EXPLICIT_SLIDES_DELIVERABLE_RE =
  /\b(?:powerpoint|power\s*point|pptx?|slides?|diaporama|pitch\s*deck)\b/i;

const CITATIONS_OR_SOURCES_RE =
  /\b(?:sources?|citations?|r[eé]f[eé]rences?|bibliographie|avec\s+sources)\b/i;

const STRUCTURED_REPORT_RE =
  /\b(?:rapport(?:\s+professionnel)?|compte[- ]rendu)\b/i;

const WEB_HELP_SHELL_RE =
  /\b(?:tu\s+peux\s+m['']aider|peux[- ]?tu\s+m['']aider|aide[- ]?moi|s['']il\s+te\s+pla[iî]t|stp|svp|je\s+veux|j['']aimerais|on\s+peut)\b/i;

const HARDWARE_PRODUCT_RE =
  /\b(?:rtx|gtx|rx\s*\d|nvidia|amd|carte\s+graphique|gpu|processeur|cpu|carte\s+m[eè]re|ram|kit\s+pc|alimentation\s+pc|ssd|disque\s+dur)\b/i;

const MIN_MODELS_RE =
  /\b(?:au\s+moins\s+)?\d+\s+mod[eè]les?\b|\b(?:trois|3)\s+mod[eè]les?\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isExplicitWebSearchRequest(query = "") {
  const raw = String(query || "");
  if (!raw.trim()) return false;
  if (EXPLICIT_WEB_SEARCH_RE.test(raw)) return true;
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  return EXPLICIT_WEB_SEARCH_RE.test(q);
}

/**
 * Demande explicite de livrable slides / PowerPoint (pas le seul mot « présentation »).
 * @param {string} query
 * @returns {boolean}
 */
export function hasExplicitSlidesDeliverableRequest(query = "") {
  return EXPLICIT_SLIDES_DELIVERABLE_RE.test(String(query || ""));
}

/**
 * Cluster opérationnel : recherche web + citations/sources + rapport.
 * Doit primer sur un marqueur lexical « présentation » adjacent.
 * @param {string} query
 * @returns {boolean}
 */
export function isWebCitationsStructuredReportCluster(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return false;
  if (!isExplicitWebSearchRequest(raw)) return false;
  if (hasExplicitSlidesDeliverableRequest(raw)) return false;
  if (!CITATIONS_OR_SOURCES_RE.test(raw)) return false;
  if (!STRUCTURED_REPORT_RE.test(raw)) return false;
  return true;
}

/**
 * Sujet de recherche après retrait des coquilles « recherche web / aide-moi ».
 * @param {string} query
 * @returns {string|null}
 */
export function extractWebSearchTopic(query = "") {
  let t = String(query || "");
  if (!t.trim()) return null;
  t = t.replace(EXPLICIT_WEB_SEARCH_RE, " ");
  t = t.replace(WEB_HELP_SHELL_RE, " ");
  t = t.replace(
    /\b(?:sur\s+(?:le\s+)?(?:web|internet|toile)|une\s+recherche|recherche|faire|fais|fait|trouve|trouver|cherche|chercher)\b/gi,
    " ",
  );
  t = t.replace(/[?!.…,;:]+/g, " ").replace(/\s+/g, " ").trim();
  const stop = new Set([
    "un",
    "une",
    "des",
    "le",
    "la",
    "les",
    "du",
    "de",
    "et",
    "ou",
    "pour",
    "avec",
    "dans",
    "sur",
    "moi",
    "toi",
    "me",
    "te",
  ]);
  const words = t
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !stop.has(w.toLowerCase()));
  if (words.length < 2) return null;
  return words.join(" ").slice(0, 160);
}

/**
 * Demande web explicite sans sujet exploitable → clarify, pas idéation.
 * @param {string} query
 * @returns {boolean}
 */
export function isWebSearchHelpWithoutTopic(query = "") {
  if (!isExplicitWebSearchRequest(query)) return false;
  return !extractWebSearchTopic(query);
}

export function buildWebSearchHelpClarifyReply() {
  return [
    "Oui — je peux lancer une **recherche sur internet**.",
    "",
    "Dis-moi le **sujet précis** (faits, produit, doc technique, actu…) et j’irai chercher des sources web pour t’en faire une synthèse ancrée.",
  ].join("\n");
}

const WEB_HELP_CLARIFY_MARKER_RE =
  /\b(?:recherche sur internet|sujet pr[eé]cis|synth[eè]se ancr[eé]e|sources web)\b/i;

/** Pivot / précision dans le même fil recherche web (pas de plafond de tours). */
const WEB_TOPIC_PIVOT_RE =
  /^(?:et\s+)?(?:aussi\s+)?(?:sur|pour|concernant|au\s+sujet\s+de|à\s+propos\s+de|a\s+propos\s+de)\b|^et\s+(?:les?|la|l['']|des|un|une)\b|^(?:pareil|idem|m[eê]me\s+chose)\b/i;

const WEB_THREAD_HARD_BREAK_RE =
  /\b(?:bonjour|salut|hello|traduis|calcule|corrige|cr[eé]e|génère|genere|forge|commit|push|analyse\s+le\s+(?:fichier|d[eé]p[oô]t)|ouvre\s+le\s+projet)\b/i;

const WEB_NON_TOPIC_RE =
  /^(?:merci|ok|okay|oui|non|ouais|d['']accord|super|parfait|top|cool|bye|a\s+plus|à\s+plus|rien|stop)$/i;

/**
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string|null}
 */
function findLastAssistantContent(history = []) {
  const list = Array.isArray(history) ? history : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (
      (list[i]?.role === "assistant" || list[i]?.role === "model") &&
      String(list[i]?.content || "").trim()
    ) {
      return String(list[i].content).trim();
    }
  }
  return null;
}

/**
 * @param {string} content
 * @returns {boolean}
 */
function looksLikeWebSearchClarifyReply(content = "") {
  const last = String(content || "").trim();
  if (!last) return false;
  return (
    WEB_HELP_CLARIFY_MARKER_RE.test(last) &&
    /\b(?:dis[- ]moi|sujet|pr[eé]cis)\b/i.test(last)
  );
}

/**
 * Tour précédent = clarify sujet pour recherche web.
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isWebSearchHelpClarifyPending(history = []) {
  return looksLikeWebSearchClarifyReply(findLastAssistantContent(history));
}

/**
 * Nouvelle intention hors fil recherche web (casse la continuité).
 * @param {string} query
 * @returns {boolean}
 */
export function isHardWebSearchThreadBreak(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return false;
  if (isExplicitWebSearchRequest(raw)) return false;
  if (isWebResearchContinuationQuery(raw)) return false;
  return WEB_THREAD_HARD_BREAK_RE.test(raw);
}

/**
 * Pivot / précision (« et sur les additions… », « sur les nike… »).
 * @param {string} query
 * @returns {boolean}
 */
export function isWebResearchContinuationQuery(query = "") {
  const t = String(query || "").trim();
  if (!t || WEB_NON_TOPIC_RE.test(t.replace(/[?!.…]+$/g, "").trim())) {
    return false;
  }
  if (isExplicitWebSearchRequest(t)) return false;
  return WEB_TOPIC_PIVOT_RE.test(t);
}

/**
 * Fil recherche web encore actif — sans plafond de tours.
 * Ouvert par une demande web explicite / clarify ; fermé seulement par
 * une intention dure (code, trad, forge, salut…) pas par un simple pivot de sujet.
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isWebSearchThreadActive(history = []) {
  const list = Array.isArray(history) ? history : [];
  let active = false;

  for (const msg of list) {
    const content = String(msg?.content || "").trim();
    if (!content) continue;
    const role = msg?.role;

    if (role === "user") {
      if (isExplicitWebSearchRequest(content)) {
        active = true;
        continue;
      }
      if (isHardWebSearchThreadBreak(content)) {
        active = false;
        continue;
      }
      // Pivots / sujets restent dans le fil s'il est déjà ouvert.
      continue;
    }

    if (
      (role === "assistant" || role === "model") &&
      looksLikeWebSearchClarifyReply(content)
    ) {
      active = true;
    }
  }

  return active;
}

/**
 * Topic depuis un follow-up court (« sur la mixtrack Pro 2 », « et sur les additions… »).
 * @param {string} query
 * @returns {string|null}
 */
export function extractWebSearchFollowUpTopic(query = "") {
  let t = String(query || "").trim();
  if (!t) return null;
  t = t.replace(/^[?!.…\s]+|[?!.…\s]+$/g, "");
  if (WEB_NON_TOPIC_RE.test(t)) return null;
  t = t.replace(
    /^(?:et\s+)?(?:aussi\s+)?(?:sur|pour|concernant|au\s+sujet\s+de|à\s+propos\s+de|a\s+propos\s+de)\s+/i,
    "",
  );
  t = t.replace(/^et\s+/i, "");
  t = t.replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 160) return null;
  if (isHardWebSearchThreadBreak(t) || WEB_THREAD_HARD_BREAK_RE.test(t)) {
    return null;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 1) return null;
  // Un seul token très court (ex. « oui ») n’est pas un sujet produit.
  if (words.length === 1 && words[0].length < 4) return null;
  return t;
}

/**
 * @param {string} topic
 * @returns {object}
 */
function buildWebPipelineHit(topic, kind = "web_help_with_topic", fullQuery = "") {
  const guidedProduct =
    fullQuery && hasExplicitWebProductRecoSignals(fullQuery);
  return {
    path: "information_seeking_full_pipeline",
    kind,
    reply: null,
    deferToLlm: true,
    deferToFullPipeline: true,
    preferWebResearch: true,
    informationSeeking: true,
    webQuery: topic,
    forcedIntentContractId: guidedProduct
      ? "GUIDED_PRODUCT_RECOMMENDATION"
      : "FACTUAL_RESEARCH",
    step: "🔍 Recherche web — pipeline information...",
  };
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{
 *   path: string,
 *   kind: string,
 *   reply?: string|null,
 *   deferToLlm?: boolean,
 *   preferWebResearch?: boolean,
 *   webQuery?: string|null,
 *   step?: string,
 * }|null}
 */
export function resolveExplicitWebSearchHelpShortCircuit(query = "", options = {}) {
  const history = options.history || [];

  const threadMaintenance = resolveWebSearchThreadMaintenanceShortCircuit(query, {
    history,
  });
  if (threadMaintenance) return threadMaintenance;

  // 1) Juste après clarify sujet.
  if (isWebSearchHelpClarifyPending(history)) {
    const followTopic =
      extractWebSearchTopic(query) || extractWebSearchFollowUpTopic(query);
    if (followTopic) {
      return buildWebPipelineHit(followTopic, "web_help_followup_topic", query);
    }
  }

  // 2) Continuité du fil web : pivots « et sur… » tant que l'intention n'est pas rompue.
  if (
    isWebSearchThreadActive(history) &&
    isWebResearchContinuationQuery(query) &&
    !isHardWebSearchThreadBreak(query)
  ) {
    const followTopic =
      extractWebSearchTopic(query) || extractWebSearchFollowUpTopic(query);
    if (followTopic) {
      return buildWebPipelineHit(followTopic, "web_help_thread_continuation", query);
    }
  }

  if (!isExplicitWebSearchRequest(query)) return null;

  const topic = extractWebSearchTopic(query);
  if (!topic) {
    return {
      path: "web_search_help_clarify",
      kind: "web_help_missing_topic",
      reply: buildWebSearchHelpClarifyReply(),
      step: "🌐 Recherche web — préciser le sujet...",
    };
  }

  return buildWebPipelineHit(topic, "web_help_with_topic", query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isHardwareProductCompareQuery(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  return HARDWARE_PRODUCT_RE.test(q);
}

/**
 * Comparatif matériel/prix avec demande web explicite — pas IDEATION_OPEN.
 * @param {string} query
 * @returns {boolean}
 */
export function isFreshFactualCompareWithWebRequest(query = "") {
  if (!isExplicitWebSearchRequest(query)) return false;
  if (!isCompareChooseRequest(query)) return false;
  const domain = extractCompareDomain(query);
  return domain === "product" || isHardwareProductCompareQuery(query);
}

/**
 * Slots produit considérés remplis si web explicite + critère + N modèles demandés.
 * @param {string} query
 * @returns {boolean}
 */
export function hasExplicitWebProductRecoSignals(query = "") {
  if (!isExplicitWebSearchRequest(query)) return false;
  if (!isHardwareProductCompareQuery(query) && extractCompareDomain(query) !== "product") {
    return false;
  }
  const raw = String(query || "");
  const q = normalizeFamiliarityQuery(query);
  const hasCriterion =
    /\b(?:rapport\s+qualit[eé][\s/-]*prix|qualit[eé][\s/-]*prix|meilleur\s+rapport|budget|prix|euros?)\b/i.test(
      q,
    ) ||
    /\b(?:moins\s+de|under|max|maximum)\s+\d+/i.test(q) ||
    /\d[\d\s.,]*\s*(?:€|euros?)\b/i.test(raw) ||
    /€/.test(raw) ||
    MIN_MODELS_RE.test(q);
  return hasCriterion;
}

/**
 * @param {object} [packet]
 * @returns {boolean}
 */
export function wasWebSearchSkippedByContract(packet = {}) {
  return packet?.meta?.web_failure_mode === "web_search_skipped_by_contract";
}

/**
 * @param {object} [packet]
 * @returns {boolean}
 */
export function wasWebSearchAttempted(packet = {}) {
  return Boolean(
    packet?.meta?.web_consulted_at ||
      packet?.meta?.web_failure_mode === "fallback_no_results" ||
      packet?.meta?.web_failure_mode === "web_search_error",
  );
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildExplicitWebUnavailableReply(query = "") {
  const snippet = normalizeFamiliarityQuery(query).slice(0, 100);
  return (
    "Je ne peux pas consulter le web depuis ce contexte (profil souverain local / recherche désactivée). " +
    (snippet ? `Pour « ${snippet}${query.length > 100 ? "…" : ""} », ` : "") +
    "je peux te donner quelques repères généraux sur les gammes, mais ce ne sera pas à jour sur les prix ni les modèles récents. " +
    "Pour un achat, vérifie toujours les benchmarks et tarifs actuels sur un comparateur ou le site constructeur."
  );
}

/**
 * WEB_PROJECT_SCOPING — cadrage création site / page / CMS (SharePoint, HTML, WordPress…).
 * P2 famille ConversationMove : clarify ciblé ou premières étapes — pas architecture_design.
 */
import { normalizeArchitectureDesignQuery } from "./architectureDesignIntentGuards.js";
import { isWebArtifactBuildExclusionForArchitectureDesign } from "./architectureDesignIntentGuards.js";

export const WEB_PROJECT_SCOPING_RULE = "web_project_scoping_not_agent_architecture";

const PLATFORM_LABELS = Object.freeze({
  sharepoint: "SharePoint",
  wordpress: "WordPress",
  wix: "Wix",
  webflow: "Webflow",
  squarespace: "Squarespace",
  shopify: "Shopify",
  drupal: "Drupal",
  joomla: "Joomla",
  html: "HTML",
});

const PLATFORM_EXTRACT_RE =
  /\b(sharepoint|wordpress|wix|webflow|squarespace|shopify|drupal|joomla)\b/i;

const SITE_TYPE_RE =
  /\b(?:site\s+d['']?equipe|site\s+de\s+communication|intranet|extranet|vitrine|landing(?:\s+page)?|blog|e[- ]?commerce|bibliotheque|bibliothèque|documentaire|portail(?:\s+web)?)\b/i;

/**
 * @param {string} query
 */
export function isWebProjectScopingRequest(query = "") {
  return isWebArtifactBuildExclusionForArchitectureDesign(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractWebProjectPlatform(query = "") {
  const q = normalizeArchitectureDesignQuery(query);
  const cms = q.match(PLATFORM_EXTRACT_RE)?.[1]?.toLowerCase();
  if (cms) return cms;
  if (/\b(?:page\s+html|\.html|site\s+web|landing|web\s*app)\b/.test(q)) return "html";
  if (/\b(?:intranet|extranet)\b/.test(q)) return "sharepoint";
  return null;
}

/**
 * @param {string} query
 */
export function hasExplicitWebSiteType(query = "") {
  return SITE_TYPE_RE.test(normalizeArchitectureDesignQuery(query));
}

/**
 * @param {string} platform
 */
export function buildWebProjectScopingClarifyReply(platform = null) {
  if (platform === "sharepoint") {
    return (
      "Tu veux créer quel type de site SharePoint : **site d'équipe** (collaboration interne), " +
      "**site de communication** (intranet / vitrine), ou **espace documentaire** (bibliothèque / fichiers) ?"
    );
  }
  if (platform === "wordpress") {
    return (
      "Pour WordPress : tu vises **hébergé** (wordpress.com) ou **auto-hébergé** (ton serveur) — " +
      "et c'est plutôt un **blog**, une **vitrine**, ou un **site e-commerce** ?"
    );
  }
  if (platform === "html") {
    return (
      "Pour ta page HTML : tu veux une **page unique** (landing / association), un **petit site multi-pages**, " +
      "ou une **maquette** à intégrer plus tard dans un CMS ?"
    );
  }
  return (
    "Tu veux plutôt un **site vitrine**, un **intranet**, ou un **espace collaboratif** — " +
    "et sur quelle plateforme (SharePoint, HTML, WordPress, autre) ?"
  );
}

/**
 * @param {string} query
 */
export function buildWebProjectScopingDirectReply(query = "") {
  const platform = extractWebProjectPlatform(query) || "web";
  const label = PLATFORM_LABELS[platform] || "web";
  return (
    `Pour démarrer ton projet **${label}**, voici le cadrage utile :\n` +
    `1. **Objectif** — public cible, contenu principal, actions attendues (lecture, formulaire, collaboration).\n` +
    `2. **Structure** — pages clés, navigation, zones récurrentes (accueil, actualités, documents, contact).\n` +
    `3. **Droits** — qui publie, qui lit, qui administre (groupes / rôles).\n` +
    `4. **Première étape concrète** — créer l'ossature du site, puis une page pilote avant d'étendre.\n\n` +
    `Dis-moi le type de site visé et ton niveau d'accès admin — je te détaille la procédure pas à pas.`
  );
}

/**
 * @param {string} query
 * @returns {{
 *   topic: string,
 *   platform: string|null,
 *   needsClarify: boolean,
 *   clarifyQuestion: string|null,
 *   directReply: string|null,
 * }|null}
 */
export function classifyWebProjectScopingRequest(query = "") {
  if (!isWebProjectScopingRequest(query)) return null;

  const platform = extractWebProjectPlatform(query);
  const topic = platform
    ? `site ${PLATFORM_LABELS[platform] || platform}`
    : "site web";
  const needsClarify = !hasExplicitWebSiteType(query);

  if (needsClarify) {
    return {
      topic,
      platform,
      needsClarify: true,
      clarifyQuestion: buildWebProjectScopingClarifyReply(platform),
      directReply: null,
    };
  }

  return {
    topic,
    platform,
    needsClarify: false,
    clarifyQuestion: null,
    directReply: buildWebProjectScopingDirectReply(query),
  };
}

const WEB_SCOPING_STRUCTURE_RE =
  /\b(?:objectif|structure|droits|premiere etape|première étape|pages cles|pages clés|navigation|plateforme|sharepoint|wordpress|html)\b/i;

/**
 * @param {string} text
 * @param {string} query
 * @param {object} [conversationMove]
 */
export function isWebProjectScopingContractViolation(
  text = "",
  query = "",
  conversationMove = {},
) {
  const path = String(conversationMove.pipelinePath || "");
  if (path !== "web_project_scoping_direct") return false;

  const cleaned = String(text || "").trim();
  if (!cleaned) return true;
  if (
    /\b(?:je vois la piste|objectif en une phrase|donne[- ]moi l['']objectif)\b/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  if (
    /\b(?:bonjour|comment puis[- ]je t['']aider|architecture_design|trois approches|rag)\b/i.test(
      cleaned,
    ) &&
    !WEB_SCOPING_STRUCTURE_RE.test(cleaned)
  ) {
    return true;
  }

  const platform = extractWebProjectPlatform(query);
  if (platform) {
    const label = (PLATFORM_LABELS[platform] || platform).toLowerCase();
    if (
      !new RegExp(`\\b${label}\\b`, "i").test(cleaned) &&
      !WEB_SCOPING_STRUCTURE_RE.test(cleaned)
    ) {
      return true;
    }
  }

  return !WEB_SCOPING_STRUCTURE_RE.test(cleaned);
}

/**
 * @param {string} text
 * @param {string} query
 * @param {object} [conversationMove]
 */
export function enforceWebProjectScopingDirectness(
  text = "",
  query = "",
  conversationMove = {},
) {
  const cleaned = String(text || "").trim();
  if (!isWebProjectScopingContractViolation(cleaned, query, conversationMove)) {
    return cleaned;
  }
  return buildWebProjectScopingDirectReply(query);
}

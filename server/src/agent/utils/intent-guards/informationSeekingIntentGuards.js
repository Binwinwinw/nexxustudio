/**
 * Shell « je cherche des informations sur X » — priorité factuelle/explicative sur le social.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isCurrentWebFactRequest } from "../../policies/web/index.js";
import {
  extractResearchThenSummarizeTarget,
  isResearchThenSummarizeRequest,
} from "../../policies/routing/researchThenSummarizePolicy.js";
import { isFormalLetterTemplateRequest } from "../../policies/delivery/index.js";
import { buildExistenceScopedWebQuery } from "../../policies/conversation/existenceScopeGuardPolicy.js";
import { isCausalWhyExplainRequest } from "../../policies/posture/voiceContinuityPolicy.js";

const INFORMATION_SEEKING_SHELL_RE =
  /\b(?:je cherche|j cherche|chercher|je voudrais|j aimerais|j'aimerais|besoin d(?:e|'|)?\s*(?:infos?|informations?|renseignements?)|j ai besoin d(?:e|'|)?\s*(?:infos?|informations?|renseignements?)|tu peux me dire|peux[- ]?tu me dire|dis[- ]?moi ce que tu sais|explique[- ]?moi|m['']?expliquer|m['']?informer|informe[- ]?moi)\b/i;

/** Variante « quelles informations as-tu / aurais-tu … » (ex. King of Avalon). */
const INFORMATION_POSSESSION_SHELL_RE =
  /\b(?:quelles informations|quelle information)\s+(?:as[- ]?tu|aurais[- ]?tu|avez[- ]?vous|peux[- ]?tu|pourrais[- ]?tu)\b/i;

const INFORMATION_KNOWLEDGE_SHELL_RE =
  /\b(?:que sais[- ]?tu|que savez[- ]?vous|qu['']en sais[- ]?tu)\s+(?:sur|de |du |d'|concernant|a propos de|à propos de)\b/i;

/** Variante courte « infos sur X » (kimono, Trello, etc.). */
const INFORMATION_SHORT_INFOS_SHELL_RE =
  /\binfos?\s+(?:sur|concernant|a propos de|à propos de|au sujet de)\b/i;

const INFORMATION_TARGET_PATTERNS = [
  /\b(?:sur|concernant|a propos de|à propos de|au sujet de)\s+(?:la |le |les |l')?([^?.!,]{2,80})/i,
  /\b(?:infos?|informations?|renseignements?)\s+(?:sur|concernant|a propos de|à propos de)\s+(?:la |le |les |l')?([^?.!,]{2,80})/i,
  /\b(?:du |de |d'|sur )(?:jeu |la |le |les |l')?([^?.!,]{2,80})/i,
];

/** Sujet nommé (jeu, app…) — escalade si simple_factual LLM vide. */
const NICHE_INFORMATION_SUBJECT_RE =
  /\b(?:jeu|jeux|app|application|logiciel|mobile game|mmorpg|strategie|stratégie)\b/i;

/** Miroir learningRequestIntentGuards — évite import circulaire. */
const LEARNING_PREEMPT_INFO_SEEKING_RE =
  /\b(?:apprentissage (?:de |du |des |d'|sur )|plan (?:d'|de |pour )?apprentissage|parcours (?:d'|de |pour )?apprentissage|feuille de route (?:pour |de )?apprendre|me former (?:a |à |en |sur |au )|structurer mon apprentissage|organiser mon apprentissage)\b/i;

/** « je voudrais créer X » = mandat de création, pas fiche / recherche web. */
const CREATE_PREEMPT_INFO_SEEKING_RE =
  /\b(?:je (?:voudrais|veux|souhaite)|j[' ]?aimerais)\s+(?:creer|créer|construire|developper|développer|fabriquer|mettre en place|concevoir)\b/i;

const CREATE_HELP_MANDATE_RE =
  /\b(?:peux|pourrais|pourras)[- ]?tu\s+m[' ]?aider.{0,48}\b(?:creer|créer|construire|developper|développer|concevoir)\b/i;

/** Création textuelle nommée (poème, conte…) — pas fiche, pas web. */
const TEXT_CREATION_GENRE_RE =
  /\b(?:po[eè]me|conte|chanson|slogan|texte\s+court)\b/i;

const TEXT_CREATION_VERB_RE =
  /\b(?:[eé]cris|[eé]crire|r[eé]dige|r[eé]diger|compose|composer|g[eé]n[eè]re|g[eé]n[eé]rer|produis|produire)\b/i;

const TEXT_CREATION_MAKE_RE =
  /\b(?:fais[- ]moi|fait[- ]moi)\s+(?:un|une)\b/i;

const TEXT_CREATION_DESIRE_RE =
  /\b(?:je\s+(?:voudrais|veux|souhaite)|j[' ]?aimerais)\s+(?:un|une)\b/i;

const TEXT_CREATION_SUBJECT_RE =
  /\b(?:sur|à\s+propos\s+de|a\s+propos\s+de|au\s+sujet\s+de|concernant)\s+(?:la\s+|le\s+|les\s+|l')?[^?.!,]{2,80}/i;

const TEXT_CREATION_EXPLAIN_EXCLUDE_RE =
  /\b(?:explique(?:[- ]moi)?|c['']est\s+quoi|qu['']est[- ]ce\s+qu|comment\s+(?:[eé]crire|r[eé]diger|faire)|infos?\s+sur|informations?\s+sur|que\s+sais[- ]tu)\b/i;

const TEXT_CREATION_RENDER_FORMAT_RE = /\b(?:pdf|markdown|\.md|docx?|html)\b/i;

/** Opinion / stance 1re personne — pas un sujet topical récupérable pour D2. */
const HISTORY_SUBJECT_STANCE_RE =
  /\b(?:j['']?adore|j['']?aime|je\s+(?:pense|trouve|crois|veux|voudrais|d[eé]teste|kiffe)|moi\s+aussi)\b/i;

/**
 * Mandat de création explicite — prime sur info-seeking et guide de lancement.
 * @param {string} query
 */
export function isCreateMandateRequest(query = "") {
  const q = normalizeQuery(query);
  return CREATE_PREEMPT_INFO_SEEKING_RE.test(q) || CREATE_HELP_MANDATE_RE.test(q);
}

/**
 * Création textuelle explicite : verbe/désir + genre + sujet (message ou fil récent).
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 */
export function isExplicitTextCreationRequest(query = "", options = {}) {
  if (isFormalLetterTemplateRequest(query)) return false;
  const q = normalizeQuery(query);
  if (!q || q.length < 8) return false;
  if (TEXT_CREATION_EXPLAIN_EXCLUDE_RE.test(q)) return false;
  if (!TEXT_CREATION_GENRE_RE.test(q)) return false;
  const hasCreationShell =
    TEXT_CREATION_VERB_RE.test(q) ||
    TEXT_CREATION_MAKE_RE.test(q) ||
    TEXT_CREATION_DESIRE_RE.test(q);
  if (!hasCreationShell) return false;
  if (TEXT_CREATION_SUBJECT_RE.test(q)) return true;
  // D2 — sujet déjà nommé dans le fil (pas d’élargissement du routeur soft).
  return Boolean(extractPriorTextCreationSubject(options.history || []));
}

/**
 * Shell création (verbe/désir + genre) sans exiger le sujet.
 * @param {string} query
 */
export function isTextCreationShell(query = "") {
  if (isFormalLetterTemplateRequest(query)) return false;
  const q = normalizeQuery(query);
  if (!q || q.length < 8) return false;
  if (TEXT_CREATION_EXPLAIN_EXCLUDE_RE.test(q)) return false;
  if (!TEXT_CREATION_GENRE_RE.test(q)) return false;
  return (
    TEXT_CREATION_VERB_RE.test(q) ||
    TEXT_CREATION_MAKE_RE.test(q) ||
    TEXT_CREATION_DESIRE_RE.test(q)
  );
}

/**
 * Sujet récupérable depuis les derniers tours user (fil papoter / sujet nommé).
 * @param {object[]} history
 * @returns {string|null}
 */
export function extractPriorTextCreationSubject(history = []) {
  const users = [...(history || [])]
    .reverse()
    .filter((m) => m?.role === "user")
    .slice(0, 4);
  for (const m of users) {
    const q = normalizeQuery(m?.content || "");
    if (!q) continue;
    const words = q.split(/\s+/).filter(Boolean);
    if (
      /^(?:salut|bonjour|bonsoir|hey|hello|coucou)\b/i.test(q) &&
      words.length <= 4
    ) {
      continue;
    }
    if (
      /^(?:ok|oui|non|merci|top|cool|super|d['']accord)\.?$/i.test(q) ||
      /\bcomment\s+(?:ca|ça)\s+va\b/i.test(q)
    ) {
      continue;
    }
    const subjectMatch = q.match(TEXT_CREATION_SUBJECT_RE);
    if (subjectMatch) {
      return String(subjectMatch[0])
        .replace(
          /^\s*(?:sur|à\s+propos\s+de|a\s+propos\s+de|au\s+sujet\s+de|concernant)\s+/i,
          "",
        )
        .trim()
        .slice(0, 80);
    }
    // Sujet court déjà posé dans le fil (ex. « la pollution informatique », « musique »).
    // Exclure opinion / small-talk 1re personne (« j'adore les chats »).
    if (
      words.length >= 1 &&
      words.length <= 8 &&
      !/[?]/.test(q) &&
      !TEXT_CREATION_VERB_RE.test(q) &&
      !TEXT_CREATION_MAKE_RE.test(q) &&
      !TEXT_CREATION_DESIRE_RE.test(q) &&
      !HISTORY_SUBJECT_STANCE_RE.test(q) &&
      !/\b(?:je|j)\b/i.test(q)
    ) {
      return q
        .replace(/^(?:la|le|les|l'|un|une)\s+/i, "")
        .trim()
        .slice(0, 80);
    }
  }
  return null;
}

/**
 * Mandat complet pour le LLM si le sujet vient du fil.
 * @param {string} query
 * @param {object[]} history
 * @returns {string}
 */
export function buildTextCreationContinuityEffectiveQuery(query = "", history = []) {
  const q = normalizeQuery(query);
  if (TEXT_CREATION_SUBJECT_RE.test(q)) return String(query || "").trim();
  const subject = extractPriorTextCreationSubject(history);
  if (!subject) return String(query || "").trim();
  return `${String(query || "").trim()} sur ${subject}`;
}

/**
 * Format de rendu optionnel — pas une nouvelle tâche.
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string|null}
 */
export function extractTextCreationRenderFormat(query = "", options = {}) {
  if (
    !isTextCreationShell(query) &&
    !isExplicitTextCreationRequest(query, options)
  ) {
    return null;
  }
  const match = normalizeQuery(query).match(TEXT_CREATION_RENDER_FORMAT_RE);
  if (!match) return null;
  const raw = match[0].toLowerCase().replace(/^\./, "");
  return raw === "md" ? "markdown" : raw;
}

/**
 * Hint SIMPLE_FAST : format = contrainte de rendu chat, pas export fichier.
 * @param {string|null|undefined} outputFormat
 * @returns {string|null}
 */
export function buildTextCreationRenderFormatHint(outputFormat = null) {
  const fmt = String(outputFormat || "").toLowerCase().trim();
  if (!fmt) return null;
  const formatLine =
    fmt === "pdf"
      ? "Format de rendu : PDF — structure le texte pour lecture / impression (titres, paragraphes nets). N'affirme pas qu'un fichier PDF a été généré ou joint."
      : fmt === "markdown" || fmt === "md"
        ? "Format de rendu : Markdown — livre le texte en Markdown valide."
        : fmt === "html"
          ? "Format de rendu : HTML — livre un fragment HTML propre, sans promettre de fichier téléchargeable."
          : fmt === "doc" || fmt === "docx"
            ? "Format de rendu : document Word — prose structurée prête à coller dans un traitement de texte. N'affirme pas qu'un fichier .docx a été généré."
            : `Format de rendu : ${fmt} — respecte ce format dans le corps de la réponse.`;
  return [
    "[Création textuelle — contrainte de rendu]",
    formatLine,
    "Pas de recherche web. Livre le livrable demandé (poème, conte, lettre…) directement.",
  ].join("\n");
}

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractInformationSeekingTarget(query = "") {
  const researchTarget = extractResearchThenSummarizeTarget(query);
  if (researchTarget) return researchTarget;

  const q = normalizeQuery(query);
  if (!q) return null;

  for (const pattern of INFORMATION_TARGET_PATTERNS) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || "")
      .replace(/\s+(?:et|ou|avec|pour)\b.*/i, "")
      .trim();
    if (raw.length >= 2) return raw;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isInformationSeekingShell(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  return (
    INFORMATION_SEEKING_SHELL_RE.test(q) ||
    INFORMATION_POSSESSION_SHELL_RE.test(q) ||
    INFORMATION_KNOWLEDGE_SHELL_RE.test(q) ||
    INFORMATION_SHORT_INFOS_SHELL_RE.test(q)
  );
}

/**
 * Demande d'information avec cible explicite (ex. « infos sur Teams 365 »).
 * @param {string} query
 * @returns {boolean}
 */
export function isInformationSeekingWithTarget(query = "") {
  if (isFormalLetterTemplateRequest(query)) return false;
  if (isCausalWhyExplainRequest(query)) return false;
  if (isResearchThenSummarizeRequest(query)) {
    return Boolean(extractInformationSeekingTarget(query));
  }
  if (!isInformationSeekingShell(query)) return false;
  const q = normalizeQuery(query);
  if (LEARNING_PREEMPT_INFO_SEEKING_RE.test(q)) return false;
  if (isCreateMandateRequest(query)) return false;
  if (isExplicitTextCreationRequest(query)) return false;
  if (isIncompleteDefinitionAsk(query)) return false;
  return Boolean(extractInformationSeekingTarget(query));
}

const DEFINITION_SHELL_RE =
  /\b(?:d[eé]finition|d[eé]finis(?:[- ]moi)?|d[eé]finir|c['']?est quoi|c est quoi|qu['']?est[- ]ce qu|qu est ce qu|que signifie|signification)\b/i;

const GENERIC_DEFINITION_PLACEHOLDER_RE =
  /^(?:un mot|une expression|ce mot|le mot|un terme|le terme|mot|terme|expression|quelque chose|ca|ça)$/i;

function cleanDefinitionTarget(raw = "") {
  return String(raw)
    .replace(/^["«']+|["»']+$/g, "")
    .replace(/^(?:d['']|d )(?=un |une )/i, "")
    .replace(/^(?:la |le |les |l'|un |une |du |de la |de |d')/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableDefinitionTarget(raw = "") {
  const target = cleanDefinitionTarget(raw);
  if (target.length < 2 || target.length > 64) return false;
  return !GENERIC_DEFINITION_PLACEHOLDER_RE.test(target);
}

/**
 * Cible nommée d'une demande de définition (pas « définir un mot » sans le mot).
 * @param {string} query
 * @returns {string|null}
 */
export function extractNamedDefinitionTarget(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  const quoted = q.match(/["«']([^"»']{2,64})["»']/);
  if (
    quoted &&
    isUsableDefinitionTarget(quoted[1]) &&
    (DEFINITION_SHELL_RE.test(q) || /\bmot que je cherche\b/.test(q) || /\ble mot\b/.test(q))
  ) {
    return cleanDefinitionTarget(quoted[1]);
  }

  const slot = q.match(
    /\b(?:le mot|mot que je cherche|le terme)(?:\s+que je cherche)?\s+(?:est|c est)\s+["«']?([^?"»!]{2,64})/i,
  );
  if (slot && isUsableDefinitionTarget(slot[1])) {
    return cleanDefinitionTarget(slot[1]);
  }

  const defined = q.match(
    /\b(?:d[eé]finition|d[eé]finis(?:[- ]moi)?|d[eé]finir)\s+(?:de |du |d'|le mot |un |une |le |la )?([^?.!,]{2,64})/i,
  );
  if (defined && isUsableDefinitionTarget(defined[1])) {
    return cleanDefinitionTarget(defined[1]);
  }

  const what = q.match(
    /\b(?:c['']?est quoi|c est quoi|qu['']?est[- ]ce qu(?:e |['']?)?(?:un |une |le |la )?|qu est ce qu(?:e )?(?:un |une |le |la )?)([^?.!]{2,64})/i,
  );
  if (what && isUsableDefinitionTarget(what[1])) {
    return cleanDefinitionTarget(what[1]);
  }

  return null;
}

/**
 * Demande de définition avec terme déjà nommé.
 * @param {string} query
 */
export function isNamedDefinitionRequest(query = "") {
  return Boolean(extractNamedDefinitionTarget(query));
}

/**
 * Shell définition sans terme nommé (« définir un mot ») — pas une vraie demande.
 * @param {string} query
 */
export function isIncompleteDefinitionAsk(query = "") {
  const q = normalizeQuery(query);
  if (!q || !DEFINITION_SHELL_RE.test(q)) return false;
  return !isNamedDefinitionRequest(query);
}

/**
 * Demande explicite d'info ou de définition — prime sur le bruit conversationnel.
 * Incomplet sans terme nommé : pas cette classe.
 * @param {string} query
 */
export function isExplicitInformationOrDefinitionRequest(query = "") {
  if (isIncompleteDefinitionAsk(query)) return false;
  return isInformationSeekingWithTarget(query) || isNamedDefinitionRequest(query);
}

/**
 * Recherche d'info ciblée — prime sur le social (composite greeting + info).
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesSocialForInformationSeeking(query = "") {
  return isInformationSeekingWithTarget(query);
}

/**
 * Message générique post-échec couloir rapide — déclenche escalade web si info-seeking.
 * @param {string} text
 * @returns {boolean}
 */
export function isInformationSeekingRecoveryResponse(text = "") {
  return /je n'ai pas pu finaliser une r[eé]ponse/i.test(String(text || ""));
}

/**
 * Requête web ciblée pour expert_web_search (overview produit/jeu/app).
 * @param {string} query
 * @returns {string|null}
 */
export function buildInformationSeekingWebQuery(query = "", options = {}) {
  const scoped = buildExistenceScopedWebQuery(query, options);
  if (scoped) return scoped;
  if (!isInformationSeekingWithTarget(query)) return null;
  const target = extractInformationSeekingTarget(query) || "";
  if (!target) return null;

  const q = normalizeQuery(query);
  if (/\bjeu\b/i.test(q)) {
    return `${target} jeu stratégie overview site officiel gameplay`;
  }
  if (/\b(?:app|application|logiciel)\b/i.test(q)) {
    return `${target} application overview site officiel fonctionnalités`;
  }
  return `${target} overview informations`;
}

/**
 * Escalade orchestrateur/web après échec simple_factual sur sujet documenté.
 *
 * Condition exacte (v1.1.2) :
 *   fallbackReason === "empty_short_circuit_llm"
 *   ET ( isInformationSeekingWithTarget(query) OU sujet niche nommé )
 *   OU réponse utilisateur = template recovery post-échec
 *
 * @param {string} query
 * @param {string} [fallbackReason]
 * @param {string} [responseText]
 * @returns {boolean}
 */
export function shouldEscalateSimpleFactualToFullPipeline(
  query = "",
  fallbackReason = "",
  responseText = "",
) {
  const usedRecovery =
    fallbackReason === "empty_short_circuit_llm" ||
    isInformationSeekingRecoveryResponse(responseText);

  if (!usedRecovery) return false;
  if (isCurrentWebFactRequest(query)) return true;
  if (isInformationSeekingWithTarget(query)) return true;

  const q = normalizeQuery(query);
  const target = extractInformationSeekingTarget(query) || "";
  if (/\binformations?\b/i.test(q) && (NICHE_INFORMATION_SUBJECT_RE.test(q) || target.length >= 3)) {
    return true;
  }

  return false;
}

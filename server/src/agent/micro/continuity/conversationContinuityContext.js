/**
 * P2 — Continuité conversationnelle locale (fenêtre courte + état structuré).
 * Nexxus ne relit pas tout l'historique : il maintient l'état actif du fil en cours.
 */
import {
  normalizeFamiliarityQuery,
  FAMILIARITY_ANTI_MARKERS,
  resolveSubjectFromLabel,
  buildFamiliarityFollowupApercuReply,
  getFamiliarityDeterministicReply,
  parseFamiliarityQuery,
} from "../../utils/familiarityIntentGuards.js";
import { assessConversationTopicShift } from "./topicShiftGuard.js";
import {
  buildLexiconPedagogicalSchemaReply,
  buildLexiconScienceTakeawayReply,
} from "../../policies/lexiconExplainLightPolicy.js";
import { isConversationTakeawaySummaryRequest } from "../../policies/summary/index.js";

export const CONTINUITY_DEFAULT_WINDOW = 6;

/**
 * Doctrine : continuité d'engagement — honorer les ouvertures que Nexxus vient de poser.
 * Pas mémoire floue globale : branche active + rattachement du tour suivant.
 */
export const CONVERSATION_CONTINUITY_RULE = "conversation_engagement_honor_open_branch";

export const CONTINUITY_TURN_PHASES = {
  IDLE: "idle",
  FAMILIARITY_APERCU_PENDING: "familiarity_apercu_pending",
  SUBJECT_CONFIRMATION_PENDING: "subject_confirmation_pending",
  ENGAGEMENT_ELABORATION_PENDING: "engagement_elaboration_pending",
};

export const CONTINUITY_ASSISTANT_OFFERS = {
  APERCU_RAPIDE: "aperçu_rapide",
  SUBJECT_CONFIRMATION: "subject_confirmation",
  ELABORATION_DEEPEN: "elaboration_deepen",
  ELABORATION_VARIANT: "elaboration_variant",
};

const FAMILIARITY_PROPOSAL_PATTERN =
  /^Oui, je connais (.+?)\.\s*(?:\n|\s)*(Tu veux)/is;

const GENERAL_KNOWLEDGE_SUBJECT_PATTERN =
  /Oui, je connais(?: bien)?\s+(?:la |le |les |l')?\*{0,2}([^*\n.]+?)\*{0,2}/i;

/** « Oui. Le cycle de l’eau, c’est… » (explication pédagogique, pas « je connais »). */
const PEDAGOGIC_EXPLAIN_SUBJECT_PATTERN =
  /(?:^|\n)\s*Oui\.?\s+(?:Le|La|Les|L['’])\s*\*{0,2}([^*\n,]{3,80}?)\*{0,2}\s*,?\s*(?:c['’]est|est\b)/i;

const APERCU_OFFER_PATTERN =
  /t['']?en parle rapidement|t en parle rapidement|aperçu ou tu as une question précise|aperçu ou une aide concrète/i;

const ELABORATION_OFFER_PATTERN =
  /tu veux que je te détaille|tu veux des variantes|tu veux une variante|question plus précise|approfondir un angle|laquelle t'intéresse|tu veux revenir sur quel angle|si tu veux[^.!?\n]{0,60}d[ée]taill|on peut d[ée]taill|on peut creuser|si tu veux[^.!?\n]{0,60}approfond/i;

const FORMAT_SCHEMA_FOLLOWUP_RE =
  /\b(?:sous forme de|en forme de|sous forme|schema|schéma|diagramme|carte mentale|tableau(?:\s+pédagogique|\s+clarifiant)?)\b/i;

const TABLE_FORMAT_FOLLOWUP_RE = /\btableau(?:x)?\b/i;

const DETAIL_ELABORATION_RE =
  /\b(?:en detail|en détail|detaille|détaillé|detaillee|détaillée|expliquer en detail|expliquer en détail)\b/i;

const ANAPHORA_ELABORATION_RE =
  /\b(?:le|la|l|ça|cela)\s+(?:d[ée]taill|expliqu|pr[ée]sent|montr|résum|resum)/i;

const DOMAIN_RESUME_OFFER_PATTERN = /on peut reprendre sur\s+([^:\n.]+)/i;

const FULL_RESUME_PATTERN =
  /\b(?:si tu peux )?tout reprendre|reprendre tout|tout (?:détailler|detailer)|(?:en )?mode complet|depuis le (?:début|debut)|vas[- ]?y en (?:mode )?complet\b/i;

const CONFIRM_SUBJECT_PATTERN = /^Tu parles de (.+?) \?$/i;

const SHORT_FOLLOWUP_PATTERNS = [
  /^oui$/,
  /^ouais$/,
  /^d accord$/,
  /^ok$/,
  /^okay$/,
  /^vas y$/,
  /^allez y$/,
  /^volontiers$/,
  /^avec plaisir$/,
  /^go$/,
  /^continue$/,
  /^explique$/,
  /^parle m en$/,
  /^dis m en plus$/,
  /^donne moi un apercu$/,
  /^un apercu$/,
  /^oui stp$/,
  /^oui s il te plait$/,
  /^oui merci$/,
  /^variante$/,
  /^variantes$/,
  /^detaille$/,
  /^détaille$/,
  /^l etape$/,
  /^une variante$/,
];

const AFFIRMATIVE_PREFIX_PATTERN =
  /^(?:oui|ouais|ok|d accord|volontiers|avec plaisir|yes)\b/i;

const ELABORATION_REQUEST_PATTERN =
  /\b(?:parle|parles|explique|decris|décris|raconte|dis moi|dis-moi|detaille|détailler|detailler|ce que tu sais|de ce que tu sais|en detail|en détail|variante|variantes|etape|étape)\b/i;

const VARIANT_FOLLOWUP_PATTERN = /\b(?:variante|variantes|sans alcool|version|alternative)\b/i;

/**
 * @param {Array<{ role?: string, content?: string, threadId?: string }>} history
 * @param {number} [limit=6]
 * @param {string|null} [threadId=null]
 */
export function readRecentTurns(history = [], limit = CONTINUITY_DEFAULT_WINDOW, threadId = null) {
  const list = (Array.isArray(history) ? history : []).filter(
    (msg) =>
      msg &&
      typeof msg.role === "string" &&
      typeof msg.content === "string" &&
      msg.content.trim(),
  );

  const scoped =
    threadId == null
      ? list
      : list.filter((msg) => !msg.threadId || msg.threadId === threadId);

  return scoped.slice(-limit);
}

function findLastMessageByRole(turns = [], role = "assistant") {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role === role) {
      return turns[i].content.trim();
    }
  }
  return null;
}

export function parseFamiliarityProposalFromTurn(content = "") {
  const text = String(content || "").trim();
  const match = text.match(FAMILIARITY_PROPOSAL_PATTERN);
  if (!match?.[1]) return null;
  return { subjectLabel: match[1].trim() };
}

/**
 * Extrait le sujet d'une réponse culture générale (« Oui, je connais bien le bœuf bourguignon »).
 * @param {string} content
 */
export function parseGeneralKnowledgeSubjectFromTurn(content = "") {
  const text = String(content || "").trim();
  const match = text.match(GENERAL_KNOWLEDGE_SUBJECT_PATTERN);
  if (!match?.[1]) return null;
  return { subjectLabel: match[1].trim() };
}

export function parsePedagogicExplainSubjectFromTurn(content = "") {
  const text = String(content || "").trim();
  const match = text.match(PEDAGOGIC_EXPLAIN_SUBJECT_PATTERN);
  if (!match?.[1]) return null;
  return { subjectLabel: match[1].replace(/\*+/g, "").trim() };
}

function resolveSubjectLabelFromTurn(content = "") {
  const resumeMatch = String(content || "").match(DOMAIN_RESUME_OFFER_PATTERN);
  if (resumeMatch?.[1]) return resumeMatch[1].trim();

  const familiarity = parseFamiliarityProposalFromTurn(content);
  if (familiarity?.subjectLabel) return familiarity.subjectLabel;
  const general = parseGeneralKnowledgeSubjectFromTurn(content);
  if (general?.subjectLabel) return general.subjectLabel;
  const pedagogic = parsePedagogicExplainSubjectFromTurn(content);
  if (pedagogic?.subjectLabel) return pedagogic.subjectLabel;
  const schemaSubject = resolveSubjectLabelFromSchemaTurn(content);
  if (schemaSubject) return schemaSubject;
  return null;
}

function resolveSubjectLabelFromRecentUser(turns = []) {
  // Parcourir les tours user récents (pas seulement le dernier — souvent une anaphore)
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role !== "user") continue;
    const content = String(turns[i].content || "");
    const n = normalizeFamiliarityQuery(content);
    if (/\bcycle de l ?eau\b/.test(n)) return "cycle de l eau";
    if (/\b(?:cycles? (?:de la )?lune|phases? lunaires?)\b/.test(n)) {
      return "cycles de la lune";
    }
    const parsed = parseFamiliarityQuery(content);
    if (parsed?.rawSubject?.trim()) return parsed.rawSubject.trim();
  }
  return null;
}

function resolveSubjectLabelFromSchemaTurn(content = "") {
  const text = String(content || "");
  const match = text.match(
    /sch[ée]ma p[ée]dagogique(?:\s+d[ée]taill[ée]e?)?\s+du\s+\*{0,2}([^*\n:]{3,80}?)\*{0,2}\s*:/i,
  );
  return match?.[1]?.trim() || null;
}

/**
 * Relance format / schéma / « le détailler… » après une explication active.
 * @param {string} query
 * @param {ReturnType<typeof extractConversationState>} state
 */
export function isFormatElaborationFollowup(query = "", state = {}) {
  if (!state?.activeSubject && !state?.isExplanationActive) return false;
  const q = normalizeShortFollowupText(query);
  if (!q) return false;
  if (FORMAT_SCHEMA_FOLLOWUP_RE.test(q)) return true;
  if (ANAPHORA_ELABORATION_RE.test(q) && ELABORATION_REQUEST_PATTERN.test(q)) {
    return true;
  }
  return false;
}

/**
 * « expliquer en détail … sous forme de schéma » → variante détaillée.
 * @param {string} query
 */
export function wantsDetailedPedagogicalSchema(query = "") {
  const q = normalizeShortFollowupText(query);
  if (!q || !FORMAT_SCHEMA_FOLLOWUP_RE.test(q)) return false;
  // Tableau = déjà une forme structurée détaillée ; pas besoin du flag schéma long
  if (TABLE_FORMAT_FOLLOWUP_RE.test(q)) return false;
  return DETAIL_ELABORATION_RE.test(q) || /\bexpliquer\b/.test(q);
}

/**
 * « sous forme de tableau » → markdown table, pas schéma à flèches.
 * @param {string} query
 */
export function wantsPedagogicalTableFormat(query = "") {
  const q = normalizeShortFollowupText(query);
  return Boolean(q && TABLE_FORMAT_FOLLOWUP_RE.test(q));
}

/**
 * @param {Array<{ role?: string, content?: string }>} turns
 * @returns {{
 *   activeSubject: string|null,
 *   activeSubjectLabel: string|null,
 *   assistantOffer: string|null,
 *   awaitingUserConfirmation: boolean,
 *   turnPhase: string,
 *   lastAssistantSnippet: string|null,
 * }}
 */
export function extractConversationState(turns = []) {
  const state = {
    activeSubject: null,
    activeSubjectLabel: null,
    assistantOffer: null,
    awaitingUserConfirmation: false,
    turnPhase: CONTINUITY_TURN_PHASES.IDLE,
    lastAssistantSnippet: null,
    isExplanationActive: false,
  };

  const lastAssistant = findLastMessageByRole(turns, "assistant");
  if (!lastAssistant) return state;

  state.lastAssistantSnippet = lastAssistant.slice(0, 160);

  const confirmMatch = lastAssistant.match(CONFIRM_SUBJECT_PATTERN);
  if (confirmMatch?.[1]) {
    state.activeSubjectLabel = confirmMatch[1].trim();
    state.activeSubject = normalizeFamiliarityQuery(state.activeSubjectLabel);
    state.assistantOffer = CONTINUITY_ASSISTANT_OFFERS.SUBJECT_CONFIRMATION;
    state.awaitingUserConfirmation = true;
    state.turnPhase = CONTINUITY_TURN_PHASES.SUBJECT_CONFIRMATION_PENDING;
    return state;
  }

  let rawSubjectLabel = resolveSubjectLabelFromTurn(lastAssistant);
  if (!rawSubjectLabel) {
    rawSubjectLabel = resolveSubjectLabelFromRecentUser(turns);
  }
  if (rawSubjectLabel) {
    const subject = resolveSubjectFromLabel(rawSubjectLabel);
    state.activeSubjectLabel = subject?.label ?? rawSubjectLabel;
    state.activeSubject = normalizeFamiliarityQuery(state.activeSubjectLabel);
  }

  if (APERCU_OFFER_PATTERN.test(lastAssistant)) {
    state.assistantOffer = CONTINUITY_ASSISTANT_OFFERS.APERCU_RAPIDE;
    state.awaitingUserConfirmation = true;
    state.turnPhase = CONTINUITY_TURN_PHASES.FAMILIARITY_APERCU_PENDING;
    return state;
  }

  if (ELABORATION_OFFER_PATTERN.test(lastAssistant)) {
    state.assistantOffer = /variante/i.test(lastAssistant)
      ? CONTINUITY_ASSISTANT_OFFERS.ELABORATION_VARIANT
      : CONTINUITY_ASSISTANT_OFFERS.ELABORATION_DEEPEN;
    state.awaitingUserConfirmation = true;
    state.turnPhase = CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING;
    if (lastAssistant.length > 50) state.isExplanationActive = true;
    return state;
  }

  if (DOMAIN_RESUME_OFFER_PATTERN.test(lastAssistant)) {
    state.assistantOffer = CONTINUITY_ASSISTANT_OFFERS.ELABORATION_DEEPEN;
    state.awaitingUserConfirmation = true;
    state.turnPhase = CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING;
    return state;
  }

  if (lastAssistant.length > 50) {
    state.isExplanationActive = true;
    // Explication déjà livrée + sujet connu → la relance format/détail est attendue
    if (state.activeSubject) {
      state.assistantOffer = CONTINUITY_ASSISTANT_OFFERS.ELABORATION_DEEPEN;
      state.awaitingUserConfirmation = true;
      state.turnPhase = CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING;
    }
  }

  return state;
}

export function normalizeShortFollowupText(query = "") {
  return normalizeFamiliarityQuery(query)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isShortFollowupText(query = "") {
  const q = normalizeShortFollowupText(query);
  if (!q || q.length > 48) return false;
  if (FAMILIARITY_ANTI_MARKERS.some((marker) => q.includes(marker))) return false;
  return SHORT_FOLLOWUP_PATTERNS.some((pattern) => pattern.test(q));
}

/**
 * Acceptation élaborée (« oui je veux que tu me parles de… ») après proposition d'aperçu.
 * @param {string} query
 * @param {ReturnType<typeof extractConversationState>} state
 */
export function isSubstantiveContinuityAcceptance(query = "", state = {}) {
  if (!state?.awaitingUserConfirmation) return false;
  if (
    state.turnPhase !== CONTINUITY_TURN_PHASES.FAMILIARITY_APERCU_PENDING &&
    state.turnPhase !== CONTINUITY_TURN_PHASES.SUBJECT_CONFIRMATION_PENDING &&
    state.turnPhase !== CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING
  ) {
    return false;
  }

  const q = normalizeShortFollowupText(query);
  if (!q || FAMILIARITY_ANTI_MARKERS.some((marker) => q.includes(marker))) return false;
  if (isShortFollowupText(query)) return false;

  if (AFFIRMATIVE_PREFIX_PATTERN.test(q) && ELABORATION_REQUEST_PATTERN.test(q)) {
    return true;
  }

  if (VARIANT_FOLLOWUP_PATTERN.test(q)) return true;

  if (isFormatElaborationFollowup(query, state)) return true;

  if (ELABORATION_REQUEST_PATTERN.test(q) && state.activeSubject) {
    const tokens = String(state.activeSubject)
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    if (tokens.some((token) => q.includes(token))) return true;
    // Anaphore (« le détailler ») après offre / explication active
    if (
      state.awaitingUserConfirmation ||
      state.isExplanationActive ||
      state.turnPhase === CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING
    ) {
      return true;
    }
  }

  if (
    state.turnPhase === CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING &&
    AFFIRMATIVE_PREFIX_PATTERN.test(q)
  ) {
    return true;
  }

  return false;
}

/**
 * Extension explicite (« tout reprendre », « mode complet ») après un sujet actif.
 * @param {string} query
 * @param {ReturnType<typeof extractConversationState>} state
 */
export function isFullExplanationResumeRequest(query = "", state = {}) {
  const q = normalizeShortFollowupText(query);
  if (!q || !FULL_RESUME_PATTERN.test(q)) return false;
  return Boolean(
    state.activeSubject ||
      state.activeSubjectLabel ||
      state.isExplanationActive ||
      state.awaitingUserConfirmation,
  );
}

/**
 * @param {ReturnType<typeof extractConversationState>} state
 */
export function buildContinuityKnowledgeQuery(state = {}, userText = "") {
  const label = state.activeSubjectLabel || state.activeSubject || "poursuite de l'explication";
  const q = normalizeShortFollowupText(userText);

  if (
    state.assistantOffer === CONTINUITY_ASSISTANT_OFFERS.ELABORATION_VARIANT ||
    VARIANT_FOLLOWUP_PATTERN.test(q)
  ) {
    const hint = q.length > 8 && !/^(?:oui|ok|variante|variantes)$/.test(q) ? ` (${q})` : "";
    return `Propose des variantes concrètes pour ${label}${hint}.`;
  }

  if (FORMAT_SCHEMA_FOLLOWUP_RE.test(q)) {
    return `Présente ${label} sous forme de schéma pédagogique textuel clair (étapes avec flèches ou liste numérotée), en langage simple, sans jargon inutile.`;
  }

  if (state.turnPhase === CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING) {
    if (/\b(?:etape|étape|detaille|détailler)\b/.test(q)) {
      return `Détaille une étape clé de ${label} de façon opérationnelle.`;
    }
    return `Approfondis ${label} : complète ta réponse précédente avec détails utiles.`;
  }

  return `Parle-moi en détail de ${label} : ce que tu sais, contexte et particularités.`;
}

/**
 * @param {string} userText
 * @param {ReturnType<typeof extractConversationState>} state
 * @returns {{ kind: string, reply: string, path: string }|null}
 */
export function resolveShortFollowup(userText = "", state = {}) {
  if (!isShortFollowupText(userText)) return null;

  if (state.awaitingUserConfirmation) {
    if (state.turnPhase === CONTINUITY_TURN_PHASES.SUBJECT_CONFIRMATION_PENDING) {
      const label = state.activeSubjectLabel || "";
      const reply = getFamiliarityDeterministicReply(`Tu connais ${label} ?`);
      if (!reply) return null;
      return {
        kind: "subject_confirmation_acceptance",
        reply,
        path: "conversation_continuity_deterministic",
      };
    }

    if (state.turnPhase === CONTINUITY_TURN_PHASES.FAMILIARITY_APERCU_PENDING) {
      const subject = resolveSubjectFromLabel(state.activeSubjectLabel || "");
      const reply = buildFamiliarityFollowupApercuReply(subject);
      if (!reply) return null;
      return {
        kind: "familiarity_followup_apercu",
        reply,
        path: "conversation_continuity_deterministic",
      };
    }

    if (state.turnPhase === CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING) {
      return {
        kind: "engagement_elaboration_defer",
        path: "general_knowledge_continuity_carryover",
        deferToFullPipeline: true,
        deferToLlm: true,
        continuitySubject: state.activeSubjectLabel || state.activeSubject || "poursuite de l'explication",
        effectiveQuery: buildContinuityKnowledgeQuery(state, userText),
      };
    }
  }

  if (state.isExplanationActive && /\b(continue|vas[- ]?y|ok|fais[- ]?le|allez[- ]?y)\b/i.test(userText)) {
    return {
      kind: "engagement_elaboration_defer",
      path: "general_knowledge_continuity_carryover",
      deferToFullPipeline: true,
      deferToLlm: true,
      continuitySubject: state.activeSubjectLabel || state.activeSubject || "poursuite de l'explication",
      effectiveQuery: buildContinuityKnowledgeQuery(state, userText),
    };
  }

  return null;
}

export function buildConversationContinuityContext(history = [], options = {}) {
  const turns = readRecentTurns(
    history,
    options.limit ?? CONTINUITY_DEFAULT_WINDOW,
    options.threadId ?? null,
  );
  const state = extractConversationState(turns);
  return { turns, state };
}

/**
 * Takeaway après explication active (« quel résumé on peut en tirer ? »).
 * @param {string} query
 * @param {ReturnType<typeof extractConversationState>} state
 */
export function isScienceTakeawayFollowup(query = "", state = {}) {
  if (!isConversationTakeawaySummaryRequest(query)) return false;
  return Boolean(
    state?.activeSubject ||
      state?.isExplanationActive ||
      state?.turnPhase === CONTINUITY_TURN_PHASES.ENGAGEMENT_ELABORATION_PENDING,
  );
}

export function isConversationContinuityFollowup(query = "", history = []) {
  if (assessConversationTopicShift(query, history).detected) return false;
  const { state } = buildConversationContinuityContext(history);
  return (
    resolveShortFollowup(query, state) !== null ||
    isFormatElaborationFollowup(query, state) ||
    isScienceTakeawayFollowup(query, state) ||
    isSubstantiveContinuityAcceptance(query, state) ||
    isFullExplanationResumeRequest(query, state)
  );
}

export function getConversationContinuityDeterministicReply(query = "", history = []) {
  const { state } = buildConversationContinuityContext(history);
  const resolved = resolveShortFollowup(query, state);
  return resolved?.reply ?? null;
}

export function resolveConversationContinuityShortCircuit(query = "", history = []) {
  if (assessConversationTopicShift(query, history).detected) return null;
  const { state } = buildConversationContinuityContext(history);
  const short = resolveShortFollowup(query, state);
  if (short?.reply || short?.deferToFullPipeline) return short;

  // Schéma / format pédagogique après explication sciences → réponse locale si connue
  if (
    isFormatElaborationFollowup(query, state) ||
    (isSubstantiveContinuityAcceptance(query, state) &&
      FORMAT_SCHEMA_FOLLOWUP_RE.test(normalizeShortFollowupText(query)))
  ) {
    const subject = state.activeSubjectLabel || state.activeSubject || "";
    // Aussi ancrer le sujet depuis la requête courante (« cycle de l'eau … schéma »)
    const qNorm = normalizeShortFollowupText(query);
    const subjectFromQuery = /\bcycle de l ?eau\b/.test(qNorm)
      ? "cycle de l eau"
      : /\b(?:cycles? (?:de la )?lune|phases? lunaires?)\b/.test(qNorm)
        ? "cycles de la lune"
        : subject;
    const asTable = wantsPedagogicalTableFormat(query);
    const detailed = !asTable && wantsDetailedPedagogicalSchema(query);
    const schema = buildLexiconPedagogicalSchemaReply(subjectFromQuery || subject, {
      detail: detailed,
      format: asTable ? "table" : "schema",
    });
    if (schema) {
      return {
        kind: "lexicon_science_schema",
        path: asTable
          ? "lexicon_science_format_table_deterministic"
          : detailed
            ? "lexicon_science_format_detailed_deterministic"
            : "lexicon_science_format_deterministic",
        reply: schema,
        continuitySubject: subjectFromQuery || subject,
        explanationRegister: "illustrated",
      };
    }
  }

  // « quel résumé on peut en tirer ? » après fil sciences → takeaway local
  if (isScienceTakeawayFollowup(query, state)) {
    const subject = state.activeSubjectLabel || state.activeSubject || "";
    const takeaway = buildLexiconScienceTakeawayReply(subject);
    if (takeaway) {
      return {
        kind: "lexicon_science_takeaway",
        path: "lexicon_science_takeaway_deterministic",
        reply: takeaway,
        continuitySubject: subject,
        explanationRegister: "synthetic",
      };
    }
    return {
      kind: "lexicon_science_takeaway_defer",
      path: "general_knowledge_continuity_carryover",
      deferToFullPipeline: true,
      deferToLlm: true,
      continuitySubject: subject || "ce que nous venons d'évoquer",
      effectiveQuery: `Donne un résumé / à retenir clair et court de ${subject || "le sujet qu'on vient d'expliquer"}, en 3–5 phrases, sans menu.`,
    };
  }

  if (isFullExplanationResumeRequest(query, state)) {
    const label =
      state.activeSubjectLabel || state.activeSubject || "ce que nous venons d'évoquer";
    return {
      kind: "full_explanation_resume",
      path: "general_knowledge_continuity_carryover",
      deferToFullPipeline: true,
      deferToLlm: true,
      continuitySubject: label,
      effectiveQuery: `Donne une explication complète et détaillée de ${label}.`,
    };
  }

  if (isSubstantiveContinuityAcceptance(query, state)) {
    return {
      kind: "engagement_substantive_acceptance",
      path: "general_knowledge_continuity_carryover",
      deferToFullPipeline: true,
      deferToLlm: true,
      continuitySubject: state.activeSubjectLabel || state.activeSubject,
      effectiveQuery: buildContinuityKnowledgeQuery(state, query),
    };
  }

  return null;
}

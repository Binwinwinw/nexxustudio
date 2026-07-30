/**
 * Reprise des clarifications en attente — slot filling multi-tour.
 * Quand Nexxus pose une précision ciblée, le tour suivant remplit le slot avant justIntent.
 */
import { normalizeForParse } from "../../micro/parsing/requestSegmentParser.js";
import {
  HOW_TO_QUALIFICATIONS,
  buildHowToComplexReply,
  buildHowToSimpleLocalContent,
  classifyHowToScopeAndRisk,
} from "./howToQualificationPolicy.js";
import {
  extractSubjectTypePendingState,
  resumeSubjectTypeClarification,
} from "./subjectTypingPolicy.js";

export const PENDING_CLARIFICATION_RULE = "pending_clarification_resume_v1";

export const CLARIFICATION_RESUME_STATUS = Object.freeze({
  RESOLVED: "clarification_resolved",
  STILL_MISSING: "clarification_still_missing",
  NOT_AN_ANSWER: "not_a_clarification_answer",
  NONE: "none",
});

export const HOW_TO_SCOPE_SLOTS = Object.freeze({
  PAPER_CRAFT: "paper_aircraft",
  MODEL: "model",
  REAL: "real_aircraft",
});

const HOW_TO_SCOPE_PENDING_PATTERNS = [
  {
    clarificationType: "how_to_scope",
    topic: "avion",
    test: (content) =>
      /Tu parles d'un avion en papier, d'une maquette ou d'un vrai avion\s*\?/i.test(
        content,
      ),
  },
  {
    clarificationType: "how_to_scope",
    topic: "fusée",
    test: (content) =>
      /Tu parles d'une fusée en papier, d'un modèle réduit ou d'un vrai lanceur\s*\?/i.test(
        content,
      ),
  },
  {
    clarificationType: "how_to_scope",
    topic: "bateau",
    test: (content) =>
      /Tu parles d'un bateau jouet, d'une maquette ou d'un vrai bateau\s*\?/i.test(
        content,
      ),
  },
];

const STILL_MISSING_RE =
  /\b(?:je\s+sais\s+pas|je\s+ne\s+sais\s+pas|aucune\s+idee|aucune\s+idée|pas\s+sur|pas\s+sûr)\b/i;

const NEW_REQUEST_RE =
  /\b(?:traduis|corrige|calcule|donne\s+moi\s+la\s+date|quelle\s+heure|bonjour|salut)\b/i;

/**
 * @param {Array<{ role?: string, content?: string }>} history
 */
function findLastAssistantMessage(history = []) {
  const list = Array.isArray(history) ? history : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === "assistant" && String(list[i]?.content || "").trim()) {
      return String(list[i].content).trim();
    }
  }
  return null;
}

/**
 * @param {string} assistantContent
 * @returns {object|null}
 */
export function extractPendingClarificationState(assistantContent = "") {
  const content = String(assistantContent || "").trim();
  if (!content) return null;

  const subjectTypePending = extractSubjectTypePendingState(content);
  if (subjectTypePending) return subjectTypePending;

  for (const pattern of HOW_TO_SCOPE_PENDING_PATTERNS) {
    if (pattern.test(content)) {
      return {
        clarificationActive: true,
        clarificationType: pattern.clarificationType,
        topic: pattern.topic,
        candidateSlots: Object.values(HOW_TO_SCOPE_SLOTS),
      };
    }
  }
  return null;
}

/**
 * @param {string} query
 * @param {{ topic?: string }} pending
 * @returns {string|null}
 */
export function matchHowToScopeSlot(query = "", pending = {}) {
  const normalized = normalizeForParse(query);
  const topic = normalizeForParse(pending.topic || "");

  if (STILL_MISSING_RE.test(normalized)) return null;

  if (topic === "avion") {
    if (
      /\b(?:vrai|veritable|véritable)\s+avion\b/.test(normalized) ||
      /\bparle\s+d['']?un\s+vrai\b/.test(normalized) ||
      /\bun\s+vrai\s+avion\b/.test(normalized)
    ) {
      return HOW_TO_SCOPE_SLOTS.REAL;
    }
    if (/\bavion\s+en\s+papier\b/.test(normalized) || /\b(?:en\s+)?papier\b/.test(normalized)) {
      return HOW_TO_SCOPE_SLOTS.PAPER_CRAFT;
    }
    if (/\bmaquette\b/.test(normalized)) {
      return HOW_TO_SCOPE_SLOTS.MODEL;
    }
  }

  if (topic === "fusee" || topic === "fusée") {
    if (/\b(?:vrai|veritable|véritable)\b/.test(normalized) && /\b(?:lanceur|fusee|fusée)\b/.test(normalized)) {
      return HOW_TO_SCOPE_SLOTS.REAL;
    }
    if (/\b(?:en\s+)?papier\b/.test(normalized)) return HOW_TO_SCOPE_SLOTS.PAPER_CRAFT;
    if (/\b(?:maquette|modele\s+reduit|modèle\s+réduit)\b/.test(normalized)) {
      return HOW_TO_SCOPE_SLOTS.MODEL;
    }
  }

  if (topic === "bateau") {
    if (/\b(?:vrai|veritable|véritable)\s+bateau\b/.test(normalized)) {
      return HOW_TO_SCOPE_SLOTS.REAL;
    }
    if (/\b(?:jouet|en\s+papier|petit\s+bateau)\b/.test(normalized)) {
      return HOW_TO_SCOPE_SLOTS.PAPER_CRAFT;
    }
    if (/\bmaquette\b/.test(normalized)) return HOW_TO_SCOPE_SLOTS.MODEL;
  }

  return null;
}

/**
 * @param {string} topic
 * @param {string} slot
 */
function buildEnrichedHowToQuery(topic = "", slot = "") {
  if (slot === HOW_TO_SCOPE_SLOTS.PAPER_CRAFT) {
    return `comment on fait un ${topic} en papier`;
  }
  if (slot === HOW_TO_SCOPE_SLOTS.MODEL) {
    return `comment on fait une maquette de ${topic}`;
  }
  if (slot === HOW_TO_SCOPE_SLOTS.REAL) {
    return `comment fabriquer un vrai ${topic}`;
  }
  return `comment on fait un ${topic}`;
}

/**
 * @param {string} topic
 * @param {string} slot
 */
function buildModelHowToReply(topic = "") {
  const topicNorm = normalizeForParse(topic);
  if (topicNorm === "avion") {
    return (
      "Pour une maquette d'avion, commence par choisir l'échelle (1:72, 1:48…), " +
      "puis assemble le kit étape par étape : fuselage, ailes, détails, peinture."
    );
  }
  return (
    `Pour une maquette de ${topic}, choisis l'échelle, puis assemble les pièces progressivement ` +
    "en suivant le plan fourni."
  );
}

/**
 * @param {string} topic
 * @param {string} slot
 */
function buildResolvedHowToReply(topic = "", slot = "") {
  const enrichedQuery = buildEnrichedHowToQuery(topic, slot);

  if (slot === HOW_TO_SCOPE_SLOTS.MODEL) {
    return {
      reply: buildModelHowToReply(topic),
      resumePath: "how_to_simple_local",
      enrichedQuery,
      howToQualification: HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL,
      slotFilled: slot,
    };
  }

  const { qualification } = classifyHowToScopeAndRisk(enrichedQuery);

  if (qualification === HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL) {
    return {
      reply: buildHowToSimpleLocalContent(enrichedQuery, "natural"),
      resumePath: "how_to_simple_local",
      enrichedQuery,
      howToQualification: qualification,
      slotFilled: slot,
    };
  }

  if (qualification === HOW_TO_QUALIFICATIONS.COMPLEX_BUT_BENIGN) {
    return {
      reply: buildHowToComplexReply(enrichedQuery),
      resumePath: "how_to_complex_clarify",
      enrichedQuery,
      howToQualification: qualification,
      slotFilled: slot,
    };
  }

  return {
    reply: buildHowToComplexReply(enrichedQuery),
    resumePath: "how_to_complex_clarify",
    enrichedQuery,
    howToQualification: qualification,
    slotFilled: slot,
  };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function resumePendingClarification(query = "", history = []) {
  const lastAssistant = findLastAssistantMessage(history);
  const pending = extractPendingClarificationState(lastAssistant);
  if (!pending) {
    return { status: CLARIFICATION_RESUME_STATUS.NONE };
  }

  const normalized = normalizeForParse(query);
  if (!normalized || normalized.length < 2) {
    return { status: CLARIFICATION_RESUME_STATUS.STILL_MISSING, pending };
  }

  if (NEW_REQUEST_RE.test(normalized) && !/\b(?:vrai|papier|maquette|avion|fusee|fusée|bateau|voiture|animal|marque|crypto|mode|felin|félin|jaguar|solana|dior)\b/.test(normalized)) {
    return { status: CLARIFICATION_RESUME_STATUS.NOT_AN_ANSWER, pending };
  }

  if (STILL_MISSING_RE.test(normalized)) {
    return { status: CLARIFICATION_RESUME_STATUS.STILL_MISSING, pending };
  }

  if (pending.clarificationType === "subject_type") {
    const resolved = resumeSubjectTypeClarification(query, pending);
    if (!resolved) {
      return { status: CLARIFICATION_RESUME_STATUS.NOT_AN_ANSWER, pending };
    }
    return {
      status: CLARIFICATION_RESUME_STATUS.RESOLVED,
      pending,
      ...resolved,
    };
  }

  const slot = matchHowToScopeSlot(query, pending);
  if (!slot) {
    return { status: CLARIFICATION_RESUME_STATUS.NOT_AN_ANSWER, pending };
  }

  const resolved = buildResolvedHowToReply(pending.topic, slot);
  return {
    status: CLARIFICATION_RESUME_STATUS.RESOLVED,
    pending,
    slotFilled: slot,
    skipClarificationGate: true,
    ...resolved,
  };
}

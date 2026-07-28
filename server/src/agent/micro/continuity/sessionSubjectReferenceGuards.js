/**
 * Résolution sujet explicite vs reprise session — couche amont transverse (lot #34b).
 *
 * Doctrine :
 * - Sujet nommé dans le tour courant → ancrage principal.
 * - Sujet nommé déjà vu dans la session → contextual_resume.
 * - Référence implicite sans X → continuité session ou clarification ciblée.
 */
import { stripTrailingFiller } from "../normalization/querySanitizer.js";
import {
  normalizeFamiliarityQuery,
  parseFamiliarityQuery,
  resolveKnownOrUnknownSubject,
} from "../../utils/familiarityIntentGuards.js";
import {
  buildConversationContinuityContext,
  parseFamiliarityProposalFromTurn,
  readRecentTurns,
} from "./conversationContinuityContext.js";
import { extractSalientCandidatesFromText } from "./anaphoraReferenceResolver.js";

export const SUBJECT_REFERENCE_RESUME_RULE = "subject_reference_resume_v1";

export const SUBJECT_REFERENCE_RESOLUTION = Object.freeze({
  CURRENT_TURN_SUBJECT: "current_turn_subject",
  PREVIOUS_SESSION_SUBJECT: "previous_session_subject",
  AMBIGUOUS: "ambiguous",
  NONE: "none",
});

const SUBJECT_REFERENCE_EXTRACTION_RULES = [
  {
    shell: "infos_sur",
    kind: "subject_reference",
    pattern:
      /(?:^|\b)(?:tu as|as[- ]tu|avez[- ]vous)\s+des\s+infos?\s+sur\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    shell: "parler_de",
    kind: "subject_reference",
    pattern:
      /(?:^|\b)(?:est[- ]ce[- ]qu[e]? )?on\s+peut\s+parler\s+de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    shell: "parler_de",
    kind: "subject_reference",
    pattern: /(?:^|\b)on\s+peut\s+parler\s+de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    shell: "s_agissant_de",
    kind: "subject_reference",
    pattern:
      /(?:^|\b)(?:sinon[, ]+)?s\s+agissant\s+de\s+(.+?)(?:\s*\?|\s*$|,)/,
  },
  {
    shell: "revenir_a",
    kind: "subject_reference",
    pattern:
      /(?:^|\b)(?:on\s+peut\s+)?reven(?:ir|ons)\s+(?:a|à)\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    shell: "a_propos_de",
    kind: "subject_reference",
    pattern: /(?:^|\b)(?:a|à)\s+propos\s+de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    shell: "si_je_te_dis",
    kind: "subject_introduction",
    pattern:
      /(?:^|\b)si\s+je\s+te\s+dis\s+(.+?)(?:\s+est[- ]ce|\s*,|\s+tu\s+(?:trouves?|sais|comprends?)|\s*\?|\s*$)/i,
  },
];

const IMPLICIT_SUBJECT_REFERENCE_PATTERNS = [
  /(?:^|\b)(?:sinon[, ]+)?(?:a|à)\s+ce\s+sujet\b/,
  /(?:^|\b)(?:et\s+)?sur\s+(?:ca|ça)\b/,
  /(?:^|\b)(?:et\s+)?(?:a|à)\s+propos\s+de\s+(?:ca|ça|cela)\b/,
  /(?:^|\b)sinon[, ]+(?:a|à)\s+propos\b/,
];

const DOMAIN_OVERVIEW_ASSISTANT_SUBJECT_RE =
  /je peux t'aider sur\s+([^:]+):/i;

/**
 * @param {string} tail
 */
function cleanSubjectCandidate(tail = "") {
  return stripTrailingFiller(String(tail || "").replace(/\?+$/g, "").trim());
}

/**
 * @param {string} raw
 */
function normalizeSubjectKey(raw = "") {
  return normalizeFamiliarityQuery(raw)
    .replace(/^(?:le|la|les|l)\s+/, "")
    .trim();
}

/**
 * @param {string} a
 * @param {string} b
 */
export function subjectsMatch(a = "", b = "") {
  const ka = normalizeSubjectKey(a);
  const kb = normalizeSubjectKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length >= 3 && kb.length >= 3 && (ka.includes(kb) || kb.includes(ka))) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @returns {{ kind: string, rawSubject: string, shell: string }|null}
 */
export function parseSubjectReferenceShell(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  for (const rule of SUBJECT_REFERENCE_EXTRACTION_RULES) {
    const match = q.match(rule.pattern);
    if (!match?.[1]) continue;
    const rawSubject = cleanSubjectCandidate(match[1]);
    if (!rawSubject || rawSubject.length < 2) continue;
    return {
      kind: rule.kind,
      rawSubject,
      shell: rule.shell,
    };
  }

  return null;
}

/**
 * @param {string} query
 * @returns {{ kind: string, rawSubject: string, shell: string }|null}
 */
export function extractSubjectCandidate(query = "") {
  const reference = parseSubjectReferenceShell(query);
  if (reference?.rawSubject) return reference;

  const familiarity = parseFamiliarityQuery(query);
  if (familiarity?.rawSubject) {
    return {
      kind: familiarity.kind,
      rawSubject: familiarity.rawSubject,
      shell: "familiarity",
    };
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isImplicitSubjectReferenceQuery(query = "") {
  if (extractSubjectCandidate(query)?.rawSubject) return false;
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  return IMPLICIT_SUBJECT_REFERENCE_PATTERNS.some((pattern) => pattern.test(q));
}

/**
 * @param {string} raw
 * @param {number} turnIndex
 * @param {string} source
 * @param {Map<string, object>} store
 */
function rememberSessionSubject(raw, turnIndex, source, store) {
  const key = normalizeSubjectKey(raw);
  if (!key || key.length < 2) return;
  const subject = resolveKnownOrUnknownSubject(raw);
  const label = subject?.label || raw;
  const existing = store.get(key);
  if (!existing || turnIndex >= existing.turnIndex) {
    store.set(key, {
      key,
      label,
      rawSubject: raw,
      turnIndex,
      source,
      subject,
    });
  }
}

export function collectSessionSubjects(history = [], window = 12, options = {}) {
  let turns = readRecentTurns(history, window);
  if (
    options.omitLastUserTurn &&
    turns.length > 0 &&
    turns[turns.length - 1]?.role === "user"
  ) {
    turns = turns.slice(0, -1);
  }
  const store = new Map();

  for (let i = 0; i < turns.length; i += 1) {
    const content = String(turns[i]?.content || "").trim();
    if (!content) continue;

    if (turns[i].role === "user") {
      const hit =
        extractSubjectCandidate(content) || parseFamiliarityQuery(content);
      if (hit?.rawSubject) {
        rememberSessionSubject(hit.rawSubject, i, "user_explicit", store);
      }
      continue;
    }

    if (turns[i].role !== "assistant") continue;

    const domainMatch = content.match(DOMAIN_OVERVIEW_ASSISTANT_SUBJECT_RE);
    if (domainMatch?.[1]) {
      rememberSessionSubject(domainMatch[1].trim(), i, "assistant_domain", store);
    }

    const familiarity = parseFamiliarityProposalFromTurn(content);
    if (familiarity?.subjectLabel) {
      rememberSessionSubject(
        familiarity.subjectLabel,
        i,
        "assistant_familiarity",
        store,
      );
    }

    for (const candidate of extractSalientCandidatesFromText(content)) {
      if (candidate?.label) {
        rememberSessionSubject(candidate.label, i, "assistant_salient", store);
      }
    }
  }

  return [...store.values()].sort((a, b) => b.turnIndex - a.turnIndex);
}

/**
 * Historique conversationnel exploitable (tours antérieurs non vides).
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {boolean}
 */
export function hasExploitableSessionHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) return false;
  return history.some(
    (turn) =>
      turn &&
      typeof turn.content === "string" &&
      turn.content.trim().length > 0,
  );
}

/**
 * Pas de « on peut reprendre » sans fil antérieur réel.
 * @param {object} resolution
 * @param {Array<{ role?: string, content?: string }>} history
 */
export function applyVirginSessionResumeGuard(resolution = {}, history = []) {
  if (!resolution?.contextual_resume) return resolution;
  if (hasExploitableSessionHistory(history)) return resolution;
  return {
    ...resolution,
    resolution: SUBJECT_REFERENCE_RESOLUTION.CURRENT_TURN_SUBJECT,
    contextual_resume: false,
    source: `${resolution.source || "session"}_virgin_session_guard`,
    matchedSessionSubject: undefined,
  };
}

/**
 * @param {string} subjectCandidate
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {string} [query]
 * @returns {{
 *   resolution: string,
 *   subject: string|null,
 *   subjectLabel: string|null,
 *   contextual_resume: boolean,
 *   source: string|null,
 *   candidates?: Array<object>,
 *   parsed?: object|null,
 *   subjectResolved?: object|null,
 * }}
 */
export function resolveConversationSubjectReference(
  subjectCandidate = "",
  history = [],
  query = "",
) {
  if (isImplicitSubjectReferenceQuery(query)) {
    const { state } = buildConversationContinuityContext(history);
    if (state.activeSubjectLabel) {
      const subject = resolveKnownOrUnknownSubject(state.activeSubjectLabel);
      return {
        resolution: SUBJECT_REFERENCE_RESOLUTION.PREVIOUS_SESSION_SUBJECT,
        subject: state.activeSubjectLabel,
        subjectLabel: subject.label || state.activeSubjectLabel,
        contextual_resume: true,
        source: "continuity_active_subject",
        subjectResolved: subject,
      };
    }

    const sessionSubjects = collectSessionSubjects(history);
    if (sessionSubjects.length === 1) {
      const hit = sessionSubjects[0];
      return {
        resolution: SUBJECT_REFERENCE_RESOLUTION.PREVIOUS_SESSION_SUBJECT,
        subject: hit.rawSubject,
        subjectLabel: hit.label,
        contextual_resume: true,
        source: "session_single_subject",
        subjectResolved: hit.subject,
      };
    }

    if (sessionSubjects.length > 1) {
      return {
        resolution: SUBJECT_REFERENCE_RESOLUTION.AMBIGUOUS,
        subject: null,
        subjectLabel: null,
        contextual_resume: false,
        source: "session_multiple_subjects",
        candidates: sessionSubjects,
      };
    }

    return {
      resolution: SUBJECT_REFERENCE_RESOLUTION.NONE,
      subject: null,
      subjectLabel: null,
      contextual_resume: false,
      source: "implicit_unresolved",
    };
  }

  const candidate = String(subjectCandidate || "").trim();
  if (!candidate) {
    return {
      resolution: SUBJECT_REFERENCE_RESOLUTION.NONE,
      subject: null,
      subjectLabel: null,
      contextual_resume: false,
      source: null,
    };
  }

  const subjectResolved = resolveKnownOrUnknownSubject(candidate);
  const sessionSubjects = collectSessionSubjects(history, 12, {
    omitLastUserTurn: true,
  });
  const matches = sessionSubjects.filter((entry) =>
    subjectsMatch(candidate, entry.label || entry.rawSubject),
  );

  if (matches.length > 1) {
    return {
      resolution: SUBJECT_REFERENCE_RESOLUTION.AMBIGUOUS,
      subject: candidate,
      subjectLabel: subjectResolved.label || candidate,
      contextual_resume: false,
      source: "session_multiple_matches",
      candidates: matches,
      subjectResolved,
    };
  }

  if (matches.length === 1) {
    return {
      resolution: SUBJECT_REFERENCE_RESOLUTION.PREVIOUS_SESSION_SUBJECT,
      subject: candidate,
      subjectLabel: subjectResolved.label || candidate,
      contextual_resume: true,
      source: "session_subject_match",
      matchedSessionSubject: matches[0],
      subjectResolved,
    };
  }

  return {
    resolution: SUBJECT_REFERENCE_RESOLUTION.CURRENT_TURN_SUBJECT,
    subject: candidate,
    subjectLabel: subjectResolved.label || candidate,
    contextual_resume: false,
    source: "current_turn_explicit",
    subjectResolved,
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isSubjectReferenceAvailabilityRequest(query = "") {
  if (parseSubjectReferenceShell(query)) return true;
  if (isImplicitSubjectReferenceQuery(query)) return true;
  const familiarity = parseFamiliarityQuery(query);
  if (familiarity?.kind === "domain_readiness") return true;
  return false;
}

import { normalizeSubject } from "./subjectNormalizer.js";
import { sessionProjectEntityId } from "./subjectEntityIds.js";
import { SUBJECT_CONFIDENCE } from "./subjectConfidence.js";
import { SUBJECT_NATURES } from "./subjectIntelligenceLayer.js";

const MAX_ENTRIES = 8;

/** @type {Map<string, { lastResolvedSubjects: object[] }>} */
const subjectMemoryStore = new Map();

/**
 * @param {string|null|undefined} sessionId
 */
export function getSubjectSessionMemory(sessionId) {
  if (!sessionId) return { lastResolvedSubjects: [] };
  const entry = subjectMemoryStore.get(String(sessionId));
  return entry || { lastResolvedSubjects: [] };
}

/**
 * @param {string|null|undefined} sessionId
 * @param {object} resolved
 */
export function rememberResolvedSubject(sessionId, resolved = {}) {
  if (!sessionId || !resolved.resolvedEntityId) return;
  const id = String(sessionId);
  const entry = subjectMemoryStore.get(id) || { lastResolvedSubjects: [] };
  const record = {
    resolvedEntityId: resolved.resolvedEntityId,
    canonical: resolved.canonical ?? null,
    label: resolved.label ?? resolved.target ?? null,
    nature: resolved.nature ?? null,
    confidence: resolved.confidence ?? SUBJECT_CONFIDENCE.HIGH,
    rememberedAt: Date.now(),
  };
  const filtered = entry.lastResolvedSubjects.filter(
    (r) => r.resolvedEntityId !== record.resolvedEntityId,
  );
  filtered.unshift(record);
  subjectMemoryStore.set(id, {
    lastResolvedSubjects: filtered.slice(0, MAX_ENTRIES),
  });
}

/**
 * @param {string|null|undefined} sessionId
 * @param {string} canonical
 */
export function findResolvedSubjectFromMemory(sessionId, canonical = "") {
  if (!sessionId || !canonical) return null;
  const key = normalizeSubject(canonical).canonical;
  const { lastResolvedSubjects } = getSubjectSessionMemory(sessionId);
  return (
    lastResolvedSubjects.find(
      (r) => r.canonical === key || r.label?.toLowerCase() === key,
    ) || null
  );
}

/**
 * Biais conversationnel : « lance Atlas » après « le projet Atlas ».
 * @param {object} state
 * @param {string|null|undefined} sessionId
 */
export function applySessionMemoryToState(state, sessionId) {
  if (!sessionId || !state.canonical) return state;

  const memoryHit = findResolvedSubjectFromMemory(sessionId, state.canonical);
  if (!memoryHit) return state;

  if (
    state.ambiguous ||
    state.confidence !== SUBJECT_CONFIDENCE.HIGH ||
    state.nature === SUBJECT_NATURES.UNRESOLVED_PROPER
  ) {
    return {
      ...state,
      nature: memoryHit.nature || SUBJECT_NATURES.INTERNAL_STUDIO,
      resolvedEntityId: memoryHit.resolvedEntityId,
      confidence: SUBJECT_CONFIDENCE.HIGH,
      ambiguous: false,
      candidates: [
        {
          resolvedEntityId: memoryHit.resolvedEntityId,
          label: memoryHit.label,
          source: "session_memory",
          confidence: SUBJECT_CONFIDENCE.HIGH,
        },
      ],
      source: "session_memory_recall",
      memoryRecall: true,
    };
  }

  return state;
}

/**
 * Ancre explicite « le projet X » — mémorise et force interne.
 * @param {string} query
 * @param {string|null|undefined} sessionId
 */
export function extractAndRememberProjectAnchor(query = "", sessionId = null) {
  const match = String(query).match(
    /\b(?:le\s+)?projet\s+([a-zA-Z0-9][\w\s-]{0,40}?)(?:\s+(?:qui|pour|dans|sur)\s+|\s*\?|$)/i,
  );
  if (!match?.[1]) return null;

  const raw = match[1].trim();
  const { canonical } = normalizeSubject(raw);
  const entityId = sessionProjectEntityId(canonical);

  const record = {
    resolvedEntityId: entityId,
    canonical,
    label: raw,
    nature: SUBJECT_NATURES.INTERNAL_STUDIO,
    confidence: SUBJECT_CONFIDENCE.HIGH,
  };

  rememberResolvedSubject(sessionId, record);
  return record;
}

export function clearSubjectSessionMemory(sessionId) {
  if (sessionId) subjectMemoryStore.delete(String(sessionId));
  else subjectMemoryStore.clear();
}

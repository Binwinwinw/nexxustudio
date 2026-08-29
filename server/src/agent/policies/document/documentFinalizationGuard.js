/**
 * Garde de finalisation — sorties DOCUMENT / FILE_ANALYSIS (PDF LLM).
 * Déterministe : collapse répétitions, coupe à phrase complète, marqueur partiel.
 * Pas de 2e passe LLM.
 */
import {
  compressComposerFinalPass,
  deduplicateNearDuplicateBlocks,
  looksTruncatedResponse,
} from "../../utils/quality-safety/qualityGuards.js";

export const FINALIZATION_STATUS = Object.freeze({
  COMPLETE: "complete",
  PARTIAL_EXPLICIT: "partial_explicit",
  REJECTED_INCOMPLETE: "rejected_incomplete",
});

export const PARTIAL_INTERRUPT_MARKER =
  "Analyse partielle — génération interrompue.";

/**
 * Titre / paragraphe répété ≥3 fois.
 * @param {string} text
 * @returns {boolean}
 */
export function detectDocumentRepetition(text = "") {
  const raw = String(text || "");
  if (raw.length < 60) return false;

  const headingCounts = new Map();
  for (const m of raw.matchAll(/^#{1,3}\s+(.+)$/gm)) {
    const key = String(m[1] || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (key.length < 3) continue;
    headingCounts.set(key, (headingCounts.get(key) || 0) + 1);
  }
  for (const n of headingCounts.values()) {
    if (n >= 3) return true;
  }

  const paraCounts = new Map();
  for (const block of raw.split(/\n\n+/)) {
    const key = block.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 140);
    if (key.length < 40) continue;
    paraCounts.set(key, (paraCounts.get(key) || 0) + 1);
  }
  for (const n of paraCounts.values()) {
    if (n >= 3) return true;
  }
  return false;
}

/**
 * Phrase / heading coupé en queue.
 * @param {string} text
 * @param {string} [query]
 * @returns {boolean}
 */
export function detectDocumentTruncation(text = "", query = "") {
  const t = String(text || "").trim();
  if (!t) return true;
  if (t.includes(PARTIAL_INTERRUPT_MARKER)) return false;
  if (looksTruncatedResponse(query, t)) return true;
  const lastLine = t.split("\n").filter(Boolean).pop() || "";
  if (/^#{1,3}\s+\S/.test(lastLine) && !/[.!?…]$/.test(lastLine)) return true;
  return false;
}

function countMarkdownSections(text = "") {
  return (String(text || "").match(/^#{1,3}\s+\S/gm) || []).length;
}

function cutToLastCompleteSentence(text = "") {
  const t = String(text || "").trimEnd();
  if (!t) return t;
  const match = t.match(/^[\s\S]*[.!?…»"”']\s*(?:\n|$)/);
  if (match && match[0].trim().length >= 40) {
    return match[0].trimEnd();
  }
  const lastBreak = Math.max(
    t.lastIndexOf(". "),
    t.lastIndexOf("! "),
    t.lastIndexOf("? "),
    t.lastIndexOf(".\n"),
  );
  if (lastBreak >= 40) {
    return t.slice(0, lastBreak + 1).trimEnd();
  }
  return t;
}

/**
 * Mesures seules (sans muter le texte).
 * @param {string} text
 * @param {{ query?: string, sectionsExpected?: number|null }} [opts]
 */
export function measureDocumentFinalization(text = "", opts = {}) {
  const raw = String(text || "");
  return {
    sections_expected:
      opts.sectionsExpected == null ? null : Number(opts.sectionsExpected),
    sections_completed: countMarkdownSections(raw),
    repetition_detected: detectDocumentRepetition(raw),
    truncation_detected: detectDocumentTruncation(raw, opts.query || ""),
  };
}

/**
 * Répare puis classe la sortie.
 * @param {string} text
 * @param {{ query?: string, sectionsExpected?: number|null }} [opts]
 * @returns {{
 *   text: string,
 *   finalization_status: string,
 *   measures: object,
 * }}
 */
export function finalizeDocumentAnalysisText(text = "", opts = {}) {
  const raw = String(text || "");
  const before = measureDocumentFinalization(raw, opts);

  if (!raw.trim()) {
    return {
      text: PARTIAL_INTERRUPT_MARKER,
      finalization_status: FINALIZATION_STATUS.REJECTED_INCOMPLETE,
      measures: {
        ...before,
        repetition_remaining: false,
        truncation_remaining: true,
      },
    };
  }

  let working = compressComposerFinalPass(raw).text;
  working = deduplicateNearDuplicateBlocks(working, {
    minSimilarity: 0.9,
    minBlockLength: 40,
  }).text;

  // Collapse exact heading triples+ : garde la 1re occurrence de chaque titre.
  const seenHeadings = new Map();
  const keptBlocks = [];
  for (const block of working.split(/\n\n+/)) {
    const heading = block.match(/^#{1,3}\s+(.+)$/m);
    if (heading) {
      const key = heading[1].trim().toLowerCase().replace(/\s+/g, " ");
      const n = (seenHeadings.get(key) || 0) + 1;
      seenHeadings.set(key, n);
      if (n >= 2 && key.length >= 3) continue;
    }
    const paraKey = block.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 140);
    if (paraKey.length >= 40) {
      const prev = keptBlocks.find(
        (b) =>
          b.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 140) === paraKey,
      );
      if (prev) continue;
    }
    keptBlocks.push(block);
  }
  working = keptBlocks.join("\n\n").trim();

  let truncationRemaining = detectDocumentTruncation(working, opts.query || "");
  if (truncationRemaining) {
    working = cutToLastCompleteSentence(working);
    truncationRemaining = detectDocumentTruncation(working, opts.query || "");
  }

  let repetitionRemaining = detectDocumentRepetition(working);
  let status = FINALIZATION_STATUS.COMPLETE;

  if (!working.trim()) {
    working = PARTIAL_INTERRUPT_MARKER;
    status = FINALIZATION_STATUS.REJECTED_INCOMPLETE;
  } else if (repetitionRemaining || truncationRemaining) {
    if (!working.includes(PARTIAL_INTERRUPT_MARKER)) {
      working = `${working.trimEnd()}\n\n${PARTIAL_INTERRUPT_MARKER}`;
    }
    status = FINALIZATION_STATUS.PARTIAL_EXPLICIT;
    repetitionRemaining = detectDocumentRepetition(
      working.replace(PARTIAL_INTERRUPT_MARKER, ""),
    );
    truncationRemaining = false;
  }

  return {
    text: working,
    finalization_status: status,
    measures: {
      ...before,
      sections_completed: countMarkdownSections(working),
      repetition_remaining: repetitionRemaining,
      truncation_remaining: truncationRemaining,
    },
  };
}

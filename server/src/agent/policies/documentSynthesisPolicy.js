/**
 * document_synthesis — synthèse / commentaire mono-doc ancré au texte fourni.
 * Patron #30–#32 : détection → can_answer_now → short-circuit → gabarit local.
 */
import { hasTextAttachments } from "../utils/conversationGuards.js";
import { isAnalyticalCritiqueIntent } from "../utils/analyticalCritiqueIntentGuards.js";
import { isMetaCapabilitiesIntent } from "./metaCapabilitiesPolicy.js";
import { isCodeIntentRequest } from "./codeIntentPolicy.js";
import { inferDocumentStateFromHistory } from "../micro/continuity/documentContinuityContext.js";
import { hasReusableDocumentBriefing } from "../micro/continuity/documentBriefingEncoder.js";
import { isExistingSourceAnalysisRequest } from "../utils/localFileUriIntentGuards.js";
import { isRepoAnalysisRequest } from "../utils/repoAnalysisIntentGuards.js";
import { suppressesDocumentSynthesisForCulturalSummary } from "./culturalContentSummaryPolicy.js";
import { isCodeConceptExplainRequest } from "./codeConceptExplainPolicy.js";
import { isResearchThenSummarizeRequest } from "./researchThenSummarizePolicy.js";
import { isFormalLetterTemplateRequest } from "./formalLetterTemplatePolicy.js";
import { shouldSuppressSummaryContractForAttachment } from "./attachmentTaskPolicy.js";

/** Lot #35 — « dis-moi l'essentiel sur [sujet scolaire] » sans document joint. */
const PEDAGOGY_SOFT_ESSENTIEL_SHELL_RE =
  /\bdis(?:s|-)?moi\s+(?:l['']?\s*)?(?:essentiel|l\s+essentiel)\s+sur\b/i;
const PEDAGOGY_SOFT_TOPIC_RE =
  /\b(?:volcan|histoire|géographie|geographie|révolution|revolution|science|biologie|physique|chimie)\b/i;

function isPedagogySoftEssentielWithoutDocument(query = "") {
  const q = normalizeDocumentSynthesisQuery(query);
  return (
    PEDAGOGY_SOFT_ESSENTIEL_SHELL_RE.test(q) && PEDAGOGY_SOFT_TOPIC_RE.test(q)
  );
}

export const DOCUMENT_SYNTHESIS_RULE = "document_synthesis_policy_v1";

export const DOCUMENT_SYNTHESIS_KINDS = Object.freeze({
  SYNTHESIS: "synthesis",
  COMMENTARY: "commentary",
  FOLLOWUP: "followup",
  MISSING_SOURCE: "missing_source",
});

export const DOCUMENT_SOURCE_TYPES = Object.freeze({
  PASTED: "pasted",
  ATTACHMENT: "attachment",
  BRIEFING: "briefing",
});

export const DOCUMENT_SOURCE_LENGTH = Object.freeze({
  SHORT: "short",
  LONG: "long",
});

const SHORT_WORD_THRESHOLD = 120;

/** Batterie #33 — passage collé + synthèse. */
export const DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY = `Résume ce passage :

La Révolution française commence en 1789. Les États généraux se réunissent à Versailles. La prise de la Bastille marque un tournant décisif pour le peuple parisien. Les idées des Lumières nourrissent les revendications politiques de la bourgeoisie et du tiers état.`;

/** Batterie #33 — extrait court + commentaire. */
export const DOCUMENT_SYNTHESIS_CANONICAL_COMMENTARY_QUERY =
  'Commente ce passage : « Les lucioles brillent dans la nuit d\'été, comme autant de promesses silencieuses. »';

/** Batterie #33 — shell sans source. */
export const DOCUMENT_SYNTHESIS_CANONICAL_MISSING_SOURCE_QUERY = "Résume ce texte";

const SYNTHESIS_SHELL_RE =
  /\b(?:resume|resumer|synthese|synthetise|synthetiser|points?\s+cles|l\s+essentiel|idees?\s+(?:centrales|principales)|fais\s+un\s+resume)\b/;

const COMMENTARY_SHELL_RE =
  /\b(?:commente|commenter|analyse|analyser|interprete|interpreter|explique\s+ce\s+passage|lis\s+ce\s+passage)\b/;

const PASSAGE_MARKER_RE =
  /\b(?:ce\s+passage|cet\s+extrait|ci\s+dessus|ci-dessus|le\s+texte\s+suivant|texte\s+suivant|ci\s+dessous)\b/;

const FOLLOWUP_MARKER_RE =
  /\b(?:plus\s+court|explique\s+mieux|detaille|developpe|synthese\s+plus|resume\s+plus|resumer\s+plus)\b/;

const DOCUMENT_REFERENCE_RE =
  /\b(?:ce\s+document|ce\s+fichier|ce\s+texte|le\s+document|l\s+analyse|document\s+joint|fichier\s+joint)\b/;

/**
 * @param {string} raw
 */
export function normalizeDocumentSynthesisQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} text
 */
export function countWords(text = "") {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasDocumentSynthesisShell(query = "") {
  if (isPedagogySoftEssentielWithoutDocument(query)) return false;
  const q = normalizeDocumentSynthesisQuery(query);
  return SYNTHESIS_SHELL_RE.test(q) || COMMENTARY_SHELL_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isDocumentSynthesisFollowUp(query = "") {
  const q = normalizeDocumentSynthesisQuery(query);
  if (!q) return false;
  if (PASSAGE_MARKER_RE.test(q) && (SYNTHESIS_SHELL_RE.test(q) || COMMENTARY_SHELL_RE.test(q))) {
    return true;
  }
  if (FOLLOWUP_MARKER_RE.test(q) && DOCUMENT_REFERENCE_RE.test(q)) return true;
  if (DOCUMENT_REFERENCE_RE.test(q) && (SYNTHESIS_SHELL_RE.test(q) || COMMENTARY_SHELL_RE.test(q))) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @param {unknown[]} [attachments]
 * @returns {boolean}
 */
export function isDocumentSynthesisExcluded(query = "", attachments = []) {
  if (isMetaCapabilitiesIntent(query)) return true;
  if (isCodeConceptExplainRequest(query)) return true;
  if (suppressesDocumentSynthesisForCulturalSummary(query)) return true;
  if (isResearchThenSummarizeRequest(query, { attachments })) return true;
  if (isFormalLetterTemplateRequest(query, { attachments })) return true;
  if (isExistingSourceAnalysisRequest(query)) return true;
  if (isRepoAnalysisRequest(query, { attachments })) return true;
  if (isAnalyticalCritiqueIntent(query, attachments)) return true;
  if (shouldSuppressSummaryContractForAttachment(query, attachments)) return true;
  if (isCodeIntentRequest(query)) return true;
  const q = normalizeDocumentSynthesisQuery(query);
  if (/\b(?:runtime|pipeline|short-circuit|nodemon|forge)\b/.test(q)) return true;
  return false;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractPastedSourceText(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return null;

  // Apostrophe ASCII (j'ai, d'un) ≠ guillemets de citation — sinon faux « passage collé ».
  const quotePatterns = [
    /[«""]([^«""]{20,})[»""]/s,
    /«([^»]{20,})»/s,
  ];
  for (const pattern of quotePatterns) {
    const match = raw.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  const parts = raw.split(/\n\s*\n/);
  if (parts.length >= 2) {
    const body = parts.slice(1).join("\n\n").trim();
    if (countWords(body) >= 12) return body;
  }

  const colonMatch = raw.match(/^[^:\n]{0,100}:\s*([\s\S]+)$/);
  if (colonMatch?.[1] && countWords(colonMatch[1]) >= 12) {
    return colonMatch[1].trim();
  }

  const lines = raw.split("\n");
  if (lines.length >= 2 && countWords(lines[0]) <= 18) {
    const body = lines.slice(1).join("\n").trim();
    if (countWords(body) >= 12) return body;
  }

  if (countWords(raw) >= 35 && hasDocumentSynthesisShell(raw)) {
    const stripped = raw
      .replace(/^[^.!?\n]{0,140}[.!?]\s*/s, "")
      .replace(/^[^:]+:\s*/s, "")
      .trim();
    if (countWords(stripped) >= 15) return stripped;
  }

  return null;
}

/**
 * @param {string} q
 */
function classifyIntentKind(q, sourceText, briefingAvailable, hasAttachment = false) {
  if (briefingAvailable && isDocumentSynthesisFollowUp(q)) {
    return DOCUMENT_SYNTHESIS_KINDS.FOLLOWUP;
  }
  if (!sourceText && !briefingAvailable && !hasAttachment) {
    if (hasDocumentSynthesisShell(q)) {
      return DOCUMENT_SYNTHESIS_KINDS.MISSING_SOURCE;
    }
    return null;
  }
  const words = sourceText ? countWords(sourceText) : 0;
  if (
    COMMENTARY_SHELL_RE.test(q) &&
    (words <= SHORT_WORD_THRESHOLD || PASSAGE_MARKER_RE.test(q))
  ) {
    return DOCUMENT_SYNTHESIS_KINDS.COMMENTARY;
  }
  if (SYNTHESIS_SHELL_RE.test(q)) return DOCUMENT_SYNTHESIS_KINDS.SYNTHESIS;
  if (COMMENTARY_SHELL_RE.test(q)) return DOCUMENT_SYNTHESIS_KINDS.COMMENTARY;
  return null;
}

/**
 * @param {string} text
 */
function splitSentences(text = "") {
  return String(text)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

/**
 * @param {string} sourceText
 * @param {number} [max]
 */
export function buildSynthesisBullets(sourceText = "", max = 6) {
  const sentences = splitSentences(sourceText);
  if (sentences.length > 0) {
    const limit = Math.min(max, Math.max(3, sentences.length));
    return sentences.slice(0, limit).map((s) => `- ${s}`);
  }
  const paras = sourceText.split(/\n+/).filter((p) => p.trim().length > 15);
  return paras.slice(0, max).map((p) => {
    const t = p.trim();
    return `- ${t.length > 180 ? `${t.slice(0, 177)}…` : t}`;
  });
}

/**
 * @param {string} sourceText
 */
function inferLiteraryRegister(sourceText = "") {
  const q = normalizeDocumentSynthesisQuery(sourceText);
  if (/\b(?:comme|metaphore|poeme|vers|rythme|image|nuit|reve)\b/.test(q)) {
    return "littéraire";
  }
  return "descriptif";
}

/**
 * @param {{
 *   intent_kind: string,
 *   sourceText?: string|null,
 *   source_length?: string,
 *   briefing?: object|null,
 * }} ctx
 */
export function buildDocumentSynthesisReply(ctx) {
  if (!ctx) return null;

  if (ctx.intent_kind === DOCUMENT_SYNTHESIS_KINDS.MISSING_SOURCE) {
    return buildMissingSourceClarifyReply();
  }

  if (ctx.intent_kind === DOCUMENT_SYNTHESIS_KINDS.FOLLOWUP && ctx.briefing) {
    return buildFollowUpBriefingReply(ctx.briefing);
  }

  const source = String(ctx.sourceText || "").trim();
  if (!source) return null;

  if (ctx.intent_kind === DOCUMENT_SYNTHESIS_KINDS.COMMENTARY) {
    const excerpt = source.length > 220 ? `${source.slice(0, 217)}…` : source;
    const register = inferLiteraryRegister(source);
    return (
      `**Lecture du passage** : « ${excerpt} »\n\n` +
      `Le passage adopte un registre **${register}** : il met en scène une image concrète tout en laissant entendre une portée plus large (thème, émotion ou argument implicite).\n\n` +
      `_Tu veux l'angle **style**, **thème** ou **argument** ?_`
    );
  }

  const bullets = buildSynthesisBullets(source);
  if (!bullets.length) return null;
  return (
    `**Synthèse du passage fourni**\n\n${bullets.join("\n")}\n\n` +
    `_Tu veux un résumé plus court, un plan thématique ou une citation commentée ?_`
  );
}

/**
 * @param {import("../micro/continuity/documentBriefingEncoder.js").DocumentBriefing} briefing
 */
export function buildFollowUpBriefingReply(briefing = {}) {
  const name = briefing.filename || "document";
  const summary =
    briefing.summary ||
    String(briefing.lastAnalysisExcerpt || "").trim().slice(0, 600) ||
    "Analyse précédente disponible dans le fil.";
  const blocks = (briefing.keyBlocks || [])
    .slice(0, 4)
    .map((b) => `- **${b.label}** : ${String(b.snippet || "").slice(0, 120)}`)
    .filter(Boolean);
  const blockSection = blocks.length ? `\n\n**Points déjà repérés**\n${blocks.join("\n")}` : "";
  return (
    `**Suite sur ${name}** (sans ré-ingestion du fichier)\n\n${summary}${blockSection}\n\n` +
    `_Précise si tu veux un résumé plus court, un angle thématique ou un point développé._`
  );
}

export function buildMissingSourceClarifyReply() {
  return (
    "Pour résumer ou commenter, colle le **passage** dans ton message ou joins le **document** (PDF, txt…). " +
    "Je répondrai directement à partir du texte fourni."
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {unknown[]} [attachments]
 * @returns {object|null}
 */
export function resolveDocumentSynthesisContext(
  query = "",
  history = [],
  attachments = [],
) {
  if (isDocumentSynthesisExcluded(query, attachments)) return null;

  const q = normalizeDocumentSynthesisQuery(query);
  const briefingState = inferDocumentStateFromHistory(history);
  const briefing = briefingState?.documentBriefing || null;
  const briefingAvailable = Boolean(briefing && hasReusableDocumentBriefing(briefing));
  const hasAttachment = hasTextAttachments(attachments);
  const pasted = extractPastedSourceText(query);

  let sourceText = pasted;
  let source_type = DOCUMENT_SOURCE_TYPES.PASTED;

  if (!sourceText && hasAttachment) {
    sourceText = "[attachment]";
    source_type = DOCUMENT_SOURCE_TYPES.ATTACHMENT;
  }
  if (!sourceText && briefingAvailable && isDocumentSynthesisFollowUp(query)) {
    source_type = DOCUMENT_SOURCE_TYPES.BRIEFING;
  }

  const intent_kind = classifyIntentKind(q, pasted, briefingAvailable, hasAttachment);
  if (!intent_kind) return null;

  if (intent_kind === DOCUMENT_SYNTHESIS_KINDS.FOLLOWUP && briefingAvailable) {
    return {
      intent_kind,
      source_type: DOCUMENT_SOURCE_TYPES.BRIEFING,
      source_length: DOCUMENT_SOURCE_LENGTH.LONG,
      sourceText: null,
      briefing,
      deferToDocumentContinuity: true,
      satisfiable: true,
    };
  }

  if (intent_kind === DOCUMENT_SYNTHESIS_KINDS.MISSING_SOURCE) {
    return {
      intent_kind,
      source_type: null,
      source_length: null,
      sourceText: null,
      satisfiable: true,
    };
  }

  if (source_type === DOCUMENT_SOURCE_TYPES.ATTACHMENT) {
    return {
      intent_kind,
      source_type,
      source_length: DOCUMENT_SOURCE_LENGTH.LONG,
      sourceText: null,
      satisfiable: true,
      deferToLlm: true,
    };
  }

  if (!sourceText) return null;

  return {
    intent_kind,
    source_type,
    source_length:
      countWords(sourceText) <= SHORT_WORD_THRESHOLD
        ? DOCUMENT_SOURCE_LENGTH.SHORT
        : DOCUMENT_SOURCE_LENGTH.LONG,
    sourceText,
    satisfiable: true,
  };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {unknown[]} [attachments]
 */
export function isDocumentSynthesisSatisfiable(
  query = "",
  history = [],
  attachments = [],
) {
  return Boolean(resolveDocumentSynthesisContext(query, history, attachments)?.satisfiable);
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {unknown[]} [attachments]
 */
export function resolveDocumentSynthesisShortCircuit(
  query = "",
  history = [],
  attachments = [],
) {
  const ctx = resolveDocumentSynthesisContext(query, history, attachments);
  if (!ctx) return null;

  if (ctx.deferToDocumentContinuity) return null;

  if (ctx.deferToLlm) {
    return {
      path: "document_synthesis_llm",
      kind: ctx.intent_kind,
      reply: null,
      deferToLlm: true,
      documentSynthesis: true,
      task: ctx,
    };
  }

  const reply = buildDocumentSynthesisReply(ctx);
  if (!reply) return null;

  const path =
    ctx.intent_kind === DOCUMENT_SYNTHESIS_KINDS.MISSING_SOURCE
      ? "document_synthesis_clarify"
      : "document_synthesis_deterministic";

  return {
    path,
    kind: ctx.intent_kind,
    reply,
    task: ctx,
  };
}

/**
 * Bypass clarification gate — réponse documentaire avant boilerplate générique.
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {unknown[]} [attachments]
 */
export function resolveDocumentSynthesisBypassReply(
  query = "",
  history = [],
  attachments = [],
) {
  return (
    resolveDocumentSynthesisShortCircuit(query, history, attachments)?.reply || ""
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {unknown[]} [attachments]
 */
export function buildDocumentSynthesisRecoveryMessage(
  query = "",
  history = [],
  attachments = [],
  reason = "empty_output",
) {
  const bypass = resolveDocumentSynthesisBypassReply(query, history, attachments);
  if (bypass) return bypass;
  if (hasDocumentSynthesisShell(query)) {
    return buildMissingSourceClarifyReply();
  }
  const snippet = normalizeDocumentSynthesisQuery(query).slice(0, 100);
  return (
    "Je n'ai pas pu extraire assez de matière textuelle pour cette demande " +
    `(${reason}). ` +
    (snippet ? `Tu demandais : « ${snippet}${query.length > 100 ? "…" : ""} ». ` : "") +
    "Colle l'extrait ou joins le document, puis précise si tu veux une synthèse ou un commentaire."
  );
}

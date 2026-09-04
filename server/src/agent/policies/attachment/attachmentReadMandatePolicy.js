/**
 * ATTACHMENT_READ_MANDATE_V1 — contrat normatif.
 * Source de vérité : ATTACHMENT_READ_MANDATE_CONTRACT ci-dessous.
 */
import { hasTextAttachments, isImageOnlyAttachments, VISION_IMAGE_UNCERTAINTY_REPLY } from "../../utils/conversation/conversationGuards.js";
import {
  classifyAttachmentTask,
  resolveAttachmentFraming,
} from "./attachmentTaskPolicy.js";
import {
  buildHtmlDocumentAnalysisReply,
  evaluateHtmlDocumentCriticChecks,
} from "../../analysis/analyzers/htmlDocumentExtract.js";

export const ATTACHMENT_READ_MANDATE_RULE = "attachment_read_mandate_v1";

/**
 * Contrat court, stable, testable.
 * Ne pas « améliorer » une phrase : appliquer ces clauses.
 */
export const ATTACHMENT_READ_MANDATE_CONTRACT = Object.freeze({
  id: "ATTACHMENT_READ_MANDATE_V1",
  trigger: {
    anyOf: [
      "work_verb AND joint_object_mention AND NOT image_only",
      "text_attachment AND work_verb",
    ],
    not: [
      "attachment_present AND NOT work_verb",
      "image_only_attachment",
    ],
  },
  readObligations: [
    "ingest_before_any_content_answer",
    "unreadable_or_empty_stops_without_invention",
  ],
  evidenceMinima: {
    quotedSpanChars: 16,
    distinctiveTokens: 2,
    workVerbsAreNotEvidence: true,
  },
  legitimateStops: [
    "unreadable",
    "empty",
    "mandate_does_not_apply",
  ],
  clarificationForbiddenWhen: [
    "work_request_and_file_is_the_target",
    "readable_file_even_if_improve_is_vague",
  ],
  clarificationAllowedWhen: [
    "mandate_does_not_apply",
    "unread_or_empty_asks_for_readable_file_not_objective",
  ],
  frontiers: {
    html_pedagogical_improve: "document",
    html_code_fix_or_security: "code",
    unreadable: "stop",
    empty: "stop",
    present_without_work: "no_mandate",
    image_only_attachment: "no_mandate_vision",
    vague_improve_readable: "mandate_no_objective_clarify",
  },
  framingPriority: ["request_nature", "work_verb", "file_type"],
});

export const MANDATE_DEFECTS = Object.freeze({
  UNREAD: "unread",
  UNANCHORED: "unanchored",
  MISPLACED_CLARIFICATION: "misplaced_clarification",
  WRONG_FRAMING: "wrong_framing",
});

const WORK_VERB_RE =
  /(?:analys(?:e|er)|am[eé]lior\w*|r[eé]sum\w*|expliqu\w*|axes?|revue|review|audit|inspecte|corrige|fix|refactor)/i;
const JOINT_OBJECT_RE =
  /\b(?:fichier|document|pi[eè]ce\s+jointe|joint|attach[eé]e?)\b/i;
const PISTE_RE =
  /je vois la piste|pas encore la destination|donne[- ]moi l['']objectif|objectif en une phrase|reformule/i;

const STOP_TOKENS = new Set([
  "pour",
  "avec",
  "dans",
  "cette",
  "celui",
  "celle",
  "les",
  "des",
  "une",
  "que",
  "qui",
  "par",
  "sur",
  "pas",
  "plus",
  "comme",
  "aussi",
  "entre",
  "sont",
  "est",
  "document",
  "fichier",
  "joint",
  "analyse",
  "analyser",
  "ameliorer",
  "amelioration",
  "contenu",
  "proposition",
  "recommandation",
  "structure",
]);

export function hasAttachmentPresent(attachments = []) {
  return hasTextAttachments(attachments) || (attachments || []).length > 0;
}

/**
 * Déclenchement du mandat — clause trigger du contrat.
 */
export function isAttachmentWorkRequest(query = "", attachments = []) {
  // Toutes les PJ `image/*` (png/jpeg/gif/webp, …) → Vision, pas mandat document.
  if (isImageOnlyAttachments(attachments)) return false;
  const q = String(query || "");
  if (WORK_VERB_RE.test(q) && JOINT_OBJECT_RE.test(q)) return true;
  if (hasAttachmentPresent(attachments) && WORK_VERB_RE.test(q)) return true;
  return false;
}

/** PJ présente, aucune demande exploitable → mandat inactif, clarify encore licite. */
export function isAttachmentPresentWithoutWorkRequest(query = "", attachments = []) {
  if (isImageOnlyAttachments(attachments)) return false;
  return hasAttachmentPresent(attachments) && !isAttachmentWorkRequest(query, attachments);
}

export function resolveIngestStatus(ingestedText = "", readStatus = null, htmlViews = null) {
  if (htmlViews?.availability === "empty_file") return "empty";
  if (htmlViews?.availability === "parse_failure") return "unreadable";
  if (
    htmlViews &&
    (htmlViews.availability === "document_available" ||
      htmlViews.availability === "metadata_only" ||
      htmlViews.availability === "low_visible_text" ||
      (htmlViews.flags || []).includes("metadata_available"))
  ) {
    return "ok";
  }
  if (readStatus === "unreadable" || readStatus === "empty") return readStatus;
  const ingested = String(ingestedText || "").trim();
  if (ingested.length < 40) return ingested.length === 0 ? "empty" : "empty";
  return "ok";
}

export function isMisplacedClarificationReply(text = "") {
  return PISTE_RE.test(String(text || ""));
}

function tokenizeEvidence(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]{5,}/g) || [];
}

/**
 * Preuve concrète : citation d'un span source, ou ≥2 tokens distinctifs du fichier.
 */
export function hasContentEvidence(reply = "", ingestedText = "") {
  const source = String(ingestedText || "").replace(/\s+/g, " ").trim();
  const out = String(reply || "").replace(/\s+/g, " ").trim();
  if (source.length < 40 || out.length < 20) return false;

  const window = Math.min(28, source.length);
  const probe = source.slice(0, 400);
  for (let i = 0; i <= probe.length - window; i += 8) {
    const span = probe.slice(i, i + window).trim();
    if (span.length >= 16 && out.toLowerCase().includes(span.toLowerCase())) {
      return true;
    }
  }

  const sourceTokens = [...new Set(tokenizeEvidence(source))]
    .filter((t) => !STOP_TOKENS.has(t))
    .slice(0, 40);
  const replyTokens = new Set(tokenizeEvidence(out));
  const hits = sourceTokens.filter((t) => replyTokens.has(t));
  return hits.length >= 2;
}

const FILE_USE_FLAGS = ["file_not_used", "generic_answer_without_document"];

/**
 * Le critique LLM ne voit pas toujours le fichier : si la réponse ancre déjà
 * le briefing, on ne retente pas pour file_not_used / generic_answer_without_document.
 */
export function reconcileCriticFileUseVerdict(critique = {}, rawAnswer = "", briefing = "") {
  const reasons = Array.isArray(critique.reasons) ? critique.reasons : [];
  if (critique.verdict !== "fail") return critique;
  if (!reasons.some((r) => FILE_USE_FLAGS.includes(r))) return critique;
  if (!hasContentEvidence(rawAnswer, briefing)) return critique;
  const next = reasons.filter((r) => !FILE_USE_FLAGS.includes(r));
  return {
    ...critique,
    verdict: next.length ? "fail" : "ok",
    reasons: next,
  };
}

function pickPreviewLines(ingestedText = "", limit = 6) {
  return String(ingestedText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 12)
    .filter((l) => !/^[-_=]{3,}$/.test(l))
    .slice(0, limit);
}

/**
 * @returns {{
 *   applies: boolean,
 *   ok: boolean,
 *   defects: string[],
 *   layers: string[],
 *   symptom: string|null,
 *   rootCause: string|null,
 *   rule: string,
 * }}
 */
export function evaluateAttachmentReadMandate(input = {}) {
  const {
    query = "",
    attachments = [],
    ingestedText = "",
    reply = "",
    fileKind = null,
    task = null,
    readStatus = null,
    htmlViews = null,
  } = input;

  if (!isAttachmentWorkRequest(query, attachments)) {
    return {
      applies: false,
      ok: true,
      defects: [],
      layers: [],
      symptom: null,
      rootCause: null,
      rule: ATTACHMENT_READ_MANDATE_RULE,
    };
  }

  const classified = classifyAttachmentTask(query, attachments);
  const framing = resolveAttachmentFraming(query, attachments);
  const kind = fileKind || framing.fileKind || classified.fileKind;
  const workTask = task || classified.task;
  const defects = [];
  const layers = [];
  const ingested = String(ingestedText || "").trim();
  const ingestStatus = resolveIngestStatus(ingested, readStatus, htmlViews);
  const text = String(reply || "").trim();

  if (isMisplacedClarificationReply(text) || !text) {
    defects.push(MANDATE_DEFECTS.MISPLACED_CLARIFICATION);
    layers.push("clarification");
  }

  const fileName = String(
    attachments[0]?.originalname || attachments[0]?.name || "",
  );
  const mentionsKnownFile =
    fileName &&
    text.toLowerCase().includes(
      fileName.replace(/^.*[\\/]/, "").toLowerCase().slice(0, 24),
    );

  if (ingestStatus !== "ok") {
    if (!text || isMisplacedClarificationReply(text) || !mentionsKnownFile) {
      defects.push(MANDATE_DEFECTS.UNREAD);
      layers.push("read");
    }
  } else if (text && !hasContentEvidence(text, ingested)) {
    const htmlCritic = htmlViews
      ? evaluateHtmlDocumentCriticChecks({
          query,
          task: workTask,
          fileKind: kind,
          views: htmlViews,
          reply: text,
        })
      : null;
    if (!htmlCritic?.checks?.response_references_artifacts) {
      defects.push(MANDATE_DEFECTS.UNANCHORED);
      layers.push("anchoring");
    }
  }

  if (
    framing.htmlOnly &&
    workTask === "doc_improve" &&
    kind === "code" &&
    framing.winner !== "request_nature"
  ) {
    defects.push(MANDATE_DEFECTS.WRONG_FRAMING);
    layers.push("framing");
  }

  const uniqueLayers = [...new Set(layers)];
  const uniqueDefects = [...new Set(defects)];
  const ok = uniqueDefects.length === 0;

  return {
    applies: true,
    ok,
    defects: uniqueDefects,
    layers: uniqueLayers,
    symptom: ok
      ? null
      : uniqueDefects.includes(MANDATE_DEFECTS.MISPLACED_CLARIFICATION)
        ? "clarification / piste malgré un fichier joint"
        : uniqueDefects.includes(MANDATE_DEFECTS.UNREAD)
          ? "réponse sans lecture du fichier"
          : "réponse sans preuve d'exploitation du contenu",
    rootCause: ok
      ? null
      : uniqueLayers.join("+") || "attachment_path",
    rule: ATTACHMENT_READ_MANDATE_RULE,
    ingestStatus,
    framing,
  };
}

export function buildAttachmentMandateRepairReply(input = {}) {
  const {
    query = "",
    attachments = [],
    ingestedText = "",
    defects = [],
    readStatus = null,
    htmlViews = null,
  } = input;
  const name =
    attachments[0]?.originalname ||
    attachments[0]?.name ||
    "fichier joint";

  const ingestStatus = resolveIngestStatus(ingestedText, readStatus, htmlViews);
  if (isImageOnlyAttachments(attachments)) {
    return VISION_IMAGE_UNCERTAINTY_REPLY;
  }
  if (htmlViews && ingestStatus === "ok") {
    return buildHtmlDocumentAnalysisReply(htmlViews, query);
  }
  if (defects.includes(MANDATE_DEFECTS.UNREAD) || ingestStatus !== "ok") {
    const stop =
      readStatus === "unreadable"
        ? "Fichier illisible — extraction impossible."
        : "Fichier vide ou trop court pour une analyse.";
    return [
      `**Lecture obligatoire — arrêt légitime.**`,
      "",
      `- **Fichier** : \`${name}\``,
      `- **Statut** : ${stop}`,
      `- **Demande** : ${String(query || "").trim() || "analyse du joint"}`,
      "",
      "Je n'invente pas d'axes ni de stack. Renvoie un fichier lisible ou un extrait — pas un nouvel objectif.",
    ].join("\n");
  }

  const lines = pickPreviewLines(ingestedText);
  const bullets =
    lines.length > 0
      ? lines.map((l) => `- \`${l.slice(0, 140)}\``).join("\n")
      : "- *(extrait trop court — le fichier a été vu mais peu de texte utile)*";

  return [
    `## Ancrage sur \`${name}\``,
    "",
    "Le fichier a été lu. Toute suite doit s'appuyer sur ces extraits — pas sur une consigne générique.",
    "",
    "### Preuves lues",
    bullets,
    "",
    "### Demande",
    String(query || "analyser le fichier joint").trim(),
    "",
    "Prochaine étape licite : axes d'amélioration **cités depuis ces extraits**, pas une demande d'objectif.",
  ].join("\n");
}

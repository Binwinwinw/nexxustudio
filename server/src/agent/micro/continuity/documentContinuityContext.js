import { hasTextAttachments } from "../../utils/conversationGuards.js";
import { readRecentTurns } from "./conversationContinuityContext.js";
import {
  buildDocumentBriefingFromAnalysisOnly,
  hasReusableDocumentBriefing,
  needsRawDocumentReingest,
  serializeDocumentBriefingForLlm,
} from "./documentBriefingEncoder.js";
import {
  classifyDocumentFollowUpKind,
  isDocumentFollowUpIntent,
  isExplicitClearDocumentRequest,
  isExplicitNewDocumentRequest,
} from "./documentFollowUpGuards.js";
import { prepareDocumentAnalysisContext } from "../../policies/document/index.js";
import {
  clearActiveDocumentContext,
  DOCUMENT_CONTINUITY_RULE,
  getActiveDocumentBriefing,
  getActiveDocumentContext,
  recordActiveDocumentAnalysis,
} from "./documentTurnState.js";

export { DOCUMENT_CONTINUITY_RULE, recordActiveDocumentAnalysis };

const DOCUMENT_ANALYSIS_ASSISTANT_MARKERS =
  /points clés|type de fichier|document joint|##\s*(type|rôle|points|synthèse)|mode document/i;

/**
 * Reconstruit un document actif depuis l'historique (briefing encodé, pas blob brut).
 * @param {Array<{ role?: string, content?: string }>} history
 */
export function inferDocumentStateFromHistory(history = [], limit = 12) {
  const turns = readRecentTurns(history, limit);
  if (!turns.length) return null;

  let lastAnalysis = null;
  let fileName = null;

  for (let i = turns.length - 1; i >= 0; i--) {
    const role = turns[i]?.role;
    const content = String(turns[i]?.content || "");

    if (role === "assistant" && !lastAnalysis) {
      if (DOCUMENT_ANALYSIS_ASSISTANT_MARKERS.test(content)) {
        lastAnalysis = content;
      }
    }

    if (role === "user") {
      const docTag = content.match(/\[DOCUMENT #\d+:\s*([^\]]+)\]/i);
      if (docTag?.[1]) fileName = docTag[1].trim();

      if (!fileName) {
        const named = content.match(
          /\b([\w.-]+\.(?:css|scss|less|js|ts|tsx|jsx|md|html|htm|php|json|txt|csv|pdf))\b/i,
        );
        if (named?.[1] && /\b(fichier|joint|css|document|analys)\b/i.test(content)) {
          fileName = named[1];
        }
      }
    }
  }

  if (!lastAnalysis) return null;

  const documentBriefing = buildDocumentBriefingFromAnalysisOnly(
    lastAnalysis,
    fileName || "document",
  );

  return {
    fileName: documentBriefing.filename,
    wasAnalyzed: true,
    lastAnalysisKind: documentBriefing.lastAnalysisKind,
    documentBriefing,
    followUpEligible: documentBriefing.followUpEligible,
    fromHistory: true,
  };
}

/**
 * @param {{
 *   fileName?: string,
 *   documentBriefing?: import("./documentBriefingEncoder.js").DocumentBriefing|null,
 *   briefingExcerpt?: string|null,
 *   lastAnalysisExcerpt?: string|null,
 * }} state
 */
export function buildDocumentFollowUpContextBlock(state = {}) {
  if (state.documentBriefing && hasReusableDocumentBriefing(state.documentBriefing)) {
    return serializeDocumentBriefingForLlm(state.documentBriefing);
  }

  const name = state.fileName || "document";
  const parts = [
    `=== DOCUMENT ACTIF: ${name} ===`,
    "Continuité documentaire (repli legacy — préférer document_briefing encodé).",
  ];

  if (state.lastAnalysisExcerpt?.trim()) {
    parts.push("\n--- ANALYSE PRÉCÉDENTE ---\n");
    parts.push(state.lastAnalysisExcerpt.trim().slice(0, 8000));
  }

  return parts.join("\n");
}

/**
 * @param {{
 *   sessionId?: string|null,
 *   query?: string,
 *   history?: Array<{ role?: string, content?: string }>,
 *   attachedFiles?: unknown[],
 * }} params
 */
export function resolveDocumentContinuity({
  sessionId,
  query = "",
  history = [],
  attachedFiles = [],
}) {
  if (isExplicitClearDocumentRequest(query)) {
    clearActiveDocumentContext(sessionId);
    return { shouldRunFollowUp: false, rule: DOCUMENT_CONTINUITY_RULE };
  }

  const hasNewFiles = hasTextAttachments(attachedFiles);
  const stored = getActiveDocumentContext(sessionId);

  if (hasNewFiles) {
    const newName =
      attachedFiles[0]?.originalname || attachedFiles[0]?.name || null;
    if (
      stored?.fileName &&
      newName &&
      stored.fileName !== newName &&
      !isExplicitNewDocumentRequest(query)
    ) {
      clearActiveDocumentContext(sessionId);
    }
    return {
      shouldRunFollowUp: false,
      rule: DOCUMENT_CONTINUITY_RULE,
      reason: "new_attachment",
    };
  }

  const fromHistory = inferDocumentStateFromHistory(history);
  const active = stored || fromHistory;
  const documentBriefing =
    active?.documentBriefing || getActiveDocumentBriefing(sessionId);

  if (documentBriefing && needsRawDocumentReingest(query, documentBriefing)) {
    return {
      shouldRunFollowUp: false,
      rule: DOCUMENT_CONTINUITY_RULE,
      reason: "needs_raw_reingest",
      needsRawReingest: true,
      fileName: documentBriefing.filename,
      documentBriefing,
    };
  }

  if (!isDocumentFollowUpIntent(query)) {
    return {
      shouldRunFollowUp: false,
      activeDocument: stored,
      documentBriefing,
      rule: DOCUMENT_CONTINUITY_RULE,
    };
  }

  if (!active?.followUpEligible && !hasReusableDocumentBriefing(documentBriefing)) {
    return {
      shouldRunFollowUp: false,
      rule: DOCUMENT_CONTINUITY_RULE,
      reason: "no_prior_document_analysis",
    };
  }

  if (!hasReusableDocumentBriefing(documentBriefing)) {
    return {
      shouldRunFollowUp: false,
      rule: DOCUMENT_CONTINUITY_RULE,
      reason: "missing_reusable_context",
    };
  }

  return {
    shouldRunFollowUp: true,
    rule: DOCUMENT_CONTINUITY_RULE,
    fileName: documentBriefing.filename,
    documentBriefing,
    followUpKind: classifyDocumentFollowUpKind(query),
    fromHistory: Boolean(fromHistory && !stored),
  };
}

/**
 * @param {string} query
 * @param {ReturnType<typeof resolveDocumentContinuity>} continuity
 * @param {{ onStep?: Function, onContent?: Function }} handlers
 */
export async function runDocumentFollowUp(query, continuity, { onStep, onContent } = {}) {
  const contextBlock = buildDocumentFollowUpContextBlock(continuity);
  const followUpKind = continuity.followUpKind || "improvement";

  const docContext = await prepareDocumentAnalysisContext(query, {
    fileName: continuity.fileName,
    attachedBriefing: contextBlock,
    hasAttachedDocument: true,
    onStep,
  });

  const { documentAnalysis } = await import(
    "../../../../../citadelle-vault/Citadelle/01-Architecture/03-Forge/document-analysis.js"
  );

  const followUpUserHint =
    followUpKind === "web_compare"
      ? "Confronte le document actif aux sources WEB PROBE — alignement, écarts, points à actualiser."
      : followUpKind === "utility"
        ? "Décris l'utilité et le public cible du document actif."
        : followUpKind === "capability_challenge"
          ? "Réponds sur les capacités OCR/vision/extraction — honnêteté sur DOCUMENT_CAPABILITY si présent."
          : undefined;

  return documentAnalysis(
    followUpUserHint ? `${query}\n\n${followUpUserHint}` : query,
    {
      extractedUrls: docContext.extractedUrls || contextBlock,
      webProbeBriefing: docContext.webProbeBriefing,
      webCompareMode: docContext.webCompareMode,
    },
    {
      onStep,
      onContent,
      hasAttachedDocument: true,
      fileName: continuity.fileName,
      followUpKind,
    },
  );
}

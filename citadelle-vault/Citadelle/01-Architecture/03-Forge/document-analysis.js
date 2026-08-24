import ollama from '../../../../server/src/llm/ollama.js';
import { getActiveTier1ChatModel } from '../../../../server/src/config/models.js';
import OllamaStreamProcessor from '../../../../server/src/agent/utils/runtime/ollamaStreamProcessor.js';
import { emitTextChunks } from '../../../../server/src/agent/utils/runtime/streamTextChunks.js';
import {
  getDocumentAnalysisSystemPrompt,
  getDocumentImprovementSystemPrompt,
  resolveDocumentLlmOutcome,
  shouldEmitDocumentFallbackChunks,
  INSUFFICIENT_SIGNAL_REFUSAL,
} from '../../../../server/src/agent/config/modeResponseContracts.js';
import responseThinkingCleaner from '../../../../server/src/agent/utils/quality-safety/responseThinkingCleaner.js';
import {
  buildDocumentLatencyBreakdown,
  logDocumentLatencyBreakdown,
  applyDocumentLatencyMetrics,
} from '../../../../server/src/agent/telemetry/documentLatencyTelemetry.js';
import {
  buildDocumentOllamaChatOptions,
  isDocumentThinkUnsupportedError,
  resolveDocumentRailPath,
} from '../../../../server/src/agent/policies/document/documentOllamaOptions.js';

const DOCUMENT_EXTRACTOR_MODEL = getActiveTier1ChatModel();

/**
 * Document Analysis Module
 * Pipeline : Extracteur (Faits) → Intégrateur (Synthèse structurée)
 */
export async function documentAnalysis(
  query,
  context,
  {
    onStep,
    onContent,
    hasAttachedDocument = false,
    fileName = null,
    followUpKind = null,
    document_extract_ms = null,
    turnTelemetry = null,
  } = {},
) {
  try {
    const docBriefing = context?.documentBriefing || "";
    const extracted = context?.extractedUrls || "";
    const webProbe = context?.webProbeBriefing || "";
    const contentToAnalyze = [extracted, webProbe, docBriefing]
      .filter(Boolean)
      .join("\n\n") || query;
    const hasBriefing =
      hasAttachedDocument &&
      String(contentToAnalyze).includes('DOCUMENTS DE CONTEXTE FOURNIS');
    const hasWebProbe = String(contentToAnalyze).includes('WEB PROBE DOCUMENTAIRE');

    if (hasAttachedDocument && !hasBriefing) {
      console.warn(
        '[DOCUMENT ANALYSIS] ⚠️ Fichier joint signalé mais briefing absent du contexte LLM',
      );
    }

    if (onStep) {
      onStep('📑 [Document Analysis] Extraction et formatage en cours...', {
        step: 1,
        total: 1,
      });
    }

    const promptBuildStarted = performance.now();
    const contextBlock = String(contentToAnalyze).substring(0, 10000);
    const isFollowUp = Boolean(followUpKind);
    const hasDocumentSignal =
      hasBriefing || hasAttachedDocument || isFollowUp;
    const systemPrompt = isFollowUp
      ? getDocumentImprovementSystemPrompt(contextBlock, {
          hasActiveDocument: hasDocumentSignal,
        })
      : getDocumentAnalysisSystemPrompt(contextBlock, {
          hasAttachedDocument: hasBriefing || hasAttachedDocument,
          webCompareMode: Boolean(hasWebProbe || context?.webCompareMode),
        });

    const followUpUserHint =
      followUpKind === 'improvement'
        ? 'Propose des améliorations concrètes sur le document actif (contexte système).'
        : followUpKind === 'explanation'
          ? 'Explique tes choix ou le raisonnement sur le document actif (contexte système).'
          : followUpKind === 'example'
            ? 'Montre le bloc ou les sélecteurs concernés sur le document actif (contexte système).'
            : 'Réponds au suivi sur le document actif (contexte système).';

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: isFollowUp
          ? `${query}\n\n${followUpUserHint}`
          : hasBriefing
            ? `${query}\n\nAnalyse le document joint présent dans le contexte système.`
            : query,
      },
    ];
    const prompt_build_ms = performance.now() - promptBuildStarted;

    let streamedVisible = '';
    let raw = '';
    let ollamaDone = null;
    let first_token_ms = null;
    let thinkRetry = false;
    const streamStarted = performance.now();

    const documentChatOptions = buildDocumentOllamaChatOptions({ think: false });

    const runDocumentChat = async (options) => {
      if (onContent) {
        const streamProcessor = new OllamaStreamProcessor({
          onChunk: (chunk) => {
            if (first_token_ms == null) {
              first_token_ms = performance.now() - streamStarted;
            }
            streamedVisible += chunk;
            onContent(chunk);
          },
        });
        const done = await ollama.chatStream(
          messages,
          (token) => streamProcessor.processToken(token),
          DOCUMENT_EXTRACTOR_MODEL,
          options,
        );
        streamProcessor.finalize();
        return {
          done,
          raw:
            streamProcessor.getResult().currentResponse ||
            streamProcessor.getResult().fullResponse ||
            '',
        };
      }
      return {
        done: null,
        raw: await ollama.chat(messages, DOCUMENT_EXTRACTOR_MODEL, options),
      };
    };

    try {
      ({ done: ollamaDone, raw } = await runDocumentChat(documentChatOptions));
    } catch (error) {
      if (!isDocumentThinkUnsupportedError(error)) throw error;
      thinkRetry = true;
      console.warn(
        `[DOCUMENT ANALYSIS] think=false rejeté (${error.message}) — retry baseline`,
      );
      first_token_ms = null;
      streamedVisible = '';
      ({ done: ollamaDone, raw } = await runDocumentChat({ temperature: 0.3 }));
    }

    const sanitizeStarted = performance.now();
    const { response, usedFallback } = resolveDocumentLlmOutcome({
      raw,
      query,
      fileName,
      contextBlock,
      hasDocumentSignal,
    });
    const sanitize_ms = performance.now() - sanitizeStarted;

    let delivery_ms = 0;
    if (usedFallback) {
      console.warn(
        `[DOCUMENT ANALYSIS] Fallback document-aware (raw=${String(raw || '').length}, streamed=${streamedVisible.length})`,
      );
      if (shouldEmitDocumentFallbackChunks(usedFallback, onContent)) {
        const deliveryStarted = performance.now();
        emitTextChunks(response, onContent);
        delivery_ms = performance.now() - deliveryStarted;
      }
    }

    if (!response.trim()) {
      throw new Error('DOCUMENT_ANALYSIS_EMPTY_AFTER_FALLBACK');
    }

    const usefulStreamed =
      Boolean(streamedVisible.trim()) &&
      !responseThinkingCleaner.isPromptInstructionLoop(streamedVisible) &&
      !responseThinkingCleaner.hasEscapedThinking(streamedVisible);

    const latency = buildDocumentLatencyBreakdown({
      document_extract_ms,
      prompt_build_ms,
      ollamaDone,
      first_token_ms,
      sanitize_ms,
      delivery_ms,
    });
    const path = resolveDocumentRailPath({ thinkRetry, usedFallback });
    logDocumentLatencyBreakdown(latency, {
      usedFallback,
      think_retry: thinkRetry,
      path,
      chars: response.length,
    });
    applyDocumentLatencyMetrics(turnTelemetry, latency);
    if (turnTelemetry?.setMetric) {
      turnTelemetry.setMetric("document_path", path);
    }

    console.log(
      `[DOCUMENT ANALYSIS] Terminé — path=${path} attached=${Boolean(hasBriefing || hasAttachedDocument)} streamed=${usefulStreamed || usedFallback} chars=${response.length} refusal=${response === INSUFFICIENT_SIGNAL_REFUSAL}`,
    );

    return {
      result: response,
      metadata: {
        mode: 'DOCUMENT',
        steps: 1,
        hasAttachedDocument: Boolean(hasDocumentSignal),
        followUpKind: followUpKind || null,
        usedFallback,
        thinkRetry,
        path,
        streamed: usefulStreamed || Boolean(usedFallback && onContent),
        webProbeExecuted: Boolean(hasWebProbe),
        webCompareMode: Boolean(hasWebProbe || context?.webCompareMode),
        latency,
      },
    };
  } catch (error) {
    console.error('[DOCUMENT ANALYSIS] Échec:', error.message);
    throw new Error(`DOCUMENT_ANALYSIS_FAILED: ${error.message}`);
  }
}

import ollama from '../../../../server/src/llm/ollama.js';
import OllamaStreamProcessor from '../../../../server/src/agent/utils/ollamaStreamProcessor.js';
import { emitTextChunks } from '../../../../server/src/agent/utils/streamTextChunks.js';
import {
  enforceModeContract,
  getDocumentAnalysisSystemPrompt,
  getDocumentImprovementSystemPrompt,
  buildAttachedDocumentFallback,
  isInsufficientSignalRefusal,
  RESPONSE_MODES,
  INSUFFICIENT_SIGNAL_REFUSAL,
} from '../../../../server/src/agent/config/modeResponseContracts.js';

const DOCUMENT_EXTRACTOR_MODEL = 'ornith:9b';

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

    let streamedVisible = '';
    let raw = '';

    if (onContent) {
      const streamProcessor = new OllamaStreamProcessor({
        onChunk: (chunk) => {
          streamedVisible += chunk;
          onContent(chunk);
        },
      });

      await ollama.chatStream(
        messages,
        (token) => streamProcessor.processToken(token),
        DOCUMENT_EXTRACTOR_MODEL,
        { temperature: 0.3 },
      );

      streamProcessor.finalize();
      raw =
        streamProcessor.getResult().currentResponse ||
        streamProcessor.getResult().fullResponse ||
        '';
    } else {
      raw = await ollama.chat(messages, DOCUMENT_EXTRACTOR_MODEL, {
        temperature: 0.3,
      });
    }

    let response = enforceModeContract(RESPONSE_MODES.DOCUMENT, raw, {
      allowRefusal: !(hasBriefing || hasAttachedDocument || isFollowUp),
      attachedDocument: hasDocumentSignal,
    });

    const needsFallback =
      hasDocumentSignal &&
      (!response.trim() || isInsufficientSignalRefusal(response));

    if (needsFallback) {
      console.warn(
        `[DOCUMENT ANALYSIS] Fallback document-aware (raw=${String(raw || '').length}, streamed=${streamedVisible.length})`,
      );
      response = buildAttachedDocumentFallback(contextBlock, query, fileName);
      response = enforceModeContract(RESPONSE_MODES.DOCUMENT, response, {
        allowRefusal: false,
        attachedDocument: true,
      });
      if (onContent && !streamedVisible.trim()) {
        emitTextChunks(response, onContent);
      }
    }

    if (!response.trim()) {
      throw new Error('DOCUMENT_ANALYSIS_EMPTY_AFTER_FALLBACK');
    }

    console.log(
      `[DOCUMENT ANALYSIS] Terminé — attached=${Boolean(hasBriefing || hasAttachedDocument)} streamed=${Boolean(onContent)} chars=${response.length} refusal=${response === INSUFFICIENT_SIGNAL_REFUSAL}`,
    );

    return {
      result: response,
      metadata: {
        mode: 'DOCUMENT',
        steps: 1,
        hasAttachedDocument: Boolean(hasDocumentSignal),
        followUpKind: followUpKind || null,
        usedFallback: needsFallback,
        streamed: Boolean(onContent),
        webProbeExecuted: Boolean(hasWebProbe),
        webCompareMode: Boolean(hasWebProbe || context?.webCompareMode),
      },
    };
  } catch (error) {
    console.error('[DOCUMENT ANALYSIS] Échec:', error.message);
    throw new Error(`DOCUMENT_ANALYSIS_FAILED: ${error.message}`);
  }
}

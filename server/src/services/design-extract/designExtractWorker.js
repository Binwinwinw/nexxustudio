/**
 * Worker Design Extract — pipeline structuré (fetch → analyse → merge hybrid → envelope).
 */
import {
  validateDesignExtractInput,
  buildDesignExtractEnvelope,
} from './designExtractContract.js';
import { validateDesignExtractEgress } from './designExtractPolicy.js';
import fetchDesignExtractHtml from './designExtractFetcher.js';
import {
  analyzeDesignHtml,
  buildReproductionPrompt,
} from './designExtractAnalyzer.js';
import { packDesignExtractV2 } from './designExtractTokenPack.js';
import { evaluateDesignExtractQualityGate } from './designExtractQualityGate.js';
import {
  mergeHybridExtract,
  validateHybridBrowserSignal,
} from './designExtractStyleMerge.js';
import { writeDesignExtractArtifacts } from './designExtractArtifacts.js';
import runBrowserObserveWorker from '../browser-harness/browserHarnessWorker.js';

export const DESIGN_EXTRACT_STEPS = [
  'design.extract.validate',
  'design.extract.browser',
  'design.extract.fetch',
  'design.extract.analyze',
  'design.extract.cluster',
  'design.extract.pack',
];

/**
 * @param {object} options
 */
export async function runDesignExtractWorker(options = {}) {
  const {
    url = null,
    htmlSnapshot = null,
    query = '',
    egressPolicy = 'local-only',
    extractionMode = 'static',
    viewport = null,
    outputDir = null,
    traceId = null,
    onStep,
    fetchHtml = fetchDesignExtractHtml,
    browserObserveRunner = runBrowserObserveWorker,
    browserObservation = null,
    browserLauncher = undefined,
  } = options;

  const emit = (step, status, extra = {}) => {
    onStep?.({
      step,
      status,
      trace_id: traceId,
      ...extra,
    });
  };

  emit('design.extract.validate', 'running');

  const inputCheck = validateDesignExtractInput({
    url,
    htmlSnapshot,
    query,
    egressPolicy,
    extractionMode,
  });

  if (!inputCheck.ok) {
    emit('design.extract.validate', 'error', { violations: inputCheck.violations });
    return {
      ok: false,
      trace_id: traceId,
      violations: inputCheck.violations,
    };
  }

  const isHybrid = extractionMode === 'hybrid' || extractionMode === 'rendered';
  let resolvedUrl = url;
  let html = htmlSnapshot;
  let fetchedAt = new Date().toISOString();
  let browserSessionId = null;
  let resolvedViewport = viewport;

  if (isHybrid) {
    emit('design.extract.browser', 'running');

    let observationPayload = browserObservation;

    if (!observationPayload) {
      const browserResult = await browserObserveRunner({
        url: resolvedUrl,
        egressPolicy,
        viewport,
        traceId,
        browserLauncher,
        onStep: (entry) =>
          emit(entry.step || 'design.extract.browser', entry.status || 'info', entry),
      });

      if (!browserResult.ok) {
        emit('design.extract.browser', 'error', {
          code: browserResult.refusal?.code || 'HYBRID_OBSERVE_FAILED',
        });
        return {
          ok: false,
          trace_id: traceId,
          refusal: browserResult.refusal || {
            code: 'HYBRID_OBSERVE_FAILED',
            message: 'Observation browser échouée en mode hybrid.',
          },
        };
      }

      const observed = browserResult.observation || browserResult.envelope || {};
      observationPayload = {
        computed_styles: observed.computed_styles || [],
        style_summary: observed.style_summary || {},
        uncertainties: observed.uncertainties || [],
        browser_session_id: browserResult.browser_session_id,
        html: observed.html || null,
        viewport: observed.viewport || browserResult.envelope?.source?.viewport || viewport,
      };
    }

    const signalCheck = validateHybridBrowserSignal(observationPayload);
    if (!signalCheck.ok) {
      emit('design.extract.browser', 'error', { blockers: signalCheck.blockers });
      return {
        ok: false,
        trace_id: traceId,
        refusal: signalCheck.blockers[0],
      };
    }

    browserSessionId = observationPayload.browser_session_id || null;
    resolvedViewport = observationPayload.viewport || viewport;
    options._browserObservation = observationPayload;

    emit('design.extract.browser', 'ok', {
      browser_session_id: browserSessionId,
      samples_count: observationPayload.style_summary?.samples_count,
    });
  }

  if (!html && extractionMode === 'rendered' && options._browserObservation?.html) {
    html = options._browserObservation.html;
    emit('design.extract.fetch', 'ok', { source: 'browser_snapshot' });
  } else if (!html) {
    const egress = validateDesignExtractEgress(resolvedUrl, egressPolicy);
    if (!egress.ok) {
      emit('design.extract.validate', 'error', egress);
      return { ok: false, trace_id: traceId, refusal: egress };
    }
    resolvedUrl = egress.url;

    emit('design.extract.fetch', 'running');
    try {
      const fetched = await fetchHtml(resolvedUrl);
      html = fetched.html;
      fetchedAt = fetched.fetched_at;
      emit('design.extract.fetch', 'ok', { bytes: html.length });
    } catch (error) {
      emit('design.extract.fetch', 'error', { message: error.message });
      return {
        ok: false,
        trace_id: traceId,
        refusal: { code: 'FETCH_FAILED', message: error.message },
      };
    }
  } else {
    emit('design.extract.fetch', 'ok', { source: 'inline_snapshot' });
  }

  emit('design.extract.analyze', 'running');
  const rawAnalysis = analyzeDesignHtml(html, resolvedUrl);
  emit('design.extract.analyze', 'ok', { signals: rawAnalysis.signals });

  emit('design.extract.cluster', 'running');
  const staticPacked = packDesignExtractV2(rawAnalysis);

  let packed = staticPacked;
  let uncertainties = [...(rawAnalysis.uncertainties || [])];

  if (isHybrid && options._browserObservation) {
    const merged = mergeHybridExtract({
      staticAnalysis: rawAnalysis,
      staticPacked,
      browserObservation: options._browserObservation,
    });

    if (!merged.ok) {
      emit('design.extract.cluster', 'error', { refusal: merged.refusal });
      return {
        ok: false,
        trace_id: traceId,
        refusal: merged.refusal,
      };
    }

    packed = {
      tokens: merged.tokens,
      layout_signatures: merged.layout_signatures,
      signals: merged.signals,
    };
    uncertainties = merged.uncertainties;
    browserSessionId = merged.browser_session_id || browserSessionId;
  }

  const analysis = {
    ...rawAnalysis,
    tokens: packed.tokens,
    layout_signatures: packed.layout_signatures,
    signals: packed.signals,
    uncertainties,
  };

  const finalPrompt = buildReproductionPrompt(analysis);
  const quality_gate = evaluateDesignExtractQualityGate({
    tokens: packed.tokens,
    layout_signatures: packed.layout_signatures,
    reproduction_prompt: finalPrompt,
    patterns: rawAnalysis.patterns,
  });

  emit('design.extract.cluster', 'ok', {
    palette: packed.tokens.colors.distinct_count,
    quality_score: quality_gate.score,
    extraction_mode: extractionMode,
  });

  if (quality_gate.blockers.some((entry) => entry.code === 'INSUFFICIENT_PALETTE')) {
    emit('design.extract.cluster', 'error', { blockers: quality_gate.blockers });
    return {
      ok: false,
      trace_id: traceId,
      refusal: {
        code: 'INSUFFICIENT_PALETTE',
        message: quality_gate.blockers[0].message,
      },
    };
  }

  emit('design.extract.pack', 'running');
  const envelope = buildDesignExtractEnvelope({
    url: resolvedUrl,
    fetched_at: fetchedAt,
    extraction_mode: extractionMode,
    viewport: resolvedViewport,
    browser_session_id: browserSessionId,
    dna_dossier: analysis.dna_dossier,
    tokens: packed.tokens,
    layout_signatures: packed.layout_signatures,
    patterns: analysis.patterns,
    reproduction_prompt: finalPrompt,
    signals: packed.signals,
    uncertainties,
    quality_gate,
  });

  let artifacts = null;
  if (outputDir) {
    artifacts = await writeDesignExtractArtifacts(outputDir, envelope);
  }

  emit('design.extract.pack', 'ok');

  return {
    ok: true,
    trace_id: traceId,
    envelope,
    artifacts,
    query,
  };
}

export default runDesignExtractWorker;

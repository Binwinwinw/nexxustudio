import { getClientForModel } from "../../llm/llmFactory.js";
import { AGENT_ROLES } from "../policies/agentRolePolicy.js";
import OllamaStreamProcessor from "../utils/ollamaStreamProcessor.js";
import responseThinkingCleaner from "../utils/responseThinkingCleaner.js";
import {
  getComposerSystemPrompt,
  enforceComposerContract,
  resolveComposerContractMode,
  INSUFFICIENT_SIGNAL_REFUSAL,
  RESPONSE_MODES,
  shouldApplyOpenPropositionContract,
} from "../config/modeResponseContracts.js";
import { getComposerObservabilityContext } from "../config/intentContractRegistry.js";
import conversationHealth from "../telemetry/conversationHealth.js";
import { recordComposerTelemetry } from "../telemetry/telemetryObservabilityBridge.js";
import {
  validateRendererWithMakersChecker,
} from "../verification/makersCheckerBridge.js";
import { resolvePipelineFallback } from "../utils/genericGreetingGuards.js";
import { isCodeReviewRequest } from "../policies/codeReviewPolicy.js";
import {
  applyCodeReviewRuntimeGuard,
  evaluateCodeReviewRuntime,
  MAX_CODE_REVIEW_RUNTIME_RETRIES,
} from "../policies/codeReviewRuntimeGuard.js";
import {
  enforceFileContextGuard,
  shouldApplyFileContextGuard,
} from "../policies/guards/index.js";
import {
  requiresDirectArbitrationContract,
  buildDirectArbitrationUserPrompt,
  isDirectArbitrationContractViolation,
} from "../micro/replies/directArbitrationComposerContract.js";
import {
  requiresGeneralKnowledgeComposerContract,
  buildGeneralKnowledgeUserPrompt,
  isGeneralKnowledgeContractViolation,
} from "../micro/replies/generalKnowledgeComposerContract.js";
import {
  requiresKnowledgeFreshnessComposerContract,
  buildKnowledgeFreshnessUserAddon,
} from "../micro/replies/knowledgeFreshnessComposerContract.js";
import {
  requiresCompareChooseComposerContract,
  buildCompareChooseSystemAddon,
  buildGuidedProductComposerUserPrompt,
  isCompareChooseContractViolation,
} from "../micro/replies/compareChooseComposer.js";
import {
  requiresResearchThenSummarizeComposerContract,
  buildResearchThenSummarizeComposerUserPrompt,
  isResearchThenSummarizeContractViolation,
} from "../micro/replies/researchThenSummarizeComposer.js";
import {
  requiresRepoAnalysisComposerContract,
  buildRepoAnalysisComposerUserPrompt,
  isRepoAnalysisContractViolation,
} from "../micro/replies/repoAnalysisComposer.js";
import { getRepoAnalysisSystemPrompt } from "../analysis/repoAnalysisContract.js";
import { buildProductSourcesInsufficientReply } from "../policies/productRecoValidator.js";
import { wasWebSearchAttempted } from "../policies/explicitWebSearchRequestPolicy.js";
import { ensureExplicitWebSourceLinks } from "../policies/webEvidenceFidelityValidator.js";
import {
  isCodeGenerationRequest,
} from "../policies/codeDeliveryPolicy.js";
import { isCodeProjectLightRequest } from "../policies/codeProjectLightPolicy.js";
import { runContractQualityLoop } from "../quality/contractQualityLoop.js";
import { frontPresentationQualityPolicy } from "../quality/policies/frontPresentationQualityPolicy.js";
import { htmlWorkshopQualityPolicy } from "../quality/policies/htmlWorkshopQualityPolicy.js";
import { isHtmlWorkshopDeliverable } from "../policies/htmlWorkshopDeliveryContract.js";
import {
  buildConstructiveDeliveryFallback,
  buildConstructiveDeliveryUserPrompt,
  isClearConstructiveDeliverable,
  isCodeDeliveryContractViolation,
} from "../policies/constructiveDeliveryPolicy.js";
import {
  buildHtmlProjectUserAddon,
  evaluateHtmlProjectDelivery,
} from "../policies/htmlProjectDeliveryPolicy.js";
import { recordHtmlProjectComposerOutcome } from "../telemetry/htmlProjectDeliveryTelemetry.js";
import { sanitizeUnverifiedToolExecutionClaims } from "../utils/toolExecutionClaimGuard.js";

// ── Composer principal ───────────────────────────────────────────────────────
export const finalRendererAgent = {
  /**
   * Compose la réponse finale depuis un OrchestratorPacket.
   * Streame les tokens propres via onContent si fourni.
   */
  async compose(packet, onContent = null) {
    const composerStartedAt = Date.now();
    const composerContext = this._resolveComposerContext(packet);
    const { options: composerOptions, observability } = composerContext;

    if (packet?.meta?.product_sources_insufficient) {
      const fallback = buildProductSourcesInsufficientReply(
        packet.user_query || "",
        packet.meta.product_reco_source_relevance || {
          reason: packet.meta.product_sources_insufficient_reason,
        },
      );
      this._logComposerPath(observability, "product_sources_insufficient", {
        reason: packet.meta.product_sources_insufficient_reason || "?",
      });
      if (onContent) onContent(fallback);
      await recordComposerTelemetry({
        outcome: "success",
        skillId: observability.intentContractId || null,
        latencyMs: Date.now() - composerStartedAt,
        responseLength: fallback.length,
        path: "product_sources_insufficient",
      });
      return fallback;
    }

    if (
      packet?.meta?.intent_contract_id === "VISION_ATTACHED" &&
      packet?.meta?.ocr_fallback_text
    ) {
      const body = String(packet.meta.ocr_fallback_text).trim();
      const intro =
        "Transcription / texte extrait de l'image (service OCR interne) :\n\n";
      const fallback = `${intro}${body}`;
      this._logComposerPath(observability, "vision_ocr_fallback", {
        backend: packet.meta.ocr_fallback_backend || "ocr-service",
      });
      if (onContent) onContent(fallback);
      await recordComposerTelemetry({
        outcome: "success",
        skillId: observability.intentContractId || null,
        latencyMs: Date.now() - composerStartedAt,
        responseLength: fallback.length,
        path: "vision_ocr_fallback",
      });
      return fallback;
    }

    if (
      packet?.meta?.intent_contract_id === "VISION_ATTACHED" &&
      packet?.meta?.vision_failed
    ) {
      const { buildVisionInfrastructureFailureReply } = await import(
        "../capabilities/ocr/ocrVisionFallback.js"
      );
      const fallback = buildVisionInfrastructureFailureReply();
      this._logComposerPath(observability, "vision_infra_failure", {});
      if (onContent) onContent(fallback);
      await recordComposerTelemetry({
        outcome: "success",
        skillId: observability.intentContractId || null,
        latencyMs: Date.now() - composerStartedAt,
        responseLength: fallback.length,
        path: "vision_infra_failure",
      });
      return fallback;
    }

    this._logComposerPath(observability, "llm_start");

    try {
      const model = AGENT_ROLES.CHAT || "ornith:9b";
      const client = getClientForModel(model);
      let systemPrompt = getComposerSystemPrompt(packet, composerOptions);
      if (composerOptions.repoAnalysis) {
        systemPrompt = `${getRepoAnalysisSystemPrompt()}\n\n${systemPrompt}`;
      }
      if (composerOptions.compareChoose) {
        systemPrompt += `\n\n${buildCompareChooseSystemAddon(packet.user_query || "")}`;
        systemPrompt += `\n\nVARIANTE RECOMMANDATION PRODUIT :
- L'objectif est déjà dans la requête — ne demande pas de reformulation ni d'objectif en une phrase.
- INTERDIT : clarify-first quand le critère (qualité/prix, modèles) est déjà posé.`;
      }

      const numPredict = composerOptions.openProposition
        ? 420
        : composerOptions.knownEntitySummary
          ? 240
        : composerOptions.generalKnowledge ||
            composerOptions.directArbitration ||
            composerOptions.knowledgeFreshness ||
            composerOptions.compareChoose ||
            composerOptions.researchThenSummarize ||
            composerOptions.repoAnalysis ||
            composerOptions.codeDelivery
          ? 4000
          : composerOptions.forceShort
            ? 400
            : packet.mode === "EPISTEMIC"
              ? 1200
              : 600;

      const userPrompt = this._buildComposerUserPrompt(packet, composerOptions);

      let rendered = "";
      const isBuffered = this._requiresBufferedFinalDelivery(packet, composerOptions);
      const activeOnContent = isBuffered ? null : onContent;

      if (activeOnContent) {
        console.log("[FinalResponseComposer] Starting stream mode...");
        const streamProcessor = new OllamaStreamProcessor({
          onChunk: (chunk) => {
            rendered += chunk;
            activeOnContent(chunk);
          },
        });

        await client.chatStream(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          (token) => {
            streamProcessor.processToken(token);
          },
          model,
          { temperature: 0.0, num_predict: numPredict },
        );

        console.log("[FinalResponseComposer] Stream finished, finalizing...");
        streamProcessor.finalize();
        rendered = streamProcessor.getResult().currentResponse;
        rendered = responseThinkingCleaner.clean(String(rendered || "")).trim();
        console.log(
          `[FinalResponseComposer] Finalized. Current response length: ${rendered.length}`,
        );
      } else {
        const responseText = await client.chat(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model,
          { temperature: 0.0, num_predict: numPredict },
        );

        rendered = responseThinkingCleaner.clean(String(responseText || "")).trim();
      }

      const webGrounded = this._hasUsableWebGrounding(packet);
      let enforced = enforceComposerContract(packet, rendered, composerOptions, {
        allowRefusal:
          !webGrounded &&
          !composerOptions.directArbitration &&
          !composerOptions.generalKnowledge &&
          !composerOptions.knownEntitySummary &&
          !composerOptions.compareChoose &&
          !composerOptions.researchThenSummarize &&
          !composerOptions.repoAnalysis &&
          !composerOptions.codeDelivery,
        codeDelivery: composerOptions.codeDelivery,
      });
      enforced = sanitizeUnverifiedToolExecutionClaims(
        enforced,
        packet?.meta?.tools_used || [],
      );
      if (
        composerOptions.generalKnowledge &&
        isGeneralKnowledgeContractViolation(packet.user_query || "", enforced)
      ) {
        const retryRaw = await client.chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPrompt}\n\nRELANCE : réponse culture générale complète et humaine. Pas de menu d'options.`,
            },
          ],
          model,
          { temperature: 0.0, num_predict: numPredict },
        );
        enforced = enforceComposerContract(
          packet,
          responseThinkingCleaner.clean(String(retryRaw || "")).trim(),
          composerOptions,
          { allowRefusal: false },
        );
        enforced = sanitizeUnverifiedToolExecutionClaims(
          enforced,
          packet?.meta?.tools_used || [],
        );
        if (activeOnContent) activeOnContent(`\n\n${enforced}`);
      } else if (
        composerOptions.directArbitration &&
        isDirectArbitrationContractViolation(packet.user_query || "", enforced)
      ) {
        const retryRaw = await client.chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPrompt}\n\nRELANCE : tranche directement selon le critère. Pas de clarify-first, pas de refus, pas de promesse d'outil.`,
            },
          ],
          model,
          { temperature: 0.0, num_predict: numPredict },
        );
        enforced = enforceComposerContract(
          packet,
          responseThinkingCleaner.clean(String(retryRaw || "")).trim(),
          composerOptions,
          { allowRefusal: false },
        );
        enforced = sanitizeUnverifiedToolExecutionClaims(
          enforced,
          packet?.meta?.tools_used || [],
        );
        if (activeOnContent) activeOnContent(`\n\n${enforced}`);
      } else if (
        composerOptions.compareChoose &&
        isCompareChooseContractViolation(enforced)
      ) {
        const retryRaw = await client.chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPrompt}\n\nRELANCE : propose au moins 3 modèles avec rapport qualité/prix. Pas de clarify-first, pas de refus, pas de demande d'objectif.`,
            },
          ],
          model,
          { temperature: 0.0, num_predict: numPredict },
        );
        enforced = enforceComposerContract(
          packet,
          responseThinkingCleaner.clean(String(retryRaw || "")).trim(),
          composerOptions,
          { allowRefusal: false },
        );
        enforced = sanitizeUnverifiedToolExecutionClaims(
          enforced,
          packet?.meta?.tools_used || [],
        );
        if (activeOnContent) activeOnContent(`\n\n${enforced}`);
      } else if (
        composerOptions.researchThenSummarize &&
        isResearchThenSummarizeContractViolation(enforced)
      ) {
        const retryRaw = await client.chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPrompt}\n\nRELANCE : synthétise utilité et conception à partir du contexte web. INTERDIT : « je n'ai pas trouvé » si des sources sont présentes.`,
            },
          ],
          model,
          { temperature: 0.0, num_predict: numPredict },
        );
        enforced = enforceComposerContract(
          packet,
          responseThinkingCleaner.clean(String(retryRaw || "")).trim(),
          composerOptions,
          { allowRefusal: false },
        );
        enforced = sanitizeUnverifiedToolExecutionClaims(
          enforced,
          packet?.meta?.tools_used || [],
        );
        if (activeOnContent) activeOnContent(`\n\n${enforced}`);
      } else if (
        composerOptions.repoAnalysis &&
        isRepoAnalysisContractViolation(enforced)
      ) {
        const retryRaw = await client.chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPrompt}\n\nRELANCE CONTRAT REPO_ANALYSIS_V1 : fournis langages (preuves), structure, ≥3 forces, ≥5 risques, tests, docs, ≥2 inconnues, ≥3 actions. Interdit réponse sociale / README-only.`,
            },
          ],
          model,
          { temperature: 0.0, num_predict: numPredict },
        );
        enforced = enforceComposerContract(
          packet,
          responseThinkingCleaner.clean(String(retryRaw || "")).trim(),
          composerOptions,
          { allowRefusal: false },
        );
        enforced = sanitizeUnverifiedToolExecutionClaims(
          enforced,
          packet?.meta?.tools_used || [],
        );
        if (activeOnContent) activeOnContent(`\n\n${enforced}`);
      } else if (
        composerOptions.codeDelivery &&
        isCodeDeliveryContractViolation(packet.user_query || "", enforced)
      ) {
        const queryForDelivery = packet.user_query || "";

        if (isHtmlWorkshopDeliverable(queryForDelivery)) {
          const workshopOutcome = await runContractQualityLoop(
            htmlWorkshopQualityPolicy,
            enforced,
            {
              query: queryForDelivery,
              packet,
              systemPrompt,
              userPrompt,
              generateOptions: {
                temperature: 0.0,
                num_predict: numPredict,
              },
              generate: async (messages, opts) => {
                const raw = await client.chat(messages, model, opts || {});
                return responseThinkingCleaner.clean(String(raw || "")).trim();
              },
              enforce: (text) => {
                const enforcedRepair = enforceComposerContract(packet, text, composerOptions, {
                  allowRefusal: false,
                  codeDelivery: true,
                });
                return sanitizeUnverifiedToolExecutionClaims(
                  enforcedRepair,
                  packet?.meta?.tools_used || [],
                );
              },
              telemetrySink: (event) => {
                console.log(
                  `[FinalResponseComposer] ${event.policyId} stop=${event.stopReason} score=${event.score} repairs=${event.repairUsed}`,
                );
              },
            },
          );

          enforced = workshopOutcome.text;
          let usedFallback = workshopOutcome.finalQuality.quality === "fail";
          if (usedFallback) {
            enforced = buildConstructiveDeliveryFallback(queryForDelivery);
          }

          packet.meta = packet.meta || {};
          packet.meta.html_workshop_quality = {
            ...workshopOutcome.finalQuality,
            repairUsed: workshopOutcome.repairAttempts > 0,
            scoreBeforeRepair: workshopOutcome.initialQuality.score,
            stopReason: workshopOutcome.stopReason,
            repairExhausted: workshopOutcome.repairExhausted,
            fallbackUsed: usedFallback,
          };

          recordHtmlProjectComposerOutcome(queryForDelivery, enforced, {
            retryUsed: workshopOutcome.repairAttempts > 0,
            fallbackUsed: usedFallback,
            composerPath: usedFallback
              ? "composer_retry_fallback"
              : workshopOutcome.repairAttempts > 0
                ? "composer_retry"
                : "composer",
          });
          if (activeOnContent) activeOnContent(`\n\n${enforced}`);
        } else {
          const retryRaw = await client.chat(
            [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `${userPrompt}\n\n${buildHtmlProjectUserAddon(packet.user_query || "")}\n\nRELANCE CRITIQUE — PROJET HTML V1 (${evaluateHtmlProjectDelivery(packet.user_query || "").profile || "html_generic"}) :
- INTERDIT : refus défensif, footer © 2023, maquette vide.
- OBLIGATOIRE : « Oui, je peux… » puis livrable adapté au profil (atelier / landing / dashboard / template / page info) — HTML autonome dans \`\`\`html si construction directe.
- Respecte la structure demandée ; défauts intelligents pour tout détail manquant.
- Atelier seulement si demandé : vraie sidebar <aside> ; landing : hero + sections sans sidebar forcée.`,
              },
            ],
            model,
            { temperature: 0.0, num_predict: numPredict },
          );
          enforced = enforceComposerContract(
            packet,
            responseThinkingCleaner.clean(String(retryRaw || "")).trim(),
            composerOptions,
            { allowRefusal: false, codeDelivery: true },
          );
          enforced = sanitizeUnverifiedToolExecutionClaims(
            enforced,
            packet?.meta?.tools_used || [],
          );
          const usedFallback = isCodeDeliveryContractViolation(queryForDelivery, enforced);
          if (usedFallback) {
            enforced = buildConstructiveDeliveryFallback(queryForDelivery);
          }
          recordHtmlProjectComposerOutcome(queryForDelivery, enforced, {
            retryUsed: true,
            fallbackUsed: usedFallback,
            composerPath: usedFallback ? "composer_retry_fallback" : "composer_retry",
          });
          if (activeOnContent) activeOnContent(`\n\n${enforced}`);
        }
      }

      if (isCodeProjectLightRequest(packet.user_query || "")) {
        const qualityOutcome = await runContractQualityLoop(
          frontPresentationQualityPolicy,
          enforced,
          {
            query: packet.user_query || "",
            packet,
            systemPrompt,
            userPrompt,
            generateOptions: {
              temperature: 0.15,
              num_predict: Math.max(numPredict, 4096),
            },
            generate: async (messages, opts) => {
              const raw = await client.chat(messages, model, opts || {});
              return responseThinkingCleaner.clean(String(raw || "")).trim();
            },
            enforce: (text) => {
              const enforcedRepair = enforceComposerContract(packet, text, composerOptions, {
                allowRefusal: false,
                codeDelivery: true,
              });
              return sanitizeUnverifiedToolExecutionClaims(
                enforcedRepair,
                packet?.meta?.tools_used || [],
              );
            },
            telemetrySink: (event) => {
              console.log(
                `[FinalResponseComposer] ${event.policyId} stop=${event.stopReason} score=${event.score} repairs=${event.repairUsed} blocked=${event.blocked}`,
              );
            },
          },
        );

        if (qualityOutcome.initialQuality.quality === "fail") {
          console.warn(
            `[FinalResponseComposer] FRONT_PRESENTATION_V1 fail score=${qualityOutcome.initialQuality.score} — repair×${frontPresentationQualityPolicy.maxRepairs}`,
          );
        }

        packet.meta = packet.meta || {};
        packet.meta.front_presentation_quality = {
          ...qualityOutcome.finalQuality,
          repairUsed: qualityOutcome.repairAttempts > 0,
          scoreBeforeRepair: qualityOutcome.initialQuality.score,
          stopReason: qualityOutcome.stopReason,
          repairExhausted: qualityOutcome.repairExhausted,
          blocked: qualityOutcome.blocked,
        };

        if (qualityOutcome.text && qualityOutcome.text !== enforced) {
          enforced = qualityOutcome.text;
          if (activeOnContent) activeOnContent(`\n\n${enforced}`);
        }

        if (qualityOutcome.repairAttempts > 0) {
          console.log(
            `[FinalResponseComposer] FRONT_PRESENTATION_V1 after repair score=${qualityOutcome.finalQuality.score} quality=${qualityOutcome.finalQuality.quality} stop=${qualityOutcome.stopReason}`,
          );
        }
      }

      this._warnModeMismatch(observability, composerOptions, packet);

      const makersGate = await this._applyMakersCheckerGate(
        packet,
        enforced,
        composerOptions,
        observability,
        composerStartedAt,
      );

      if (makersGate.blocked) {
        return makersGate.text;
      }

      const postValidationText = makersGate.text ?? enforced;

      if (postValidationText && postValidationText !== INSUFFICIENT_SIGNAL_REFUSAL) {
        const reviewGuardedText = await this._applyCodeReviewRuntimeGuard(packet, postValidationText, {
          client,
          model,
          systemPrompt,
          userPrompt,
          numPredict,
          onContent: activeOnContent,
          composerOptions,
        });

        const guardedText = this._applyFileContextGuard(packet, reviewGuardedText, {
          onContent: activeOnContent,
        });

        this._logComposerPath(observability, "primary", {
          chars: guardedText.length,
          makersChecker: makersGate.validation?.outcome || "skipped",
        });
        await recordComposerTelemetry({
          outcome: "success",
          skillId: observability.intentContractId || null,
          latencyMs: Date.now() - composerStartedAt,
          responseLength: guardedText.length,
          path: "primary",
        });
        if (composerOptions.codeDelivery) {
          recordHtmlProjectComposerOutcome(packet.user_query || "", guardedText, {
            composerPath: "composer_primary",
          });
        }
        return this._emitWithExplicitWebSourceLinks(
          packet,
          guardedText,
          activeOnContent,
        );
      }

      if (
        enforced === INSUFFICIENT_SIGNAL_REFUSAL &&
        (rendered.trim() || composerOptions.openProposition || webGrounded)
      ) {
        return this._applyContractFallback(
          packet,
          composerContext,
          composerOptions,
          webGrounded ? "web_grounded_llm_refusal" : "llm_refusal",
        );
      }

      if ((composerOptions.openProposition || webGrounded) && !enforced) {
        return this._applyContractFallback(
          packet,
          composerContext,
          composerOptions,
          webGrounded ? "web_grounded_llm_empty" : "llm_empty",
        );
      }

      const genericFallback = this._fallback(packet);
      if (genericFallback) {
        this._logComposerPath(observability, "fallback", { reason: "expert_or_quick_answer" });
      }
      let finalText = enforced || genericFallback;
      // Preuves web présentes : ne jamais livrer le refus « piste / destination ».
      if (
        webGrounded &&
        (finalText === INSUFFICIENT_SIGNAL_REFUSAL || !String(finalText || "").trim()) &&
        genericFallback
      ) {
        finalText = enforceComposerContract(packet, genericFallback, composerOptions, {
          allowRefusal: false,
        });
        this._logComposerPath(observability, "web_grounded_refusal_replaced", {});
      }
      if (
        composerOptions.compareChoose &&
        (finalText === INSUFFICIENT_SIGNAL_REFUSAL ||
          isCompareChooseContractViolation(finalText))
      ) {
        finalText = buildProductSourcesInsufficientReply(
          packet.user_query || "",
          packet.meta?.product_reco_source_relevance || {},
        );
        this._logComposerPath(observability, "product_reco_refusal_replaced", {});
      }
      await recordComposerTelemetry({
        outcome: "success",
        skillId: observability.intentContractId || null,
        latencyMs: Date.now() - composerStartedAt,
        responseLength: String(finalText || "").length,
        path: genericFallback ? "fallback" : "primary",
      });
      return this._emitWithExplicitWebSourceLinks(
        packet,
        finalText,
        onContent,
      );
    } catch (err) {
      console.error(
        "[FinalResponseComposer] Erreur LLM ou compose :",
        err.message,
      );
      await recordComposerTelemetry({
        outcome: "error",
        skillId: observability.intentContractId || null,
        latencyMs: Date.now() - composerStartedAt,
        error: err,
        path: "llm_error",
      });
      if (composerOptions.openProposition) {
        return this._applyContractFallback(
          packet,
          composerContext,
          composerOptions,
          "llm_error",
        );
      }
      this._logComposerPath(observability, "fallback", { reason: "llm_error" });
      return enforceComposerContract(
        packet,
        this._fallback(packet),
        composerOptions,
        { allowRefusal: false },
      );
    }
  },

  /**
   * Méthode legacy — compatibilité avec le runPipeline.js existant.
   */
  async render(queryEnvelope, rawAnswerData, sourceType = "verified_pipeline") {
    const packet = {
      user_intent: "unknown",
      user_query: queryEnvelope?.user_query || "",
      mode: sourceType === "quick_answer" ? "OPERATIONAL" : "EPISTEMIC",
      expert_outputs: [
        {
          stage: "legacy",
          content: rawAnswerData.response_text || rawAnswerData.answer || "",
        },
      ],
      evidence: [],
      vision_briefing: null,
      risk_level: "low",
      budget: {
        total_budget_ms: 0,
        elapsed_ms: 0,
        remaining_ms: 0,
        exhausted: false,
      },
    };

    const text = await this.compose(packet, null);
    return { rendered_text: text, tone: "direct" };
  },

  _resolveComposerContext(packet) {
    const observability = getComposerObservabilityContext(packet);
    const options = this._resolveComposerOptions(packet, observability);
    return { observability, options };
  },

  _resolveComposerOptions(packet, observability = null) {
    const obs =
      observability || getComposerObservabilityContext(packet);
    const expectedMode = obs.expectedResponseMode;

    const isSocial =
      packet.user_intent === "social" ||
      packet.user_intent === "social_chit_chat";
    const forceShort =
      expectedMode === RESPONSE_MODES.SIMPLE_FAST ||
      this.shouldForceShortResponse(packet);
    const openProposition =
      expectedMode === RESPONSE_MODES.OPEN_PROPOSITION ||
      shouldApplyOpenPropositionContract(packet);
    const useFactualPrompt =
      !isSocial &&
      !forceShort &&
      !openProposition &&
      (expectedMode === RESPONSE_MODES.DOCUMENT ||
        expectedMode === RESPONSE_MODES.CRITICAL ||
        packet.mode === "EPISTEMIC");

    const directArbitration = requiresDirectArbitrationContract(packet.user_query || "");
    const knownEntitySummary =
      packet?.meta?.summary_contract_id === "DIRECT_SUMMARY" ||
      packet?.meta?.summary_contract_intent === "summary/known_entity";
    const generalKnowledge =
      requiresGeneralKnowledgeComposerContract(packet.user_query || "") &&
      !directArbitration &&
      !knownEntitySummary;
    const knowledgeFreshness = requiresKnowledgeFreshnessComposerContract(
      packet.user_query || "",
      packet,
    );
    const compareChoose = requiresCompareChooseComposerContract(
      packet.user_query || "",
      packet,
    );
    const researchThenSummarize = requiresResearchThenSummarizeComposerContract(
      packet.user_query || "",
      packet,
    );
    const repoAnalysis = requiresRepoAnalysisComposerContract(
      packet.user_query || "",
      packet,
    );
    const codeDelivery =
      isCodeProjectLightRequest(packet.user_query || "") ||
      isCodeGenerationRequest(packet.user_query || "") ||
      isClearConstructiveDeliverable(packet.user_query || "");

    return {
      forceShort: forceShort && !generalKnowledge && !knowledgeFreshness && !codeDelivery && !compareChoose && !researchThenSummarize && !repoAnalysis,
      isSocial,
      useFactual: useFactualPrompt || generalKnowledge || researchThenSummarize || repoAnalysis,
      openProposition,
      directArbitration,
      generalKnowledge,
      knownEntitySummary,
      knowledgeFreshness,
      compareChoose,
      researchThenSummarize,
      repoAnalysis,
      codeDelivery,
    };
  },

  _warnModeMismatch(observability, composerOptions, packet) {
    const resolved = resolveComposerContractMode(packet, composerOptions);
    const expected = observability.expectedResponseMode;
    if (
      expected &&
      resolved !== expected &&
      expected !== RESPONSE_MODES.COMPOSER
    ) {
      console.warn(
        `[FinalResponseComposer] contract=${observability.intentContractId} mode_mismatch expected=${expected} resolved=${resolved}`,
      );
    }
  },

  _logComposerPath(observability, path, extra = {}) {
    const base = `[FinalResponseComposer] contract=${observability.intentContractId} mode=${observability.expectedResponseMode} path=${path}`;
    const suffix = Object.keys(extra).length
      ? ` ${Object.entries(extra)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`
      : "";
    if (path === "fallback") {
      console.warn(`${base}${suffix}`);
    } else {
      console.log(`${base}${suffix}`);
    }
  },

  _buildComposerUserPrompt(
    packet,
    {
      forceShort = false,
      openProposition = false,
      directArbitration = false,
      generalKnowledge = false,
      knowledgeFreshness = false,
      compareChoose = false,
      researchThenSummarize = false,
      repoAnalysis = false,
      codeDelivery = false,
    } = {},
  ) {
    const freshnessUserAddon = knowledgeFreshness
      ? buildKnowledgeFreshnessUserAddon(packet.user_query || "", packet)
      : "";

    if (compareChoose) {
      return buildGuidedProductComposerUserPrompt(packet, { freshnessUserAddon });
    }

    if (repoAnalysis) {
      return buildRepoAnalysisComposerUserPrompt(packet, {
        freshnessUserAddon,
      });
    }

    if (researchThenSummarize) {
      return buildResearchThenSummarizeComposerUserPrompt(packet, {
        freshnessUserAddon,
      });
    }

    const expertSynthesis = (packet.expert_outputs || [])
      .filter((o) => o.content && o.content.length > 10)
      .filter((o) => !openProposition || o.stage !== "web_research")
      .map((o) =>
        responseThinkingCleaner.clean(String(o.content || "")).trim(),
      )
      .join("\n\n")
      .slice(0, 6000);

    const visionBriefing = String(packet.vision_briefing || "").trim();
    const isVisionAttached =
      packet.meta?.intent_contract_id === "VISION_ATTACHED";

    if (isVisionAttached) {
      const visionBlock = visionBriefing || expertSynthesis;
      if (!visionBlock || packet.meta?.vision_failed) {
        return `Demande utilisateur :
"${packet.user_query || ""}"

CONTEXTE VISION :
${visionBlock || "(aucun briefing)"}

CONSIGNE :
L'analyse vision locale a échoué ou n'a rien produit. Dis-le clairement en français (échec technique / modèle / timeout) — INTERDIT de parler d'« accès restreint » ou d'incapacité permanente. Propose de réessayer ou de décrire l'image à la main.`;
      }
      return `Demande utilisateur :
"${packet.user_query || ""}"

BRIEFING VISUEL (source exclusive — déjà analysé par le pipeline) :
${visionBlock}

CONSIGNE CRITIQUE :
Décris DIRECTEMENT ce que montre le briefing. Tu as bien reçu une analyse d'image. Interdiction de dire que tu ne peux pas voir d'images. Français, concret, ancré au briefing.`;
    }

    if (generalKnowledge) {
      const base = buildGeneralKnowledgeUserPrompt(packet.user_query || "", {
        expertSynthesis,
        quickAnswer: packet.quick_answer,
      });
      return freshnessUserAddon ? `${base}\n\n${freshnessUserAddon}` : base;
    }

    if (directArbitration) {
      return buildDirectArbitrationUserPrompt(packet.user_query || "", {
        expertSynthesis,
        quickAnswer: packet.quick_answer,
      });
    }

    const isEpistemic = packet.mode === "EPISTEMIC";
    const lengthDirective = forceShort
      ? "RÉPONDS EN 1-3 PHRASES OU 2 PARAGRAPHES COURTS MAXIMUM. Zéro titre, zéro liste longue, zéro sous-section."
      : isEpistemic
        ? "Structure ta réponse si le sujet est complexe. Maximum 6 sections ou paragraphes."
        : "RÉPONDS EN 2-4 PARAGRAPHES MAXIMUM. Pas de titre de rapport, pas de plan en 5 points.";

    const hasSignal =
      Boolean(expertSynthesis?.trim()) || Boolean(packet.quick_answer?.trim());

    if (openProposition) {
      return `Demande utilisateur :
"${packet.user_query || ""}"

CONSIGNE CRITIQUE — PROPOSITION OUVERTE (pas de compilation web) :
- Ne liste AUCUN article, guide, URL ni source externe.
- Propose exactement 3 pistes de PROJET concret (nom + intérêt + premier pas simple).
- Maximum 120 mots. Termine par "Laquelle t'intéresse ?"
- Inspire-toi des capacités Citadelle (local-first, navigateur, RAG, Forge) si pertinent.`;
    }

    if (!hasSignal && codeDelivery) {
      return buildConstructiveDeliveryUserPrompt(packet.user_query || "");
    }

    if (!hasSignal) {
      return `CONSIGNE: Le contexte expert est vide ou insuffisant. Applique la policy de refus propre (signal insuffisant).`;
    }

    const base = `REQUÊTE UTILISATEUR ORIGINALE (Priorité absolue sur le ton et les micro-directives) :
"${packet.user_query || ""}"

SYNTHÈSE EXPERTE / CONTEXTE :
${expertSynthesis || packet.quick_answer}

CONSIGNE CRITIQUE :
Rédige DIRECTEMENT la réponse finale en français. Si la synthèse experte contredit le format demandé par l'utilisateur, la consigne utilisateur locale prime, sauf contrainte de sécurité. ${lengthDirective} Interdiction totale de plan/métapensée en anglais.`;
    return freshnessUserAddon ? `${base}\n\n${freshnessUserAddon}` : base;
  },

  shouldForceShortResponse(packet) {
    const isSocial = packet.user_intent === "social";
    const queryWords = (packet.user_query || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (isSocial || queryWords === 0 || queryWords > 15) {
      return false;
    }

    const isAnalytical =
      /\b(?:analyse|analyser|diagnostic|architectur|compar|comparaison|évaluat|audit|stratég|optimis|implément|implement|structur|explique|explication|détaill|développ|pourquoi|comment(?:\s+(?:fonctionne|marche|utilise|utiliser|faire|travaill|définir))|quels?\s+sont|avantages?|inconvénients?)\b/i.test(
        packet.user_query || "",
      );
    return !isAnalytical;
  },

  _requiresBufferedFinalDelivery(packet, composerOptions) {
    if (composerOptions.codeDelivery) return true;
    
    const query = packet?.user_query || "";
    if (isCodeReviewRequest(query)) return true;
    
    const attachmentRefs = packet?.meta?._attachment_refs || [];
    if (shouldApplyFileContextGuard(query, attachmentRefs)) return true;

    return false;
  },

  _applyContractFallback(packet, composerContext, composerOptions, reason) {
    const { observability } = composerContext;
    this._logComposerPath(observability, "fallback", { reason });

    if (observability.recordFallbackIncident) {
      conversationHealth.recordIncident("fallback_triggered", {
        reason: `${observability.fallbackReasonPrefix}${reason}`,
        intentContractId: observability.intentContractId,
        expectedResponseMode: observability.expectedResponseMode,
        queryPreview: String(packet?.user_query || "").slice(0, 80),
      });
    }

    const fallbackText = composerOptions.openProposition
      ? this._openPropositionFallback()
      : this._fallback(packet);

    return enforceComposerContract(
      packet,
      fallbackText,
      composerOptions,
      { allowRefusal: false },
    );
  },

  _openPropositionFallback() {
    return `Voici 3 pistes concrètes :
1. **Assistant RAG local** — Interroger vos notes et docs en local-first. Premier pas : indexer 10 fichiers Markdown test.
2. **Automatisation Forge** — Transformer une idée en spec ou script exécutable. Premier pas : une commande npm qui génère un brief projet.
3. **Copilote navigateur léger** — Résumer une page et proposer la prochaine action. Premier pas : prototype read-only sur une URL fixe.
Laquelle t'intéresse ?`;
  },

  async _applyMakersCheckerGate(
    packet,
    primaryRender,
    composerOptions,
    observability,
    composerStartedAt,
  ) {
    const gate = await validateRendererWithMakersChecker(
      packet,
      primaryRender,
      composerOptions,
      observability,
    );

    if (!gate.validation) {
      return { text: primaryRender, validation: null, blocked: false };
    }

    if (gate.blocked) {
      this._logComposerPath(observability, "fallback", {
        reason: "makers-checker-blocked",
        consensus: gate.validation.consensus,
      });
      await recordComposerTelemetry({
        outcome: "fallback-makers-blocked",
        skillId: observability.intentContractId || null,
        latencyMs: Date.now() - composerStartedAt,
        path: "fallback-makers-blocked",
      });
      return {
        text: this._applyContractFallback(
          packet,
          { observability, options: composerOptions },
          composerOptions,
          "makers_checker_blocked",
        ),
        validation: gate.validation,
        blocked: true,
      };
    }

    return { text: primaryRender, validation: gate.validation, blocked: false };
  },

  _applyFileContextGuard(packet, primaryText, { onContent = null } = {}) {
    const query = packet?.user_query || "";
    const attachmentRefs = packet?.meta?._attachment_refs || [];
    const attachments = packet?.meta?._attachments || [];
    if (!shouldApplyFileContextGuard(query, attachmentRefs)) {
      return primaryText;
    }

    const guard = enforceFileContextGuard({
      query,
      response: primaryText,
      attachmentRefs,
      attachments,
      attachmentTask: packet?.meta?.attachmentTask || null,
      sourceBacked:
        packet?.meta?.sourceBacked != null
          ? Boolean(packet.meta.sourceBacked)
          : attachmentRefs.length > 0 || attachments.length > 0,
    });

    if (guard.blocked) {
      console.warn(
        `[FinalResponseComposer] file_context_guard=blocked files=${guard.guard.violations.map((v) => v.file).join(",")}`,
      );
      if (onContent) onContent(guard.delivered);
      return guard.delivered;
    }

    if (guard.softened || guard.appendOnly) {
      console.warn(
        `[FinalResponseComposer] file_context_guard=${guard.guardMode || "append_only"} files=${(guard.guard.violations || []).map((v) => v.file).join(",")} overrideLocked=${guard.overrideLocked}`,
      );
      // Buffered : texte final = original + note. Stream : n'émettre que le delta.
      if (onContent && guard.delivered !== primaryText) {
        const suffix = String(guard.delivered).slice(String(primaryText).length);
        if (suffix.trim()) onContent(suffix);
      }
      return guard.delivered;
    }

    // no_op / pass / incapacity — jamais de remplacement
    return guard.delivered || primaryText;
  },

  async _applyCodeReviewRuntimeGuard(
    packet,
    primaryText,
    {
      client,
      model,
      systemPrompt,
      userPrompt,
      numPredict,
      onContent = null,
      composerOptions = {},
    } = {},
  ) {
    const query = packet?.user_query || "";
    if (!isCodeReviewRequest(query)) {
      return primaryText;
    }

    let currentText = primaryText;
    let retriesLeft = MAX_CODE_REVIEW_RUNTIME_RETRIES;

    while (retriesLeft >= 0) {
      const guard = applyCodeReviewRuntimeGuard({ query, response: currentText });

      if (guard.ok) {
        return currentText;
      }

      if (!guard.shouldRetry || retriesLeft === 0) {
        console.warn(
          `[FinalResponseComposer] code_review_guard=blocked failures=${guard.failures.map((f) => f.id).join(",")}`,
        );
        return guard.blockedMessage;
      }

      console.warn(
        `[FinalResponseComposer] code_review_guard=retry failures=${guard.failures.map((f) => f.id).join(",")}`,
      );

      const retryRaw = await client.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
          { role: "assistant", content: currentText },
          { role: "user", content: guard.reaskPrompt },
        ],
        model,
        { temperature: 0.0, num_predict: numPredict },
      );

      currentText = enforceComposerContract(
        packet,
        responseThinkingCleaner.clean(String(retryRaw || "")).trim(),
        composerOptions,
      );

      if (onContent) {
        onContent(`\n\n${currentText}`);
      }

      retriesLeft -= 1;
    }

    const finalEval = evaluateCodeReviewRuntime({ query, response: currentText });
    if (finalEval.ok) {
      return currentText;
    }

    return applyCodeReviewRuntimeGuard({ query, response: currentText }).blockedMessage;
  },

  /**
   * Demande « sur la toile trouve… » : append **Sources** avec URLs du paquet si absentes.
   * @param {object} packet
   * @param {string} text
   * @returns {string}
   */
  _withExplicitWebSourceLinks(packet = {}, text = "") {
    return ensureExplicitWebSourceLinks(text, packet);
  },

  /**
   * @param {object} packet
   * @param {string} text
   * @param {((chunk: string) => void)|null} [onContent]
   * @returns {string}
   */
  _emitWithExplicitWebSourceLinks(packet = {}, text = "", onContent = null) {
    const withSources = this._withExplicitWebSourceLinks(packet, text);
    if (
      typeof onContent === "function" &&
      withSources &&
      withSources !== text &&
      withSources.startsWith(String(text || ""))
    ) {
      onContent(withSources.slice(String(text || "").length));
    }
    return withSources;
  },

  /**
   * Preuves web utilisables (consultation OK ou bloc expert web_research).
   * @param {object} packet
   * @returns {boolean}
   */
  _hasUsableWebGrounding(packet = {}) {
    if (
      (packet?.expert_outputs || []).some(
        (o) =>
          o?.stage === "web_research" &&
          String(o?.content || "").trim().length > 20,
      )
    ) {
      return true;
    }
    return Boolean(packet?.meta?.web_consulted_at) || wasWebSearchAttempted(packet);
  },

  _fallback(packet) {
    const webFirst = (packet.expert_outputs || []).find(
      (o) =>
        o?.stage === "web_research" &&
        o.content &&
        String(o.content).length > 20,
    );
    const best =
      webFirst ||
      (packet.expert_outputs || []).find(
        (o) => o.content && o.content.length > 20,
      );
    if (best) {
      const cleaned = responseThinkingCleaner.clean(String(best.content)).trim();
      if (cleaned.length > 10 && !responseThinkingCleaner.hasEscapedThinking(cleaned)) {
        return cleaned;
      }
    }
    const qAnswer = packet.quick_answer;
    if (
      qAnswer &&
      qAnswer.length > 10 &&
      !responseThinkingCleaner.hasEscapedThinking(qAnswer)
    ) {
      return qAnswer;
    }
    return resolvePipelineFallback({
      query: packet?.user_query || packet?.query || "",
      expertOutputs: packet?.expert_outputs,
      quickAnswer: packet?.quick_answer,
      reason: "empty_composer_render",
    });
  },
};

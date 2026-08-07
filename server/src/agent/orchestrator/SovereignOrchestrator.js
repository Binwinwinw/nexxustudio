/* server/src/agent/orchestrator/SovereignOrchestrator.js */
/**
 * ORCHESTRATEUR SOUVERAIN — Citadel v5.0
 *
 * Rôle : Recevoir la demande utilisateur, décider quels experts réveiller
 * selon la matrice, orchestrer le pipeline en arrière-plan, produire
 * un OrchestratorPacket propre pour le FinalResponseComposer.
 *
 * Règle d'or :
 *   - Les experts conseillent (jamais user-facing)
 *   - Le Composer tranche et reformule (seule voix publique)
 *
 * Pattern : best-effort budget (70s) avec logging des dépassements.
 */

import { BudgetManager } from "./BudgetManager.js";
import { IntentStage } from "../stages/IntentStage.js";
import { SecurityStage } from "../stages/SecurityStage.js";
import { ContextStage } from "../stages/ContextStage.js";
import { RoutingStage } from "../stages/RoutingStage.js";
import { PromptStage } from "../stages/PromptStage.js";
import { ExecutionStage } from "../stages/ExecutionStage.js";
import intentClassifier from "../utils/intentClassifier.js";
import knowledgeService from "../knowledge/knowledgeService.js";
import {
  isIdeationRequest,
  classifyUserProfile,
  buildRecentMemoryBuffer,
  hasTextAttachments,
  isAttachedDocumentAnalysisRequest,
  isAttachedVisionRequest,
} from "../utils/conversationGuards.js";
import { sanitizeHistory } from "../utils/safetyGuards.js";
import { isLongOutputTask } from "../utils/qualityGuards.js";
import criticAgent from "../utils/criticAgent.js";
import { AGENT_ROLES } from "../policies/core/index.js";
import { validateOrchestratorPacket } from "../validators/pipelineValidators.js";
import {
  applyIntentContractToPacket,
  isIdeationIntentContract,
  shouldSkipWebSearchForIntent,
} from "../config/intentContractRegistry.js";
import {
  isGeneratorFirstIntent,
  stripHttpUrlSpans,
} from "../../../../shared/generatorFirstPolicy.js";
import {
  extractLocalFileReference,
} from "../utils/localFileUriIntentGuards.js";
import { resolveWorkspaceReadablePath } from "../policies/analysis/index.js";
import {
  deriveFactualResearchWebQuery,
  deriveFactualResearchWebQueryEn,
  deriveFactualResearchMetricsWebQuery,
  deriveFactualResearchSectorSitesWebQuery,
  deriveFactualResearchMarketSizeEnWebQuery,
  deriveFactualResearchOpenAccessWebQuery,
  isExplicitWebSearchRequest,
  isWebCitationsStructuredReportCluster,
} from "../policies/routing/explicitWebSearchRequestPolicy.js";
import {
  buildFactualResearchNoSourcesReply,
  isFactualResearchSourcedReportPath,
  shouldRefuseFactualResearchWithoutSources,
} from "../policies/web/factualResearchDeliverablePolicy.js";
import {
  evidenceHasKeyFigures,
  mergeAndRankFactualResearchSources,
  sourcesAreMajorityLight,
  sourcesAreMajorityPaywall,
  sourcesHaveHardSector,
} from "../policies/web/factualResearchSourceRankPolicy.js";
import {
  runOrchestratorMakersCheckerValidation,
} from "../verification/makersCheckerBridge.js";
import {
  buildCurrentWebFactRecoveryMessage,
  findLastExplicitWebSearchUserMessage,
  isCurrentWebFactRequest,
  isWebSearchThreadMaintenanceMessage,
  parseCurrentWebFactTask,
} from "../policies/web/index.js";
import {
  resolveGuidedProductWebSearchLimits,
  deriveGuidedProductWebSearchQuery,
} from "../policies/guided/index.js";
import { deriveResearchThenSummarizeWebQuery } from "../policies/routing/researchThenSummarizePolicy.js";
import { deriveRepoAnalysisWebQuery } from "../utils/repoAnalysisIntentGuards.js";
import {
  applyProductRecoValidationToWebPacket,
  assessProductRecoWebSources,
} from "../policies/guided/index.js";
import { extractProductRecommendationSlots } from "../policies/routing/compareChooseCompositePolicy.js";

// ── Matrice de réveil des experts ────────────────────────────────────────────
// Chaque entrée définit le budget alloué par stage pour ce type de demande.
const EXPERT_MATRIX = {
  social: {
    mode: "SOCIAL",
    stages: [], // Réponse déterministe, aucun LLM lourd
    budgets: {},
    totalMs: 3_000,
  },
  ideation: {
    mode: "IDEATION",
    stages: ["routing", "prompt", "execution"],
    budgets: { routing: 3_000, prompt: 1_000, execution: 12_000 },
    totalMs: 20_000,
  },
  factual_light: {
    mode: "OPERATIONAL",
    stages: ["routing", "context", "prompt", "execution"],
    budgets: {
      routing: 2_000,
      context: 5_000,
      prompt: 1_000,
      execution: 15_000,
    },
    totalMs: 25_000,
  },
  factual_heavy: {
    mode: "EPISTEMIC",
    stages: ["routing", "context", "prompt", "execution"],
    budgets: {
      routing: 3_000,
      context: 8_000,
      prompt: 1_000,
      execution: 45_000,
    },
    totalMs: 60_000,
  },
  technical_diagnostic: {
    mode: "EPISTEMIC",
    stages: ["routing", "context", "prompt", "execution"],
    budgets: {
      routing: 3_000,
      context: 10_000,
      prompt: 1_000,
      execution: 55_000,
    },
    totalMs: 70_000,
  },
  vision: {
    mode: "VISION",
    stages: ["context", "routing", "prompt", "execution"],
    budgets: {
      context: 20_000,
      routing: 2_000,
      prompt: 1_000,
      execution: 25_000,
    },
    totalMs: 50_000,
  },
  safety: {
    mode: "OPERATIONAL",
    stages: [], // Réponse politique directe
    budgets: {},
    totalMs: 1_000,
  },
  unknown: {
    mode: "OPERATIONAL",
    stages: ["routing", "context", "prompt", "execution"],
    budgets: {
      routing: 3_000,
      context: 6_000,
      prompt: 1_000,
      execution: 30_000,
    },
    totalMs: 45_000,
  },
  expert_task: {
    mode: "EPISTEMIC",
    stages: ["routing", "context", "prompt", "execution"],
    budgets: {
      routing: 3_000,
      context: 10_000,
      prompt: 1_000,
      execution: 55_000,
    },
    totalMs: 70_000,
  },
  social_chit_chat: {
    mode: "SOCIAL",
    stages: [], // Fast path, pas de LLM lourd ni de planner
    budgets: {},
    totalMs: 0,
    plannerEnabled: false,
    lexicalAnalysisEnabled: false,
    fastPath: true,
  },
  normal_conversation: {
    mode: "OPERATIONAL",
    stages: ["routing", "context", "prompt", "execution"],
    budgets: {
      routing: 2_000,
      context: 5_000,
      prompt: 1_000,
      execution: 15_000,
    },
    totalMs: 25_000,
    plannerEnabled: false,
    lexicalAnalysisEnabled: false,
    fastPath: false,
  },
};

// ── Classe principale ────────────────────────────────────────────────────────
export class SovereignOrchestrator {
  /**
   * @param {object} pipeline - Référence à l'AgentPipeline (pour accéder aux options/config)
   */
  constructor(pipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Point d'entrée principal.
   *
   * @param {string} query
   * @param {Array} history
   * @param {object} opts - { onStep, onContent, onThought, projectState, sessionId, images, cavemanLevel, ... }
   * @returns {Promise<string>} - La réponse finale (texte propre, streamé via onContent)
   */
  async orchestrate(query, history = [], opts = {}) {
    const {
      intent,
      onStep,
      onContent,
      onThought,
      projectState,
      sessionId,
      images = [],
      cavemanLevel = "NORMAL",
      forcedExpertKey,
      disableRecentMemory = false,
      topicShiftReset = false,
      topicShiftMeta = null,
      forgeProduction = false,
      intentContractId: forcedIntentContractId = null,
      queryUnderstanding = null,
      requestWorkup = null,
      structuredRequest = null,
      interpreterLock = null,
      webSearchQuery: optsWebSearchQuery = null,
      summaryContract = null,
    } = opts;

    const recentMemoryDisabled = disableRecentMemory || topicShiftReset;

    const budget = new BudgetManager(70_000);
    budget.start("total");

    // ── 1. Détermination du type de demande ──────────────────────────────────
    const fileIntent = this._evaluateFileDrivenIntent(query, images);
    const isGeneratorFirst = this._evaluateGeneratorFirstIntent(query);

    let userIntent = intent || (fileIntent ? fileIntent.forcedIntent : this._classifyIntent(query, images));
    if (interpreterLock?.locked && interpreterLock.forced_intent) {
      userIntent = interpreterLock.forced_intent;
    }
    // PJ image + demande visuelle : prioriser matrice vision (pas expert_task triage).
    if (
      !interpreterLock?.locked &&
      isAttachedVisionRequest(query, images)
    ) {
      userIntent = "vision";
    }
    let plan;

    if (isGeneratorFirst && !interpreterLock?.locked) {
      userIntent = "expert_task";
      plan = {
        mode: "EPISTEMIC",
        stages: ["prompt", "execution"], // Bypass PM (routing) & Architect (context)
        budgets: { prompt: 2_000, execution: 298_000 },
        totalMs: 300_000,
      };
      if (onStep) onStep("⚡ Mode Generator-First activé : Bypass PM & Architect pour sécuriser le timeout.");
    } else {
      if (!EXPERT_MATRIX[userIntent]) {
        userIntent = "unknown";
      }
      plan = EXPERT_MATRIX[userIntent] || EXPERT_MATRIX.unknown;
    }

    const expertBudget = new BudgetManager(plan.totalMs);

    if (onStep && !isGeneratorFirst)
      onStep(
        `🎯 Intent : ${userIntent} | Mode : ${plan.mode} | Budget : ${plan.totalMs / 1000}s`,
      );
    console.log(
      `[SovereignOrchestrator] Intent="${userIntent}" Mode="${plan.mode}" Budget=${plan.totalMs}ms Session=${sessionId}`,
    );

    // ── 2. Paquets intermédiaires (accumulés par les experts) ─────────────────
    const packet = {
      user_intent: userIntent,
      user_query: query,
      mode: plan.mode,
      expert_outputs: [],
      evidence: [],
      vision_briefing: null,
      risk_level: "low",
      budget: null,
      quick_answer: null,
      system_prompt_used: null,
      meta: {}
    };

    if (structuredRequest) {
      packet.meta.structured_request = structuredRequest;
    }
    if (summaryContract) {
      packet.meta.summary_contract_id = summaryContract.contract || null;
      packet.meta.summary_contract_intent = summaryContract.intent || null;
      packet.meta.summary_entity_label = summaryContract.entityLabel || null;
    }
    if (interpreterLock?.locked) {
      packet.meta.interpreter_lock = interpreterLock;
      packet.meta.override_requires_reason = true;
    }

    if (topicShiftReset) {
      packet.meta.topic_shift_reset = true;
      packet.meta.topic_shift_previous_domain =
        topicShiftMeta?.previousDomain || null;
      packet.meta.topic_shift_current_domain =
        topicShiftMeta?.currentDomain || null;
    }

    if (fileIntent) {
      packet.meta.forbiddenFlags = fileIntent.forbiddenFlags;
      packet.meta.allowPostHocExplanation = fileIntent.allowPostHocExplanation;
      packet.meta.contract_name = fileIntent.contract_name;
      packet.meta.executionContract = fileIntent.executionContract;
      packet.meta.forcedIntent = fileIntent.forcedIntent;
    }

    if (forgeProduction) {
      packet.meta.forge_production = true;
      packet.meta.intent_contract_id =
        forcedIntentContractId || "FORGE_WEBAPP_BUILD";
      packet.meta.open_proposition = false;
    } else if (forcedIntentContractId) {
      packet.meta.intent_contract_id = forcedIntentContractId;
      if (forcedIntentContractId === "RESEARCH_THEN_SUMMARIZE") {
        packet.meta.research_then_summarize = true;
      }
      if (forcedIntentContractId === "REPO_ANALYSIS") {
        packet.meta.repo_analysis = true;
      }
    }

    if (queryUnderstanding) {
      packet.meta.query_understanding = {
        primaryDomain: queryUnderstanding.primaryDomain,
        responseStrategy: queryUnderstanding.responseStrategy,
        domains: queryUnderstanding.domains,
        workIntentCount: queryUnderstanding.workIntentCount,
      };
      const compareIntent = queryUnderstanding.intents?.find(
        (item) => item.domain === "compare_choose" && !item.absorbable,
      );
      if (compareIntent?.task?.slots) {
        packet.meta.product_reco_slots = compareIntent.task.slots;
      }
      const synthesisIntent = queryUnderstanding.intents?.find(
        (item) => item.domain === "document_synthesis" && !item.absorbable,
      );
      if (synthesisIntent?.task?.slots) {
        packet.meta.document_synthesis_slots = synthesisIntent.task.slots;
      }
    }

    if (requestWorkup) {
      packet.meta.cognitive_cycle = {
        rule: requestWorkup.rule,
        profile: requestWorkup.action_decision?.profile,
        orchestratorMode: requestWorkup.action_decision?.orchestratorMode,
        intent_assessment: requestWorkup.intent_assessment,
        evidence_requirement: requestWorkup.evidence_requirement,
        action_decision: requestWorkup.action_decision,
        retrieval_decision: requestWorkup.retrieval_decision,
        response_commitment: requestWorkup.response_commitment,
      };
      packet.meta.request_workup = packet.meta.cognitive_cycle;
    }

    if (images.length > 0) {
      packet.meta.has_attached_documents = hasTextAttachments(images);
      packet.meta.has_attached_images = images.some(
        (f) =>
          String(f?.mimetype || "").startsWith("image/") ||
          /\.(jpe?g|png|webp|gif)$/i.test(f?.originalname || f?.name || ""),
      );
      packet.meta._attachment_refs = images.map((f) => ({
        name: f.originalname || f.name || "document",
        mimetype: f.mimetype || "",
      }));
    }

    const { contract: intentContract, matchedBy: intentContractMatch } =
      applyIntentContractToPacket(packet, query);
    console.log(
      `[SovereignOrchestrator] IntentContract="${intentContract.id}" matchedBy="${intentContractMatch}" responseMode="${intentContract.responseMode}"`,
    );
    if (onStep) {
      onStep(
        `📋 Contrat d'intention : ${intentContract.id} (${intentContract.label})`,
      );
    }

    // Contrat VISION_ATTACHED → plan vision (contexte d'abord, pas routing web).
    if (intentContract.id === "VISION_ATTACHED") {
      userIntent = "vision";
      plan = EXPERT_MATRIX.vision;
      packet.user_intent = "vision";
      packet.mode = plan.mode;
      if (onStep) {
        onStep(
          `🎯 Intent recalibré : vision | Mode : ${plan.mode} | Budget : ${plan.totalMs / 1000}s`,
        );
      }
    }

    // ── 3. Gate rapide : social / safety ─────────────────────────────────────
    if (plan.stages.length === 0) {
      const quickResp = this._buildDirectResponse(userIntent);
      packet.quick_answer = quickResp;
      packet.budget = budget.summary();
      if (onContent) onContent(quickResp);
      return quickResp;
    }

    // ── 4. Stage : Security ───────────────────────────────────────────────────
    expertBudget.start("security");
    const { blocked, reason, queryRisk } = await SecurityStage.run(query, {
      onStep,
    });
    expertBudget.checkpoint("security");

    packet.risk_level =
      queryRisk > 0.6 ? "high" : queryRisk > 0.3 ? "medium" : "low";

    if (blocked) {
      packet.quick_answer = reason;
      packet.budget = budget.summary();
      if (onContent) onContent(reason);
      return reason;
    }

    // ── 5. Stage : Context (mémoire + vision) ────────────────────────────────
    let visionData = null,
      contextData = null,
      memoryContext = "",
      projectSotBrief = "",
      governedContext = null;

    if (plan.stages.includes("context")) {
      expertBudget.start("context");
      const ctx = await ContextStage.run(query, {
        onStep,
        projectState,
        queryRisk,
        options: {
          sessionId,
          images,
          turnTimestamp: opts.turnTimestamp || new Date().toISOString(),
        },
      });
      expertBudget.checkpoint("context");

      visionData = ctx.visionData;
      contextData = ctx.contextData;
      memoryContext = ctx.memoryContext;
      projectSotBrief = ctx.projectSotBrief;
      governedContext = ctx.governedContext;

      if (visionData?.briefing) {
        packet.vision_briefing = visionData.briefing;
        // Briefing d'erreur VisionAgent (catch) ≠ analyse OK — forcer path composeur échec.
        if (visionData.error) {
          packet.meta.vision_failed = true;
        }
        packet.expert_outputs.push({
          stage: "vision",
          content: visionData.briefing,
        });
        if (visionData.error && onStep) {
          onStep(
            `⚠️ Vision : échec local signalé au composeur (${String(visionData.error).slice(0, 120)}).`,
          );
        }
        if (visionData.error && images?.length) {
          try {
            const { tryOcrServiceFallbackForVisionFailure } = await import(
              "../capabilities/ocr/ocrVisionFallback.js"
            );
            const ocrHit = await tryOcrServiceFallbackForVisionFailure(query, images);
            if (ocrHit?.text) {
              packet.meta.ocr_fallback_text = ocrHit.text;
              packet.meta.ocr_fallback_backend = ocrHit.backend;
              packet.vision_briefing =
                "\n--- BRIEFING OCR (fallback service) ---\n" +
                ocrHit.text.slice(0, 12000) +
                "\n-----------------------------------------------\n";
              packet.meta.vision_failed = false;
              if (onStep) {
                onStep(
                  `🪪 OCR fallback : texte extrait via ${ocrHit.backend} (${ocrHit.text.length} car.).`,
                );
              }
            }
          } catch (ocrErr) {
            console.warn("[SovereignOrchestrator] OCR vision fallback:", ocrErr?.message);
          }
        }
      } else if (intentContract.id === "VISION_ATTACHED") {
        const failBrief =
          "\n--- BRIEFING VISUEL ---\n" +
          "[ÉCHEC] Aucune analyse vision produite (modèle indisponible, buffer image manquant, ou timeout).\n" +
          "Ne dis PAS que l'accès visuel est « restreint par politique ». Dis que l'analyse locale a échoué et propose de réessayer.\n" +
          "-----------------------------------------------\n";
        packet.vision_briefing = failBrief;
        packet.meta.vision_failed = true;
        packet.expert_outputs.push({
          stage: "vision",
          content: failBrief,
        });
        if (onStep) {
          onStep("⚠️ Vision : aucun briefing produit — échec local signalé au composeur.");
        }
      }
      if (ctx.memoryData?.semanticMatches?.length > 0) {
        for (const m of ctx.memoryData.semanticMatches.slice(0, 3)) {
          packet.evidence.push({
            source: m.metadata?.source || "memory",
            excerpt: m.content?.slice(0, 200),
            relevance: m.score,
          });
        }
      }
    }

    // ── 5.5 Gate rapide : direct_answer gouverné ─────────────────────────────
    // Règle d'or v4.6 : On ne court-circuite JAMAIS une requête experte technique avec une réponse RAG directe.
    if (
      !forgeProduction &&
      governedContext &&
      governedContext.type === "direct_answer" &&
      intent !== "expert_task"
    ) {
      const answer = knowledgeService.buildDirectAnswer(governedContext);
      if (onStep)
        onStep(`governed direct answer [${governedContext.topic.id}]`);
      packet.quick_answer = answer;
      packet.budget = budget.summary();
      if (onContent) onContent(answer);
      return { rawResponse: "", packet };
    }

    // ── 6. Stage : Routing ───────────────────────────────────────────────────
    let expertMatches = [],
      bestModel = AGENT_ROLES.ORCHESTRATOR;

    if (plan.stages.includes("routing")) {
      expertBudget.start("routing");
      const skipWeb =
        shouldSkipWebSearchForIntent(query, packet) ||
        intentContract.routing?.skipWebSearch === true;
      const routing = await RoutingStage.run(query, {
        onStep,
        projectState,
        isSocial: userIntent === "social",
        forcedExpertKey,
        reasoningBudget: plan.budgets.execution || 30_000,
        isDiscussion: query.includes("discussion:"),
        excludeExpertKeys: skipWeb ? ["expert_web_search"] : [],
      });
      expertBudget.checkpoint("routing");
      expertMatches = routing.expertMatches;
      bestModel = routing.bestModel;
    } else if (isGeneratorFirst) {
      bestModel = "qwen2.5-coder:7b"; // Assignation explicite du Dev Model
    }

    // ── 6.5 Exécution active des Experts (Citadelle V5.2) ─────────────────────
    let currentWebFactAttempted = false;
    let currentWebFactSucceeded = false;

    if (expertMatches && expertMatches.length > 0) {
      for (const match of expertMatches) {
        const key = match.expert?.key;
        if (key === "expert_web_search") {
          if (shouldSkipWebSearchForIntent(query, packet)) {
            if (isExplicitWebSearchRequest(query)) {
              packet.meta.web_failure_mode = "web_search_skipped_by_contract";
            }
            if (isIdeationIntentContract(packet)) {
              if (onStep) {
                onStep(
                  "💡 Idéation ouverte — recherche web contournée (contrat IDEATION_OPEN).",
                );
              }
            } else if (onStep) {
              onStep(
                `🚫 Web Search contournée (contrat ${packet.meta.intent_contract_id}).`,
              );
            }
            continue;
          }
          // Règle de court-circuit: pas de web search si on a un fichier et un expert_task, sauf mention explicite.
          if (fileIntent && userIntent === "expert_task") {
            if (onStep) onStep(`🚫 Web Search désactivé (Contrat d'exécution sur fichier local prioritaire).`);
            continue;
          }
          if (onStep)
            onStep(
              `🔍 Recherche Web Souveraine active [${match.expert.name}]...`,
            );
          const productRecoAnchorQuery =
            intentContract.id === "GUIDED_PRODUCT_RECOMMENDATION" &&
            isWebSearchThreadMaintenanceMessage(query)
              ? findLastExplicitWebSearchUserMessage(history) || query
              : query;
          if (
            productRecoAnchorQuery !== query &&
            intentContract.id === "GUIDED_PRODUCT_RECOMMENDATION"
          ) {
            packet.meta.product_reco_anchor_query = productRecoAnchorQuery;
          }
          const factualNeedsDerivedQuery =
            intentContract.id === "FACTUAL_RESEARCH" ||
            isWebCitationsStructuredReportCluster(query);
          const trimmedOptsWebQuery =
            optsWebSearchQuery && String(optsWebSearchQuery).trim()
              ? String(optsWebSearchQuery).trim()
              : "";
          // Prefer SC-derived short query; never keep a long marketing brief as DDG input.
          const factualWebQuery =
            trimmedOptsWebQuery && trimmedOptsWebQuery.length <= 160
              ? trimmedOptsWebQuery
              : deriveFactualResearchWebQuery(query) || trimmedOptsWebQuery || query;
          const effectiveWebSearchQuery =
            intentContract.id === "GUIDED_PRODUCT_RECOMMENDATION"
              ? trimmedOptsWebQuery ||
                deriveGuidedProductWebSearchQuery(productRecoAnchorQuery)
              : intentContract.id === "RESEARCH_THEN_SUMMARIZE"
                ? deriveResearchThenSummarizeWebQuery(query)
              : intentContract.id === "REPO_ANALYSIS"
                ? deriveRepoAnalysisWebQuery(query)
              : factualNeedsDerivedQuery
                ? factualWebQuery
              : trimmedOptsWebQuery || query;
          if (isCurrentWebFactRequest(query)) {
            currentWebFactAttempted = true;
          }
          try {
            // Importation dynamique de l'expert de recherche
            const { expertWebSearch } =
              await import("../agents/expertWebSearch.js");
            if (effectiveWebSearchQuery !== query) {
              console.log(
                `[SovereignOrchestrator] Web query dérivée: "${effectiveWebSearchQuery}"`,
              );
            }
            const webLimits = resolveGuidedProductWebSearchLimits(intentContract);
            const factualPath = isFactualResearchSourcedReportPath(query, {
              meta: { intent_contract_id: intentContract.id },
            });
            const runWebSearch = (searchQuery) =>
              expertWebSearch.run(
                { query: searchQuery },
                {
                  sessionId,
                  maxResults: webLimits.maxResults,
                  timeoutMs: webLimits.timeoutMs,
                  factualResearchRank: factualPath,
                },
              );

            let webPacket = await runWebSearch(effectiveWebSearchQuery);
            let validatedPacket = webPacket;

            if (intentContract.id === "GUIDED_PRODUCT_RECOMMENDATION") {
              const slots =
                packet.meta.product_reco_slots ||
                extractProductRecommendationSlots(productRecoAnchorQuery);
              const validated = applyProductRecoValidationToWebPacket(
                webPacket,
                slots,
                webLimits.maxResults,
              );
              validatedPacket = validated.packet;
              packet.meta.product_reco_validation = validated.audit;
              const relevance = assessProductRecoWebSources(
                validatedPacket.sources || [],
                productRecoAnchorQuery,
              );
              packet.meta.product_reco_source_relevance = relevance;
              if (!relevance.sufficient) {
                packet.meta.product_sources_insufficient = true;
                packet.meta.product_sources_insufficient_reason = relevance.reason;
                console.log(
                  `[SovereignOrchestrator] product_sources_insufficient reason=${relevance.reason} ` +
                    `proceduralOnly=${relevance.proceduralOnly}`,
                );
              }
              if (validated.audit.reasons.length > 0) {
                console.log(
                  `[SovereignOrchestrator] product_reco_validation dropped=${validated.audit.dropped} ` +
                    `reasons=${validated.audit.reasons.join("; ")}`,
                );
              }
            }

            let hasSources =
              validatedPacket &&
              validatedPacket.sources &&
              validatedPacket.sources.length > 0;

            // P2 — FACTUAL_RESEARCH / cluster : 2e chance query EN avant refus
            if (!hasSources && factualPath) {
              const enQuery = deriveFactualResearchWebQueryEn(query);
              if (
                enQuery &&
                enQuery.toLowerCase() !==
                  String(effectiveWebSearchQuery || "").toLowerCase()
              ) {
                console.log(
                  `[SovereignOrchestrator] Web query EN retry: "${enQuery}"`,
                );
                if (onStep) {
                  onStep(`🔁 Retry recherche web (query EN) : ${enQuery}`);
                }
                webPacket = await runWebSearch(enQuery);
                validatedPacket = webPacket;
                packet.meta.factual_research_en_retry = true;
                packet.meta.factual_research_en_query = enQuery;
                hasSources =
                  validatedPacket &&
                  validatedPacket.sources &&
                  validatedPacket.sources.length > 0;
              }
            }

            const applyMergedSources = async (searchQuery, nextSources) => {
              const merged = mergeAndRankFactualResearchSources(
                validatedPacket.sources || [],
                nextSources || [],
                { maxResults: webLimits.maxResults },
              );
              if (merged.sources.length === 0) return;
              const { buildRawSummary, computeOverallConfidence } =
                await import("../normalizers/webEvidenceNormalizer.js");
              validatedPacket = {
                ...validatedPacket,
                sources: merged.sources,
                summary: buildRawSummary(searchQuery, merged.sources),
                content: buildRawSummary(searchQuery, merged.sources),
                confidence: computeOverallConfidence(merged.sources),
              };
              hasSources = true;
            };

            // P4 — preuves sans chiffres clés → retry query métriques (1 fois)
            if (
              factualPath &&
              hasSources &&
              !evidenceHasKeyFigures(validatedPacket.sources) &&
              !packet.meta.factual_research_metrics_retry
            ) {
              const metricsQuery = deriveFactualResearchMetricsWebQuery(query, {
                lang: "fr",
              });
              if (
                metricsQuery &&
                metricsQuery.toLowerCase() !==
                  String(effectiveWebSearchQuery || "").toLowerCase()
              ) {
                console.log(
                  `[SovereignOrchestrator] Web query metrics retry: "${metricsQuery}"`,
                );
                if (onStep) {
                  onStep(`🔁 Retry recherche métriques : ${metricsQuery}`);
                }
                const metricsPacket = await runWebSearch(metricsQuery);
                packet.meta.factual_research_metrics_retry = true;
                packet.meta.factual_research_metrics_query = metricsQuery;
                await applyMergedSources(
                  metricsQuery,
                  metricsPacket?.sources || [],
                );
              }
            }

            // P5 — majorité blogs légers → retry sites sectoriels (+ PDF)
            if (
              factualPath &&
              hasSources &&
              sourcesAreMajorityLight(validatedPacket.sources) &&
              !packet.meta.factual_research_sector_sites_retry
            ) {
              const sectorQuery = deriveFactualResearchSectorSitesWebQuery();
              console.log(
                `[SovereignOrchestrator] Web query sector sites retry: "${sectorQuery}"`,
              );
              if (onStep) {
                onStep(`🔁 Retry sources sectorielles : ${sectorQuery}`);
              }
              const sectorPacket = await runWebSearch(sectorQuery);
              packet.meta.factual_research_sector_sites_retry = true;
              packet.meta.factual_research_sector_sites_query = sectorQuery;
              await applyMergedSources(
                sectorQuery,
                sectorPacket?.sources || [],
              );
            }

            // P7 — majorité paywalls → retry open-access / PDF
            if (
              factualPath &&
              hasSources &&
              sourcesAreMajorityPaywall(validatedPacket.sources) &&
              !packet.meta.factual_research_open_access_retry
            ) {
              const openQuery = deriveFactualResearchOpenAccessWebQuery();
              console.log(
                `[SovereignOrchestrator] Web query open-access retry: "${openQuery}"`,
              );
              if (onStep) {
                onStep(`🔁 Retry sources open-access : ${openQuery}`);
              }
              const openPacket = await runWebSearch(openQuery);
              packet.meta.factual_research_open_access_retry = true;
              packet.meta.factual_research_open_access_query = openQuery;
              await applyMergedSources(openQuery, openPacket?.sources || []);
            }

            // P5 — 0 chiffre + 0 hard sector → retry market size EN
            if (
              factualPath &&
              hasSources &&
              !evidenceHasKeyFigures(validatedPacket.sources) &&
              !sourcesHaveHardSector(validatedPacket.sources) &&
              !packet.meta.factual_research_market_size_retry
            ) {
              const marketQuery = deriveFactualResearchMarketSizeEnWebQuery();
              console.log(
                `[SovereignOrchestrator] Web query market size EN retry: "${marketQuery}"`,
              );
              if (onStep) {
                onStep(`🔁 Retry market size EN : ${marketQuery}`);
              }
              const marketPacket = await runWebSearch(marketQuery);
              packet.meta.factual_research_market_size_retry = true;
              packet.meta.factual_research_market_size_query = marketQuery;
              await applyMergedSources(
                marketQuery,
                marketPacket?.sources || [],
              );
            }

            packet.meta.factual_research_evidence_has_figures = evidenceHasKeyFigures(
              validatedPacket?.sources || [],
            );
            packet.meta.factual_research_hard_sector = sourcesHaveHardSector(
              validatedPacket?.sources || [],
            );
            packet.meta.factual_research_needs_metrics_admission =
              !packet.meta.factual_research_evidence_has_figures &&
              !packet.meta.factual_research_hard_sector;

            if (
              validatedPacket &&
              validatedPacket.sources &&
              validatedPacket.sources.length > 0
            ) {
              if (currentWebFactAttempted) {
                currentWebFactSucceeded = true;
              }
              packet.meta.resolution_path = "web_fallback";
              packet.meta.web_consulted_at = new Date().toISOString();
              try {
                const { stashWebTurnSnapshot } = await import(
                  "../memory/web-candidates/webTurnContext.js",
                );
                stashWebTurnSnapshot({
                  query,
                  webPacket: validatedPacket,
                  sessionId,
                  pipelineMode: plan.mode,
                });
              } catch (stashErr) {
                console.warn(
                  "[SovereignOrchestrator] web turn snapshot:",
                  stashErr.message,
                );
              }

              // 1. Enregistrement dans les sorties experts
              packet.expert_outputs.push({
                stage: "web_research",
                content: validatedPacket.summary || validatedPacket.content,
              });

              // 2. Hydratation des preuves du paquet (pour citation ou audit)
              for (const s of validatedPacket.sources) {
                packet.evidence.push({
                  source: s.url,
                  excerpt: s.snippet,
                  title: s.title || "",
                  relevance: s.confidence,
                });
              }

              // 3. Injection directe dans le briefing contextuel de l'exécuteur principal
              if (!contextData) {
                contextData = { briefing: "" };
              } else if (typeof contextData.briefing !== "string") {
                contextData.briefing = "";
              }
              contextData.briefing += `\n\n--- PREUVES DE RECHERCHE WEB DE CONFIANCE (ADR-011) ---\n${validatedPacket.summary}\n-----------------------------------------------------\n`;

              if (onStep)
                onStep(
                  `✅ Preuves de recherche web injectées avec succès (${validatedPacket.sources.length} sources).`,
                );
            } else {
              packet.meta.web_failure_mode =
                validatedPacket?.failure_mode || "fallback_no_results";
              if (onStep)
                onStep(
                  `⚠️ Recherche web silencieuse ou sans résultats (${webPacket?.failure_mode || "aucun"}).`,
                );
            }
          } catch (err) {
            packet.meta.web_failure_mode = "web_search_error";
            console.error(
              `[SovereignOrchestrator] Échec de l'exécution de expert_web_search :`,
              err.message,
            );
          }
        }
      }
    }

    if (currentWebFactAttempted && !currentWebFactSucceeded) {
      const recovery = buildCurrentWebFactRecoveryMessage(
        query,
        packet.meta.web_failure_mode || "web_search_unavailable",
      );
      packet.quick_answer = recovery;
      packet.meta.current_web_fact_fast_fallback = true;
      packet.meta.weather_web_fast_fallback =
        parseCurrentWebFactTask(query).factType === "weather";
      packet.budget = budget.summary();
      if (onStep) {
        onStep(
          "⚠️ Fait actuel — recherche web indisponible, réponse honnête (pas de raisonneur lourd).",
        );
      }
      if (onContent) onContent(recovery);
      return recovery;
    }

    // P2 — FACTUAL_RESEARCH / cluster : 0 source après retries → refus déterministe
    if (shouldRefuseFactualResearchWithoutSources(query, packet)) {
      const refuse = buildFactualResearchNoSourcesReply(
        query,
        packet.meta.web_failure_mode || null,
      );
      packet.quick_answer = refuse;
      packet.meta.factual_research_no_sources = true;
      packet.budget = budget.summary();
      if (onStep) {
        onStep(
          "⚠️ FACTUAL_RESEARCH — 0 source web : refus honnête (pas de faux rapport).",
        );
      }
      if (onContent) onContent(refuse);
      return refuse;
    }

    // ── 7. Stage : Prompt ────────────────────────────────────────────────────
    let systemPrompt = "";

    if (plan.stages.includes("prompt")) {
      // Préparation du briefing
      let briefing = projectSotBrief || "";
      if (governedContext?.type === "grounded_generation") {
        briefing += knowledgeService.buildGroundedBriefing(governedContext);
      }

      expertBudget.start("prompt");
      const isIdeation =
        !forgeProduction &&
        (isIdeationIntentContract(packet) ||
          userIntent === "ideation" ||
          isIdeationRequest(query));
      const promptResult = await PromptStage.run(query, {
        expertMatches,
        isDiscussion: query.includes("discussion:"),
        projectState,
        briefing,
        userProfile: classifyUserProfile(query),
        bestModel,
        longFormEnabled: isLongOutputTask(query),
        cavemanLevel,
        isSocial: userIntent === "social",
        isIdeation,
        memoryContext,
        visionData,
        contextData,
        isContinuationSignal: false,
        onStep,
        intentContractId: intentContract.id,
      });
      expertBudget.checkpoint("prompt");

      systemPrompt = promptResult.systemPrompt;
      if (fileIntent && fileIntent.executionContract) {
        systemPrompt += "\n\n[CONTRAT D'EXÉCUTION STRICT]\n" + fileIntent.executionContract + "\n";
      }
      packet.system_prompt_used = systemPrompt.slice(0, 200) + "…"; // Tronqué pour le packet
    }

    // ── 8. Stage : Execution (le conseil parle en silence) ───────────────────
    let rawResponse = "";

    // Rule 4 — pas de boucle critique si la précondition d'accès fichier a échoué.
    if (fileIntent?.access_precondition_failed || fileIntent?.skip_critic_retry) {
      const failPayload = {
        status: "access_precondition_failed",
        contract_name: fileIntent.contract_name || "INLINE_FILE_ANALYSIS_V4_1",
        target_path: fileIntent.target_path || "",
        access_status: "failed",
        error: {
          code: fileIntent.access_failure_reason || "unresolved_path",
          message:
            "Aucun fichier lisible résolu avant le contrat d'analyse — pas de cycle critique.",
        },
        evidence: [],
        findings: [],
        unknowns: [
          "Le chemin n'a pas été résolu dans l'allowlist workspace (projects/) ou le fichier est inaccessible.",
        ],
        forbidden_speculation: [],
      };
      rawResponse = JSON.stringify(failPayload, null, 2);
      packet.meta.final_contract_verdict = "fail";
      packet.meta.final_failed_rules = ["access_precondition_failed"];
      packet.meta.target_path = fileIntent.target_path || "";
      packet.expert_outputs.push({ stage: "execution", content: rawResponse });
      budget.checkpoint("total");
      packet.budget = {
        ...budget.summary(),
        expert_budget: expertBudget.summary(),
      };
      validateOrchestratorPacket(packet);
      return { rawResponse, packet };
    }

    if (plan.stages.includes("execution") && !expertBudget.isExhausted()) {
      const cleanHistory = sanitizeHistory(history, {
        social: userIntent === "social",
      });
      const recentMemoryBuffer = recentMemoryDisabled
        ? ""
        : buildRecentMemoryBuffer(cleanHistory, 2);
      const currentHistory = [
        ...cleanHistory,
        { role: "user", content: query },
      ];

      const executionOptions = {
        num_ctx: 8192,
        temperature: userIntent === "social" ? 0.1 : 0.4,
        top_p: 0.9,
        repeat_penalty: 1.2,
        num_predict: userIntent === "social" ? 400 : 4000,
      };

      let attempt = 0;
      const MAX_RETRIES = 1;
      let isContractValid = false;
      let finalFailedRules = [];
      let executionSystemPrompt = systemPrompt;

      while (attempt <= MAX_RETRIES && !isContractValid) {
        attempt++;
        
        expertBudget.start("execution");
        const execResult = await ExecutionStage.run(this.pipeline, query, {
          bestModel,
          systemPrompt: executionSystemPrompt,
          currentHistory,
          recentMemoryBuffer,
          isContinuationSignal: false,
          isSocial: userIntent === "social",
          isDiscussion: query.includes("discussion:"),
          isGuidedWorkRequest: false,
          onStep,
          onContent: null,
          onThought,
          sessionId,
          projectState,
          maxIterations: this.pipeline.maxIterations || 3,
          options: executionOptions,
        });
        expertBudget.checkpoint("execution");

        rawResponse = execResult.currentResponse || "";

        const isInlineAnalysis = packet.meta?.contract_name === "INLINE_FILE_ANALYSIS_V4_1";
        if (!isInlineAnalysis && (!packet.meta?.forbiddenFlags || packet.meta.forbiddenFlags.length === 0)) {
          isContractValid = true;
          break;
        }

        if (onStep) onStep(`⚖️ Agent Critique : Vérification du contrat (essai ${attempt})...`);
        const tools_used = packet.expert_outputs.map(o => o.stage);
        let critique;

        if (fileIntent && fileIntent.contract_name === "INLINE_FILE_ANALYSIS_V4_1") {
          if (onStep) onStep(`🛡️ [Self-Check] Application du contrat V4.1 strict sur fichier inline.`);
          const rawVerdict = criticAgent.evaluateInlineFileAnalysis({
            userPrompt: query,
            contract: fileIntent,
            agentOutput: rawResponse
          });
          
          critique = {
            verdict: rawVerdict.verdict === "pass" ? "ok" : "fail",
            reasons: rawVerdict.failed_rules,
            analysis: "Diagnostics structurés: " + JSON.stringify(rawVerdict.diagnostics),
            instructions_for_retry: rawVerdict.repair_instructions.join("\\n")
          };

          if (critique.verdict === "fail") {
             if (onStep) onStep(`❌ [Self-Check] Critique échoué (${critique.reasons.join(', ')}). Boucle de rattrapage activée...`);
          } else {
             if (onStep) onStep(`✅ [Self-Check] Critique passée avec succès (0 fail).`);
          }
        } else {
          critique = await criticAgent.evaluateReflexionContract({
            user_query: query,
            execution_contract: fileIntent?.executionContract || "",
            forbidden_flags: packet.meta.forbiddenFlags || [],
            tools_used: tools_used,
            raw_answer: rawResponse
          });
        }

        if (critique.verdict === "ok") {
          isContractValid = true;
          finalFailedRules = [];
          if (onStep) onStep(`✅ Agent Critique : Contrat respecté.`);
        } else {
          finalFailedRules = critique.reasons;
          if (onStep) onStep(`❌ Agent Critique : Échec (${critique.reasons.join(', ')}). Correction en cours...`);
          
          if (attempt <= MAX_RETRIES) {
            executionSystemPrompt += `\n\n[RETOUR CRITIQUE - TENTATIVE ${attempt} ÉCHOUÉE]\nTon essai précédent a été refusé. Raisons : ${critique.reasons.join(', ')}.\nAnalyse : ${critique.analysis}\nInstruction obligatoire : ${critique.instructions_for_retry}\nCorrige ta réponse immédiatement en respectant ces consignes.`;
          }
        }
      }

      packet.meta.final_contract_verdict = isContractValid ? "pass" : "fail";
      packet.meta.final_failed_rules = finalFailedRules;
      packet.expert_outputs.push({ stage: "execution", content: rawResponse });

      if (rawResponse) {
        await runOrchestratorMakersCheckerValidation(packet, rawResponse, onStep);
      }
    } else if (expertBudget.isExhausted()) {
      console.warn(
        `[SovereignOrchestrator] ⚠️ Budget épuisé avant l'étape d'exécution.`,
      );
    }

    // ── 9. Compilation du packet ──────────────────────────────────────────────
    budget.checkpoint("total");
    packet.budget = {
      ...budget.summary(),
      expert_budget: expertBudget.summary(),
    };
    validateOrchestratorPacket(packet);

    return { rawResponse, packet };
  }

  // ── Helpers privés ───────────────────────────────────────────────────────────

  /**
   * Détection robuste d'une demande de génération massive ("Generator-First bypass").
   * Déléguée à shared/generatorFirstPolicy — interdit analyse de chemin existant.
   */
  _evaluateGeneratorFirstIntent(query) {
    return isGeneratorFirstIntent(query);
  }

  /**
   * Classification de l'intent basée sur la query et les images présentes.
   */
  _evaluateFileDrivenIntent(query, attachments) {
    const actionableExt = /\.(txt|csv|json|md|html|htm|php|js|css|ts|jsx|tsx|xml|yml|yaml)$/i;
    const hasActionableFile = attachments && attachments.length > 0 && attachments.some(file => {
      const name = file.originalname || file.name || "";
      return (
        actionableExt.test(name) ||
        (file.mimetype && file.mimetype.startsWith("text/"))
      );
    });

    // Absolu, relatif projects/, ./… — pas seulement file:/// ou /unix.
    // Strip http(s) d'abord : sinon https://host/…/index.php → faux positif INLINE_FILE.
    const queryForLocalPaths = stripHttpUrlSpans(query);
    const inlineFileRegex =
      /(?:file:\/\/\/|[a-zA-Z]:\\|\/(?:[a-zA-Z0-9_.-]+\/)+|(?:^|\s)(?:\.\/|\.\.\/)?projects\/)[a-zA-Z0-9_./\\-]+\.(txt|csv|json|md|html|htm|php|js|css|ts|jsx|tsx)\b/i;
    const hasInlineFile =
      inlineFileRegex.test(queryForLocalPaths) ||
      Boolean(extractLocalFileReference(query));

    if (!hasActionableFile && !hasInlineFile) return null;

    const executionVerbs = /\b(crée|créer|génère|générer|convertis|convertir|transforme|transformer|code|coder|implémente|implémenter|bâtis|bâtir|fais|faire|construis|construire)\b/i;
    const analysisVerbs = /\b(analyse|analyser|explique|expliquer|lis|lire|vérifie|vérifier|audite|auditer|audit|regarde|inspecte|inspecter)\b/i;

    if (hasActionableFile && executionVerbs.test(query)) {
      const executionContract =
        "Tu dois produire l'artefact technique demandé en extrayant et en utilisant exhaustivement les données du fichier fourni. " +
        "Il est strictement interdit de te contenter d'un tutoriel générique, d'un simple squelette vide, ou de renvoyer le travail à l'utilisateur. " +
        "Le code ou le contenu que tu produis doit déjà contenir les vraies données issues du fichier et être directement exploitable.";

      return {
        forcedIntent: "expert_task",
        executionContract,
        forbiddenFlags: ["generic_tutorial_instead_of_artifact", "file_not_used", "work_pushed_back_to_user", "ghost_tool_usage"],
        allowPostHocExplanation: true
      };
    }

    if (hasActionableFile && analysisVerbs.test(query) && !hasInlineFile) {
      const names = (attachments || [])
        .map((f) => f.originalname || f.name)
        .filter(Boolean)
        .join(", ");
      return {
        contract_name: "ATTACHED_DOCUMENT_ANALYSIS_V1",
        forcedIntent: "expert_task",
        executionContract:
          "Tu dois analyser le(s) document(s) joint(s) par l'utilisateur (" +
          (names || "fichier joint") +
          "). " +
          "Base-toi exclusivement sur le contenu injecté dans le briefing CONTEXT — pas de généralités hors document. " +
          "Structure ta réponse : points clés, éléments notables, et limites de ce que le fichier ne couvre pas.",
        forbiddenFlags: ["generic_answer_without_document", "file_not_used"],
        allowPostHocExplanation: true,
      };
    }

    if (hasInlineFile && (analysisVerbs.test(query) || !executionVerbs.test(query))) {
       const targetPath = this._extractPathFromUserMessage(query);
       const ref = extractLocalFileReference(query);
       const resolved = ref ? resolveWorkspaceReadablePath(ref) : { ok: false, reason: "empty_path" };

       // Rule 2 — pas de contrat INLINE sans cible résolue / lisible.
       if (!resolved.ok || !targetPath || targetPath === "file:///" || /^file:\/\/\/?$/i.test(targetPath)) {
         return {
           contract_name: "INLINE_FILE_ANALYSIS_V4_1",
           requires_inline_file_analysis: true,
           target_path: resolved.relativePath || targetPath || "",
           resolved_path: resolved.absolutePath || null,
           access_precondition_failed: true,
           access_failure_reason: resolved.reason || "unresolved_path",
           forcedIntent: "expert_task",
           executionContract:
             "PRÉCONDITION ÉCHOUÉE : le chemin fichier n'a pas pu être résolu ou lu. " +
             "Réponds UNIQUEMENT qu'aucune analyse n'est possible sans fichier accessible. " +
             "Ne simule pas le contenu. Ne lance pas de génération.",
           forbiddenFlags: ["file_not_actually_analyzed", "ghost_analysis"],
           skip_critic_retry: true,
           enforcement: {
             min_evidence_items: 0,
             max_evidence_items: 0,
             require_unknowns: true,
             fail_on_missing_schema: false,
           },
         };
       }

       return {
         contract_name: "INLINE_FILE_ANALYSIS_V4_1",
         requires_inline_file_analysis: true,
         target_path: resolved.relativePath || targetPath,
         resolved_path: resolved.absolutePath,
         forcedIntent: "expert_task",
         executionContract: this._buildInlineFileAnalysisSystemClause({
           target_path: resolved.relativePath || targetPath,
           enforcement: { min_evidence_items: 2, max_evidence_items: 5 },
         }),
         forbiddenFlags: [],
         enforcement: {
           min_evidence_items: 2,
           max_evidence_items: 5,
           require_unknowns: true,
           fail_on_missing_schema: true,
           fail_on_unsupported_external_inference: true
         }
       };
    }

    return null;
  }

  _buildInlineFileAnalysisSystemClause(contract) {
    return `[INLINE FILE ANALYSIS CONTRACT — V4.1]

La requête exige l'analyse d'un fichier explicite.
Chemin cible: ${contract.target_path || "(non détecté)"}

OBLIGATIONS :
1) Ouvre/lis le fichier ciblé avec les outils disponibles avant toute conclusion.
2) Analyse uniquement ce qui est démontrable par le contenu réel du fichier.
3) Retourne STRICTEMENT un objet JSON avec :
   - target_path
   - access_status
   - evidence
   - findings
   - unknowns
   - forbidden_speculation
4) evidence doit contenir entre ${contract.enforcement.min_evidence_items} et ${contract.enforcement.max_evidence_items} éléments si access_status != "failed".
5) Chaque finding doit contenir:
   - claim
   - evidence_refs (tableau de IDs d'evidence, ex: ["E1","E2"])
6) Si l'accès échoue, retourne access_status="failed", evidence=[], findings=[], et explique l'incertitude dans unknowns.
7) Il est strictement interdit d'affirmer quoi que ce soit sur l'hébergement, le serveur, le réseau, les erreurs HTTP, la base de données ou l'architecture externe sans preuve textuelle explicite présente dans le fichier.
8) Tout ce qui n'est pas démontrable doit être placé dans unknowns.

FAIL AUTOMATIQUE SI :
- aucune preuve concrète du fichier,
- chemin analysé différent du chemin demandé,
- findings sans evidence_refs,
- spéculation externe non prouvée,
- analyse fictive malgré échec d'accès.`;
  }

  _extractPathFromUserMessage(text) {
    const ref = extractLocalFileReference(text);
    if (ref?.uri) return ref.uri;

    const patterns = [
      /\bfile:\/\/\/?[^\s"'`]+/i,
      /\b((?:\.\/|\.\.\/)?projects\/[^\s"'`]+\.(?:html?|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))\b/i,
      /(?:^|\s)(\/[^\s"'`]+\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i,
      /(?:^|\s)(\.{1,2}\/[^\s"'`]+\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i
    ];
    for (const rx of patterns) {
      const m = (text || "").match(rx);
      if (m) return (m[1] || m[0]).trim();
    }
    return "";
  }

  _classifyIntent(query, images = []) {
    const q = query.toLowerCase().trim();

    if (images.length > 0) {
      const imageOnly = images.filter((f) => f.mimetype?.startsWith("image/"));
      const docOnly = images.filter((f) => !f.mimetype?.startsWith("image/"));
      if (docOnly.length > 0 && imageOnly.length === 0) {
        if (isAttachedDocumentAnalysisRequest(query, docOnly)) {
          return "expert_task";
        }
        return "factual_heavy";
      }
      if (imageOnly.length > 0) return "vision";
    }
    if (isIdeationRequest(query)) return "ideation";

    // Utiliser le classificateur d'intent existant si disponible
    try {
      const result = intentClassifier.classifyIntent(q);
      if (result && result.intent) {
        const intent = result.intent;
        if (intent === intentClassifier.INTENT_TAXONOMY?.SAFETY) return "safety";
        return intent; // Propulse directement "social_chit_chat", "expert_task", etc.
      }
    } catch (e) {
      // Fallback silencieux : on laisse les heuristiques locales terminer la classification.
      console.warn("[SovereignOrchestrator] Intent classification error:", e.message);
    }

    // Heuristiques complémentaires
    const wordCount = q.split(/\s+/).filter(Boolean).length;
    if (
      wordCount <= 5 &&
      /^(bonjour|salut|hello|coucou|bonsoir|merci|ok|oui|non|super|bien|parfait)/.test(
        q,
      )
    )
      return "social";

    const technicalMarkers = [
      "bug",
      "erreur",
      "log",
      "crash",
      "stack",
      "trace",
      "debug",
      "exception",
      "undefined",
      "null pointer",
      "cors",
      "timeout",
      "deploy",
      "pipeline",
    ];
    if (technicalMarkers.some((m) => q.includes(m)))
      return "technical_diagnostic";

    if (wordCount > 20) return "factual_heavy";
    return "factual_light";
  }

  /**
   * Réponses directes pour les gates rapides (social / safety) sans LLM.
   */
  _buildDirectResponse(intent) {
    if (intent === "safety") {
      return "**POLITIQUE DE CONFIDENTIALITÉ NEXXUS** : Vos données restent locales et souveraines.";
    }
    if (intent === "social_chit_chat" || intent === "social") {
      return "Oui bien sûr, on discute de quoi ?";
    }
    // Le pipeline social gérera cela via le chemin déterministe existant
    return null;
  }
}

export default SovereignOrchestrator;

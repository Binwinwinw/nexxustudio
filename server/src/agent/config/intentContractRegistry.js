/**
 * Intent Contract Registry v1.2 — source unique intent → routage → mode réponse.
 * Voir ADR-20260527-Intent-Contract-Registry et intentContractRegistry.schema.json
 */
import {
  isIdeationRequest,
  isAttachedDocumentAnalysisRequest,
  isAnalyticalTechnicalRequest,
  isDocumentAnalysisIntent,
  isAttachedVisionRequest,
  buildAttachmentPacketMeta,
  isConversationMemoryRecallRequest,
  isAttachedVideoAnalysisRequest,
  isVideoAnalysisIntent,
  hasVideoAttachments,
  isDesignCreateIntent,
  isDesignAuditIntent,
  isDesignExtractIntent,
  isArchitectureDesignIntent,
} from "../utils/conversationGuards.js";
import {
  RESPONSE_MODES,
  isOpenProjectIdeation,
  isGreetingOrIntroduction,
} from "./modeResponseContracts.js";
import { isCodeGenerationRequest } from "../policies/code/codeDeliveryPolicy.js";
import { isCodeIntentRequest } from "../policies/code/codeIntentPolicy.js";
import { isCodeReviewRequest } from "../policies/code/codeReviewPolicy.js";
import { requiresGenerousComposerResponse } from "../policies/routing/practicalAdviceRoutingGuard.js";
import { isSocialAcceptanceOfOffer } from "../policies/social/index.js";
import { isMetaCapabilitiesIntent } from "../policies/meta/metaCapabilitiesPolicy.js";
import { isPresentationOutlineRequest } from "../utils/presentationOutlineIntentGuards.js";
import { isGuidedProductRecommendationRequest } from "../policies/guided/index.js";
import { isGuidedDocumentSynthesisRequest } from "../policies/guided/index.js";
import { isGuidedCreationScopingContractRequest } from "../policies/guided/index.js";
import { isMetaAssistantBehaviorRequest, isComprehensionDemonstrationRequest } from "../utils/metaAssistantBehaviorGuards.js";
import { isIdeationIntent } from "../utils/ideationIntentGuards.js";
import { isAssistantUtteranceClarifyRequest } from "../policies/qualification/assistantUtteranceClarifyPolicy.js";
import { isReactAuditRequest } from "../utils/reactAuditIntentGuards.js";
import {
  isExplicitWebSearchRequest,
  isFreshFactualCompareWithWebRequest,
  isWebCitationsStructuredReportCluster,
} from "../policies/routing/explicitWebSearchRequestPolicy.js";
import { isCompareChooseRequest } from "../utils/compareChooseIntentGuards.js";
import { isResearchThenSummarizeRequest } from "../policies/routing/researchThenSummarizePolicy.js";
import { isRepoAnalysisRequest } from "../utils/repoAnalysisIntentGuards.js";
import {
  extractCodeProjectLightSlots,
  isCodeProjectLightRequest,
} from "../policies/code/codeProjectLightPolicy.js";
import { isFormalLetterTemplateRequest } from "../policies/delivery/index.js";

const GUARDS = {
  isIdeationRequest: (query, packet) => isIdeationRequest(query),
  isOpenProjectIdeation: (query, packet) => isOpenProjectIdeation(query, packet),
  isAnalyticalTechnicalRequest: (query) => isAnalyticalTechnicalRequest(query),
  isDocumentAnalysisIntent: (query, packet) => {
    const refs = packet?.meta?._attachment_refs || [];
    if (isRepoAnalysisRequest(query, { attachments: refs })) return false;
    return isDocumentAnalysisIntent(query, refs);
  },
  isRepoAnalysisRequest: (query, packet) => {
    const refs = packet?.meta?._attachment_refs || [];
    return isRepoAnalysisRequest(query, { attachments: refs });
  },
  isResearchThenSummarizeRequest: (query, packet) => {
    const refs = packet?.meta?._attachment_refs || [];
    if (isRepoAnalysisRequest(query, { attachments: refs })) return false;
    return isResearchThenSummarizeRequest(query, { attachments: refs });
  },
  isExplicitSourceCompilationRequest: (query) => {
    if (isWebCitationsStructuredReportCluster(query)) return true;
    const q = String(query || "").toLowerCase();
    return /\b(sources?|citations?|articles?|liens?|urls?|documentation web|bibliographie|retourne.*web|cite.*web|trouve.*web)\b/.test(
      q,
    );
  },
  isSocialQuery: (query) => {
    const q = String(query || "").toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    if (
      words.length <= 5 &&
      /^(bonjour|salut|hello|coucou|bonsoir|merci|ok|oui|non|super|bien|parfait)/.test(
        q,
      )
    ) {
      return true;
    }
    // Small talk / invitation à discuter (évite GUIDED_* sur normal_conversation)
    if (
      /\b(?:discuter|parler|ca va|ça va|comment (?:ca |ça )?va|comment vas[- ]?tu)\b/.test(
        q,
      ) &&
      !/\b(?:smartphone|produit|acheter|budget|conseil|recommand)/.test(q)
    ) {
      return true;
    }
    return false;
  },
  isInstantCommand: (query) => {
    const q = String(query || "").toLowerCase().trim();
    return q.startsWith("/") && !q.includes(" ");
  },
  hasAttachedDocumentContext: (query, packet) => {
    if (packet?.meta?.has_attached_documents) {
      return isAttachedDocumentAnalysisRequest(
        query,
        packet.meta._attachment_refs || [{ name: "attached" }],
      );
    }
    const q = String(query || "").toLowerCase();
    return (
      /\b(analyse|analyser|résume|explique)\b/.test(q) &&
      /\b(fichier|document)\b/.test(q) &&
      /\b(ajouté|ajoute|joint|conversation|contexte)\b/.test(q)
    );
  },
  hasAttachedVisionContext: (query, packet) => {
    if (!packet?.meta?.has_attached_images) return false;
    return isAttachedVisionRequest(
      query,
      packet.meta._attachment_refs || [],
    );
  },
  hasAttachedVideoContext: (query, packet) => {
    if (packet?.meta?.has_attached_videos) {
      return isAttachedVideoAnalysisRequest(
        query,
        packet.meta._attachment_refs || [],
      );
    }
    return isVideoAnalysisIntent(query, packet.meta?._attachment_refs || []);
  },
  isDesignExtractIntent: (query) => isDesignExtractIntent(query),
  isDesignAuditIntent: (query) => isDesignAuditIntent(query),
  isDesignCreateIntent: (query, packet) => {
    const attachments = packet?.meta?._attachment_refs || [];
    if (isResearchThenSummarizeRequest(query, { attachments })) return false;
    return isDesignCreateIntent(query);
  },
  isArchitectureDesignIntent: (query) => isArchitectureDesignIntent(query),
  isForgeWebappProductionIntent: (query, packet) => {
    if (packet?.meta?.forge_production === true) return true;
    return /\[FORGE_PRODUCTION\s*[—-]/i.test(String(query || ""));
  },
  isCodeDeliveryRequest: (query, packet) => {
    if (packet?.meta?.forge_production === true) return false;
    if (/\[FORGE_PRODUCTION\s*[—-]/i.test(String(query || ""))) return false;
    if (isCodeProjectLightRequest(query)) return false;
    return isCodeGenerationRequest(query);
  },
  isCodeIntentRequest: (query) => isCodeIntentRequest(query),
  isCodeReviewRequest: (query) => isCodeReviewRequest(query),
  isPresentationOutlineRequest: (query) => isPresentationOutlineRequest(query),
  isGuidedProductRecommendationRequest: (query, packet) =>
    isGuidedProductRecommendationRequest(query, packet),
  isGuidedDocumentSynthesisRequest: (query, packet) =>
    isGuidedDocumentSynthesisRequest(query, packet),
  isGuidedCreationScopingContractRequest: (query, packet) =>
    isGuidedCreationScopingContractRequest(query, packet),
  isFormalLetterTemplateRequest: (query, packet) => {
    const attachments = packet?.meta?._attachment_refs || [];
    return isFormalLetterTemplateRequest(query, { attachments });
  },
  isCodeProjectLightRequest: (query, packet) => {
    if (packet?.meta?.forge_production === true) return false;
    return isCodeProjectLightRequest(query);
  },
};

/** @type {import('../contracts/intentContractRegistry.schema.json')} */
export const INTENT_CONTRACT_REGISTRY = [
  {
    id: "CODE_PROJECT_LIGHT",
    version: "1.0.0",
    label: "Projet web léger — HTML/CSS/JS + fichiers",
    description:
      "Trio index.html / style.css / app.js généré et enregistré sous projects/ — pas Forge webapp.",
    orchestratorIntents: ["expert_task"],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 930,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 1,
      orchestratorMode: "OPERATIONAL",
    },
    detection: { guard: "isCodeProjectLightRequest" },
    observability: {
      logTag: "codeProjectLight",
      fallbackReasonPrefix: "code_project_light_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "Crée une page HTML/CSS/JS simple pour présenter la citadelle, enregistre les fichiers dans projects/demo-citadelle",
      mustNotContain: [
        "Je n'ai pas assez d'éléments fiables pour répondre correctement",
        "© 2023",
      ],
      mustContain: ["index.html", "style.css", "app.js"],
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "CODE_DELIVERY_V1",
    version: "1.0.0",
    label: "Livraison code (HTML/CSS/JS/Python)",
    description:
      "Génération de livrable code complet — pas pipeline Forge PM/ARCH/DEV.",
    orchestratorIntents: ["expert_task"],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 928,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 1,
      orchestratorMode: "OPERATIONAL",
    },
    detection: { guard: "isCodeDeliveryRequest" },
    observability: {
      logTag: "codeDelivery",
      fallbackReasonPrefix: "code_delivery_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "crée un fichier html avec header sidebar pour un atelier notion",
      mustNotContain: [
        "Je n'ai pas assez d'éléments fiables pour répondre correctement",
        "smartphone",
        "© 2023",
      ],
      mustContain: ["<aside", "@media", "nav"],
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "FORGE_WEBAPP_BUILD",
    version: "1.0.0",
    label: "Production Forge — build webapp",
    description:
      "Phases PM/ARCH/DEV/QA sur brief validé — livrables concrets, pas idéation ni Nexxus Design.",
    orchestratorIntents: ["expert_task"],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 925,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 1,
      orchestratorMode: "OPERATIONAL",
      skillId: null,
    },
    detection: { guard: "isForgeWebappProductionIntent" },
    observability: {
      logTag: "forgeWebappBuild",
      fallbackReasonPrefix: "forge_webapp_build_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "[FORGE_PRODUCTION — DEVELOPER] Livrable code Vite React calculatrice",
      mustNotContain: ["Laquelle t'intéresse", "Voici 3 pistes"],
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-20260608-Subject-Intelligence-Layer",
  },
  {
    id: "PRESENTATION_OUTLINE",
    version: "1.0.0",
    label: "Plan présentation slides / scénario pédagogique",
    description:
      "Sommaire titres/sous-titres et découpage modules — pas Forge webapp ni livraison code.",
    orchestratorIntents: ["strategic", "unknown", "expert_task"],
    responseMode: RESPONSE_MODES.OPEN_PROPOSITION,
    priority: 931,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: true,
      maxActiveExperts: 0,
      orchestratorMode: "IDEATION",
    },
    detection: { guard: "isPresentationOutlineRequest" },
    observability: {
      logTag: "presentationOutline",
      fallbackReasonPrefix: "presentation_outline_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "fait un plan pour une présentation en slides de Teams365 avec sommaire et scénario pédagogique 6 fois 4h",
      mustNotContain: ["FORGE", "webapp", "Production Forge"],
      expectedResponseMode: "OPEN_PROPOSITION",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "IDEATION_OPEN",
    version: "1.0.0",
    label: "Idéation projet ouverte",
    description:
      "L'utilisateur cherche quoi construire, pas une compilation de sources.",
    orchestratorIntents: ["ideation"],
    responseMode: RESPONSE_MODES.OPEN_PROPOSITION,
    priority: 900,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 2,
      orchestratorMode: "IDEATION",
    },
    detection: { guard: "isOpenProjectIdeation" },
    observability: {
      logTag: "openProposition",
      fallbackReasonPrefix: "open_proposition_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi",
      mustNotContain: [
        "Je n'ai pas assez d'éléments fiables pour répondre correctement",
      ],
      mustMatch: ["Laquelle t'intéresse \\?", "1\\. \\*\\*"],
      expectedResponseMode: "OPEN_PROPOSITION",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "ARCHITECTURE_OPTIONS",
    version: "1.1.0",
    label: "Conception architecture (comment créer X)",
    description:
      "Demande de conception — 2–3 options courtes, pas pipeline EXPERT_TASK lourd.",
    orchestratorIntents: ["ideation"],
    responseMode: RESPONSE_MODES.OPEN_PROPOSITION,
    priority: 910,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 0,
      orchestratorMode: "IDEATION",
    },
    detection: { guard: "isArchitectureDesignIntent" },
    observability: {
      logTag: "architectureOptions",
      fallbackReasonPrefix: "architecture_options_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "comment créer un code-reviewer qui analyse tout le code d'un projet",
      mustNotContain: ["skill-industrial-maturation", "via l'orchestrateur"],
      mustMatch: ["3 approches", "Je partirais plutôt", "Prochain pas"],
      expectedResponseMode: "OPEN_PROPOSITION",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "DOCUMENT_ATTACHED",
    version: "1.0.0",
    label: "Analyse document joint",
    description:
      "Fichier texte joint + demande d'analyse — pipeline documentaire complet, pas SIMPLE_FAST.",
    orchestratorIntents: ["expert_task", "factual_heavy", "factual_light"],
    responseMode: RESPONSE_MODES.DOCUMENT,
    priority: 850,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 2,
      orchestratorMode: "EPISTEMIC",
    },
    detection: { guard: "hasAttachedDocumentContext" },
    observability: {
      logTag: "documentAttached",
      fallbackReasonPrefix: "document_attached_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "peux tu faire une analyse du fichier ajouté à la conversation",
      expectedResponseMode: "DOCUMENT",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "VISION_ATTACHED",
    version: "1.0.0",
    label: "Analyse image jointe",
    description:
      "Capture ou image jointe — pipeline vision orchestrateur, pas SIMPLE_FAST.",
    orchestratorIntents: ["vision"],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 845,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 2,
      orchestratorMode: "EPISTEMIC",
    },
    detection: { guard: "hasAttachedVisionContext" },
    observability: {
      logTag: "visionAttached",
      fallbackReasonPrefix: "vision_attached_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "décris cette capture",
      packetMeta: {
        has_attached_images: true,
        _attachment_refs: [{ name: "capture.png", mimetype: "image/png" }],
      },
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "VIDEO_ANALYSIS",
    version: "1.0.0",
    label: "Analyse vidéo Nexxus Video",
    description:
      "Vidéo MP4 jointe ou demande explicite — job asynchrone skill-nexxus-video, pas chat synchrone.",
    orchestratorIntents: ["expert_task", "factual_heavy", "vision"],
    responseMode: RESPONSE_MODES.DOCUMENT,
    priority: 855,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 1,
      orchestratorMode: "EPISTEMIC",
      asyncJob: true,
      skillId: "skill-nexxus-video",
    },
    detection: { guard: "hasAttachedVideoContext" },
    observability: {
      logTag: "nexxusVideo",
      fallbackReasonPrefix: "video_analysis_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "résume la vidéo jointe et extrais les moments clés",
      packetMeta: {
        has_attached_videos: true,
        _attachment_refs: [{ name: "demo.mp4", mimetype: "video/mp4" }],
      },
      expectedResponseMode: "DOCUMENT",
    },
    adrRef: "ADR-20260601-Nexxus-Video",
  },
  {
    id: "DESIGN_EXTRACT",
    version: "1.0.0",
    label: "Extraction ADN design (Design Extract)",
    description:
      "Rétro-ingénierie visuelle d'un site — palette, patterns, tokens, prompt reproduction.",
    orchestratorIntents: ["expert_task", "factual_heavy"],
    responseMode: RESPONSE_MODES.DOCUMENT,
    priority: 800,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 1,
      orchestratorMode: "EPISTEMIC",
      skillId: "skill-design-extract",
    },
    detection: { guard: "isDesignExtractIntent" },
    observability: {
      logTag: "designExtract",
      fallbackReasonPrefix: "design_extract_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "extrais l'ADN design de ce site et prépare un dossier de référence",
      expectedResponseMode: "DOCUMENT",
    },
    adrRef: "ADR-20260601-Suite-Design-Nexxus",
  },
  {
    id: "DESIGN_AUDIT",
    version: "1.0.0",
    label: "Audit qualité design (Impeccable)",
    description:
      "Critique UI/UX — score, issues, quick wins, blockers pre-merge. N'invente pas.",
    orchestratorIntents: ["expert_task"],
    responseMode: RESPONSE_MODES.CRITICAL,
    priority: 790,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 1,
      orchestratorMode: "EPISTEMIC",
      skillId: "skill-impeccable",
    },
    detection: { guard: "isDesignAuditIntent" },
    observability: {
      logTag: "impeccable",
      fallbackReasonPrefix: "design_audit_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "audite cette page ui et liste les incohérences design",
      expectedResponseMode: "CRITICAL",
    },
    adrRef: "ADR-20260601-Suite-Design-Nexxus",
  },
  {
    id: "REPO_ANALYSIS",
    version: "1.0.0",
    label: "Revue technique de dépôt",
    description:
      "Analyse structurée d'un dépôt (GitHub ou projects/) — REPO_ANALYSIS_V1, pas DOCUMENT social.",
    orchestratorIntents: ["expert_task", "technical_diagnostic"],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 790,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 2,
      orchestratorMode: "EPISTEMIC",
      webSearchMaxSources: 6,
      webSearchTimeoutMs: 14000,
    },
    detection: { guard: "isRepoAnalysisRequest" },
    observability: {
      logTag: "repoAnalysis",
      fallbackReasonPrefix: "repo_analysis_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "analyse le dépôt https://github.com/JuliusBrussee/caveman",
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-Repo-Analysis-V1",
  },
  {
    id: "RESEARCH_THEN_SUMMARIZE",
    version: "1.0.0",
    label: "Recherche externe puis synthèse",
    description:
      "Aller chercher une source externe (GitHub, web) puis résumer utilité et conception.",
    orchestratorIntents: [],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 785,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: false,
      maxActiveExperts: 1,
      orchestratorMode: "OPERATIONAL",
      webSearchMaxSources: 5,
      webSearchTimeoutMs: 12000,
    },
    detection: { guard: "isResearchThenSummarizeRequest" },
    observability: {
      logTag: "researchThenSummarize",
      fallbackReasonPrefix: "research_then_summarize_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        'j\'ai entendu parler d\'un dépôt github dont le nom est "caveman" vas te renseigner là dessus et fait moi un résumé consistant sur son utilité et sa conception',
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-Research-Then-Summarize",
  },
  {
    id: "FORMAL_LETTER_TEMPLATE",
    version: "1.0.0",
    label: "Modèle de courrier formel",
    description:
      "Lettre type administrative (résiliation, réclamation…) — template local sans web ni Document Analysis.",
    orchestratorIntents: [],
    responseMode: RESPONSE_MODES.INSTANT,
    priority: 787,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: true,
      maxActiveExperts: 0,
      orchestratorMode: "DIRECT",
    },
    detection: { guard: "isFormalLetterTemplateRequest" },
    observability: {
      logTag: "formalLetterTemplate",
      fallbackReasonPrefix: "formal_letter_template_",
      recordFallbackIncident: false,
    },
    smoke: {
      sampleQuery:
        "Donne-moi un modèle type de courrier de résiliation pour mon abonnement Canal+",
      expectedResponseMode: "INSTANT",
    },
    adrRef: "ADR-Formal-Letter-Template",
  },
  {
    id: "DESIGN_CREATE",
    version: "1.0.0",
    label: "Création design (Nexxus Design)",
    description:
      "Direction artistique, design system, composants, blueprint — proposition Forge-ready.",
    orchestratorIntents: ["expert_task", "ideation"],
    responseMode: RESPONSE_MODES.OPEN_PROPOSITION,
    priority: 780,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 1,
      orchestratorMode: "IDEATION",
      skillId: "skill-nexxus-design",
    },
    detection: { guard: "isDesignCreateIntent" },
    observability: {
      logTag: "nexxusDesign",
      fallbackReasonPrefix: "design_create_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "conçois une landing dark mode pour La Citadelle avec design system",
      expectedResponseMode: "OPEN_PROPOSITION",
    },
    adrRef: "ADR-20260601-Suite-Design-Nexxus",
  },
  {
    id: "GUIDED_PRODUCT_RECOMMENDATION",
    version: "1.0.0",
    label: "Recommandation produit guidée",
    description:
      "Compare/choose produit avec slots remplis — web search borné (3 sources, 8s).",
    orchestratorIntents: [],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 715,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: false,
      maxActiveExperts: 1,
      orchestratorMode: "OPERATIONAL",
      webSearchMaxSources: 3,
      webSearchTimeoutMs: 8000,
    },
    detection: { guard: "isGuidedProductRecommendationRequest" },
    observability: {
      logTag: "guidedProductReco",
      fallbackReasonPrefix: "guided_product_reco_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "meilleur smartphone 2026 budget 500 euros pour photo",
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-G31-Guided-Product-Recommendation",
  },
  {
    id: "GUIDED_DOCUMENT_SYNTHESIS",
    version: "1.0.0",
    label: "Synthèse document guidée",
    description:
      "Résumé/synthèse ancré à la source — pas de web search, décodage conservateur.",
    orchestratorIntents: [],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 712,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: true,
      maxActiveExperts: 0,
      orchestratorMode: "OPERATIONAL",
      synthesisTemperature: 0.2,
      synthesisMaxTokens: {
        short: 400,
        medium: 800,
      },
    },
    detection: { guard: "isGuidedDocumentSynthesisRequest" },
    observability: {
      logTag: "guidedDocumentSynthesis",
      fallbackReasonPrefix: "guided_document_synthesis_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "Résume ce document joint en mettant en avant les idées principales",
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-G32-Guided-Document-Synthesis",
  },
  {
    id: "GUIDED_CREATION_SCOPING",
    version: "1.0.0",
    label: "Création guidée — réflexion orientée",
    description:
      "code/create et web_html/create — LLM warm avec contraintes extraites, pas gabarit déterministe.",
    orchestratorIntents: [],
    responseMode: RESPONSE_MODES.OPEN_PROPOSITION,
    priority: 920,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: true,
      maxActiveExperts: 0,
      orchestratorMode: "OPERATIONAL",
    },
    detection: { guard: "isGuidedCreationScopingContractRequest" },
    observability: {
      logTag: "guidedCreationScoping",
      fallbackReasonPrefix: "guided_creation_scoping_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?",
      expectedResponseMode: "OPEN_PROPOSITION",
    },
    adrRef: "ADR-Guided-Creation-Scoping",
  },
  {
    id: "DIRECT_EXPLANATION",
    version: "1.0.0",
    label: "Explication directe gouvernée",
    description:
      "Réponse factuelle courte issue d'un RequestInterpreter haute confiance — pas livraison code.",
    orchestratorIntents: ["factual_light", "normal_conversation"],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 700,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: false,
      maxActiveExperts: 1,
      orchestratorMode: "EPISTEMIC",
    },
    observability: {
      logTag: "directExplanation",
      fallbackReasonPrefix: "direct_explanation_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "peut-on localiser un ordinateur Windows 11 avec son ID-produit ?",
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "FACTUAL_RESEARCH",
    version: "1.0.0",
    label: "Recherche factuelle",
    description: "Synthèse documentaire ou web avec grounding strict.",
    orchestratorIntents: ["factual_light", "factual_heavy", "expert_task"],
    responseMode: RESPONSE_MODES.DOCUMENT,
    priority: 400,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 2,
      orchestratorMode: "EPISTEMIC",
      webSearchMaxSources: 10,
    },
    detection: { guard: "isExplicitSourceCompilationRequest" },
    observability: { logTag: "factualResearch", recordFallbackIncident: true },
    smoke: {
      sampleQuery: "trouve des articles web sur RAG local avec sources",
      expectedResponseMode: "DOCUMENT",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "CODE_INTENT",
    version: "1.0.0",
    label: "Intention code (revue, debug, explication, refactor)",
    description:
      "Snippet exécutable collé — jamais routé vers Document Analysis. Contrat selon sous-type.",
    orchestratorIntents: ["expert_task", "technical_diagnostic", "factual_heavy"],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 560,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 1,
      orchestratorMode: "OPERATIONAL",
    },
    detection: { guard: "isCodeIntentRequest" },
    observability: {
      logTag: "codeIntent",
      fallbackReasonPrefix: "code_intent_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery:
        "Fais une revue de code Python de ce snippet. Commence par les erreurs bloquantes.",
      expectedResponseMode: "COMPOSER",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "DOCUMENT_ANALYSIS",
    version: "1.0.0",
    label: "Analyse documentaire (verbe)",
    description:
      "Résume, extrait ou analyse sans court-circuit SIMPLE_FAST.",
    orchestratorIntents: ["expert_task", "factual_heavy", "factual_light"],
    responseMode: RESPONSE_MODES.DOCUMENT,
    priority: 480,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 2,
      orchestratorMode: "EPISTEMIC",
    },
    detection: { guard: "isDocumentAnalysisIntent" },
    observability: {
      logTag: "documentAnalysis",
      fallbackReasonPrefix: "document_analysis_",
      recordFallbackIncident: true,
    },
    smoke: {
      sampleQuery: "résume ce passage",
      expectedResponseMode: "DOCUMENT",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "DIAGNOSTIC",
    version: "1.0.0",
    label: "Diagnostic technique",
    description: "Analyse, audit, debug — prudence épistémique élevée.",
    orchestratorIntents: ["technical_diagnostic", "expert_task"],
    responseMode: RESPONSE_MODES.CRITICAL,
    priority: 500,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: false,
      maxActiveExperts: 2,
      orchestratorMode: "EPISTEMIC",
    },
    detection: { guard: "isAnalyticalTechnicalRequest" },
    observability: { logTag: "diagnostic", recordFallbackIncident: true },
    smoke: {
      sampleQuery: "analyse cette erreur de timeout dans le pipeline",
      expectedResponseMode: "CRITICAL",
    },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "SOCIAL",
    version: "1.0.0",
    label: "Échange social court",
    orchestratorIntents: ["social", "social_chit_chat"],
    responseMode: RESPONSE_MODES.INSTANT,
    priority: 718,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: true,
      maxActiveExperts: 0,
      orchestratorMode: "SOCIAL",
    },
    detection: { guard: "isSocialQuery" },
    observability: { logTag: "social", recordFallbackIncident: false },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "INSTANT",
    version: "1.0.0",
    label: "Commande instantanée",
    orchestratorIntents: [],
    responseMode: RESPONSE_MODES.INSTANT,
    priority: 950,
    routing: {
      bypassSimpleFast: true,
      skipWebSearch: true,
      maxActiveExperts: 0,
    },
    detection: { guard: "isInstantCommand" },
    observability: { logTag: "instant", recordFallbackIncident: false },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
  {
    id: "CONVERSATION_STANDARD",
    version: "1.0.0",
    label: "Conversation standard",
    description: "Fallback — composer classique, 1–2 experts max.",
    orchestratorIntents: [
      "unknown",
      "normal_conversation",
      "factual_light",
      "expert_task",
    ],
    responseMode: RESPONSE_MODES.COMPOSER,
    priority: 0,
    routing: {
      bypassSimpleFast: false,
      skipWebSearch: false,
      maxActiveExperts: 2,
      orchestratorMode: "OPERATIONAL",
    },
    observability: { logTag: "composer", recordFallbackIncident: true },
    adrRef: "ADR-20260527-Intent-Contract-Registry",
  },
];

const DEFAULT_CONTRACT = INTENT_CONTRACT_REGISTRY.find(
  (c) => c.id === "CONVERSATION_STANDARD",
);

function runGuard(guardName, query, packet) {
  const fn = GUARDS[guardName];
  if (!fn) return false;
  return Boolean(fn(query, packet));
}

/**
 * Résout le contrat d'intention applicable.
 * @param {string} query
 * @param {{ user_intent?: string, meta?: object }} [packet]
 * @returns {{ contract: object, matchedBy: string }}
 */
export function resolveIntentContract(query = "", packet = {}) {
  if (
    isReactAuditRequest(query, {
      history: packet?.history || [],
      workspaceRoot: packet?.workspaceRoot,
      packageJsonHasReact: packet?.packageJsonHasReact,
    })
  ) {
    return {
      contract: DEFAULT_CONTRACT,
      matchedBy: "g48_react_audit_block",
    };
  }

  if (
    isMetaAssistantBehaviorRequest(query) ||
    isComprehensionDemonstrationRequest(query) ||
    isAssistantUtteranceClarifyRequest(query, { history: packet?.history || [] }) ||
    isIdeationIntent(query)
  ) {
    return {
      contract: DEFAULT_CONTRACT,
      matchedBy: "g44_sil_meta_ideation_block",
    };
  }

  const interpreterLock = packet?.meta?.interpreter_lock;
  if (interpreterLock?.locked && interpreterLock?.forced_contract_id) {
    const locked = INTENT_CONTRACT_REGISTRY.find(
      (c) => c.id === interpreterLock.forced_contract_id,
    );
    if (locked) {
      return {
        contract: locked,
        matchedBy: `interpreter_lock:${interpreterLock.rule || "unknown"}`,
      };
    }
  }

  const metaId = packet?.meta?.intent_contract_id;
  if (metaId) {
    const preforced = INTENT_CONTRACT_REGISTRY.find((c) => c.id === metaId);
    if (
      preforced &&
      (preforced.id === "GUIDED_PRODUCT_RECOMMENDATION" ||
        preforced.id === "RESEARCH_THEN_SUMMARIZE" ||
        preforced.id === "REPO_ANALYSIS" ||
        preforced.id === "FORMAL_LETTER_TEMPLATE" ||
        preforced.routing?.skipWebSearch === false)
    ) {
      return { contract: preforced, matchedBy: "meta.intent_contract_id" };
    }
  }

  if (isFreshFactualCompareWithWebRequest(query)) {
    const guidedProduct = INTENT_CONTRACT_REGISTRY.find(
      (c) => c.id === "GUIDED_PRODUCT_RECOMMENDATION",
    );
    if (
      guidedProduct &&
      isGuidedProductRecommendationRequest(query, packet)
    ) {
      return {
        contract: guidedProduct,
        matchedBy: "guard:isGuidedProductRecommendationRequest:explicit_web",
      };
    }
  }

  const sorted = [...INTENT_CONTRACT_REGISTRY].sort(
    (a, b) => b.priority - a.priority,
  );

  // Cluster web+citations+rapport : FACTUAL_RESEARCH avant PRESENTATION_OUTLINE
  if (isWebCitationsStructuredReportCluster(query)) {
    const factual = sorted.find((c) => c.id === "FACTUAL_RESEARCH");
    if (factual) {
      return {
        contract: factual,
        matchedBy: "web_citations_structured_report_cluster",
      };
    }
  }

  const presentationContract = sorted.find((c) => c.id === "PRESENTATION_OUTLINE");
  if (presentationContract?.detection?.guard) {
    if (runGuard(presentationContract.detection.guard, query, packet)) {
      return {
        contract: presentationContract,
        matchedBy: `guard:${presentationContract.detection.guard}`,
      };
    }
  }

  if (metaId) {
    const forced = INTENT_CONTRACT_REGISTRY.find((c) => c.id === metaId);
    if (forced) return { contract: forced, matchedBy: "meta.intent_contract_id" };
  }

  for (const contract of sorted) {
    if (contract.id === "PRESENTATION_OUTLINE") continue;
    if (contract.detection?.guard) {
      if (runGuard(contract.detection.guard, query, packet)) {
        return { contract, matchedBy: `guard:${contract.detection.guard}` };
      }
    }
  }

  const userIntent = packet?.user_intent;
  if (userIntent) {
    const byIntent = sorted.find((c) =>
      (c.orchestratorIntents || []).includes(userIntent),
    );
    if (
      byIntent?.id === "PRESENTATION_OUTLINE" &&
      (isCompareChooseRequest(query) ||
        isFreshFactualCompareWithWebRequest(query) ||
        isWebCitationsStructuredReportCluster(query))
    ) {
      if (isWebCitationsStructuredReportCluster(query)) {
        const factual = INTENT_CONTRACT_REGISTRY.find(
          (c) => c.id === "FACTUAL_RESEARCH",
        );
        if (factual) {
          return {
            contract: factual,
            matchedBy: "web_citations_report_blocks_presentation_outline",
          };
        }
      }
      const guidedProduct = INTENT_CONTRACT_REGISTRY.find(
        (c) => c.id === "GUIDED_PRODUCT_RECOMMENDATION",
      );
      if (
        guidedProduct &&
        isGuidedProductRecommendationRequest(query, packet)
      ) {
        return {
          contract: guidedProduct,
          matchedBy: "compare_choose_blocks_presentation_outline",
        };
      }
      return { contract: DEFAULT_CONTRACT, matchedBy: "compare_choose_blocks_presentation_outline" };
    }
    if (byIntent) return { contract: byIntent, matchedBy: `orchestrator:${userIntent}` };
  }

  return { contract: DEFAULT_CONTRACT, matchedBy: "default" };
}

export function getComposerObservabilityContext(packet = {}, query = "") {
  const contractId = packet?.meta?.intent_contract_id;
  const contract = contractId
    ? INTENT_CONTRACT_REGISTRY.find((c) => c.id === contractId)
    : null;
  const resolved = contract
    ? { contract, matchedBy: packet?.meta?.intent_contract_matched_by || "packet.meta" }
    : resolveIntentContract(query || packet?.user_query || "", packet);

  const expectedResponseMode =
    packet?.meta?.expected_response_mode || resolved.contract.responseMode;
  const obs = resolved.contract.observability || {};

  return {
    intentContractId: resolved.contract.id,
    intentContractMatchedBy:
      packet?.meta?.intent_contract_matched_by || resolved.matchedBy,
    expectedResponseMode,
    logTag: obs.logTag || resolved.contract.id.toLowerCase(),
    fallbackReasonPrefix:
      obs.fallbackReasonPrefix || `${resolved.contract.id.toLowerCase()}_`,
    recordFallbackIncident: obs.recordFallbackIncident !== false,
  };
}

export function applyIntentContractToPacket(packet, query = "") {
  const { contract, matchedBy } = resolveIntentContract(query, packet);
  packet.meta = packet.meta || {};
  packet.meta.intent_contract_id = contract.id;
  packet.meta.intent_contract_matched_by = matchedBy;
  packet.meta.intent_contract_version = contract.version;
  packet.meta.expected_response_mode = contract.responseMode;

  if (contract.responseMode === RESPONSE_MODES.OPEN_PROPOSITION) {
    packet.meta.open_proposition = true;
  }

  if (contract.id === "CODE_PROJECT_LIGHT") {
    packet.meta.write_artifact = true;
    packet.meta.code_project_light_slots = extractCodeProjectLightSlots(query);
  }

  return { contract, matchedBy };
}

export function isIdeationIntentContract(packet = {}) {
  return packet?.meta?.intent_contract_id === "IDEATION_OPEN";
}

export function shouldBypassSimpleFast(query = "", packet = {}, options = {}) {
  const attachments = options.images || options.attachments || [];
  const attachmentMeta = buildAttachmentPacketMeta(attachments);
  const enrichedPacket = {
    ...packet,
    meta: {
      ...(packet?.meta || {}),
      ...attachmentMeta,
    },
  };

  if (
    resolveIntentContract(query, enrichedPacket).contract.routing
      ?.bypassSimpleFast === true
  ) {
    return true;
  }

  if (options.forcedExpertKey) return true;
  if (options.forgeProduction) return true;
  if (options.criticality === "HIGH") return true;
  if (/https?:\/\/[^\s]+/.test(String(query || ""))) return true;

  if (
    attachmentMeta.has_attached_documents ||
    attachmentMeta.has_attached_images
  ) {
    return true;
  }

  if (isGreetingOrIntroduction(query)) return true;

  if (isSocialAcceptanceOfOffer(query, options.history || [])) return true;

  if (isMetaCapabilitiesIntent(query)) return true;

  if (isConversationMemoryRecallRequest(query)) return true;

  if (isCodeGenerationRequest(query)) return true;

  if (isCodeIntentRequest(query)) return true;

  if (isCodeReviewRequest(query)) return true;

  if (requiresGenerousComposerResponse(query)) return true;

  return false;
}

export function shouldSkipWebSearchForIntent(query = "", packet = {}) {
  if (isExplicitWebSearchRequest(query)) return false;
  if (
    packet?.meta?.intent_contract_id === "RESEARCH_THEN_SUMMARIZE" ||
    packet?.meta?.research_then_summarize === true ||
    isResearchThenSummarizeRequest(query, {
      attachments: packet?.meta?._attachment_refs || [],
    })
  ) {
    return false;
  }
  return resolveIntentContract(query, packet).contract.routing?.skipWebSearch === true;
}

export function getExpectedResponseMode(query = "", packet = {}) {
  return resolveIntentContract(query, packet).contract.responseMode;
}

export function listIntentContracts() {
  return INTENT_CONTRACT_REGISTRY.map(({ id, version, label, responseMode, priority }) => ({
    id,
    version,
    label,
    responseMode,
    priority,
  }));
}

export default {
  INTENT_CONTRACT_REGISTRY,
  resolveIntentContract,
  applyIntentContractToPacket,
  isIdeationIntentContract,
  shouldBypassSimpleFast,
  shouldSkipWebSearchForIntent,
  getExpectedResponseMode,
  getComposerObservabilityContext,
  listIntentContracts,
};

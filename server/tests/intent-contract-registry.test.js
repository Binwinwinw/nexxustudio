import test from "node:test";
import assert from "node:assert/strict";

import {
  INTENT_CONTRACT_REGISTRY,
  resolveIntentContract,
  applyIntentContractToPacket,
  isIdeationIntentContract,
  shouldBypassSimpleFast,
  shouldSkipWebSearchForIntent,
  getExpectedResponseMode,
  getComposerObservabilityContext,
  listIntentContracts,
} from "../src/agent/config/intentContractRegistry.js";
import { RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";
import {
  interpretStructuredRequest,
  resolveInterpreterLock,
} from "../src/agent/interpreter/RequestInterpreter.js";

test("registry: all entries have unique ids", () => {
  const ids = INTENT_CONTRACT_REGISTRY.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("registry: listIntentContracts exposes summary", () => {
  const list = listIntentContracts();
  assert.ok(list.length >= 5);
  assert.ok(list.every((c) => c.id && c.responseMode));
});

test("registry: ideation query resolves IDEATION_OPEN", () => {
  const query =
    "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi";
  const { contract, matchedBy } = resolveIntentContract(query, {});
  assert.equal(contract.id, "IDEATION_OPEN");
  assert.ok(matchedBy.startsWith("guard:"));
  assert.equal(contract.responseMode, RESPONSE_MODES.OPEN_PROPOSITION);
  assert.equal(shouldBypassSimpleFast(query), true);
  assert.equal(shouldSkipWebSearchForIntent(query), true);
  assert.equal(getExpectedResponseMode(query), RESPONSE_MODES.OPEN_PROPOSITION);
});

test("registry: short ideation bypasses SIMPLE_FAST gate (regression OPEN_PROPOSITION)", () => {
  const query =
    "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi";
  const wordsCount = query.toLowerCase().split(/\s+/).length;
  assert.ok(wordsCount < 15);
  assert.equal(shouldBypassSimpleFast(query), true);
});

test("registry: attached document bypasses SIMPLE_FAST", () => {
  const query = "peux tu faire une analyse du fichier ajouté à la conversation";
  const attachments = [
    {
      originalname: "physique_chimie_6eme_241_288.php.txt",
      mimetype: "text/plain",
      buffer: Buffer.from("contenu test"),
    },
  ];
  assert.equal(shouldBypassSimpleFast(query, {}, { images: attachments }), true);
  const packet = {
    user_query: query,
    meta: {
      has_attached_documents: true,
      _attachment_refs: [{ name: attachments[0].originalname }],
    },
  };
  const { contract } = resolveIntentContract(query, packet);
  assert.equal(contract.id, "DOCUMENT_ATTACHED");
});

test("conversationGuards: detects attached document analysis request", async () => {
  const { isAttachedDocumentAnalysisRequest, hasTextAttachments } =
    await import("../src/agent/utils/conversationGuards.js");
  const attachments = [
    { originalname: "doc.txt", mimetype: "text/plain" },
  ];
  assert.equal(hasTextAttachments(attachments), true);
  assert.equal(
    isAttachedDocumentAnalysisRequest(
      "peux tu faire une analyse du fichier ajouté à la conversation",
      attachments,
    ),
    true,
  );
});

test("registry: factual research with sources resolves FACTUAL_RESEARCH", () => {
  const query = "trouve des articles web sur RAG local avec sources";
  const { contract } = resolveIntentContract(query, {});
  assert.equal(contract.id, "FACTUAL_RESEARCH");
  assert.equal(contract.responseMode, RESPONSE_MODES.DOCUMENT);
  assert.equal(shouldBypassSimpleFast(query), true);
});

test("registry: diagnostic query resolves DIAGNOSTIC", () => {
  const query = "analyse cette erreur de timeout dans le pipeline";
  const { contract } = resolveIntentContract(query, {});
  assert.equal(contract.id, "DIAGNOSTIC");
  assert.equal(contract.responseMode, RESPONSE_MODES.CRITICAL);
});

test("registry: unified analytical guard — corrige ce script", () => {
  const query = "corrige ce script";
  const { contract } = resolveIntentContract(query, {});
  assert.equal(contract.id, "DIAGNOSTIC");
  assert.equal(shouldBypassSimpleFast(query), true);
});

test("registry: document analysis verb resolves DOCUMENT_ANALYSIS", () => {
  const query = "résume ce passage";
  const { contract } = resolveIntentContract(query, {});
  assert.equal(contract.id, "DOCUMENT_ANALYSIS");
  assert.equal(contract.responseMode, RESPONSE_MODES.DOCUMENT);
  assert.equal(shouldBypassSimpleFast(query), true);
});

test("registry: vision attached resolves VISION_ATTACHED", () => {
  const query = "décris cette capture";
  const packet = {
    meta: {
      has_attached_images: true,
      _attachment_refs: [{ name: "capture.png", mimetype: "image/png" }],
    },
  };
  const { contract } = resolveIntentContract(query, packet);
  assert.equal(contract.id, "VISION_ATTACHED");
  assert.equal(
    shouldBypassSimpleFast(query, packet, {
      images: [{ originalname: "capture.png", mimetype: "image/png" }],
    }),
    true,
  );
});

test("registry: video attached resolves VIDEO_ANALYSIS", () => {
  const query = "résume la vidéo jointe";
  const packet = {
    meta: {
      has_attached_videos: true,
      _attachment_refs: [{ name: "demo.mp4", mimetype: "video/mp4" }],
    },
  };
  const { contract, matchedBy } = resolveIntentContract(query, packet);
  assert.equal(contract.id, "VIDEO_ANALYSIS");
  assert.equal(contract.routing.asyncJob, true);
  assert.equal(contract.routing.skillId, "skill-nexxus-video");
  assert.match(matchedBy, /hasAttachedVideoContext/);
});

test("registry: design create resolves DESIGN_CREATE", () => {
  const query = "conçois une landing dark mode avec design system";
  const { contract } = resolveIntentContract(query, {});
  assert.equal(contract.id, "DESIGN_CREATE");
  assert.equal(contract.routing.skillId, "skill-nexxus-design");
});

test("registry: design audit resolves DESIGN_AUDIT", () => {
  const query = "audite cette page ui et liste les incohérences design";
  const { contract } = resolveIntentContract(query, {});
  assert.equal(contract.id, "DESIGN_AUDIT");
  assert.equal(contract.routing.skillId, "skill-impeccable");
});

test("registry: design extract resolves DESIGN_EXTRACT", () => {
  const query = "extrais l'ADN design de ce site web pour dossier de référence";
  const { contract } = resolveIntentContract(query, {});
  assert.equal(contract.id, "DESIGN_EXTRACT");
  assert.equal(contract.routing.skillId, "skill-design-extract");
});

test("registry: image attachment bypasses SIMPLE_FAST without vision verb", () => {
  const query = "bonjour";
  const attachments = [{ originalname: "shot.png", mimetype: "image/png" }];
  assert.equal(
    shouldBypassSimpleFast(query, {}, { images: attachments }),
    true,
  );
});

test("registry: text attachment bypasses SIMPLE_FAST without analysis verb", () => {
  const query = "bonjour";
  const attachments = [{ originalname: "notes.txt", mimetype: "text/plain" }];
  assert.equal(
    shouldBypassSimpleFast(query, {}, { images: attachments }),
    true,
  );
});

test("registry: forced expert bypasses SIMPLE_FAST on short query", () => {
  assert.equal(
    shouldBypassSimpleFast("ok", {}, { forcedExpertKey: "expert_mentor" }),
    true,
  );
});

test("registry: URL bypasses SIMPLE_FAST on short query", () => {
  assert.equal(
    shouldBypassSimpleFast("voir https://example.com/doc"),
    true,
  );
});

test("conversationGuards: unified isAnalyticalTechnicalRequest includes debug", async () => {
  const { isAnalyticalTechnicalRequest } =
    await import("../src/agent/utils/conversationGuards.js");
  assert.equal(isAnalyticalTechnicalRequest("debug ce timeout"), true);
  assert.equal(isAnalyticalTechnicalRequest("refactor ce module"), true);
});

test("conversationGuards: isDocumentAnalysisIntent covers extraire", async () => {
  const { isDocumentAnalysisIntent } =
    await import("../src/agent/utils/conversationGuards.js");
  assert.equal(isDocumentAnalysisIntent("extraire les dates"), true);
});

test("registry: social greeting resolves SOCIAL", () => {
  const { contract } = resolveIntentContract("salut", {});
  assert.equal(contract.id, "SOCIAL");
});

test("registry: greeting introduction bypasses SIMPLE_FAST", () => {
  assert.equal(shouldBypassSimpleFast("salut qui es tu ???"), true);
  assert.equal(shouldBypassSimpleFast("coucou"), true);
});

test("registry: conversation recall bypasses SIMPLE_FAST", () => {
  assert.equal(
    shouldBypassSimpleFast("saurais tu retrouver de quoi nous avons parlé hier ?"),
    true,
  );
});

test("conversationGuards: memory recall detection and response", async () => {
  const {
    isConversationMemoryRecallRequest,
    buildConversationRecallResponse,
  } = await import("../src/agent/utils/conversationGuards.js");

  const query = "saurais tu retrouver de quoi nous avons parlé hier ?";
  assert.equal(isConversationMemoryRecallRequest(query), true);

  const empty = buildConversationRecallResponse(
    "saurais tu retrouver de quoi nous avons parlé précédemment",
    [],
  );
  assert.match(empty, /pas encore d'échange substantiel/i);
  assert.ok(!empty.includes("journal « hier »"));

  const withHistory = buildConversationRecallResponse(query, [
    { role: "user", content: "On a parlé du hardening RAG" },
    { role: "assistant", content: "Oui, seuils de confiance et traçabilité." },
  ]);
  assert.match(withHistory, /hardening RAG/i);
  assert.match(withHistory, /seuils de confiance/i);
  assert.ok(!withHistory.includes("Je n'ai pas assez d'éléments fiables"));

  const precedemment = "saurais tu retrouver de quoi nous avons parlé précédemment";
  assert.equal(isConversationMemoryRecallRequest(precedemment), true);
  const noHierFooter = buildConversationRecallResponse(precedemment, [
    { role: "user", content: "bonjour qui es tu" },
    { role: "assistant", content: "Salut ! Je suis NEXXUS." },
    { role: "user", content: "saurais tu retrouver de quoi nous avons parlé hier ?" },
    {
      role: "assistant",
      content:
        "Je n'ai pas assez d'éléments fiables pour répondre correctement. Précise ta demande ou fournis plus de contexte",
    },
  ]);
  assert.ok(!noHierFooter.includes("journal « hier »"));
  assert.ok(!noHierFooter.includes("éléments fiables"));
  assert.match(noHierFooter, /fenêtre récente/i);
});

test("registry: meta override forces contract", () => {
  const { contract, matchedBy } = resolveIntentContract("hello", {
    meta: { intent_contract_id: "IDEATION_OPEN" },
  });
  assert.equal(contract.id, "IDEATION_OPEN");
  assert.equal(matchedBy, "meta.intent_contract_id");
});

test("registry: orchestrator intent fallback when no guard matches", () => {
  const { contract, matchedBy } = resolveIntentContract(
    "explique le module de consensus séquentiel en détail technique",
    { user_intent: "technical_diagnostic" },
  );
  assert.equal(contract.id, "DIAGNOSTIC");
  assert.equal(matchedBy, "orchestrator:technical_diagnostic");
});

test("registry: applyIntentContractToPacket propagates meta fields", () => {
  const query =
    "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi";
  const packet = { user_intent: "ideation", user_query: query, meta: {} };
  const { contract, matchedBy } = applyIntentContractToPacket(packet, query);
  assert.equal(contract.id, "IDEATION_OPEN");
  assert.ok(matchedBy.startsWith("guard:"));
  assert.equal(packet.meta.intent_contract_id, "IDEATION_OPEN");
  assert.equal(packet.meta.intent_contract_matched_by, matchedBy);
  assert.equal(packet.meta.expected_response_mode, "OPEN_PROPOSITION");
  assert.equal(packet.meta.open_proposition, true);
});

test("registry: interpreter_lock interdit CODE_DELIVERY_V1 sur inversion sujet/instrument", () => {
  const query =
    "pourrait on retrouver un ordinateur windows 11 avec son ID-produit ou sa clé produit en le localisant ?";
  const structuredRequest = interpretStructuredRequest(query);
  const interpreterLock = resolveInterpreterLock(structuredRequest);

  const { contract, matchedBy } = resolveIntentContract(query, {
    user_intent: "expert_task",
    meta: {
      structured_request: structuredRequest,
      interpreter_lock: interpreterLock,
    },
  });

  assert.equal(contract.id, "DIRECT_EXPLANATION");
  assert.match(matchedBy, /^interpreter_lock:/);
  assert.notEqual(contract.id, "CODE_DELIVERY_V1");
});

test("registry: shouldSkipWebSearchForIntent follows contract routing", () => {
  const ideation =
    "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi";
  const research = "trouve des articles web sur RAG local avec sources";
  assert.equal(shouldSkipWebSearchForIntent(ideation), true);
  assert.equal(shouldSkipWebSearchForIntent(research), false);
});

test("registry: isIdeationIntentContract detects IDEATION_OPEN only", () => {
  assert.equal(isIdeationIntentContract({ meta: { intent_contract_id: "IDEATION_OPEN" } }), true);
  assert.equal(isIdeationIntentContract({ meta: { open_proposition: true } }), false);
  assert.equal(isIdeationIntentContract({ meta: { intent_contract_id: "DIAGNOSTIC" } }), false);
});

test("registry: getComposerObservabilityContext reads packet meta", () => {
  const query =
    "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi";
  const packet = {
    user_query: query,
    user_intent: "ideation",
    meta: {
      intent_contract_id: "IDEATION_OPEN",
      intent_contract_matched_by: "guard:isOpenProjectIdeation",
      expected_response_mode: "OPEN_PROPOSITION",
    },
  };
  const ctx = getComposerObservabilityContext(packet, query);
  assert.equal(ctx.intentContractId, "IDEATION_OPEN");
  assert.equal(ctx.expectedResponseMode, "OPEN_PROPOSITION");
  assert.equal(ctx.logTag, "openProposition");
  assert.equal(ctx.fallbackReasonPrefix, "open_proposition_");
  assert.equal(ctx.recordFallbackIncident, true);
});

test("registry: getComposerObservabilityContext resolves without meta", () => {
  const query = "salut";
  const ctx = getComposerObservabilityContext({ user_query: query, meta: {} }, query);
  assert.equal(ctx.intentContractId, "SOCIAL");
  assert.equal(ctx.expectedResponseMode, "SIMPLE_FAST");
});

test("registry: smoke fixtures declare expected modes", () => {
  for (const entry of INTENT_CONTRACT_REGISTRY) {
    if (!entry.smoke?.sampleQuery) continue;
    const packet = entry.smoke.packetMeta
      ? { meta: entry.smoke.packetMeta }
      : {};
    const { contract } = resolveIntentContract(entry.smoke.sampleQuery, packet);
    if (entry.smoke.expectedResponseMode) {
      assert.equal(
        contract.responseMode,
        entry.smoke.expectedResponseMode,
        `${entry.id}: ${entry.smoke.sampleQuery}`,
      );
    }
  }
});

test("registry: social free chat must not resolve GUIDED_PRODUCT_RECOMMENDATION", () => {
  const query = "rien de spéciale on peut discuter un peu ?";
  const packet = {
    user_intent: "normal_conversation",
    meta: {
      query_understanding: {
        primaryDomain: "unknown",
        responseStrategy: "full_pipeline",
        domains: [],
        workIntentCount: 0,
      },
    },
  };
  const { contract, matchedBy } = resolveIntentContract(query, packet);
  assert.notEqual(contract.id, "GUIDED_PRODUCT_RECOMMENDATION");
  assert.notEqual(contract.id, "GUIDED_DOCUMENT_SYNTHESIS");
  assert.equal(contract.id, "SOCIAL");
  assert.equal(matchedBy, "guard:isSocialQuery");
});

test("registry: GUIDED_PRODUCT_RECOMMENDATION guard-only (no orchestrator fallback)", () => {
  const packet = { user_intent: "normal_conversation", meta: {} };
  const { contract } = resolveIntentContract(
    "explique-moi la photosynthèse",
    packet,
  );
  assert.notEqual(contract.id, "GUIDED_PRODUCT_RECOMMENDATION");
});

test("registry: GUIDED_PRODUCT_RECOMMENDATION via guard when compare_choose ready", () => {
  const query = "meilleur smartphone 2026 budget 500 euros pour photo";
  const packet = {
    user_intent: "normal_conversation",
    meta: {
      query_understanding: {
        primaryDomain: "compare_choose",
        responseStrategy: "guided_recommendation",
        domains: ["compare_choose"],
        workIntentCount: 1,
      },
    },
  };
  const { contract, matchedBy } = resolveIntentContract(query, packet);
  assert.equal(contract.id, "GUIDED_PRODUCT_RECOMMENDATION");
  assert.ok(
    matchedBy === "guard:isGuidedProductRecommendationRequest" ||
      matchedBy === "meta.intent_contract_id",
  );
});

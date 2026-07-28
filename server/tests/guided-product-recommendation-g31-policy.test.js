import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { INTENT_CONTRACT_REGISTRY } from "../src/agent/config/intentContractRegistry.js";
import {
  isGuidedProductRecommendationRequest,
  resolveGuidedProductIntentContractId,
  resolveGuidedProductWebSearchLimits,
  buildQueryUnderstandingSlotTelemetry,
  GUIDED_PRODUCT_WEB_MAX_SOURCES,
  GUIDED_PRODUCT_WEB_TIMEOUT_MS,
} from "../src/agent/policies/guidedProductRecommendationPolicy.js";
import {
  filterProductRecoWebSources,
  validateProductRecommendationReply,
  applyProductRecoValidationToWebPacket,
  assessProductRecoWebSources,
  buildProductSourcesInsufficientReply,
  scoreProductRecoSourceRelevance,
} from "../src/agent/policies/productRecoValidator.js";
import {
  deriveGuidedProductWebSearchQuery,
} from "../src/agent/policies/guidedProductRecommendationPolicy.js";
import { understandQuery, buildRequestWorkup, applyWorkupRetrievalGate } from "../src/agent/policies/conversationQueryUnderstanding.js";

const GUIDED_SMARTPHONE_QUERY =
  "meilleur smartphone 2026 budget 500 euros pour photo";

const RTX_GUIDED_QUERY =
  "je veux changer ma carte graphique rtx 4060, qu'est ce que tu pourrais me conseiller " +
  "en faisant une recherche sur la toile pour me donner une réponse sur au moins 3 modèles " +
  "qui pourraient avoir un bon rapport qualité/prix?";

describe("guidedProductRecommendationPolicy — G31.3 contrat", () => {
  it("resolveGuidedProductIntentContractId — slots remplis → GUIDED_PRODUCT_RECOMMENDATION", () => {
    const u = understandQuery(GUIDED_SMARTPHONE_QUERY);
    assert.equal(resolveGuidedProductIntentContractId(u), "GUIDED_PRODUCT_RECOMMENDATION");
  });

  it("resolveGuidedProductIntentContractId — partial_clarify → null", () => {
    const u = understandQuery("je veux acheter un smartphone, que me conseilles-tu ?");
    assert.equal(resolveGuidedProductIntentContractId(u), null);
  });

  it("isGuidedProductRecommendationRequest — via packet meta query_understanding", () => {
    const u = understandQuery(GUIDED_SMARTPHONE_QUERY);
    const packet = {
      meta: {
        query_understanding: {
          primaryDomain: u.primaryDomain,
          responseStrategy: u.responseStrategy,
        },
      },
    };
    assert.equal(isGuidedProductRecommendationRequest(GUIDED_SMARTPHONE_QUERY, packet), true);
  });

  it("resolveGuidedProductWebSearchLimits — 3 sources, 8s", () => {
    const contract = INTENT_CONTRACT_REGISTRY.find(
      (item) => item.id === "GUIDED_PRODUCT_RECOMMENDATION",
    );
    const limits = resolveGuidedProductWebSearchLimits(contract);
    assert.equal(limits.maxResults, GUIDED_PRODUCT_WEB_MAX_SOURCES);
    assert.equal(limits.timeoutMs, GUIDED_PRODUCT_WEB_TIMEOUT_MS);
    assert.equal(limits.maxResults, 3);
    assert.equal(limits.timeoutMs, 8000);
  });
});

describe("guidedProductRecommendationPolicy — G31.3 télémétrie slots", () => {
  it("buildQueryUnderstandingSlotTelemetry — required + missing sur clarify", () => {
    const u = understandQuery("je veux acheter un smartphone, que me conseilles-tu ?");
    const telemetry = buildQueryUnderstandingSlotTelemetry(u);
    assert.ok(telemetry);
    assert.deepEqual(telemetry.required_slots, ["budget", "usage"]);
    assert.deepEqual(telemetry.missing_slots, ["budget", "usage"]);
    assert.match(telemetry.policy_match_reason, /product_recommendation/);
    assert.equal(telemetry.domain_confidence, "medium");
  });

  it("buildQueryUnderstandingSlotTelemetry — slots remplis, missing vide", () => {
    const u = understandQuery(GUIDED_SMARTPHONE_QUERY);
    const telemetry = buildQueryUnderstandingSlotTelemetry(u);
    assert.ok(telemetry);
    assert.deepEqual(telemetry.required_slots, ["budget", "usage"]);
    assert.deepEqual(telemetry.missing_slots, []);
  });
});

describe("productRecoValidator — G31.4 post-search", () => {
  it("filterProductRecoWebSources — écarte modèles obsolètes", () => {
    const sources = [
      { title: "iPhone 15 Pro test 2024", url: "https://a.example" },
      { title: "Galaxy S23 Ultra review", url: "https://b.example" },
      { title: "Meilleurs smartphones 2026", url: "https://c.example" },
    ];
    const filtered = filterProductRecoWebSources(sources, { budget: 500 }, 3);
    assert.equal(filtered.sources.length, 1);
    assert.match(filtered.sources[0].title, /2026/);
    assert.ok(filtered.reasons.some((r) => r.startsWith("outdated_source:")));
  });

  it("filterProductRecoWebSources — budget ≤700 filtre flagship hors budget", () => {
    const sources = [
      { title: "Galaxy S26 Ultra 1500 euros", url: "https://a.example" },
      { title: "Pixel 9a 450 euros photo", url: "https://b.example" },
    ];
    const filtered = filterProductRecoWebSources(sources, { budget: 500 }, 3);
    assert.equal(filtered.sources.length, 1);
    assert.match(filtered.sources[0].title, /Pixel/);
  });

  it("validateProductRecommendationReply — filtre modèle obsolète dans la réponse", () => {
    const result = validateProductRecommendationReply(
      "Je te conseille l'iPhone 15 Pro pour la photo.",
      { budget: 500, usage: "photo" },
    );
    assert.equal(result.valid, false);
    assert.ok(result.issues.includes("outdated_model_mentioned"));
    assert.match(result.sanitized, /filtré/);
    assert.match(result.sanitized, /trop anciens/);
  });

  it("applyProductRecoValidationToWebPacket — audit dans meta", () => {
    const webPacket = {
      sources: [
        { title: "iPhone 14 encore bon", url: "https://old.example" },
        { title: "Comparatif 2026 budget", url: "https://new.example" },
      ],
    };
    const { packet, audit } = applyProductRecoValidationToWebPacket(
      webPacket,
      { budget: 500 },
      3,
    );
    assert.ok(packet.meta.product_reco_validation);
    assert.ok(audit.dropped >= 0);
    assert.ok(Array.isArray(packet.sources));
  });

  it("scoreProductRecoSourceRelevance — tutoriel procédure vs comparatif", () => {
    const procedural = scoreProductRecoSourceRelevance({
      title: "Comment changer une carte graphique — étapes",
      url: "https://example.com/tutoriel",
    });
    const comparative = scoreProductRecoSourceRelevance({
      title: "RTX 4070 Super vs RX 7800 XT comparatif prix 2026",
      snippet: "meilleur rapport qualité/prix",
    });
    assert.ok(procedural <= 0);
    assert.ok(comparative >= 3);
  });

  it("assessProductRecoWebSources — guides procédure uniquement → insufficient", () => {
    const assessment = assessProductRecoWebSources([
      { title: "Comment installer une carte graphique", url: "https://a.example" },
      { title: "Guide pratique remplacer GPU", url: "https://b.example" },
      { title: "Étapes pour changer votre carte", url: "https://c.example" },
    ]);
    assert.equal(assessment.sufficient, false);
    assert.equal(assessment.proceduralOnly, true);
    assert.equal(assessment.reason, "procedural_guides_only");
  });

  it("buildProductSourcesInsufficientReply — RTX 4060 avec repères offline", () => {
    const reply = buildProductSourcesInsufficientReply(
      "changer ma rtx 4060 avec recherche web 3 modèles qualité/prix",
      { reason: "procedural_guides_only", proceduralOnly: true },
    );
    assert.match(reply, /comment changer|installer/i);
    assert.match(reply, /4070 Super|7800 XT/i);
    assert.doesNotMatch(reply, /objectif en une phrase|pas encore la destination/i);
  });
});

describe("guidedProductRecommendationPolicy — G31.5 web query derivation", () => {
  it("deriveGuidedProductWebSearchQuery — RTX 4060 → comparatif/prix", () => {
    const q = deriveGuidedProductWebSearchQuery(
      "je veux changer ma rtx 4060, recherche web 3 modèles qualité/prix",
    );
    assert.match(q, /4060/i);
    assert.match(q, /comparatif|qualit[eé]|prix/i);
    assert.doesNotMatch(q, /comment changer/i);
  });

  it("deriveGuidedProductWebSearchQuery — SSD NVMe 4T ≠ carte graphique", () => {
    const q = deriveGuidedProductWebSearchQuery(
      "je cherche un comparatif de prix de disque dur ssd nvme de 4T",
    );
    assert.match(q, /SSD|NVMe/i);
    assert.match(q, /4T|4\s*T/i);
    assert.match(q, /prix|comparatif/i);
    assert.doesNotMatch(q, /carte graphique|rtx|gtx/i);
  });
});

describe("cognitiveCycle — cycle factorisé 4 blocs", () => {
  it("buildRequestWorkup — RTX : 4 blocs alignés", () => {
    const understanding = understandQuery(RTX_GUIDED_QUERY);
    const cycle = buildRequestWorkup(RTX_GUIDED_QUERY, understanding, {
      intentContractId: "GUIDED_PRODUCT_RECOMMENDATION",
    });
    assert.equal(cycle.intent_assessment.intentContractId, "GUIDED_PRODUCT_RECOMMENDATION");
    assert.equal(cycle.intent_assessment.primaryDomain, "compare_choose");
    assert.equal(cycle.intent_assessment.constraints.minModels, 3);
    assert.equal(cycle.evidence_requirement.level, "high");
    assert.equal(cycle.evidence_requirement.comparative, true);
    assert.equal(cycle.retrieval_decision.needsExternalInfo, true);
    assert.equal(cycle.retrieval_decision.sourceKind, "web");
    assert.match(cycle.retrieval_decision.webQuery || "", /4060/i);
    assert.equal(cycle.response_commitment.kind, "guided_product_comparison");
    assert.equal(cycle.response_commitment.renderMode, "contractual_llm");
    assert.equal(cycle.response_commitment.minItems, 3);
  });

  it("buildRequestWorkup — upgrade RTX sans « recherche toile » explicite → même contrat", () => {
    const q =
      "j'ai une rtx 4060 8GB, changer de carte graphique meilleur rapport qualité/prix, que me conseilles-tu ?";
    const understanding = understandQuery(q);
    assert.equal(understanding.responseStrategy, "guided_recommendation");
    assert.equal(
      resolveGuidedProductIntentContractId(understanding),
      "GUIDED_PRODUCT_RECOMMENDATION",
    );
    const cycle = buildRequestWorkup(q, understanding);
    assert.equal(cycle.intent_assessment.intentContractId, "GUIDED_PRODUCT_RECOMMENDATION");
    assert.equal(cycle.evidence_requirement.level, "high");
    assert.equal(cycle.retrieval_decision.sourceKind, "web");
    assert.equal(cycle.action_decision.capabilities.web, true);
    assert.equal(cycle.intent_assessment.constraints.minModels, 3);
  });

  it("buildRequestWorkup — ray tracing : preuve faible, pas de web", () => {
    const understanding = understandQuery("explique le ray tracing");
    const cycle = buildRequestWorkup("explique le ray tracing", understanding);
    assert.equal(cycle.evidence_requirement.level, "low");
    assert.equal(cycle.retrieval_decision.needsExternalInfo, false);
    assert.equal(cycle.response_commitment.renderMode, "llm_direct");
  });

  it("applyWorkupRetrievalGate — cycle high evidence → web", () => {
    const understanding = understandQuery(RTX_GUIDED_QUERY);
    const cycle = buildRequestWorkup(RTX_GUIDED_QUERY, understanding, {
      intentContractId: "GUIDED_PRODUCT_RECOMMENDATION",
    });
    const gated = applyWorkupRetrievalGate(cycle, null, null);
    assert.equal(gated.source, "action_decision");
    assert.equal(gated.forcedExpertKey, "expert_web_search");
    assert.ok(gated.webQuery);
  });

  it("applyWorkupRetrievalGate — cycle skip web prime sur enrichissement", () => {
    const understanding = understandQuery("explique le ray tracing");
    const cycle = buildRequestWorkup("explique le ray tracing", understanding);
    const gated = applyWorkupRetrievalGate(cycle, "expert_web_search", null);
    assert.equal(gated.source, "chat_profile_skip_web");
    assert.equal(gated.forcedExpertKey, null);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessKnowledgeFreshnessRisk,
  formatReferenceDateFr,
  resolveReferenceDate,
  scoreKnowledgeFreshnessRisk,
  extractWebVerificationLabel,
  requiresBridgedFreshnessFallback,
  isStableCategoryKnowledge,
} from "../src/agent/policies/web/index.js";
import { resolveKnowledgeEnrichmentPolicy } from "../src/agent/policies/knowledgeEnrichmentPolicy.js";
import {
  requiresKnowledgeFreshnessComposerContract,
  buildKnowledgeFreshnessSystemAddon,
} from "../src/agent/micro/replies/knowledgeFreshnessComposerContract.js";

const IPHONE_COMPARATIF_QUERY =
  "pourrais tu faire un comparatif entre les derniers modeles d iphone de chez apple et galaxy chez samsung";
const SHOES_COMPARATIF_QUERY =
  "fais un comparatif des derniers modeles de chaussures de running nike vs adidas";
const STABLE_LUNETTES_QUERY =
  "c est quoi une monture ovale de lunettes et quelles sont les categories de montures";
const BOEUF_QUERY = "connais tu la recette du boeuf bourguignon";
const FIXED_NOW = new Date("2026-05-27T12:00:00.000Z");

describe("knowledgeFreshnessPolicy — scoring relatif à la date du jour", () => {
  it("score élevé pour comparatif smartphones récents", () => {
    const score = scoreKnowledgeFreshnessRisk(IPHONE_COMPARATIF_QUERY);
    assert.ok(score >= 0.45, `score attendu >= 0.45, reçu ${score}`);
  });

  it("score faible pour recette classique stable", () => {
    const score = scoreKnowledgeFreshnessRisk(BOEUF_QUERY);
    assert.ok(score < 0.35, `score attendu < 0.35, reçu ${score}`);
  });

  it("score élevé pour comparatif chaussures running (pas seulement tech)", () => {
    const score = scoreKnowledgeFreshnessRisk(SHOES_COMPARATIF_QUERY);
    assert.ok(score >= 0.45, `score attendu >= 0.45, reçu ${score}`);
  });

  it("score faible pour catégories de lunettes stables", () => {
    assert.equal(isStableCategoryKnowledge(STABLE_LUNETTES_QUERY), true);
    const score = scoreKnowledgeFreshnessRisk(STABLE_LUNETTES_QUERY);
    assert.ok(score < 0.35, `score attendu < 0.35, reçu ${score}`);
  });

  it("assess déclenche refresh web sans sources pour sujet mouvant", () => {
    const assessment = assessKnowledgeFreshnessRisk(IPHONE_COMPARATIF_QUERY, {
      now: FIXED_NOW,
      webSourcesCount: 0,
    });
    assert.equal(assessment.preferWebRefresh, true);
    assert.equal(assessment.temporalDisclosureRequired, true);
    assert.equal(assessment.isFreshnessSensitive, true);
    assert.match(assessment.referenceDateLabel, /2026/);
  });

  it("assess ne force pas refresh pour recette stable", () => {
    const assessment = assessKnowledgeFreshnessRisk(BOEUF_QUERY, {
      now: FIXED_NOW,
      webSourcesCount: 0,
    });
    assert.equal(assessment.preferWebRefresh, false);
    assert.equal(assessment.temporalDisclosureRequired, false);
  });

  it("resolveReferenceDate et formatReferenceDateFr sont dynamiques", () => {
    const ref = resolveReferenceDate(FIXED_NOW);
    const label = formatReferenceDateFr(ref);
    assert.match(label, /mai.*2026/i);
  });

  it("extractWebVerificationLabel lit web_consulted_at si pas de date ISO dans le contenu", () => {
    const packet = {
      meta: { web_consulted_at: "2026-05-20T10:00:00.000Z" },
      expert_outputs: [
        { stage: "web_research", content: "Résumé sans date ISO explicite." },
      ],
    };
    const label = extractWebVerificationLabel(packet);
    assert.match(label || "", /mai.*2026/i);
  });
});

describe("knowledgeEnrichmentPolicy — fusion fraîcheur + culture générale", () => {
  it("unifie preferWebResearch pour comparatif volatile", () => {
    const policy = resolveKnowledgeEnrichmentPolicy(IPHONE_COMPARATIF_QUERY, {
      now: FIXED_NOW,
    });
    assert.equal(policy.preferWebResearch, true);
    assert.ok(policy.freshness.riskScore >= 0.45);
  });

  it("ne force pas web pour bœuf bourguignon", () => {
    const policy = resolveKnowledgeEnrichmentPolicy(BOEUF_QUERY, {
      now: FIXED_NOW,
    });
    assert.equal(policy.preferWebResearch, false);
  });
});

describe("knowledgeFreshnessComposerContract — divulgation temporelle", () => {
  it("exige contrat composer pour sujet mouvant", () => {
    assert.equal(
      requiresKnowledgeFreshnessComposerContract(IPHONE_COMPARATIF_QUERY),
      true,
    );
  });

  it("addon système active fallback bridé sans web sur sujet mouvant", () => {
    const addon = buildKnowledgeFreshnessSystemAddon(IPHONE_COMPARATIF_QUERY, {
      meta: { web_failure_mode: "fallback_no_results" },
    });
    assert.match(addon, /FALLBACK BRIDÉ/i);
    assert.match(addon, /INTERDIT.*numéros de modèle/i);
    assert.match(addon, /Date de référence système.*2026/i);
  });

  it("requiresBridgedFreshnessFallback si web échoué", () => {
    assert.equal(
      requiresBridgedFreshnessFallback(IPHONE_COMPARATIF_QUERY, {
        meta: { web_failure_mode: "fallback_no_results" },
      }),
      true,
    );
  });

  it("addon système signale grounding web quand sources présentes", () => {
    const packet = {
      meta: { resolution_path: "web_fallback", web_consulted_at: FIXED_NOW.toISOString() },
      expert_outputs: [
        {
          stage: "web_research",
          content:
            "iPhone 16 Pro Max — écran 6,7 pouces, puce A18 Pro, sortie septembre 2025. Galaxy S25 Ultra — écran AMOLED, Snapdragon 8 Gen 4. Source vérifiée 2025-11-01.",
        },
      ],
    };
    const addon = buildKnowledgeFreshnessSystemAddon(IPHONE_COMPARATIF_QUERY, packet);
    assert.match(addon, /sources web/i);
    assert.match(addon, /vérifiées/i);
  });
});

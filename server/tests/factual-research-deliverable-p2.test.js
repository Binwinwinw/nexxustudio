import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveFactualResearchWebQuery,
  deriveFactualResearchWebQueryEn,
  isWebCitationsStructuredReportCluster,
} from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";
import {
  buildFactualResearchNoSourcesReply,
  shouldRefuseFactualResearchWithoutSources,
  isFactualResearchSourcedReportPath,
  FACTUAL_RESEARCH_MIN_SOURCES,
  FACTUAL_RESEARCH_WEB_MAX_SOURCES,
  scoreFactualResearchRecency,
} from "../src/agent/policies/web/factualResearchDeliverablePolicy.js";
import {
  validateFactualResearchReply,
  detectFactualResearchSections,
} from "../src/agent/policies/web/factualResearchReplyValidator.js";
import {
  requiresFactualResearchComposerContract,
  buildFactualResearchSystemAddon,
} from "../src/agent/micro/replies/factualResearchComposerContract.js";
import { buildKnowledgeFreshnessSystemAddon } from "../src/agent/micro/replies/knowledgeFreshnessComposerContract.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isPresentationOutlineRequest } from "../src/agent/utils/presentationOutlineIntentGuards.js";

const STREAMING_SERIES_A = `Je suis responsable marketing d'une startup de streaming indépendante et nous préparons un dossier de présentation pour une levée de fonds de série A. Pourriez-vous effectuer une recherche sur l'état actuel du marché du streaming de films indépendants et identifier les tendances clés, le positionnement des concurrents et les opportunités de croissance ? Veuillez utiliser des sources web récentes avec citations et structurer le tout sous forme de rapport professionnel de 5 pages maximum, comprenant un résumé, une analyse de marché, une analyse concurrentielle et une présentation des opportunités de croissance. Focus juillet 2026.`;

const SLIDES_PLAN =
  "fait un plan pour la création d'une présentation en slides de l'application Teams365 avec un sommaire des titres et un scénario pédagogique sur 24h soit 6 * 4h";

function packetWithSources(n = 3) {
  const evidence = Array.from({ length: n }, (_, i) => ({
    source: `https://example.com/market-${i + 1}-2026`,
    excerpt: `Market note ${i + 1} published 2026`,
  }));
  return {
    user_query: STREAMING_SERIES_A,
    meta: { intent_contract_id: "FACTUAL_RESEARCH" },
    evidence,
    expert_outputs: [
      {
        stage: "web_research",
        content: evidence.map((e) => `- ${e.source}: ${e.excerpt}`).join("\n"),
      },
    ],
  };
}

describe("P2 FACTUAL_RESEARCH deliverable", () => {
  it("détecte le path sourcé Series A", () => {
    assert.equal(isWebCitationsStructuredReportCluster(STREAMING_SERIES_A), true);
    assert.equal(
      isFactualResearchSourcedReportPath(STREAMING_SERIES_A, {
        meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      }),
      true,
    );
  });

  it("contrat FACTUAL_RESEARCH expose webSearchMaxSources=10", () => {
    const { contract } = resolveIntentContract(STREAMING_SERIES_A, {});
    assert.equal(contract.id, "FACTUAL_RESEARCH");
    assert.equal(
      contract.routing.webSearchMaxSources,
      FACTUAL_RESEARCH_WEB_MAX_SOURCES,
    );
  });

  it("derive query EN courte pour retry", () => {
    const en = deriveFactualResearchWebQueryEn(STREAMING_SERIES_A);
    assert.ok(en.length <= 120);
    assert.match(en, /streaming|Series A|market/i);
    assert.match(en, /2026|July|juillet/i);
    assert.doesNotMatch(en, /responsable marketing/i);
    const fr = deriveFactualResearchWebQuery(STREAMING_SERIES_A);
    assert.notEqual(en.toLowerCase(), fr.toLowerCase());
  });

  it("0 source → refus déterministe, pas de faux chiffres", () => {
    const packet = {
      meta: {
        intent_contract_id: "FACTUAL_RESEARCH",
        web_failure_mode: "fallback_no_results",
      },
      evidence: [],
      expert_outputs: [],
    };
    assert.equal(
      shouldRefuseFactualResearchWithoutSources(STREAMING_SERIES_A, packet),
      true,
    );
    const reply = buildFactualResearchNoSourcesReply(
      STREAMING_SERIES_A,
      "fallback_no_results",
    );
    assert.match(reply, /pas trouvé de sources/i);
    assert.match(reply, /reformuler/i);
    assert.doesNotMatch(reply, /\d+\s*(?:milliards?|millions?|%|Md€)/i);
    assert.doesNotMatch(reply, /connaissances?\s+de\s+base/i);
  });

  it("override bridged freshness pour FACTUAL_RESEARCH 0 source", () => {
    const addon = buildKnowledgeFreshnessSystemAddon(STREAMING_SERIES_A, {
      meta: {
        intent_contract_id: "FACTUAL_RESEARCH",
        web_failure_mode: "fallback_no_results",
      },
      evidence: [],
      expert_outputs: [],
    });
    assert.match(addon, /REFUS FACTUAL_RESEARCH/i);
    assert.doesNotMatch(addon, /MODE FALLBACK BRIDÉ/i);
  });

  it("template composer activé si sources présentes", () => {
    const packet = packetWithSources(4);
    assert.equal(
      requiresFactualResearchComposerContract(STREAMING_SERIES_A, packet),
      true,
    );
    const addon = buildFactualResearchSystemAddon(STREAMING_SERIES_A, packet);
    assert.match(addon, /Résumé exécutif/);
    assert.match(addon, /Analyse de marché/);
    assert.match(addon, /Sources/);
  });

  it("validator OK avec 3+ sources, sections et citations", () => {
    const packet = packetWithSources(FACTUAL_RESEARCH_MIN_SOURCES);
    const text = `
## Résumé exécutif
Le marché croît [1].

## Analyse de marché
Taille estimée évoquée par les sources [2].

## Analyse concurrentielle
Acteurs présents [3].

## Opportunités de croissance
Trois pistes actionnables [1].

## Sources
[1] https://example.com/market-1-2026
[2] https://example.com/market-2-2026
[3] https://example.com/market-3-2026
`;
    const sections = detectFactualResearchSections(text);
    assert.deepEqual(
      sections.missing,
      [],
      `sections manquantes: ${sections.missing.join(",")}`,
    );
    const result = validateFactualResearchReply(text, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.equal(
      result.valid,
      true,
      `issues=${result.issues.join("|")} missing=${result.sections.missing.join(",")}`,
    );
    assert.ok(result.sourceCount >= FACTUAL_RESEARCH_MIN_SOURCES);
  });

  it("validator : 0 source → sanitized = refus", () => {
    const packet = {
      meta: {
        intent_contract_id: "FACTUAL_RESEARCH",
        web_failure_mode: "vqd_retry_exhausted",
      },
      evidence: [],
    };
    const result = validateFactualResearchReply(
      "Voici un rapport avec 40% de croissance inventée.",
      packet,
      { query: STREAMING_SERIES_A },
    );
    assert.equal(result.valid, false);
    assert.ok(result.issues.includes("no_sources"));
    assert.match(result.sanitized, /pas trouvé de sources/i);
  });

  it("validator retire disclaimer bridged si evidence > 0", () => {
    const packet = packetWithSources(3);
    const text = `
## Résumé exécutif
Je n'ai pas pu vérifier les données ; voici une comparaison qualitative [1].

## Analyse de marché
Note [2].

## Analyse concurrentielle
Note [3].

## Opportunités de croissance
Note [1].

## Sources
[1] https://example.com/market-1-2026
`;
    const result = validateFactualResearchReply(text, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.ok(result.issues.includes("bridged_disclaimer_with_evidence"));
    assert.doesNotMatch(result.sanitized, /je n'ai pas pu vérifier/i);
  });

  it("soft récence score sans hard-fail", () => {
    const score = scoreFactualResearchRecency([
      { url: "https://a.com/2026/report", excerpt: "ok" },
      { url: "https://b.com/about", excerpt: "undated" },
    ]);
    assert.equal(score.recentCount, 1);
    assert.equal(score.total, 2);
  });

  it("régression : slides / query courte inchangés", () => {
    assert.equal(isPresentationOutlineRequest(SLIDES_PLAN), true);
    assert.equal(isWebCitationsStructuredReportCluster(SLIDES_PLAN), false);
    const shortQ = "streaming Series A market 2026";
    assert.equal(deriveFactualResearchWebQuery(shortQ).length <= 120, true);
    assert.equal(
      shouldRefuseFactualResearchWithoutSources(shortQ, {
        meta: {},
        evidence: [],
      }),
      false,
    );
  });
});

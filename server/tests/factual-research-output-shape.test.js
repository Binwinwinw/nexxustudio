import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isFactualResearchSourcedReportPath,
  shouldRefuseFactualResearchWithoutSources,
  buildFactualResearchNoSourcesReply,
  resolveFactualResearchOutputShape,
  isFactualResearchStructuredReportShape,
  FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
  FACTUAL_RESEARCH_SHAPE_SOURCED_BRIEF,
} from "../src/agent/policies/web/factualResearchDeliverablePolicy.js";
import { isWebCitationsStructuredReportCluster } from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";
import { buildFactualResearchDeterministicReport } from "../src/agent/policies/web/factualResearchDeterministicBuilder.js";
import {
  hasExactCanonicalHeadings,
  validateFactualResearchReply,
} from "../src/agent/policies/web/factualResearchReplyValidator.js";
import {
  buildFactualResearchSystemAddon,
  buildFactualResearchComposerUserPrompt,
} from "../src/agent/micro/replies/factualResearchComposerContract.js";

export const ZORIN_QUERY =
  "Je veux tester Zorin OS, qu'est-ce que tu peux m'en dire ? Est-ce Windows-friendly ?";

export const EXPLICIT_REPORT_QUERY =
  "recherche web marché streaming films indépendants série A avec citations et rapport professionnel";

const CLUSTER_QUERY = `Je suis responsable marketing d'une startup de streaming indépendante. Effectuer une recherche sur l'état actuel du marché avec sources web récentes avec citations et structurer le tout sous forme de rapport professionnel, comprenant un résumé, une analyse de marché, une analyse concurrentielle et les opportunités de croissance.`;

const ZERO_PACKET = {
  meta: { intent_contract_id: "FACTUAL_RESEARCH", web_failure_mode: "fallback_no_results" },
  evidence: [],
};

describe("Étape 1 — gâche de shape (grounding intact)", () => {
  it("Zorin → sourced_brief ; grounding FACTUAL_RESEARCH reste vrai", () => {
    assert.equal(resolveFactualResearchOutputShape(ZORIN_QUERY), FACTUAL_RESEARCH_SHAPE_SOURCED_BRIEF);
    assert.equal(isFactualResearchStructuredReportShape(ZORIN_QUERY), false);
    assert.equal(
      isFactualResearchSourcedReportPath(ZORIN_QUERY, {
        meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      }),
      true,
    );
  });

  it("rapport explicite + cluster → structured_report", () => {
    assert.equal(isWebCitationsStructuredReportCluster(CLUSTER_QUERY), true);
    assert.equal(
      resolveFactualResearchOutputShape(CLUSTER_QUERY),
      FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
    );
    assert.equal(
      resolveFactualResearchOutputShape(EXPLICIT_REPORT_QUERY),
      FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
    );
    assert.equal(
      resolveFactualResearchOutputShape(
        "fais un résumé exécutif et une analyse de marché de Zorin OS",
      ),
      FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
    );
  });

  it("format=null n'est pas un driver — query simple reste brief", () => {
    assert.equal(resolveFactualResearchOutputShape(ZORIN_QUERY), FACTUAL_RESEARCH_SHAPE_SOURCED_BRIEF);
  });

  it("refus 0 source inchangé (gâche grounding)", () => {
    assert.equal(shouldRefuseFactualResearchWithoutSources(ZORIN_QUERY, ZERO_PACKET), true);
    const refusal = buildFactualResearchNoSourcesReply(ZORIN_QUERY, "fallback_no_results");
    assert.match(refusal, /Je n'ai pas trouvé de sources web/);
    assert.match(refusal, /rapport chiffré/);
  });
});

function zorinPacket(n = 9) {
  const evidence = Array.from({ length: n }, (_, i) => ({
    source: `https://zorin.com/os/page-${i + 1}`,
    title: `Zorin OS ${i + 1}`,
    excerpt:
      i === 0
        ? "Zorin OS is a Linux distribution designed to feel familiar to Windows users."
        : `Windows-friendly desktop layout and app layout notes ${i + 1}.`,
  }));
  return {
    user_query: ZORIN_QUERY,
    meta: { intent_contract_id: "FACTUAL_RESEARCH" },
    evidence,
  };
}

describe("Étape 2 — builder déterministe", () => {
  it("P5 inchangé sur query rapport explicite", () => {
    const evidence = Array.from({ length: 4 }, (_, i) => ({
      source: `https://www.arcom.fr/etude-${i + 1}`,
      title: `Observatoire SVOD ${i + 1}`,
      excerpt: `Tendances streaming films indépendants ${i + 1}`,
    }));
    const packet = {
      user_query: EXPLICIT_REPORT_QUERY,
      meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      evidence,
    };
    const built = buildFactualResearchDeterministicReport(EXPLICIT_REPORT_QUERY, packet);
    assert.equal(built.ok, true);
    assert.equal(hasExactCanonicalHeadings(built.text), true);
    assert.match(built.text, /## Analyse de Marché/);
    assert.match(built.text, /Alignement brief/);
  });

  it("Zorin + 9 sources = brief sourcé, pas rapport", () => {
    const built = buildFactualResearchDeterministicReport(ZORIN_QUERY, zorinPacket(9));
    assert.equal(built.ok, true);
    assert.equal(built.path, "factual_deterministic_builder_sourced_brief");
    assert.equal(hasExactCanonicalHeadings(built.text), false);
    assert.doesNotMatch(built.text, /## Résumé Exécutif/);
    assert.doesNotMatch(built.text, /## Analyse de Marché/);
    assert.doesNotMatch(built.text, /Alignement brief/);
    assert.doesNotMatch(built.text, /Différenciation produit/);
    assert.doesNotMatch(built.text, /Je veux tester Zorin OS/);
    assert.match(built.text, /Sources\s*:/);
    assert.match(built.text, /zorin\.com/);
  });

  it("Zorin 3 vs 9 sources = même shape", () => {
    const a = buildFactualResearchDeterministicReport(ZORIN_QUERY, zorinPacket(3));
    const b = buildFactualResearchDeterministicReport(ZORIN_QUERY, zorinPacket(9));
    assert.equal(a.path, b.path);
    assert.equal(hasExactCanonicalHeadings(a.text), false);
    assert.equal(hasExactCanonicalHeadings(b.text), false);
  });
});

describe("Étape 3 — composer + validator", () => {
  it("addon P5 seulement si structured_report", () => {
    const reportPacket = {
      user_query: EXPLICIT_REPORT_QUERY,
      meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      evidence: [{ source: "https://example.com/a", excerpt: "x" }],
    };
    const p5 = buildFactualResearchSystemAddon(EXPLICIT_REPORT_QUERY, reportPacket);
    assert.match(p5, /VARIANTE RAPPORT FACTUEL/);
    assert.match(p5, /## Résumé Exécutif/);
    assert.match(p5, /1200–1800/);

    const brief = buildFactualResearchSystemAddon(ZORIN_QUERY, zorinPacket(9));
    assert.match(brief, /VARIANTE BRIEF SOURCÉ/);
    assert.doesNotMatch(brief, /Longueur : 1200/);
    assert.doesNotMatch(brief, /Structure OBLIGATOIRE/);
  });

  it("validator brief : pas d'injection P5 ; 0 source et cluster intacts", () => {
    const briefText = "Zorin OS vise les bascules depuis Windows.\n\nSources :\n1. https://zorin.com/os";
    const briefResult = validateFactualResearchReply(briefText, zorinPacket(9), {
      query: ZORIN_QUERY,
    });
    assert.equal(hasExactCanonicalHeadings(briefResult.sanitized), false);
    assert.doesNotMatch(briefResult.sanitized, /## Analyse de Marché/);
    assert.ok(!briefResult.issues.includes("non_canonical_headings"));

    const zero = validateFactualResearchReply("brouillon", ZERO_PACKET, {
      query: ZORIN_QUERY,
    });
    assert.equal(zero.issues.includes("no_sources"), true);
    assert.match(zero.sanitized, /Je n'ai pas trouvé de sources web/);

    const clusterPacket = {
      user_query: CLUSTER_QUERY,
      meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      evidence: Array.from({ length: 3 }, (_, i) => ({
        source: `https://example.com/m-${i}`,
        excerpt: `Market 2026 ${i}`,
      })),
    };
    const p5text = `## Résumé Exécutif
Synthèse.
## Analyse de Marché
- signal [1]
## Analyse Concurrentielle
| Acteur / source | Signal concurrentiel | Preuve |
|---|---|---|
| A | b | [1] |
## Opportunités de Croissance
1. **A** — x
2. **B** — y
## Sources
1. Example — https://example.com/m-0`;
    const cluster = validateFactualResearchReply(p5text, clusterPacket, {
      query: CLUSTER_QUERY,
    });
    assert.equal(hasExactCanonicalHeadings(cluster.sanitized), true);
  });

  it("user prompt brief interdit de recopier la demande", () => {
    const prompt = buildFactualResearchComposerUserPrompt(zorinPacket(3));
    assert.match(prompt, /NE PAS recopier/);
    assert.doesNotMatch(prompt, /5 titres canoniques P5/);
  });
});

describe("Étape 4 — batterie shape obligatoire", () => {
  it("1. Zorin + 9 sources = brief sourcé", () => {
    const built = buildFactualResearchDeterministicReport(ZORIN_QUERY, zorinPacket(9));
    assert.equal(built.path, "factual_deterministic_builder_sourced_brief");
    assert.equal(hasExactCanonicalHeadings(built.text), false);
  });

  it("2. Zorin 3 vs 9 = même shape", () => {
    const a = resolveFactualResearchOutputShape(ZORIN_QUERY);
    const b = resolveFactualResearchOutputShape(ZORIN_QUERY);
    assert.equal(a, FACTUAL_RESEARCH_SHAPE_SOURCED_BRIEF);
    assert.equal(a, b);
    assert.equal(
      buildFactualResearchDeterministicReport(ZORIN_QUERY, zorinPacket(3)).path,
      buildFactualResearchDeterministicReport(ZORIN_QUERY, zorinPacket(9)).path,
    );
  });

  it("3. format=null n'est pas lu — pas de promotion P5", () => {
    assert.equal(resolveFactualResearchOutputShape(ZORIN_QUERY), FACTUAL_RESEARCH_SHAPE_SOURCED_BRIEF);
  });

  it("4. demande explicite de rapport = P5", () => {
    assert.equal(
      resolveFactualResearchOutputShape(EXPLICIT_REPORT_QUERY),
      FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
    );
  });

  it("5. 0 source = refus inchangé", () => {
    assert.equal(shouldRefuseFactualResearchWithoutSources(ZORIN_QUERY, ZERO_PACKET), true);
  });

  it("6. cluster structured report = P5", () => {
    assert.equal(isWebCitationsStructuredReportCluster(CLUSTER_QUERY), true);
    assert.equal(
      resolveFactualResearchOutputShape(CLUSTER_QUERY),
      FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
    );
  });
});

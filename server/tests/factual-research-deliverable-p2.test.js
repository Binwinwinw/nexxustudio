import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveFactualResearchWebQuery,
  deriveFactualResearchWebQueryEn,
  deriveFactualResearchMetricsWebQuery,
  deriveFactualResearchSectorSitesWebQuery,
  deriveFactualResearchMarketSizeEnWebQuery,
  isWebCitationsStructuredReportCluster,
} from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";
import {
  rankFactualResearchSources,
  evidenceHasKeyFigures,
  replyHasKeyFigures,
  isSectorReportSource,
  isLightEntertainmentSource,
  sourcesAreMajorityLight,
  sourcesHaveHardSector,
  FACTUAL_RESEARCH_METRICS_ADMISSION,
} from "../src/agent/policies/web/factualResearchSourceRankPolicy.js";
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
  stripUnanchoredFigures,
  dedupeFactualResearchSections,
  softCapFactualResearchLength,
  countWords,
  hasExactCanonicalHeadings,
  FACTUAL_RESEARCH_SOFT_MAX_WORDS,
} from "../src/agent/policies/web/factualResearchReplyValidator.js";
import {
  requiresFactualResearchComposerContract,
  buildFactualResearchSystemAddon,
  FACTUAL_RESEARCH_CANONICAL_HEADINGS,
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
    assert.match(addon, /## Résumé Exécutif/);
    assert.match(addon, /## Analyse de Marché/);
    assert.match(addon, /## Analyse Concurrentielle/);
    assert.match(addon, /## Opportunités de Croissance/);
    assert.match(addon, /## Sources/);
    assert.match(addon, /1200–1800|1400/);
    assert.match(addon, /aucune métrique chiffrée|métriques chiffrées/i);
    assert.deepEqual(FACTUAL_RESEARCH_CANONICAL_HEADINGS, [
      "## Résumé Exécutif",
      "## Analyse de Marché",
      "## Analyse Concurrentielle",
      "## Opportunités de Croissance",
      "## Sources",
    ]);
  });

  it("validator OK avec 3+ sources, sections et citations", () => {
    const packet = packetWithSources(FACTUAL_RESEARCH_MIN_SOURCES);
    const text = `
## Résumé Exécutif
Le marché croît [1].

## Analyse de Marché
Taille estimée évoquée par les sources [2].

## Analyse Concurrentielle
Acteurs présents [3].

## Opportunités de Croissance
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
## Résumé Exécutif
Je n'ai pas pu vérifier les données ; voici une comparaison qualitative [1].

## Analyse de Marché
Note [2].

## Analyse Concurrentielle
Note [3].

## Opportunités de Croissance
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

  it("P3 : chiffre sans citation retiré ; chiffre ancré conservé", () => {
    const stripped = stripUnanchoredFigures(
      "## Résumé\nLe marché croît de 40% par an.\n\n## Analyse de Marché\nLa taille atteint 12 milliards [1].\n",
    );
    assert.ok(stripped.removed >= 1);
    assert.doesNotMatch(stripped.text, /40%/);
    assert.match(stripped.text, /12 milliards\s*\[1\]/);

    const packet = packetWithSources(3);
    const text = `
## Résumé
Croissance de 40% sans preuve.

## Analyse de Marché
Part de 12% [1].

## Analyse Concurrentielle
Acteurs [2].

## Opportunités
Pistes [3].

## Sources
[1] https://example.com/market-1-2026
`;
    const result = validateFactualResearchReply(text, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.ok(result.issues.includes("unanchored_figure"));
    assert.doesNotMatch(result.sanitized, /40%/);
    assert.match(result.sanitized, /12%\s*\[1\]/);
  });

  it("P3 : double ## Résumé → un seul bloc", () => {
    const { text, deduped } = dedupeFactualResearchSections(`
## Résumé
Premier.

## Résumé
Doublon à supprimer.

## Analyse de Marché
Ok.

## Analyse Concurrentielle
Ok.

## Opportunités
Ok.

## Sources
[1] https://example.com/a
`);
    assert.equal(deduped, true);
    assert.equal((text.match(/## Résumé/g) || []).length, 1);
    assert.match(text, /Premier/);
    assert.doesNotMatch(text, /Doublon/);
  });

  it("P3 : soft-cap > 2000 mots garde Sources", () => {
    const filler = Array.from({ length: 2200 }, () => "mot").join(" ");
    const long = `
## Résumé
${filler}

## Analyse de Marché
${filler}

## Analyse Concurrentielle
court [1].

## Opportunités
court [2].

## Sources
[1] https://example.com/market-1-2026
[2] https://example.com/market-2-2026
`;
    assert.ok(countWords(long) > FACTUAL_RESEARCH_SOFT_MAX_WORDS);
    const capped = softCapFactualResearchLength(long);
    assert.equal(capped.truncated, true);
    assert.ok(capped.wordCount <= FACTUAL_RESEARCH_SOFT_MAX_WORDS + 80);
    assert.match(capped.text, /## Sources/);
    assert.match(capped.text, /https:\/\/example\.com\/market-1-2026/);

    const packet = packetWithSources(3);
    const result = validateFactualResearchReply(long, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.ok(result.issues.includes("over_length"));
    assert.match(result.sanitized, /## Sources/);
  });

  it("P5 : titres courts P3 remappés vers titres exacts", () => {
    const packet = packetWithSources(3);
    const text = `
## Résumé
Synthèse [1].

## Analyse de Marché
Marché [2].

## Analyse Concurrentielle
Concurrence [3].

## Opportunités
Pistes [1].

## Sources
[1] https://example.com/market-1-2026
[2] https://example.com/market-2-2026
[3] https://example.com/market-3-2026
`;
    const result = validateFactualResearchReply(text, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.ok(result.issues.includes("non_canonical_headings"));
    assert.match(result.sanitized, /^## Résumé Exécutif$/m);
    assert.match(result.sanitized, /^## Opportunités de Croissance$/m);
    assert.equal(result.valid, true, result.issues.join("|"));
  });
});

describe("P4 FACTUAL_RESEARCH source rank + metrics", () => {
  it("rank : Arcom > blog quelle série / GO VF", () => {
    const { sources } = rankFactualResearchSources(
      [
        {
          url: "https://quelleseriecesoir.fr/top-streaming",
          title: "Quelle série ce soir en streaming",
          snippet: "Nos coups de cœur VF",
          confidence: 0.7,
        },
        {
          url: "https://www.arcom.fr/observatoire-streaming-2026",
          title: "Observatoire des usages streaming",
          snippet: "Parts de marché SVOD en France",
          confidence: 0.6,
        },
        {
          url: "https://govf.example/film",
          title: "GO VF film gratuit",
          snippet: "voir en streaming",
          confidence: 0.65,
        },
        {
          url: "https://www.cnc.fr/cinema/etudes",
          title: "CNC études marché",
          snippet: "données sectorielles",
          confidence: 0.55,
        },
        {
          url: "https://lesechos.fr/tech/streaming",
          title: "Streaming indépendant",
          snippet: "analyse",
          confidence: 0.6,
        },
      ],
      { maxResults: 5 },
    );
    assert.ok(isSectorReportSource(sources[0]));
    assert.match(sources[0].url, /arcom\.fr|cnc\.fr/);
    assert.ok(sources.every((s) => !isLightEntertainmentSource(s)));
  });

  it("evidenceHasKeyFigures true/false", () => {
    assert.equal(
      evidenceHasKeyFigures([
        { title: "Market", snippet: "CAGR de 12% et taille du marché 3 milliards" },
      ]),
      true,
    );
    assert.equal(
      evidenceHasKeyFigures([
        { title: "Blog série", snippet: "les tendances narratives du moment" },
      ]),
      false,
    );
    assert.equal(
      replyHasKeyFigures("Le marché croît avec un CAGR de 8% [1]."),
      true,
    );
    assert.equal(replyHasKeyFigures("Analyse qualitative sans métrique."), false);
  });

  it("derive metrics query courte FR", () => {
    const q = deriveFactualResearchMetricsWebQuery(STREAMING_SERIES_A, {
      lang: "fr",
    });
    assert.ok(q.length <= 120);
    assert.match(q, /CAGR|parts|taille/i);
  });

  it("P5 : aveu métriques injecté si 0 chiffre et 0 hard sector", () => {
    const packet = packetWithSources(3);
    const text = `
## Résumé Exécutif
Synthèse qualitative [1].

## Analyse de Marché
Signaux qualitatifs seulement [2].

## Analyse Concurrentielle
Acteurs [3].

## Opportunités de Croissance
Pistes [1].

## Sources
[1] https://example.com/market-1-2026
[2] https://example.com/market-2-2026
[3] https://example.com/market-3-2026
`;
    const result = validateFactualResearchReply(text, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.ok(result.issues.includes("missing_key_figures"));
    assert.ok(result.issues.includes("metrics_admission_injected"));
    assert.match(result.sanitized, new RegExp(FACTUAL_RESEARCH_METRICS_ADMISSION));
    assert.equal(result.valid, true, result.issues.join("|"));
    assert.equal(hasExactCanonicalHeadings(result.sanitized), true);
  });

  it("validator missing_key_figures si preuves chiffrées mais reply sans", () => {
    const packet = packetWithSources(3);
    packet.meta.factual_research_evidence_has_figures = true;
    packet.evidence[0].excerpt = "Parts de marché SVOD à 42% en 2026";
    const text = `
## Résumé Exécutif
Synthèse [1].

## Analyse de Marché
Tendances [2].

## Analyse Concurrentielle
Acteurs [3].

## Opportunités de Croissance
Pistes [1].

## Sources
[1] https://example.com/market-1-2026
[2] https://example.com/market-2-2026
[3] https://example.com/market-3-2026
`;
    const result = validateFactualResearchReply(text, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.ok(result.issues.includes("missing_key_figures"));
    assert.equal(result.valid, true);
  });

  it("composer exige chiffres si preuves en ont", () => {
    const packet = packetWithSources(3);
    packet.meta.factual_research_evidence_has_figures = true;
    packet.evidence[0].excerpt = "market size 12 milliards CAGR 9%";
    const addon = buildFactualResearchSystemAddon(STREAMING_SERIES_A, packet);
    assert.match(addon, /2–3 chiffres clés/);
    assert.doesNotMatch(addon, /aucune métrique chiffrée disponible/i);
  });
});

describe("P5 FACTUAL_RESEARCH harden + sector retry helpers", () => {
  it("majority light blogs détectée", () => {
    const sources = [
      { url: "https://culture-series.fr/a", title: "blog", snippet: "x" },
      { url: "https://fuplayvideo.fr/", title: "fuplay", snippet: "y" },
      { url: "https://capitainecomment.fr/z", title: "niche", snippet: "z" },
      { url: "https://example.com/ok", title: "std", snippet: "ok" },
    ];
    assert.equal(sourcesAreMajorityLight(sources), true);
    assert.equal(sourcesHaveHardSector(sources), false);
  });

  it("queries sector sites + market size EN", () => {
    assert.match(deriveFactualResearchSectorSitesWebQuery(), /site:arcom\.fr/);
    assert.match(deriveFactualResearchSectorSitesWebQuery(), /filetype:pdf/);
    assert.match(
      deriveFactualResearchMarketSizeEnWebQuery(),
      /market size independent film streaming/i,
    );
  });

  it("titres non canoniques → remap + valid", () => {
    const packet = packetWithSources(3);
    const text = `
## Résumé Exécutive
Synthèse [1].

## Analyse du Marché
Note [2].

## Analyse Concurrentielle
Note [3].

## Opportunités de Croissance
Note [1].

## Sources
[1] https://example.com/market-1-2026
[2] https://example.com/market-2-2026
[3] https://example.com/market-3-2026
`;
    const result = validateFactualResearchReply(text, packet, {
      query: STREAMING_SERIES_A,
    });
    assert.ok(result.issues.includes("non_canonical_headings"));
    assert.match(result.sanitized, /^## Résumé Exécutif$/m);
    assert.match(result.sanitized, /^## Analyse de Marché$/m);
    assert.equal(hasExactCanonicalHeadings(result.sanitized), true);
  });
});


import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFactualResearchDeterministicReport,
} from "../src/agent/policies/web/factualResearchDeterministicBuilder.js";
import {
  compressComposerFinalPass,
  scrubComposerRedundancy,
} from "../src/agent/utils/quality-safety/qualityGuards.js";
import {
  validateFactualResearchReply,
  hasExactCanonicalHeadings,
} from "../src/agent/policies/web/factualResearchReplyValidator.js";
import {
  rankFactualResearchSources,
  isOpenAccessSource,
  isPaywallReportSource,
  sourcesAreMajorityPaywall,
  FACTUAL_RESEARCH_METRICS_ADMISSION,
} from "../src/agent/policies/web/factualResearchSourceRankPolicy.js";
import { deriveFactualResearchOpenAccessWebQuery } from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";
import { isMetaDeliverableTypesIntent } from "../src/agent/utils/intent-guards/metaConversationIntentGuards.js";
import { resolveMetaConversationRoute } from "../src/agent/micro/replies/metaConversationReplyBuilder.js";
import { DELIVERABLE_TYPES_CLARIFY_REPLY } from "../src/agent/micro/replies/metaConversationReplyBuilder.js";

// Query rapport explicite (structured_report) — P5 uniquement sur ce shape.
const SERIES_A =
  "recherche web marché streaming films indépendants série A avec citations et rapport professionnel";

function packetWithSources(n = 4, { figures = false } = {}) {
  const evidence = Array.from({ length: n }, (_, i) => ({
    source: `https://www.arcom.fr/etude-${i + 1}`,
    title: `Observatoire SVOD ${i + 1}`,
    excerpt: figures
      ? `Parts de marché SVOD streaming à ${10 + i}% et taille du marché en milliards`
      : `Tendances streaming films indépendants et usages FR ${i + 1}`,
  }));
  return {
    user_query: SERIES_A,
    meta: { intent_contract_id: "FACTUAL_RESEARCH" },
    evidence,
    expert_outputs: [
      {
        stage: "web_research",
        content: evidence.map((e) => `- ${e.title}: ${e.source}`).join("\n"),
      },
    ],
  };
}

describe("P7 FACTUAL deterministic builder", () => {
  it("builder OK : titres exacts + tableau + opportunités 1–2–3", () => {
    const packet = packetWithSources(4);
    const built = buildFactualResearchDeterministicReport(SERIES_A, packet);
    assert.equal(built.ok, true, built.path);
    assert.equal(hasExactCanonicalHeadings(built.text), true);
    assert.match(built.text, /\| Acteur \/ source \|/);
    assert.match(built.text, /1\. \*\*/);
    assert.match(built.text, /2\. \*\*/);
    assert.match(built.text, /3\. \*\*/);
    assert.match(built.text, /Limites\s*:/i);
    assert.match(built.text, /https:\/\/www\.arcom\.fr/);
    // Snippets on-topic → pas forcément fallback ; aveu métriques OU alignement OK
    assert.ok(
      built.text.includes(FACTUAL_RESEARCH_METRICS_ADMISSION) ||
        built.fallback === false ||
        /indirecte/i.test(built.text),
    );
  });

  it("builder : pas de doublon snippets Résumé ↔ Analyse de Marché", () => {
    const packet = packetWithSources(4);
    const built = buildFactualResearchDeterministicReport(SERIES_A, packet);
    assert.equal(built.ok, true, built.path);
    const resume = built.text.split("## Analyse de Marché")[0] || "";
    const marche = (built.text.split("## Analyse de Marché")[1] || "").split(
      "## Analyse Concurrentielle",
    )[0];
    // Extraits détaillés uniquement en Marché
    assert.match(marche, /Tendances streaming/i);
    assert.equal(/Tendances streaming/i.test(resume), false);
    assert.match(resume, /une seule fois/i);
  });

  it("scrubComposerRedundancy : retire restart --- ## + phrase dupliquée", () => {
    const sentence =
      "Copilot analyse ce contexte pour proposer des actions : résumer, reformuler, générer du texte cohérent avec le ton de ta rédaction, créer des graphiques à partir d'un tableau brut, etc.";
    const raw = [
      "Comment ça marche ?",
      sentence,
      "",
      `Cas d'usage principaux\n${sentence} --- ## Cas d'usage principaux`,
      "Word : résumer un long rapport.",
    ].join("\n\n");
    const { text, scrubbed } = scrubComposerRedundancy(raw);
    assert.equal(scrubbed, true);
    assert.equal((text.match(/Copilot analyse ce contexte/g) || []).length, 1);
    assert.doesNotMatch(text, /---\s*##/);
  });

  it("compressComposerFinalPass : drop republication fiche aplatie (## inline)", () => {
    const dump =
      "Fiche — Microsoft 365 Copilot ## Qu'est-ce que c'est ? Copilot est l'assistant IA intégré nativement à Word, Excel, PowerPoint, Outlook, Teams et OneNote. ## Fonctionnalités par application ### Word — Copilot Writer & Edit - Rédaction assistée ### Excel — Analyse intelligente - Formules ## Ce qui change concrètement pour toi ?";
    const raw = [
      "Fiche — Microsoft 365 Copilot",
      "Qu'est-ce que c'est ?",
      "Copilot est l'assistant IA intégré nativement à Word, Excel, PowerPoint, Outlook, Teams et OneNote.",
      "Fonctionnalités par application",
      "Word — rédaction assistée.",
      "Ce qui change concrètement pour toi ?",
      dump,
      "| Avant | Avec Copilot |",
      "|---|---|",
      "| Tu écris tout seul | L'IA propose un premier jet |",
    ].join("\n\n");
    const { text, compressed } = compressComposerFinalPass(raw);
    assert.equal(compressed, true);
    assert.doesNotMatch(text, /## Qu'est-ce que c'est \?/);
    assert.doesNotMatch(text, /### Word/);
    assert.match(text, /Ce qui change concrètement pour toi \?/i);
    assert.match(text, /\| Avant \|/);
    assert.equal((text.match(/Fiche — Microsoft 365 Copilot/g) || []).length, 1);
  });

  it("compressComposerFinalPass : une section + pas de paraphrase post-tableau", () => {
    const raw = [
      "Comment ça marche ?",
      "Chaque app expose son contexte à Copilot.",
      "| Application | Contexte |",
      "|---|---|",
      "| Word | Texte du document |",
      "| Excel | Formules et données |",
      "",
      "Copilot utilise le texte du document Word et les formules Excel comme contexte pour proposer des actions.",
      "",
      "Cas d'usage principaux",
      "Word résume ; Excel interroge les données.",
      "",
      "Cas d'usage principaux",
      "Word résume encore ; Excel interroge encore les données.",
    ].join("\n");
    const { text, compressed } = compressComposerFinalPass(raw);
    assert.equal(compressed, true);
    assert.equal(
      (text.match(/Cas d'usage principaux/gi) || []).length,
      1,
    );
    assert.match(text, /\| Word \|/);
    // Paraphrase immédiate après tableau retirée
    assert.doesNotMatch(
      text,
      /utilise le texte du document Word et les formules Excel/i,
    );
  });

  it("validator soft issues absents sur sortie builder", () => {
    const packet = packetWithSources(4);
    const built = buildFactualResearchDeterministicReport(SERIES_A, packet);
    const result = validateFactualResearchReply(built.text, packet, {
      query: SERIES_A,
    });
    assert.equal(result.valid, true, result.issues.join("|"));
    assert.ok(!result.issues.includes("missing_competitive_table"));
    assert.ok(!result.issues.includes("missing_opportunity_ranking"));
  });

  it("rank : open-access > paywall", () => {
    const { sources, majorityPaywall } = rankFactualResearchSources(
      [
        {
          url: "https://www.mordorintelligence.com/industry-reports/x",
          title: "Paid report",
          snippet: "market size",
          confidence: 0.8,
        },
        {
          url: "https://www.arcom.fr/observatoire",
          title: "Arcom",
          snippet: "SVOD France",
          confidence: 0.55,
        },
        {
          url: "https://www.tv.fr/etude-streaming",
          title: "TV.fr",
          snippet: "usages",
          confidence: 0.55,
        },
        {
          url: "https://www.bpifrance.fr/etudes",
          title: "BPI",
          snippet: "levée",
          confidence: 0.55,
        },
      ],
      { maxResults: 4 },
    );
    assert.ok(isOpenAccessSource(sources[0]));
    assert.ok(sources.every((s) => !isPaywallReportSource(s)));
    assert.equal(majorityPaywall, false);
  });

  it("majority paywall détectée + query open-access", () => {
    const sources = [
      { url: "https://www.statista.com/a" },
      { url: "https://www.mordorintelligence.com/b" },
      { url: "https://www.gartner.com/c" },
      { url: "https://example.com/d" },
    ];
    assert.equal(sourcesAreMajorityPaywall(sources), true);
    assert.match(deriveFactualResearchOpenAccessWebQuery(), /site:arcom\.fr/);
    assert.match(deriveFactualResearchOpenAccessWebQuery(), /filetype:pdf/);
  });

  it("régression P6 : sans FACTUAL → clarify livrables", () => {
    const q = "quel type de livrable pourrais tu fournir";
    assert.equal(isMetaDeliverableTypesIntent(q), true);
    const route = resolveMetaConversationRoute(q, { history: [] });
    assert.equal(route?.reply, DELIVERABLE_TYPES_CLARIFY_REPLY);
  });
});

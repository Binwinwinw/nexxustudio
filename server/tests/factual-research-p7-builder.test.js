import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFactualResearchDeterministicReport,
} from "../src/agent/policies/web/factualResearchDeterministicBuilder.js";
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
import { isMetaDeliverableTypesIntent } from "../src/agent/utils/metaConversationIntentGuards.js";
import { resolveMetaConversationRoute } from "../src/agent/micro/replies/metaConversationReplyBuilder.js";
import { DELIVERABLE_TYPES_CLARIFY_REPLY } from "../src/agent/micro/replies/metaConversationReplyBuilder.js";

const SERIES_A =
  "recherche web marché streaming films indépendants série A avec citations et rapport professionnel";

function packetWithSources(n = 4, { figures = false } = {}) {
  const evidence = Array.from({ length: n }, (_, i) => ({
    source: `https://www.arcom.fr/etude-${i + 1}`,
    title: `Observatoire SVOD ${i + 1}`,
    excerpt: figures
      ? `Parts de marché SVOD à ${10 + i}% et taille du marché en milliards`
      : `Tendances plateformes indépendantes et usages FR ${i + 1}`,
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
    assert.match(built.text, new RegExp(FACTUAL_RESEARCH_METRICS_ADMISSION));
    assert.match(built.text, /https:\/\/www\.arcom\.fr/);
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

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessFactualSourcesTopicMatch,
  buildOpportunityThemesFromBrief,
  deriveFactualResearchTopicRetryWebQuery,
  extractFactualTopicKeywords,
  isStreamingFactualBrief,
  sourceMatchesTopic,
  FACTUAL_RESEARCH_TOPIC_MATCH_MIN,
} from "../src/agent/policies/web/factualResearchTopicMatchPolicy.js";
import { buildFactualResearchDeterministicReport as buildReport } from "../src/agent/policies/web/factualResearchDeterministicBuilder.js";
import { hasExactCanonicalHeadings } from "../src/agent/policies/web/factualResearchReplyValidator.js";

// Query rapport explicite (structured_report).
const AGTECH =
  "Recherche web marché IoT AgTech Europe agriculture de précision, concurrents et opportunités, rapport professionnel avec citations focus 2026";

const SERIES_A =
  "recherche web marché streaming films indépendants série A avec citations et rapport professionnel";

describe("P7.1 topic match + gate streaming", () => {
  it("détecte brief streaming vs AgTech", () => {
    assert.equal(isStreamingFactualBrief(SERIES_A), true);
    assert.equal(isStreamingFactualBrief(AGTECH), false);
  });

  it("keywords brief AgTech contiennent iot/agtech/agriculture", () => {
    const ks = extractFactualTopicKeywords(AGTECH);
    assert.ok(ks.includes("iot") || ks.includes("agtech"));
    assert.ok(ks.some((k) => k.includes("agricultur") || k === "agtech"));
  });

  it("sources levées FR ne matchent pas brief AgTech", () => {
    const fundraising = [
      {
        url: "https://www.maddyness.com/levees-fonds-france-2026",
        title: "Les levées de fonds tech en France",
        snippet: "startup série A fintech et SaaS lèvent des millions",
      },
      {
        url: "https://www.frenchweb.fr/levees",
        title: "Baromètre levées de fonds",
        snippet: "capital-risque français 2026",
      },
      {
        url: "https://www.bpifrance.fr/actualites/levees",
        title: "Levées BPI",
        snippet: "financement startup France",
      },
    ];
    const assess = assessFactualSourcesTopicMatch(AGTECH, fundraising);
    assert.ok(
      assess.matchCount < FACTUAL_RESEARCH_TOPIC_MATCH_MIN,
      `matchCount=${assess.matchCount}`,
    );
    assert.equal(assess.weak, true);
  });

  it("sources AgTech matchent le brief", () => {
    const onTopic = [
      {
        url: "https://www.fao.org/agtech-iot-europe.pdf",
        title: "IoT AgTech Europe report",
        snippet: "precision agriculture market IoT sensors",
      },
      {
        url: "https://ec.europa.eu/agri/iot",
        title: "EU AgTech IoT",
        snippet: "agriculture de précision Europe",
      },
      {
        url: "https://www.inrae.fr/actualites/agtech",
        title: "AgTech INRAE",
        snippet: "capteurs IoT agriculture",
      },
    ];
    const assess = assessFactualSourcesTopicMatch(AGTECH, onTopic);
    assert.ok(assess.matchCount >= FACTUAL_RESEARCH_TOPIC_MATCH_MIN);
    assert.equal(assess.weak, false);
  });

  it("query topic retry dérive du brief + institutions OR + pdf", () => {
    const q = deriveFactualResearchTopicRetryWebQuery(AGTECH);
    assert.match(q, /agtech|iot|agriculture/i);
    assert.match(q, /filetype:pdf/i);
    assert.match(q, /europa\.eu/);
    assert.match(q, /OR/);
    assert.ok(!/^streaming SVOD/i.test(q));
  });

  it("opportunités dérivées du brief, pas SVOD hardcodé", () => {
    const themes = buildOpportunityThemesFromBrief(AGTECH);
    const blob = themes.map((t) => `${t.title} ${t.hint}`).join(" ");
    assert.doesNotMatch(blob, /SVOD|éditorial|Différenciation éditoriale/i);
    assert.match(blob, /agtech|iot|agriculture|marché/i);
  });

  it("builder fallback : sources hors-sujet → squelette + indirectes + Limites", () => {
    const packet = {
      user_query: AGTECH,
      meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      evidence: [
        {
          source: "https://www.maddyness.com/levees-fonds",
          title: "Levées de fonds France",
          excerpt: "startup série A lèvent des millions en France",
        },
        {
          source: "https://www.frenchweb.fr/levees",
          title: "Baromètre levées",
          excerpt: "capital-risque français",
        },
        {
          source: "https://lesechos.fr/tech/levees",
          title: "Record de levées",
          excerpt: "fintech SaaS",
        },
      ],
    };
    const built = buildReport(AGTECH, packet);
    assert.equal(built.ok, true);
    assert.equal(built.builder_triggered, true);
    assert.equal(built.fallback, true);
    assert.equal(built.path, "factual_deterministic_builder_fallback");
    assert.ok(built.sources_topic_match < FACTUAL_RESEARCH_TOPIC_MATCH_MIN);
    assert.equal(hasExactCanonicalHeadings(built.text), true);
    assert.match(built.text, /indirecte/i);
    assert.match(built.text, /Limites/i);
    assert.doesNotMatch(built.text, /Différenciation éditoriale/);
  });

  it("builder fallback : 0 source → squelette Limites (pas vide)", () => {
    const packet = {
      user_query: AGTECH,
      meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      evidence: [],
    };
    const built = buildReport(AGTECH, packet);
    assert.equal(built.ok, true);
    assert.equal(built.builder_triggered, true);
    assert.equal(built.fallback, true);
    assert.equal(hasExactCanonicalHeadings(built.text), true);
    assert.match(built.text, /Limites/i);
    assert.match(built.text, /1\. \*\*/);
  });

  it("Series A on-topic : builder non-fallback, opportunités OK", () => {
    const packet = {
      user_query: SERIES_A,
      meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      evidence: [
        {
          source: "https://www.arcom.fr/svod-1",
          title: "Observatoire streaming SVOD",
          excerpt: "marché streaming films indépendants usages FR",
        },
        {
          source: "https://www.cnc.fr/etude-2",
          title: "CNC audiovisuel",
          excerpt: "plateformes streaming indépendantes France",
        },
        {
          source: "https://www.tv.fr/rapport-3",
          title: "TV.fr streaming",
          excerpt: "parts de marché SVOD films",
        },
      ],
    };
    const built = buildReport(SERIES_A, packet);
    assert.equal(built.ok, true);
    assert.equal(built.fallback, false, `match=${built.sources_topic_match}`);
    assert.equal(built.path, "factual_deterministic_builder");
    assert.ok(built.sources_topic_match >= FACTUAL_RESEARCH_TOPIC_MATCH_MIN);
  });

  it("sourceMatchesTopic exige signal fort (pas startup seul)", () => {
    assert.equal(
      sourceMatchesTopic(
        { title: "Startup levée de fonds", snippet: "millions" },
        ["startup", "agtech", "iot", "agriculture"],
      ),
      false,
    );
    assert.equal(
      sourceMatchesTopic(
        { title: "AgTech IoT Europe", snippet: "agriculture précision" },
        ["startup", "agtech", "iot", "agriculture"],
      ),
      true,
    );
  });
});

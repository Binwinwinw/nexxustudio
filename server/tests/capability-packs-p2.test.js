import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { match as matchCaveman, injectInstructions } from "../src/agent/capabilities/caveman/index.js";
import { composeCapabilityContext, CAPABILITY_IDS } from "../src/agent/capabilities/index.js";
import { CAVEMAN_LITE_INSTRUCTION_BLOCK } from "../src/agent/capabilities/caveman/instructions.js";
import { DEFAULT_GRAPH_JSON } from "../src/agent/capabilities/graphify/graphifyPaths.js";
import {
  resolvePipelineCavemanLevel,
  formatLowTokenModeObservabilityStep,
} from "../src/agent/capabilities/caveman/pipelineLevel.js";
import { CODE_INTENT_KINDS } from "../../shared/codeIntentCatalog.js";

const baseInput = {
  query: "",
  history: [],
  intentContractId: null,
  justIntent: {},
  conversationMove: {},
  cavemanLevel: "NORMAL",
  toolHeavyTurn: false,
  capabilities: {},
  attachments: [],
};

describe("capability packs P2 — caveman instruction lite", () => {
  it("NORMAL → pas d'instruction", () => {
    const hit = matchCaveman({
      ...baseInput,
      intentContractId: "REPO_ANALYSIS",
      cavemanLevel: "NORMAL",
    });
    assert.equal(hit.active, false);
    assert.equal(injectInstructions({ ...baseInput, cavemanLevel: "NORMAL" }), null);
  });

  it("LITE + REPO_ANALYSIS → actif + bloc lite", () => {
    const input = {
      ...baseInput,
      query: "impact de composeCapabilityContext",
      intentContractId: "REPO_ANALYSIS",
      cavemanLevel: "LITE",
      toolHeavyTurn: true,
    };
    const hit = matchCaveman(input);
    assert.equal(hit.active, true);
    const block = injectInstructions(input);
    assert.equal(block, CAVEMAN_LITE_INSTRUCTION_BLOCK);
    assert.match(block, /INTERDIT de modifier/i);
    assert.match(block, /code, commandes/i);
  });

  it("LITE sans contrat ni signal technique → inactif", () => {
    const hit = matchCaveman({
      ...baseInput,
      query: "raconte-moi une blague",
      cavemanLevel: "LITE",
    });
    assert.equal(hit.active, false);
  });

  it("FULL explicite + patch code → actif", () => {
    const hit = matchCaveman({
      ...baseInput,
      query: "mode caveman full — corrige ce script",
      cavemanLevel: "FULL",
      justIntent: { codeIntentKind: CODE_INTENT_KINDS.CORRECTION },
      toolHeavyTurn: true,
    });
    assert.equal(hit.active, true);
  });

  it("exclut code_explain même en FULL", () => {
    const hit = matchCaveman({
      ...baseInput,
      query: "mode caveman full — explique ce code",
      cavemanLevel: "FULL",
      justIntent: { codeIntentKind: CODE_INTENT_KINDS.EXPLAIN },
    });
    assert.equal(hit.active, false);
    assert.ok(hit.why.some((w) => w.includes("code_explain")));
  });

  it("exclut présentation pédagogique même en ULTRA", () => {
    const hit = matchCaveman({
      ...baseInput,
      query: "plan de cours sur la lune",
      intentContractId: "PRESENTATION_OUTLINE",
      cavemanLevel: "ULTRA",
    });
    assert.equal(hit.active, false);
  });

  it("exclut spec / prose utilisateur", () => {
    const hit = matchCaveman({
      ...baseInput,
      query: "rédige la spec fonctionnelle du module auth",
      cavemanLevel: "LITE",
      intentContractId: "CODE_DELIVERY_V1",
    });
    assert.equal(hit.active, false);
  });

  it("compose — caveman + graphify peuvent coexister sur REPO", () => {
    process.env.GRAPHIFY_GRAPH_PATH = DEFAULT_GRAPH_JSON;
    const ctx = composeCapabilityContext({
      ...baseInput,
      query: "qui appelle agentPipeline.run",
      intentContractId: "REPO_ANALYSIS",
      cavemanLevel: "LITE",
      toolHeavyTurn: true,
    });
    const cave = ctx.telemetry.find((t) => t.id === CAPABILITY_IDS.CAVEMAN);
    const graph = ctx.telemetry.find((t) => t.id === CAPABILITY_IDS.GRAPHIFY);
    if (graph?.active) {
      assert.equal(cave?.active, true);
      assert.ok(ctx.instructionBlocks.some((b) => b.includes("behavior.caveman")));
    }
  });
});

describe("NEXXUS_LOW_TOKEN_MODE", () => {
  it("force LITE sans mot caveman dans la requête", () => {
    const prev = process.env.NEXXUS_LOW_TOKEN_MODE;
    process.env.NEXXUS_LOW_TOKEN_MODE = "1";
    try {
      assert.equal(
        resolvePipelineCavemanLevel({
          query: "impact si je change composeCapabilityContext",
          optionLevel: "NORMAL",
        }),
        "LITE",
      );
    } finally {
      if (prev === undefined) delete process.env.NEXXUS_LOW_TOKEN_MODE;
      else process.env.NEXXUS_LOW_TOKEN_MODE = prev;
    }
  });

  it("env seul n'active pas caveman sans signal tour compatible", () => {
    const prev = process.env.NEXXUS_LOW_TOKEN_MODE;
    process.env.NEXXUS_LOW_TOKEN_MODE = "true";
    try {
      const hit = matchCaveman({
        ...baseInput,
        query: "raconte une histoire",
        cavemanLevel: "LITE",
      });
      assert.equal(hit.active, false);
    } finally {
      if (prev === undefined) delete process.env.NEXXUS_LOW_TOKEN_MODE;
      else process.env.NEXXUS_LOW_TOKEN_MODE = prev;
    }
  });

  it("env + REPO → caveman instruction si graphe/signaux OK", () => {
    const prev = process.env.NEXXUS_LOW_TOKEN_MODE;
    process.env.NEXXUS_LOW_TOKEN_MODE = "on";
    try {
      const level = resolvePipelineCavemanLevel({
        query: "qui appelle run()",
        optionLevel: "NORMAL",
      });
      assert.equal(level, "LITE");
      const hit = matchCaveman({
        ...baseInput,
        query: "qui appelle run()",
        intentContractId: "REPO_ANALYSIS",
        cavemanLevel: level,
        toolHeavyTurn: true,
      });
      assert.equal(hit.active, true);
    } finally {
      if (prev === undefined) delete process.env.NEXXUS_LOW_TOKEN_MODE;
      else process.env.NEXXUS_LOW_TOKEN_MODE = prev;
    }
  });

  it("formatLowTokenModeObservabilityStep sépare env, niveau et instruction", () => {
    assert.equal(formatLowTokenModeObservabilityStep({ lowTokenModeEnabled: false }), null);
    assert.match(
      formatLowTokenModeObservabilityStep({
        lowTokenModeEnabled: true,
        cavemanLevelEffective: "LITE",
        cavemanActive: true,
      }),
      /low_token_mode=on · caveman_level_effective=LITE · caveman_instruction=on$/,
    );
    assert.match(
      formatLowTokenModeObservabilityStep({
        lowTokenModeEnabled: true,
        cavemanLevelEffective: "LITE",
        cavemanActive: false,
        cavemanWhy: ["no_tool_heavy_signal"],
      }),
      /caveman_instruction=off \(no_tool_heavy_signal\)/,
    );
  });
});

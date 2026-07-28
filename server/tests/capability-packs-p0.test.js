import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CAPABILITY_IDS, composeCapabilityContext } from "../src/agent/capabilities/index.js";
import { match as matchPonytail } from "../src/agent/capabilities/ponytail/index.js";
import { match as matchCaveman } from "../src/agent/capabilities/caveman/index.js";
import { match as matchGraphify } from "../src/agent/capabilities/graphify/index.js";
import { CODE_INTENT_KINDS } from "../../shared/codeIntentCatalog.js";

const baseInput = {
  query: "",
  history: [],
  intentContractId: null,
  justIntent: {},
  conversationMove: {},
  cavemanLevel: "NORMAL",
  capabilities: {},
  attachments: [],
};

describe("capability packs P0 — ponytail", () => {
  it("actif sur refactor code", () => {
    const hit = matchPonytail({
      ...baseInput,
      query: "refactorise cette fonction sans changer le comportement",
      justIntent: { codeIntentKind: CODE_INTENT_KINDS.REFACTOR },
    });
    assert.equal(hit.active, true);
    assert.ok(hit.why.some((w) => w.includes("code_intent")));
  });

  it("inactif sur code_explain (pédagogie code)", () => {
    const hit = matchPonytail({
      ...baseInput,
      query: "explique ce code ligne par ligne",
      justIntent: { codeIntentKind: CODE_INTENT_KINDS.EXPLAIN },
    });
    assert.equal(hit.active, false);
    assert.ok(hit.why.some((w) => w.includes("code_explain")));
  });

  it("inactif sur GUIDED_PRODUCT_RECOMMENDATION", () => {
    const hit = matchPonytail({
      ...baseInput,
      query: "meilleure carte graphique sous 1000€",
      intentContractId: "GUIDED_PRODUCT_RECOMMENDATION",
      capabilities: { code: false },
    });
    assert.equal(hit.active, false);
  });

  it("actif sur contrat CODE_DELIVERY_V1", () => {
    const hit = matchPonytail({
      ...baseInput,
      query: "écris un script python qui lit un csv",
      intentContractId: "CODE_DELIVERY_V1",
    });
    assert.equal(hit.active, true);
  });
});

describe("capability packs P0 — caveman guards", () => {
  it("interdit sur contrat pédagogique PRESENTATION_OUTLINE", () => {
    const hit = matchCaveman({
      ...baseInput,
      query: "plan de présentation sur le cycle de l'eau",
      intentContractId: "PRESENTATION_OUTLINE",
      cavemanLevel: "ULTRA",
    });
    assert.equal(hit.active, false);
    assert.ok(hit.why.some((w) => w.startsWith("excluded:")));
  });

  it("pas instruction si cavemanLevel NORMAL", () => {
    const hit = matchCaveman({
      ...baseInput,
      query: "ok merci",
      cavemanLevel: "NORMAL",
    });
    assert.equal(hit.active, false);
  });
});

describe("capability packs P0 — graphify match (tools P1)", () => {
  it("actif sur REPO_ANALYSIS", () => {
    const hit = matchGraphify({
      ...baseInput,
      query: "analyse ce dépôt et l'architecture",
      intentContractId: "REPO_ANALYSIS",
    });
    assert.equal(hit.active, true);
  });

  it("actif sur requête impact / call flow", () => {
    const hit = matchGraphify({
      ...baseInput,
      query: "quel est l'impact si je change cette fonction, qui l'appelle ?",
    });
    assert.equal(hit.active, true);
  });

  it("inactif sur chat généraliste", () => {
    const hit = matchGraphify({
      ...baseInput,
      query: "bonjour comment vas-tu",
      intentContractId: "SOCIAL",
    });
    assert.equal(hit.active, false);
  });
});

describe("composeCapabilityContext — priorité registre", () => {
  it("injecte ponytail seul sur patch code", () => {
    const ctx = composeCapabilityContext({
      ...baseInput,
      query: "corrige ce script python",
      justIntent: { codeIntentKind: CODE_INTENT_KINDS.CORRECTION },
      intentContractId: "CODE_INTENT",
    });
    const active = ctx.telemetry.filter((t) => t.active).map((t) => t.id);
    assert.deepEqual(active, [CAPABILITY_IDS.PONYTAIL]);
    assert.equal(ctx.instructionBlocks.length, 1);
    assert.match(ctx.instructionBlocks[0], /behavior\.ponytail/i);
    assert.equal(ctx.tools.length, 0);
  });

  it("graphify match sans injection texte en P0", () => {
    const ctx = composeCapabilityContext({
      ...baseInput,
      query: "blast radius de UserService.update",
      intentContractId: "REPO_ANALYSIS",
    });
    const graph = ctx.telemetry.find((t) => t.id === CAPABILITY_IDS.GRAPHIFY);
    if (graph?.active) {
      assert.ok(ctx.instructionBlocks.length >= 1);
      assert.equal(ctx.tools.length, 3);
    } else {
      assert.equal(ctx.instructionBlocks.length, 0);
    }
  });

  it("exclut ponytail sur présentation pédagogique", () => {
    const ctx = composeCapabilityContext({
      ...baseInput,
      query: "fais un plan de cours sur les phases de la lune",
      intentContractId: "PRESENTATION_OUTLINE",
    });
    const pony = ctx.telemetry.find((t) => t.id === CAPABILITY_IDS.PONYTAIL);
    assert.equal(pony?.active, false);
    const cave = ctx.telemetry.find((t) => t.id === CAPABILITY_IDS.CAVEMAN);
    assert.equal(cave?.active, false);
  });
});

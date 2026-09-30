import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CAPABILITY_IDS, composeCapabilityContext } from "../src/agent/capabilities/index.js";
import { match as matchPonytail } from "../src/agent/capabilities/ponytail/index.js";
import { match as matchCaveman } from "../src/agent/capabilities/caveman/index.js";
import { match as matchGraphify } from "../src/agent/capabilities/graphify/index.js";
import { assessGraphifyGraphAvailability } from "../src/agent/capabilities/graphify/graphifyPaths.js";
import { classifyCodeIntent } from "../src/agent/policies/code/codeIntentPolicy.js";
import { CODE_INTENT_KINDS } from "../../shared/codeIntentCatalog.js";

const EXPLAIN_CODE_Q =
  "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
const CREATE_CODE_Q = "ecris un script python pour lister les fichiers csv";
const REFACTOR_CODE_Q = "refactor ce script python sans changer le comportement";

const baseInput = {
  query: "",
  history: [],
  intentContractId: null,
  conversationMove: {},
  cavemanLevel: "NORMAL",
  capabilities: {},
  attachments: [],
};

describe("capability packs P0 — ponytail", () => {
  it("actif sur CREATE via capabilities.code + verbe write, sans JUST", () => {
    assert.equal(classifyCodeIntent(CREATE_CODE_Q), null);
    const hit = matchPonytail({
      ...baseInput,
      query: CREATE_CODE_Q,
      capabilities: { code: true },
    });
    assert.equal(hit.active, true);
    assert.ok(hit.why.some((w) => w === "capability_code_write"));
  });

  it("actif sur refactor via capabilities.code + verbe write, sans JUST", () => {
    assert.equal(classifyCodeIntent(REFACTOR_CODE_Q)?.kind, CODE_INTENT_KINDS.REFACTOR);
    const hit = matchPonytail({
      ...baseInput,
      query: REFACTOR_CODE_Q,
      capabilities: { code: true },
    });
    assert.equal(hit.active, true);
    assert.ok(hit.why.some((w) => w === "capability_code_write"));
    assert.equal(hit.why.some((w) => w.startsWith("code_intent:")), false);
  });

  it("inactif sur code_explain même si capabilities.code", () => {
    assert.equal(classifyCodeIntent(EXPLAIN_CODE_Q)?.kind, CODE_INTENT_KINDS.EXPLAIN);
    const hit = matchPonytail({
      ...baseInput,
      query: EXPLAIN_CODE_Q,
      capabilities: { code: true },
      toolHeavyTurn: true,
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

  it("REPO_ANALYSIS n'active pas ponytail même avec capabilities.code", () => {
    const hit = matchPonytail({
      ...baseInput,
      query: "analyse ce dépôt et l'architecture du code python",
      intentContractId: "REPO_ANALYSIS",
      capabilities: { code: true },
    });
    assert.equal(hit.active, false);
    assert.ok(hit.why.some((w) => w.includes("REPO_ANALYSIS")));
  });

  it("non-code / vocab technique sans cap.code → inactif", () => {
    const hit = matchPonytail({
      ...baseInput,
      query: "fais un composant api pour le dashboard",
      capabilities: {},
    });
    assert.equal(hit.active, false);
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
    const avail = assessGraphifyGraphAvailability();
    if (avail.ok) {
      assert.equal(hit.active, true);
    } else {
      assert.ok(hit.why.some((w) => w.startsWith("graph_unavailable")));
    }
  });

  it("actif sur requête impact / call flow", () => {
    const hit = matchGraphify({
      ...baseInput,
      query: "quel est l'impact si je change cette fonction, qui l'appelle ?",
    });
    const avail = assessGraphifyGraphAvailability();
    if (avail.ok) {
      assert.equal(hit.active, true);
    } else {
      assert.ok(hit.why.some((w) => w.startsWith("graph_unavailable")));
    }
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
  it("injecte ponytail seul sur patch code via contrat, sans JUST", () => {
    const ctx = composeCapabilityContext({
      ...baseInput,
      query: "corrige ce script python",
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

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { match as matchGraphify } from "../src/agent/capabilities/graphify/index.js";
import { registerGraphifyTools } from "../src/agent/capabilities/graphify/registerTools.js";
import {
  assessGraphifyGraphAvailability,
  DEFAULT_GRAPH_JSON,
} from "../src/agent/capabilities/graphify/graphifyPaths.js";
import {
  formatGraphifyToolResult,
  normalizeGraphifyCliOutput,
} from "../src/agent/capabilities/graphify/graphifyCli.js";
import { composeCapabilityContext } from "../src/agent/capabilities/index.js";
import {
  setCapabilityToolsForTurn,
  clearCapabilityToolsForTurn,
  isCapabilityToolEnabled,
} from "../src/agent/capabilities/capabilityToolSession.js";
import { isToolAvailable } from "../src/agent/utils/toolRegistry.js";
import { getAllowedTools } from "../src/agent/policies/prompt/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../");

const baseInput = {
  query: "quel impact si je change agentPipeline",
  history: [],
  intentContractId: "REPO_ANALYSIS",
  justIntent: {},
  conversationMove: {},
  attachments: [],
};

describe("capability packs P1 — graphify CLI tools", () => {
  before(() => {
    process.env.GRAPHIFY_GRAPH_PATH = DEFAULT_GRAPH_JSON;
  });

  after(() => {
    clearCapabilityToolsForTurn();
    delete process.env.GRAPHIFY_GRAPH_PATH;
  });

  it("graph.json présent sur ce dépôt", () => {
    const avail = assessGraphifyGraphAvailability();
    assert.equal(avail.ok, true, `graph missing at ${DEFAULT_GRAPH_JSON}`);
  });

  it("match actif + 3 outils si graphe OK", () => {
    const hit = matchGraphify(baseInput);
    assert.equal(hit.active, true);
    const tools = registerGraphifyTools(baseInput);
    assert.equal(tools.length, 3);
    assert.deepEqual(
      tools.map((t) => t.name).sort(),
      ["graph_explain", "graph_path", "graph_query"].sort(),
    );
  });

  it("match inactif si graph.json absent", () => {
    process.env.GRAPHIFY_GRAPH_PATH = path.join(SERVER_ROOT, "nope-graphify-out", "graph.json");
    const hit = matchGraphify(baseInput);
    assert.equal(hit.active, false);
    assert.ok(hit.why.some((w) => w.includes("graph_unavailable")));
    process.env.GRAPHIFY_GRAPH_PATH = DEFAULT_GRAPH_JSON;
  });

  it("compose injecte instruction graphify + tools", () => {
    const ctx = composeCapabilityContext(baseInput);
    const graph = ctx.telemetry.find((t) => t.id === "tool.graphify");
    assert.equal(graph?.active, true);
    assert.equal(ctx.tools.length, 3);
    assert.match(ctx.instructionBlocks.join("\n"), /AST, pas runtime/i);
  });

  it("session capability — outils graph indisponibles hors tour", () => {
    clearCapabilityToolsForTurn();
    assert.equal(isToolAvailable("graph_query"), false);
    setCapabilityToolsForTurn(["graph_query", "graph_path"]);
    assert.equal(isToolAvailable("graph_query"), true);
    assert.equal(isToolAvailable("graph_explain"), false);
    assert.ok(getAllowedTools(null).includes("graph_query"));
    clearCapabilityToolsForTurn();
    assert.equal(isCapabilityToolEnabled("graph_query"), false);
  });

  it("formatGraphifyToolResult — fallback si échec", () => {
    const msg = formatGraphifyToolResult({ ok: false, error: "timeout" }, "graph_query");
    assert.match(msg, /indisponible \(timeout\)/i);
    assert.match(msg, /sans inventer/i);
  });

  it("normalizeGraphifyCliOutput tronque proprement", () => {
    const out = normalizeGraphifyCliOutput("hello", "warn");
    assert.match(out, /hello/);
    assert.match(out, /stderr/);
  });
});

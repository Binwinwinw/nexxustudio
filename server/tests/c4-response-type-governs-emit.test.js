import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  runConversationShortCircuit,
  shouldEmitForResponseType,
  inferShortCircuitPathResponseType,
} from "../src/agent/micro/classifiers/intentShortCircuit.js";

const AVION_HOWTO = "comment on fait un avion ?";
const SITE_WEB = "je veux créer un site web";
const PEDAGOGY =
  "que doit apprendre un élève de 6e sur les fractions simples ?";
const PHPMYADMIN =
  "comment créer une base dans phpMyAdmin l'application web";

describe("C4_RESPONSE_TYPE_GOVERNS_EMIT_V1", () => {
  it("gate : path typé bloqué si responseType incompatible", () => {
    assert.equal(inferShortCircuitPathResponseType("web_project_scoping_clarify"), "scoping");
    assert.equal(inferShortCircuitPathResponseType("how_to_clarify"), "clarify");
    assert.equal(inferShortCircuitPathResponseType("pedagogical_overview_deterministic"), "overview");
    assert.equal(inferShortCircuitPathResponseType("how_to_simple_local"), null);

    assert.equal(
      shouldEmitForResponseType("web_project_scoping_clarify", { responseType: "direct" }),
      false,
    );
    assert.equal(
      shouldEmitForResponseType("how_to_clarify", { responseType: "direct" }),
      false,
    );
    assert.equal(
      shouldEmitForResponseType("pedagogical_overview_deterministic", {
        responseType: "direct",
      }),
      false,
    );
    assert.equal(
      shouldEmitForResponseType("web_project_scoping_clarify", { responseType: "scoping" }),
      true,
    );
    assert.equal(
      shouldEmitForResponseType("how_to_clarify", { responseType: "clarify" }),
      true,
    );
    assert.equal(
      shouldEmitForResponseType("how_to_simple_local", { responseType: "direct" }),
      true,
    );
    assert.equal(shouldEmitForResponseType("how_to_clarify", null), true);
  });

  it("scoping : emit conservé si job scoping, bloqué si direct", async () => {
    const allowed = await runConversationShortCircuit(SITE_WEB, {
      response_commitment: { renderMode: "clarify", responseType: "scoping" },
    });
    assert.equal(allowed?.path, "web_project_scoping_clarify");

    const blocked = await runConversationShortCircuit(SITE_WEB, {
      response_commitment: { renderMode: "llm_direct", responseType: "direct" },
    });
    assert.notEqual(blocked?.path, "web_project_scoping_clarify");
    assert.equal(/scoping/i.test(blocked?.path || ""), false);
  });

  it("clarify : how_to_clarify seulement si job clarify", async () => {
    const allowed = await runConversationShortCircuit(AVION_HOWTO, {
      response_commitment: { renderMode: "clarify", responseType: "clarify" },
    });
    assert.equal(allowed?.path, "how_to_clarify");

    const blocked = await runConversationShortCircuit(AVION_HOWTO, {
      response_commitment: { renderMode: "llm_direct", responseType: "direct" },
    });
    assert.equal(/_clarify(?:_|$)/.test(blocked?.path || ""), false);
  });

  it("overview : path overview seulement si job overview", async () => {
    const allowed = await runConversationShortCircuit(PEDAGOGY, {
      response_commitment: { responseType: "overview" },
    });
    assert.match(allowed?.path || "", /overview/i);

    const blocked = await runConversationShortCircuit(PEDAGOGY, {
      response_commitment: { responseType: "direct" },
    });
    assert.equal(/overview/i.test(blocked?.path || ""), false);
  });

  it("phpMyAdmin + job direct : pas de rail scoping", async () => {
    const hit = await runConversationShortCircuit(PHPMYADMIN, {
      response_commitment: { renderMode: "llm_direct", responseType: "direct" },
    });
    assert.equal(/scoping/i.test(hit?.path || ""), false);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  decomposeRequest,
  splitRequestClauses,
  isMultiUnitRequest,
  isMultiTargetRequest,
  buildMultiUnitExecutionHint,
  suppressesClarificationForDecomposedRequest,
  allWorkUnitsSatisfiable,
  shouldPreemptMultiSegment,
  inventoryRequestUnits,
  REQUEST_MODES,
} from "../src/agent/policies/routing/requestDecompositionPolicy.js";
import { buildRequestDecompositionTelemetryEvent } from "../src/agent/telemetry/requestDecompositionTelemetry.js";
import { resolveClarificationGate } from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import {
  buildMultiUnitCompositeReply,
  canServeMultiUnitComposite,
} from "../src/agent/micro/replies/multiUnitReplyBuilder.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  enforceModeContract,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";

const multiLangQuery =
  "je veux traduire la phrase suivante en espagnol, en allemand, en arabe et en chinois : Suivez la progression de votre enfant en toute sérénité merci par avance";

const heterogeneousQuery =
  "Bonjour, corrige-moi ce HTML, donne-moi un conseil sur React, puis calcule la masse de 2 litres d'eau";

const smoothieMultiUnitQuery =
  "salut salut comment ca va ??? héy j'ai besoin de l'heure, de la date du jour et savoir si tu sais comment on fait un smoothie???";

describe("requestDecompositionPolicy", () => {
  it("multi-cible traduction → request_mode multi_target", () => {
    const decomposition = decomposeRequest(multiLangQuery);
    assert.equal(decomposition.requestMode, REQUEST_MODES.MULTI_TARGET);
    assert.equal(isMultiTargetRequest(decomposition), true);
    assert.equal(decomposition.unitCount, 4);
    assert.equal(decomposition.executionMode, "batch");
    assert.equal(suppressesClarificationForDecomposedRequest(decomposition), true);
  });

  it("multi-cadres hétérogènes → request_mode multi_unit", () => {
    const decomposition = decomposeRequest(heterogeneousQuery);
    assert.equal(decomposition.requestMode, REQUEST_MODES.MULTI_UNIT);
    assert.equal(isMultiUnitRequest(decomposition), true);
    assert.equal(decomposition.containsSocialPreamble, true);
    assert.ok(decomposition.unitTypes.includes("social_greeting"));
    assert.ok(decomposition.unitTypes.includes("html_transform"));
    assert.ok(decomposition.unitTypes.includes("advice"));
    assert.ok(decomposition.unitTypes.includes("calculate"));
    assert.equal(decomposition.unitCount, 4);
  });

  it("ne découpe pas les listes de langues traduction", () => {
    const clauses = splitRequestClauses(multiLangQuery);
    assert.equal(clauses.length, 1);
  });

  it("hint multi_unit — sections par sous-demande", () => {
    const decomposition = decomposeRequest(heterogeneousQuery);
    const hint = buildMultiUnitExecutionHint(decomposition);
    assert.match(hint, /MULTI-UNITÉS/i);
    assert.match(hint, /html_transform|html/i);
    assert.match(hint, /advice|conseil/i);
  });

  it("telemetry [REQUEST_DECOMP]", () => {
    const decomposition = decomposeRequest(heterogeneousQuery);
    const event = buildRequestDecompositionTelemetryEvent(
      heterogeneousQuery,
      decomposition,
    );
    assert.equal(event.event, "request_decomposition");
    assert.equal(event.request_mode, "multi_unit");
    assert.equal(event.execution_mode, "multi_unit");
    assert.equal(event.unit_count, 4);
    assert.deepEqual(event.unit_types, decomposition.unitTypes);
    assert.equal(event.contains_social_preamble, true);
  });

  it("clarification gate — multi_unit explicite sans blocage", () => {
    const gate = resolveClarificationGate(heterogeneousQuery, {
      justIntent: evaluateJustIntent(heterogeneousQuery),
    });
    assert.equal(gate.shouldClarify, false);
  });

  it("batterie #24 — smoothie + heure + date → multi_unit inventorié", () => {
    const decomposition = decomposeRequest(smoothieMultiUnitQuery);
    assert.equal(decomposition.requestMode, REQUEST_MODES.MULTI_UNIT);
    assert.equal(isMultiUnitRequest(decomposition), true);
    assert.ok(decomposition.unitTypes.includes("social_greeting"));
    assert.ok(decomposition.unitTypes.includes("social_checkin"));
    assert.ok(decomposition.unitTypes.includes("time_request"));
    assert.ok(decomposition.unitTypes.includes("date_request"));
    assert.ok(decomposition.unitTypes.includes("how_to_request"));
    assert.equal(allWorkUnitsSatisfiable(decomposition), true);
    assert.equal(shouldPreemptMultiSegment(decomposition), true);
    assert.equal(suppressesClarificationForDecomposedRequest(decomposition), true);
  });

  it("batterie #24 — réponse fusionnée naturelle sans clarification", async () => {
    const decomposition = decomposeRequest(smoothieMultiUnitQuery);
    assert.equal(canServeMultiUnitComposite(decomposition), true);
    const composite = buildMultiUnitCompositeReply(decomposition);
    assert.ok(composite?.reply);
    assert.equal(composite.surfaceStyle, "natural_fusion");
    assert.match(composite.reply, /Salut/i);
    assert.match(composite.reply, /Nous sommes/i);
    assert.match(composite.reply, /il est \d{2}:\d{2}/i);
    assert.match(composite.reply, /smoothie/i);
    assert.doesNotMatch(composite.reply, /\*\*Heure\s*:/i);
    assert.doesNotMatch(composite.reply, /n'hésite pas/i);

    const hit = await runConversationShortCircuit(smoothieMultiUnitQuery, {
      requestDecomposition: decomposition,
    });
    assert.equal(hit?.path, "multi_unit_deterministic");
    assert.ok(hit?.reply);
    assert.doesNotMatch(hit.reply, /Je vois la piste/i);

    const enforced = enforceModeContract(
      RESPONSE_MODES.INSTANT,
      composite.reply,
      hit.enforce,
    );
    assert.match(enforced, /smoothie/i, "sectionedComposite doit préserver le how-to");
  });

  it("inventaire — au moins 4 signaux sur requête smoothie", () => {
    const units = inventoryRequestUnits(smoothieMultiUnitQuery);
    assert.ok(units.length >= 4);
    const types = units.map((u) => u.unitType);
    assert.ok(types.includes("time_request"));
    assert.ok(types.includes("date_request"));
    assert.ok(types.includes("how_to_request"));
  });
});

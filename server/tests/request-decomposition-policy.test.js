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
  composeSocialSituation,
  SOCIAL_SITUATIONS,
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

describe("Social multi-signal v1 — inventaire + composition", () => {
  it("salut + papoter → N unités + situation chat_invite (greeting absorbé)", () => {
    const q = "salut et si on papotait ?";
    const units = inventoryRequestUnits(q);
    assert.ok(units.some((u) => u.unitType === "social_greeting"));
    assert.ok(units.some((u) => u.unitType === "social_chat_invite"));
    assert.ok(units.length >= 2);

    const composed = composeSocialSituation(units);
    assert.equal(composed?.situation, SOCIAL_SITUATIONS.CHAT_INVITE);
    assert.deepEqual(composed?.absorbedUnitTypes, [SOCIAL_SITUATIONS.GREETING]);

    const d = decomposeRequest(q);
    assert.equal(d.socialSituation?.situation, SOCIAL_SITUATIONS.CHAT_INVITE);
    assert.ok(d.unitTypes.includes("social_greeting"));
    assert.ok(d.unitTypes.includes("social_chat_invite"));
  });

  it("bonjour on discute ? → même composition chat_invite", () => {
    const d = decomposeRequest("bonjour on discute ?");
    assert.ok(d.unitTypes.includes("social_greeting"));
    assert.ok(d.unitTypes.includes("social_chat_invite"));
    assert.equal(d.socialSituation?.situation, SOCIAL_SITUATIONS.CHAT_INVITE);
  });

  it("salut seul → situation greeting", () => {
    const d = decomposeRequest("salut");
    assert.deepEqual(d.unitTypes, ["social_greeting"]);
    assert.equal(d.socialSituation?.situation, SOCIAL_SITUATIONS.GREETING);
  });

  it("comment ça va ? → situation checkin", () => {
    const d = decomposeRequest("comment ça va ?");
    assert.ok(d.unitTypes.includes("social_checkin"));
    assert.equal(d.socialSituation?.situation, SOCIAL_SITUATIONS.CHECKIN);
  });

  it("salut + ça va + prêt à tafer → work_ready (greeting/checkin absorbés)", () => {
    const q = "salut comment ca va ??? tu es prêt à tafer ?";
    const units = inventoryRequestUnits(q);
    assert.ok(units.some((u) => u.unitType === "social_greeting"));
    assert.ok(units.some((u) => u.unitType === "social_checkin"));
    assert.ok(units.some((u) => u.unitType === "social_work_ready"));

    const composed = composeSocialSituation(units);
    assert.equal(composed?.situation, SOCIAL_SITUATIONS.WORK_READY);
    assert.ok(composed?.absorbedUnitTypes.includes(SOCIAL_SITUATIONS.GREETING));
    assert.ok(composed?.absorbedUnitTypes.includes(SOCIAL_SITUATIONS.CHECKIN));
    assert.equal(composed?.preemptedByWork, false);

    const d = decomposeRequest(q);
    assert.equal(d.socialSituation?.situation, SOCIAL_SITUATIONS.WORK_READY);
    assert.ok(d.unitTypes.includes("social_work_ready"));
  });

  it("greeting + tâche métier → social preemptedByWork, multi_unit intact", () => {
    const q = "Bonjour, corrige-moi ce HTML";
    const d = decomposeRequest(q);
    assert.ok(d.unitTypes.includes("social_greeting"));
    assert.ok(d.unitTypes.includes("html_transform"));
    assert.equal(d.socialSituation?.preemptedByWork, true);
    assert.equal(d.socialSituation?.situation, null);
    assert.equal(isMultiUnitRequest(d), true);
  });
});

describe("Social multi-signal v1 — short-circuit après composition", () => {
  it("salut et si on papotait ? → entrée conversation, pas menu d'accueil", async () => {
    const hit = await runConversationShortCircuit("salut et si on papotait ?", {
      history: [],
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/chat_invite");
    assert.match(hit?.step || "", /multi-signal|chat_invite/i);
    assert.match(hit?.reply || "", /écoute|sujet/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /cadrer un projet|structurer des livrables/i,
    );
  });

  it("bonjour on discute ? → chat_invite déterministe", async () => {
    const hit = await runConversationShortCircuit("bonjour on discute ?", {
      history: [],
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/chat_invite");
    assert.doesNotMatch(
      hit?.reply || "",
      /cadrer un projet|structurer des livrables/i,
    );
  });

  it("salut seul → greeting déterministe rapide (menu OK)", async () => {
    const hit = await runConversationShortCircuit("salut", { history: [] });
    assert.equal(hit?.path, "social_deterministic");
    assert.match(hit?.reply || "", /Salut/i);
    assert.match(hit?.step || "", /Réponse sociale déterministe/i);
  });

  it("comment ça va ? → checkin déterministe", async () => {
    const hit = await runConversationShortCircuit("comment ça va ?", {
      history: [],
    });
    assert.equal(hit?.path, "social_deterministic");
    assert.match(hit?.reply || "", /Ça va bien|va bien/i);
    assert.match(hit?.step || "", /État\/Santé/i);
  });

  it("salut + ça va + prêt à tafer → work_ready, pas panel santé seul", async () => {
    const q = "salut comment ca va ??? tu es prêt à tafer ?";
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/work_ready");
    assert.match(hit?.step || "", /work_ready/i);
    assert.match(hit?.reply || "", /Salut/i);
    assert.match(hit?.reply || "", /va bien|Tout va bien/i);
    assert.match(hit?.reply || "", /prêt|lance/i);
    assert.doesNotMatch(hit?.step || "", /État\/Santé/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /cadrer un projet|structurer des livrables|Choisis un numéro/i,
    );
  });

  it("salut + HTML → pas short-circuit greeting menu (laisse multi_unit)", async () => {
    const q = "Bonjour, corrige-moi ce HTML";
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.notEqual(hit?.socialPatternName, "social/chat_invite");
    if (hit?.path === "social_deterministic") {
      assert.doesNotMatch(
        hit.reply || "",
        /^Salut ! Si tu veux on peut papoter/i,
      );
    }
  });
});

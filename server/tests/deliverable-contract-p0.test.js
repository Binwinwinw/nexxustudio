import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveDeliverableContract,
  isGuidedChoiceSurface,
  isExplorationPanelOffer,
  formatDeliverableContractSummary,
  PROMISED_VALUES,
  REPLY_SHAPES,
  DELIVERABLE_POLICY_MODE,
} from "../src/agent/policies/deliverableContractPolicy.js";

describe("DeliverableContractPolicy P0.1 — observe", () => {
  it("open_prompt → exploration_proposal, clarify false, gateSuppressed", () => {
    const c = resolveDeliverableContract(
      "alors qu'est-ce qu'on pourrait faire aujourd'hui?",
    );
    assert.equal(c.mode, DELIVERABLE_POLICY_MODE);
    assert.equal(c.enforcement, false);
    assert.equal(c.promisedValue, PROMISED_VALUES.EXPLORATION_PROPOSAL);
    assert.equal(c.clarificationRequired, false);
    assert.equal(c.gateSuppressed, true);
    assert.equal(c.replyShape, REPLY_SHAPES.MENU_PLUS_QUESTION);
    assert.match(formatDeliverableContractSummary(c), /exploration_proposal/);
    assert.match(formatDeliverableContractSummary(c), /enforce=no/);
  });

  it("chat_invite → social_continuity", () => {
    const c = resolveDeliverableContract("ben on va papoter pour le moment");
    assert.equal(c.promisedValue, PROMISED_VALUES.SOCIAL_CONTINUITY);
    assert.equal(c.replyShape, REPLY_SHAPES.SHORT_OPEN);
    assert.equal(c.gateSuppressed, true);
  });

  it("sélection après panel structurel → guided_choice (runtimeAligned=true)", () => {
    const history = [
      {
        role: "user",
        content: "alors qu'est-ce qu'on pourrait faire aujourd'hui?",
      },
      {
        role: "assistant",
        content:
          "Hé bien tu as le choix :\n\n1. discussion libre\n2. brainstorm léger\n3. recherche web sur un thème\n4. petit livrable tech\n5. apprendre un sujet\n\nChoisis un numéro et on se lance",
      },
    ];
    assert.equal(
      isExplorationPanelOffer(history[1].content),
      true,
      "panel structurel reconnu",
    );
    assert.equal(isGuidedChoiceSurface("2", history), true);
    const c = resolveDeliverableContract("2", { history });
    assert.equal(c.promisedValue, PROMISED_VALUES.GUIDED_CHOICE);
    assert.equal(c.replyShape, REPLY_SHAPES.CHOICE_HELP);
    assert.equal(c.clarificationRequired, false);
    assert.equal(c.runtimeAligned, true);
    assert.doesNotMatch(formatDeliverableContractSummary(c), /runtimeAligned=no/);
  });

  it("après personal_discomfort, soft followup ≠ guided_choice", () => {
    const history = [
      { role: "user", content: "j'ai mal au ventre" },
      {
        role: "assistant",
        content:
          "Désolé que tu te doutes pas bien. Je suis pas médecin — on peut papoter un peu si tu veux, ou parler d'autre chose.",
      },
    ];
    assert.equal(isExplorationPanelOffer(history[1].content), false);
    assert.equal(isGuidedChoiceSurface("ok on papote", history), false);
    const c = resolveDeliverableContract("ok on papote", { history });
    assert.notEqual(c.promisedValue, PROMISED_VALUES.GUIDED_CHOICE);
  });

  it("personal_discomfort → care_ack (pas social_continuity)", () => {
    const c = resolveDeliverableContract("j'ai mal au ventre");
    assert.equal(c.promisedValue, PROMISED_VALUES.CARE_ACK);
    assert.equal(c.replyShape, REPLY_SHAPES.CARE_LIMITS);
    assert.notEqual(c.promisedValue, PROMISED_VALUES.SOCIAL_CONTINUITY);
  });

  it("hors cas connus → promisedValue null (pas explanation)", () => {
    const c = resolveDeliverableContract(
      "corrige le bug dans agentPipeline.js ligne 42",
    );
    assert.equal(c.promisedValue, null);
    assert.equal(c.replyShape, REPLY_SHAPES.UNKNOWN);
    assert.equal(c.source, "default_unknown");
    assert.match(formatDeliverableContractSummary(c), /promisedValue=unknown/);
  });

  it("idéation projet ≠ exploration_proposal", () => {
    const c = resolveDeliverableContract("on pourrait faire quoi comme projet");
    assert.notEqual(c.promisedValue, PROMISED_VALUES.EXPLORATION_PROPOSAL);
  });

  it("télémétrie minimale exposée (P0.1)", () => {
    const c = resolveDeliverableContract(
      "alors qu'est-ce qu'on pourrait faire aujourd'hui?",
    );
    assert.deepEqual(
      Object.keys(c.telemetry).sort(),
      [
        "clarificationRequired",
        "deliverableContract",
        "enforcement",
        "gateSuppressed",
        "mode",
        "promisedValue",
        "replyShape",
        "runtimeAligned",
      ].sort(),
    );
    assert.equal(c.telemetry.enforcement, false);
  });
});

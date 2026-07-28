import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFactualSanityTelemetryEvent,
  FACTUAL_SANITY_TELEMETRY_EVENT,
} from "../src/agent/telemetry/factualSanityTelemetry.js";

describe("factualSanityTelemetry", () => {
  it("structure un événement d'observation minimal", () => {
    const event = buildFactualSanityTelemetryEvent("Où se trouve la tour de pizz ?", {
      path: "simple_factual_abstain",
      decision: "abstain",
      reason: "probable_landmark_typo_or_unrecognized_entity",
      matchedRule: "typo_or_unrecognized_landmark",
    });

    assert.equal(event.event, FACTUAL_SANITY_TELEMETRY_EVENT);
    assert.equal(event.path, "simple_factual_abstain");
    assert.equal(event.decision, "abstain");
    assert.equal(event.matched_rule, "typo_or_unrecognized_landmark");
    assert.match(event.query_preview, /tour de pizz/i);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildRequestIntentFrameTelemetryEvent,
  recordRequestIntentFrameTelemetry,
} from "../src/agent/telemetry/requestIntentFrameTelemetry.js";

describe("requestIntentFrameTelemetry", () => {
  it("expose task.kind et information_seeking pour King of Avalon", () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    const event = buildRequestIntentFrameTelemetryEvent(q, {
      pipelinePath: "information_seeking_full_pipeline",
    });
    assert.equal(event.event, "request_intent_frame_shadow");
    assert.equal(event.task_kind, "explain");
    assert.equal(event.information_seeking, true);
    assert.match(event.domain_target, /kingofavalon/i);
    assert.equal(event.pipeline_path, "information_seeking_full_pipeline");
  });

  it("recordRequestIntentFrameTelemetry — JSON loggable", () => {
    const event = recordRequestIntentFrameTelemetry("explique redis", {
      pipelinePath: "technical_overview",
    });
    assert.equal(typeof event.version, "string");
    assert.equal(event.pipeline_path, "technical_overview");
  });
});

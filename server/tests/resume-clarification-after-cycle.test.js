import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pipelineSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/agent/agentPipeline.js"),
  "utf8",
);

function callSiteIndex(marker) {
  const idx = pipelineSrc.indexOf(marker);
  assert.ok(idx >= 0, `marqueur introuvable: ${marker}`);
  return idx;
}

describe("RESUME_CLARIFICATION_AFTER_CYCLE_V1", () => {
  it("resumePendingClarification est appelé après runAgentUnderstandingPhase", () => {
    const cycleIdx = callSiteIndex("} = runAgentUnderstandingPhase(");
    const resumeIdx = callSiteIndex(
      "const pendingClarificationResume = resumePendingClarification(",
    );
    assert.ok(
      resumeIdx > cycleIdx,
      "reprise clarification encore avant le cycle",
    );
  });

  it("la reprise annote response_commitment du cycle", () => {
    const resumeIdx = callSiteIndex(
      "const pendingClarificationResume = resumePendingClarification(",
    );
    const bindIdx = pipelineSrc.indexOf(
      "requestWorkup?.response_commitment",
      resumeIdx,
    );
    const annotateIdx = pipelineSrc.indexOf(
      "pending_clarification_resume",
      resumeIdx,
    );
    assert.ok(bindIdx > resumeIdx, "response_commitment non lié à la reprise");
    assert.ok(annotateIdx > resumeIdx, "télémétrie reprise absente après le cycle");
  });
});

import test from "node:test";
import assert from "node:assert/strict";

import { assessMemoryEligibility } from "../src/agent/memory/guardianship/curatedMemoryGate.js";
import { INSUFFICIENT_SIGNAL_REFUSAL, RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";
import { getLastPipelineMode, recordTurn } from "../src/agent/telemetry/pipelineTelemetry.js";

test("curated memory: eligible technical SIMPLE_FAST response", () => {
  const result = assessMemoryEligibility({
    userQuery: "Comment configurer le quality gate local ?",
    assistantResponse:
      "Lance npm run quality:gate dans server/. Le verdict PASS exige 21 tests.",
    pipelineMode: RESPONSE_MODES.SIMPLE_FAST,
  });
  assert.equal(result.eligible, true);
  assert.equal(result.reasons.length, 0);
});

test("curated memory: rejects refusal response", () => {
  const result = assessMemoryEligibility({
    userQuery: "Quelle est la marge nette du projet ?",
    assistantResponse: INSUFFICIENT_SIGNAL_REFUSAL,
    pipelineMode: RESPONSE_MODES.CRITICAL,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("refusal_response"));
});

test("curated memory: rejects ephemeral social exchange", () => {
  const result = assessMemoryEligibility({
    userQuery: "salut salut comment vas tu",
    assistantResponse: "Salut ! Tout va bien de mon côté. Et toi ?",
    pipelineMode: RESPONSE_MODES.SIMPLE_FAST,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("ephemeral_social"));
});

test("curated memory: rejects system commands", () => {
  const result = assessMemoryEligibility({
    userQuery: "/careful",
    assistantResponse: "Mode prudent activé pour les commandes destructives.",
    pipelineMode: RESPONSE_MODES.INSTANT,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("system_command"));
});

test("curated memory: rejects generic fallback snippets", () => {
  const result = assessMemoryEligibility({
    userQuery: "explique le pipeline",
    assistantResponse: "Tout est prêt. Sur quoi travaillons-nous ? 😄",
    pipelineMode: RESPONSE_MODES.COMPOSER,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("generic_fallback"));
});

test("pipeline telemetry: tracks last recorded mode", () => {
  recordTurn("DOCUMENT", 120, 400, true);
  assert.equal(getLastPipelineMode(), "DOCUMENT");
  recordTurn("COMPOSER", 800, 900, true);
  assert.equal(getLastPipelineMode(), "COMPOSER");
});

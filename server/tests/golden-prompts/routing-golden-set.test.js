/* global process */
import assert from "node:assert/strict";

import agent from "../../src/agent/agent.js";
import {
  isPureSocial,
  isAnalyticalTechnicalRequest,
  isTechnicalStatusReport,
} from "../../src/agent/utils/conversationGuards.js";
import intentClassifier from "../../src/agent/utils/intentClassifier.js";
import emergencyReplyRegistry from "../../src/agent/harness/emergencyReplyRegistry.js";

function pass(name) {
  console.log(`PASS - ${name}`);
}

async function main() {
  const goldenCases = [
    {
      name: "Expert vs RAG (Direct Answer) - Complex task with social request",
      query: "analyse la conception de notre citadelle qu'est-ce que tu peux faire pour améliorer certaines parties du code ??? peux-tu m'aider ???",
      expectedIntent: "expert_task",
      guards: {
        isAnalyticalTechnicalRequest: true,
        isTechnicalStatusReport: false,
      },
      presetAllowed: false,
      socialAllowed: false,
    },
    {
      name: "Strategic vs Expert - Strategic words but requiring technical analysis",
      query: "plan de 6 améliorations pour faire un audit technique de notre code",
      expectedIntent: "expert_task",
      guards: {
        isAnalyticalTechnicalRequest: true,
        isTechnicalStatusReport: false,
      },
      presetAllowed: false,
      socialAllowed: false,
    },
    {
      name: "Status Report vs Architecture Overview - Mixed status report with architecture words",
      query: "J'ai mis à jour l'orchestrateur. Le bug est corrigé et je grave la directive dans le référentiel.",
      guards: {
        isTechnicalStatusReport: true,
      },
      socialAllowed: false,
      presetAllowed: false,
    },
    {
      name: "Social vs Technical Ambiguous - Greeting mixed with technical object",
      query: "Bonjour, je voudrais parler de la base de données",
      expectedIntent: "expert_task",
      guards: {
        isPureSocial: false,
      },
      socialAllowed: false,
    },
  ];

  for (const tc of goldenCases) {
    // 1. Check guards
    if (tc.guards.isAnalyticalTechnicalRequest !== undefined) {
      assert.equal(
        isAnalyticalTechnicalRequest(tc.query),
        tc.guards.isAnalyticalTechnicalRequest,
        `${tc.name}: isAnalyticalTechnicalRequest should be ${tc.guards.isAnalyticalTechnicalRequest}`
      );
    }
    if (tc.guards.isTechnicalStatusReport !== undefined) {
      assert.equal(
        isTechnicalStatusReport(tc.query),
        tc.guards.isTechnicalStatusReport,
        `${tc.name}: isTechnicalStatusReport should be ${tc.guards.isTechnicalStatusReport}`
      );
    }
    if (tc.guards.isPureSocial !== undefined) {
      assert.equal(
        isPureSocial(tc.query),
        tc.guards.isPureSocial,
        `${tc.name}: isPureSocial should be ${tc.guards.isPureSocial}`
      );
    }

    // 2. Check Intent
    if (tc.expectedIntent) {
      const intentData = intentClassifier.classifyIntent(tc.query);
      assert.equal(
        intentData.intent,
        tc.expectedIntent,
        `${tc.name}: Intent should be ${tc.expectedIntent}`
      );
    }

    // 3. Check presets
    if (tc.presetAllowed === false) {
      const matched_preset = emergencyReplyRegistry.getReply(tc.query);
      assert.equal(
        matched_preset,
        null,
        `${tc.name}: Preset should be null`
      );
    }

    // 4. Check social fast-path
    if (tc.socialAllowed === false) {
      const socialReply = agent.getDeterministicSocialResponse(tc.query);
      assert.equal(
        socialReply,
        undefined,
        `${tc.name}: Social reply should be undefined`
      );
    }

    pass(tc.name);
  }

  console.log("All Golden Set routing cases passed.");
}

main().catch((error) => {
  console.error("Golden Set routing failure:", error.message);
  process.exitCode = 1;
});

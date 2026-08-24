import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  applyArchitectureDepthMetrics,
  resolveArchitectureDepthControl,
  shouldFinalizeArchitectureDesignRail,
} from "../src/agent/utils/intent-guards/architectureDesignIntentGuards.js";
import { RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";

const OS_BRIEF =
  "pourrais tu m'aider : je voudrais créer un système d'exploitation avec interface graphique simple mais windows-friendly, sans réellement avoir la présentation de windows, mais une barre tâches dans laquelle l'icône des fenêtres ouvertes pourra apparaitre, un menu démarrer (style) un navigateur internet une calculatrice, la possibilité d'avoir l'heure peut être une base linux simple mais pas simplement un terminal";

const CODE_REVIEWER_HOW_TO =
  "comment créer un code-reviewer qui analyse tout le code d'un projet, identifie les erreurs et propose plusieurs solutions selon la logique de dev senior";

const OS_FOLLOW_UP_DEPTH =
  "je voudrais créer un système d'exploitation avec interface graphique, compare les trois approches";

const DEPTH_REPLY_RE = /3 approches|Je partirais plutôt|Prochain pas/i;
const CITADELLE_META_RE =
  /La Citadelle|0\s*%\s*de maturit|orchestration complète|phase de d[eé]couverte/i;

function countQuestions(text = "") {
  return (String(text).match(/\?/g) || []).length;
}

describe("PROJECT_BUILD_RESPONSE_DEPTH_CONTROL", () => {
  it("brief OS long → architecture deferred, skip*, pas de matrice", async () => {
    const depth = resolveArchitectureDepthControl(OS_BRIEF);
    assert.equal(depth.analysisMode, "deferred");
    assert.equal(depth.depthTrigger, "default");
    assert.equal(depth.responseMode, "quick");

    const hit = await runConversationShortCircuit(OS_BRIEF);
    assert.equal(hit?.path, "architecture_design_deterministic");
    assert.equal(hit?.analysisMode, "deferred");
    assert.equal(hit?.depthTrigger, "default");
    assert.equal(hit?.responseMode, "quick");
    assert.equal(hit?.skipSovereign, true);
    assert.equal(hit?.skipPlanner, true);
    assert.equal(hit?.skipWeb, true);
    assert.equal(hit?.skipComposer, true);
    assert.equal(hit?.deferToLlm, undefined);
    assert.notEqual(hit?.mode, RESPONSE_MODES.SIMPLE_FAST);
    assert.notEqual(hit?.path, "NORMAL_CONVERSATION");
    assert.doesNotMatch(hit?.reply || "", DEPTH_REPLY_RE);
    assert.match(hit?.reply || "", /syst[eè]me d['']?exploitation|interface graphique/i);
    assert.ok(countQuestions(hit?.reply || "") <= 1);
    assert.equal(shouldFinalizeArchitectureDesignRail(hit), true);
  });

  it("HOW_TO code-reviewer → matrice + P5 conservées", async () => {
    const depth = resolveArchitectureDepthControl(CODE_REVIEWER_HOW_TO);
    assert.equal(depth.analysisMode, "immediate");
    assert.equal(depth.depthTrigger, "how_to");

    const hit = await runConversationShortCircuit(CODE_REVIEWER_HOW_TO);
    assert.equal(hit?.path, "architecture_design_deterministic");
    assert.equal(hit?.analysisMode, "immediate");
    assert.match(hit?.reply || "", /3 approches/i);
    assert.match(hit?.reply || "", /Je partirais plutôt/i);
    assert.match(hit?.reply || "", /Prochain pas/i);
  });

  it("follow-up explicite → profondeur autorisée", async () => {
    const depth = resolveArchitectureDepthControl(OS_FOLLOW_UP_DEPTH);
    assert.equal(depth.analysisMode, "immediate");
    assert.equal(depth.depthTrigger, "explicit_detail");

    const hit = await runConversationShortCircuit(OS_FOLLOW_UP_DEPTH);
    assert.equal(hit?.path, "architecture_design_deterministic");
    assert.equal(hit?.analysisMode, "immediate");
    assert.match(hit?.reply || "", /3 approches/i);
  });

  it("social check-in après brief → pas de dump méta La Citadelle", async () => {
    const history = [
      { role: "user", content: OS_BRIEF },
      {
        role: "assistant",
        content:
          "Je retiens le brief : un systeme d exploitation. Une question pour cadrer : tu veux un prototype rapide, ou d'abord figer le périmètre ?",
      },
    ];
    const hit = await runConversationShortCircuit("comment ça va ?", { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.doesNotMatch(hit?.reply || "", DEPTH_REPLY_RE);
    assert.doesNotMatch(hit?.reply || "", CITADELLE_META_RE);
  });

  it("métriques profondeur — clés posées, génération 0 sur rail local", () => {
    const metrics = {
      routing_ms: null,
      ttft_ms: null,
      generation_ms: null,
      analysis_mode: null,
      depth_trigger: null,
      ttft: null,
    };
    const telemetry = {
      setMetric(name, value) {
        metrics[name] = value;
      },
    };
    applyArchitectureDepthMetrics(
      telemetry,
      { analysisMode: "deferred", depthTrigger: "default" },
      Date.now() - 12,
    );
    assert.equal(typeof metrics.routing_ms, "number");
    assert.equal(typeof metrics.ttft_ms, "number");
    assert.equal(metrics.generation_ms, 0);
    assert.equal(metrics.analysis_mode, "deferred");
    assert.equal(metrics.depth_trigger, "default");
  });
});

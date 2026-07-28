import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isDebugDiagnosticRequest,
  isDebugDiagnosticSignal,
  parseDebugDiagnostic,
  extractDiagnosticComponent,
  extractDiagnosticContext,
} from "../src/agent/utils/debugDiagnosticIntentGuards.js";
import {
  resolveDebugDiagnosticShortCircuit,
  buildDebugDiagnosticDirectFallback,
  enforceDebugDiagnosticDirectness,
  classifyDebugDiagnosticMove,
  isDebugDiagnosticOverRefusal,
} from "../src/agent/micro/replies/debugDiagnosticComposer.js";
import { getDebugDiagnosticSystemPrompt } from "../src/agent/config/modeResponseContracts.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";
import { detectDebugDiagnosticDirectnessViolation } from "../src/agent/telemetry/conversationMoveShadowTelemetry.js";
import { evaluateConversationMove } from "../src/agent/policies/conversationMovePolicy.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { isCodeReviewRequest } from "../src/agent/policies/codeReviewPolicy.js";

describe("debugDiagnostic — lot 8", () => {
  it("pourquoi Redis crash ECONNREFUSED → debug_diagnostic", async () => {
    const q = "pourquoi mon Redis crash avec cette erreur ECONNREFUSED";
    assert.equal(isDebugDiagnosticSignal(q), true);
    assert.equal(isDebugDiagnosticRequest(q), true);
    assert.equal(isTechnicalOverviewRequest(q), false);
    assert.match(extractDiagnosticComponent(q) || "", /redis/i);
    assert.equal(extractDiagnosticContext(q), "network");

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "debug_diagnostic");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.debugDiagnostic, true);
  });

  it("erreur 502 nginx → debug_diagnostic", () => {
    const q = "mon nginx renvoie une erreur 502 depuis ce matin";
    assert.equal(isDebugDiagnosticRequest(q), true);
    const slots = parseDebugDiagnostic(q);
    assert.match(slots?.component || "", /nginx/);
    assert.equal(slots?.severity, "blocking");
  });

  it("explique Redis → technical_overview, pas debug", () => {
    const q = "explique Redis";
    assert.equal(isDebugDiagnosticRequest(q), false);
    assert.equal(isTechnicalOverviewRequest(q), true);
  });

  it("critique de réponse (« échec ») ≠ debug_diagnostic", async () => {
    const q = "ta réponse est un échec car ce n'est pas une réponse correcte";
    assert.equal(isDebugDiagnosticSignal(q), false);
    assert.equal(isDebugDiagnosticRequest(q), false);
    const history = [
      { role: "user", content: "ben on va papoter pour le moment" },
      {
        role: "assistant",
        content: "L'utilisateur veut juste papoter. Je dois répondre brièvement.",
      },
    ];
    const hit = await runConversationShortCircuit(q, { history });
    assert.ok(hit);
    assert.ok(
      hit.path === "meta_feedback_deterministic" ||
        hit.path === "assistant_repair_deterministic",
      `path inattendu: ${hit.path}`,
    );
    assert.doesNotMatch(hit.reply || "", /composant ou service/i);
  });

  it("comment installer Redis → pas debug (procédural pur)", () => {
    const q = "comment installer Redis sur Ubuntu";
    assert.equal(isDebugDiagnosticRequest(q), false);
  });

  it("snippet code + debug → couloir code review, pas debug_diagnostic", () => {
    const q = [
      "debug ce script python, il ne compile pas :",
      "```python",
      "def main():",
      "    print('hello'",
      "if name == 'main':",
      "    main()",
      "```",
    ].join("\n");
    assert.equal(isCodeReviewRequest(q), true);
    assert.equal(isDebugDiagnosticRequest(q), false);
  });

  it("pod Kubernetes CrashLoopBackOff → debug + context deployment", () => {
    const q = "pourquoi mon pod Kubernetes est en CrashLoopBackOff";
    assert.equal(isDebugDiagnosticRequest(q), true);
    assert.equal(extractDiagnosticContext(q), "deployment");
  });

  it("pas de defer orchestrateur implicite", () => {
    const hit = resolveDebugDiagnosticShortCircuit(
      "pourquoi mon API ne fonctionne pas avec une erreur 401",
    );
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(
        hit,
        "pourquoi mon API ne fonctionne pas avec une erreur 401",
      ),
      false,
    );
  });

  it("addon diagnostic interdit le mode aperçu technique", () => {
    const hit = resolveDebugDiagnosticShortCircuit("pourquoi Docker plante au démarrage");
    assert.match(hit?.reflectiveHint || "", /pas aperçu conceptuel/i);
    assert.match(hit?.reflectiveHint || "", /causes probables/i);
  });
});

const NGINX_502_QUERY = "mon nginx renvoie une erreur 502 depuis ce matin";

describe("debugDiagnostic — P2 move + P3 directness (G13)", () => {
  it("classifie nginx 502 comme answer_direct", () => {
    const move = evaluateConversationMove(NGINX_502_QUERY);
    assert.equal(move.family, "debug_diagnostic");
    assert.equal(move.move, "answer_direct");
    assert.equal(move.pipelinePath, "debug_diagnostic");
    assert.equal(move.contractId, "debug_diagnostic_v1");
  });

  it("symptôme vague sans composant → clarify_one", () => {
    const move = evaluateConversationMove("j'ai un bug ça ne marche pas du tout");
    assert.equal(move.family, "debug_diagnostic");
    assert.equal(move.move, "clarify_one");
    assert.equal(move.pipelinePath, "debug_diagnostic_clarify");
  });

  it("mode DEBUG_DIAGNOSTIC sans REFUS PROPRE", () => {
    const prompt = getDebugDiagnosticSystemPrompt();
    assert.match(prompt, /DEBUG_DIAGNOSTIC/);
    assert.doesNotMatch(prompt, /REFUS PROPRE:/);
    assert.match(prompt, /causes probables/i);
  });

  it("fallback structuré nginx 502 — causes + vérifications", () => {
    const out = buildDebugDiagnosticDirectFallback(NGINX_502_QUERY);
    assert.match(out, /Symptôme/i);
    assert.match(out, /502/i);
    assert.match(out, /Causes probables/i);
    assert.match(out, /Vérifications/i);
    assert.equal(isDebugDiagnosticOverRefusal(out), false);
  });

  it("enforce remplace refus technique par diagnostic structuré", () => {
    const fixed = enforceDebugDiagnosticDirectness(INSUFFICIENT_SIGNAL_REFUSAL, NGINX_502_QUERY);
    assert.equal(isDebugDiagnosticOverRefusal(fixed), false);
    assert.match(fixed, /502/i);
    assert.match(fixed, /nginx/i);
  });

  it("resolvePipelineFallback — diagnostic avant recovery générique", () => {
    const out = resolvePipelineFallback({
      query: NGINX_502_QUERY,
      reason: "empty_short_circuit_llm",
    });
    assert.match(out, /Causes probables/i);
    assert.doesNotMatch(out, /objectif en une phrase/i);
  });

  it("shadow détecte violation sur refus insuffisant", () => {
    const hit = detectDebugDiagnosticDirectnessViolation(
      INSUFFICIENT_SIGNAL_REFUSAL,
      "debug_diagnostic",
    );
    assert.equal(hit.applicable, true);
    assert.equal(hit.contract_violation_debug_directness, true);
    assert.ok(hit.signals.includes("insufficient_signal_refusal"));

    const ok = detectDebugDiagnosticDirectnessViolation(
      buildDebugDiagnosticDirectFallback(NGINX_502_QUERY),
      "debug_diagnostic",
    );
    assert.equal(ok.contract_violation_debug_directness, false);
  });

  it("classifyDebugDiagnosticMove — slots nginx", () => {
    const cls = classifyDebugDiagnosticMove(NGINX_502_QUERY);
    assert.ok(cls);
    assert.equal(cls.needsClarify, false);
    assert.match(cls.slots?.component || "", /nginx/i);
  });
});

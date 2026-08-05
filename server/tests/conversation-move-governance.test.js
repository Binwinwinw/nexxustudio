import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONVERSATION_MOVE_CONTRACT,
  CONVERSATION_MOVES,
  MOVE_SATISFIABILITY,
  evaluateConversationMove,
  routeFromConversationMove,
  isExplicitToolOrWebRequest,
  shouldRunClarificationGate,
} from "../src/agent/policies/conversation/conversationMovePolicy.js";
import { isGeneralKnowledgeRequest } from "../src/agent/utils/generalKnowledgeIntentGuards.js";
import { decomposeRequest } from "../src/agent/policies/routing/requestDecompositionPolicy.js";
import {
  computeConversationMoveDivergence,
  buildConversationMoveShadowEvent,
  detectHowToProceduralDirectnessViolation,
  getHowToProceduralShadowStats,
  resetHowToProceduralShadowStats,
  runConversationMoveShadowServed,
  CONVERSATION_MOVE_SHADOW_EVENT,
  CONVERSATION_MOVE_SHADOW_MODE,
} from "../src/agent/telemetry/conversationMoveShadowTelemetry.js";
import { applyConversationMoveAuthority } from "../src/agent/policies/conversation/conversationMoveAuthority.js";
import { enforceHowToProceduralDirectness } from "../src/agent/policies/qualification/howToQualificationPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

const SHAREPOINT_QUERY =
  "je voudrais créer un site avec sharepoint pourras tu m'aider à faire cela";

const smoothieMultiUnitQuery =
  "salut salut comment ca va ??? héy j'ai besoin de l'heure, de la date du jour et savoir si tu sais comment on fait un smoothie???";

describe("conversationMovePolicy — isExplicitToolOrWebRequest", () => {
  it("détecte mandat outil web explicite", () => {
    assert.equal(
      isExplicitToolOrWebRequest(
        "si tu utilises ton outil de navigation web quelle est la date de la prochaine pleine lune ?",
      ),
      true,
    );
  });
});

describe("conversationMovePolicy — lois L1–L4", () => {
  it("L1 — tool explicite prime sur clarify_one (fais quelque chose + outil web)", () => {
    const q =
      "utilise ton outil de navigation web et fais quelque chose pour moi";
    const move = evaluateConversationMove(q);
    assert.equal(move.move, CONVERSATION_MOVES.TOOL);
    assert.equal(move.stopped, true);
    assert.notEqual(move.move, CONVERSATION_MOVES.CLARIFY_ONE);
    assert.equal(shouldRunClarificationGate(move), false);
  });

  it("L2 — multi_unit prime sur how_to standalone", () => {
    const move = evaluateConversationMove(smoothieMultiUnitQuery);
    assert.equal(move.family, "multi_unit");
    assert.equal(move.stopped, true);
    assert.match(move.pipelinePath, /multi_unit/);
    assert.notEqual(move.family, "how_to");
  });

  it("L3 — procédural bénin non capturable par culture générale", () => {
    const q = "comment faire un bon tiramisu";
    assert.equal(isGeneralKnowledgeRequest(q), false);
    const move = evaluateConversationMove(q);
    assert.equal(move.family, "how_to");
    assert.equal(move.move, CONVERSATION_MOVES.ANSWER_DIRECT);
    assert.equal(shouldRunClarificationGate(move), false);
    assert.match(move.topic || "", /tiramisu/i);
  });

  it("L4 — clarify_one uniquement sur ambiguïté bloquante", () => {
    const soupe = evaluateConversationMove("comment faire une bonne soupe ??");
    assert.equal(soupe.move, CONVERSATION_MOVES.ANSWER_DIRECT);
    assert.equal(soupe.clarifyQuestion, null);
    assert.equal(shouldRunClarificationGate(soupe), false);

    const html = evaluateConversationMove("fais une page html");
    assert.equal(html.move, CONVERSATION_MOVES.CLARIFY_ONE);
    assert.ok(html.clarifyQuestion);
    assert.equal(shouldRunClarificationGate(html), true);
  });
});

describe("conversationMovePolicy — G2 et G10", () => {
  it("G2 — comment faire un bon tiramisu", () => {
    const q = "comment faire un bon tiramisu";
    const move = evaluateConversationMove(q);

    assert.equal(move.contract, CONVERSATION_MOVE_CONTRACT);
    assert.equal(move.move, CONVERSATION_MOVES.ANSWER_DIRECT);
    assert.equal(move.family, "how_to");
    assert.equal(move.domain, "culinary");
    assert.equal(move.stopped, true);
    assert.equal(isGeneralKnowledgeRequest(q), false);
    assert.equal(shouldRunClarificationGate(move), false);
    assert.match(move.topic || "", /tiramisu/i);
    assert.match(move.pipelinePath, /how_to_/);
    assert.ok(
      move.satisfiability === MOVE_SATISFIABILITY.DETERMINISTIC ||
        move.satisfiability === MOVE_SATISFIABILITY.PROCEDURAL_LLM,
    );
    assert.ok(move.signals.includes("how_to_procedural"));
  });

  it("G10 — et la recette du tiramisu", () => {
    const q = "et la recette du tiramisu";
    const move = evaluateConversationMove(q);

    assert.equal(move.move, CONVERSATION_MOVES.ANSWER_DIRECT);
    assert.equal(move.family, "how_to");
    assert.equal(move.domain, "culinary");
    assert.equal(move.satisfiability, MOVE_SATISFIABILITY.PROCEDURAL_LLM);
    assert.equal(move.pipelinePath, "how_to_procedural_llm");
    assert.equal(move.contractId, "how_to_procedural_culinary_v1");
    assert.equal(move.stopped, true);
    assert.match(move.topic || "", /tiramisu/i);
    assert.equal(move.clarifyQuestion, null);
    assert.equal(isGeneralKnowledgeRequest(q), false);
    assert.equal(shouldRunClarificationGate(move), false);
  });
});

describe("conversationMovePolicy — routeFromConversationMove STOP", () => {
  it("ne recalcule pas pipelinePath si stopped=true", () => {
    const fixed = {
      contract: CONVERSATION_MOVE_CONTRACT,
      move: CONVERSATION_MOVES.ANSWER_DIRECT,
      family: "how_to",
      qualification: "benign",
      satisfiability: MOVE_SATISFIABILITY.PROCEDURAL_LLM,
      pipelinePath: "how_to_procedural_llm",
      contractId: "how_to_procedural_culinary_v1",
      stopped: true,
    };
    const routed = routeFromConversationMove(fixed);
    assert.equal(routed.pipelinePath, "how_to_procedural_llm");
    assert.equal(routed.contractId, "how_to_procedural_culinary_v1");
  });

  it("G8 — multi_unit via décomposition, pas how_to prématuré", () => {
    const decomposition = decomposeRequest(smoothieMultiUnitQuery);
    const move = evaluateConversationMove(smoothieMultiUnitQuery);
    assert.equal(move.family, "multi_unit");
    assert.equal(move.sources.decomposition?.requestMode, decomposition.requestMode);
    assert.notEqual(move.pipelinePath, "how_to_simple_local");
  });
});

describe("conversationMoveShadowTelemetry — divergences P2", () => {
  it("famille 1 — answer_direct vs legacy clarify", () => {
    const move = {
      move: "answer_direct",
      family: "how_to",
      pipelinePath: "how_to_simple_local",
      stopped: true,
    };
    const div = computeConversationMoveDivergence(move, {
      clarificationGateWouldRun: true,
      legacyPipelinePath: "clarification_gate",
    });
    assert.equal(div.deltaReason, "answer_direct_vs_legacy_clarify");
    assert.ok(div.diverged);
  });

  it("famille 2 — tool vs legacy direct", () => {
    const move = {
      move: "tool",
      family: "factual_lookup",
      pipelinePath: "simple_factual_lookup",
      stopped: true,
    };
    const div = computeConversationMoveDivergence(move, {
      clarificationGateWouldRun: false,
      legacyPipelinePath: "how_to_simple_local",
    });
    assert.equal(div.deltaReason, "tool_vs_legacy_direct");
  });

  it("famille 3 — multi_unit vs legacy how_to", () => {
    const move = {
      move: "answer_direct",
      family: "multi_unit",
      pipelinePath: "multi_unit_deterministic",
      stopped: true,
    };
    const div = computeConversationMoveDivergence(move, {
      clarificationGateWouldRun: false,
      legacyPipelinePath: "how_to_simple_local",
    });
    assert.equal(div.deltaReason, "multi_unit_vs_legacy_how_to");
  });

  it("famille 4 — procedural how_to vs legacy GK", () => {
    const move = {
      move: "answer_direct",
      family: "how_to",
      pipelinePath: "how_to_procedural_llm",
      stopped: true,
    };
    const div = computeConversationMoveDivergence(move, {
      clarificationGateWouldRun: false,
      legacyPipelinePath: "general_knowledge_full_pipeline",
    });
    assert.equal(div.deltaReason, "procedural_how_to_vs_legacy_gk");
  });

  it("G2 shadow — move corrige clarify legacy sans diverger sur path servi", () => {
    const q = "comment faire un bon tiramisu";
    const move = evaluateConversationMove(q);
    const event = buildConversationMoveShadowEvent(q, move, {
      phase: "amont",
      clarificationGateWouldRun: true,
      legacyPipelinePath: "clarification_gate",
      justIntentStrategy: "clarify_then_build",
    });
    assert.equal(event.event, CONVERSATION_MOVE_SHADOW_EVENT);
    assert.equal(event.shadow_mode, CONVERSATION_MOVE_SHADOW_MODE);
    assert.equal(event.move, "answer_direct");
    assert.equal(event.delta_reason, "answer_direct_vs_legacy_clarify");
    assert.equal(event.clarify_gate_mismatch, true);

    const served = buildConversationMoveShadowEvent(q, move, {
      phase: "served",
      clarificationGateWouldRun: true,
      legacyPipelinePath: "how_to_simple_local",
    });
    assert.equal(served.pipeline_path, "how_to_simple_local");
    assert.equal(served.legacy_pipeline_path, "how_to_simple_local");
    assert.equal(served.pipeline_path_mismatch, false);
  });

  it("P3 shadow — détecte pseudo-clarification sur how_to_procedural_llm", () => {
    resetHowToProceduralShadowStats();
    const move = {
      move: "answer_direct",
      family: "how_to",
      domain: "craft",
      pipelinePath: "how_to_procedural_llm",
      stopped: true,
    };
    const hit = detectHowToProceduralDirectnessViolation(
      INSUFFICIENT_SIGNAL_REFUSAL,
      move,
      "how_to_procedural_llm",
    );
    assert.equal(hit.contract_violation_how_to_directness, true);
    assert.ok(hit.signals.includes("insufficient_signal_refusal"));

    const ok = detectHowToProceduralDirectnessViolation(
      "1) Prérequis : carte mère, CPU, RAM.\n2) Monte le CPU sur la carte mère.\n3) Branche l'alimentation.",
      move,
      "how_to_procedural_llm",
    );
    assert.equal(ok.contract_violation_how_to_directness, false);
  });

  it("P3 shadow — détecte smalltalk hors-sujet sur how_to_procedural_llm", () => {
    const move = {
      move: "answer_direct",
      family: "how_to",
      domain: "general",
      pipelinePath: "how_to_procedural_llm",
      stopped: true,
    };
    const q = "comment on fait une soustraction de fractions";
    const drift =
      "Bonjour ! Tout va bien ici. Comment puis-je t'aider aujourd'hui ?";
    const hit = detectHowToProceduralDirectnessViolation(
      drift,
      move,
      "how_to_procedural_llm",
      q,
    );
    assert.equal(hit.contract_violation_how_to_directness, true);
    assert.ok(hit.signals.includes("social_drift"));

    const fixed = enforceHowToProceduralDirectness(drift, q);
    const ok = detectHowToProceduralDirectnessViolation(
      fixed,
      move,
      "how_to_procedural_llm",
      q,
    );
    assert.equal(ok.contract_violation_how_to_directness, false);
  });

  it("P3 shadow — compteur how_to_procedural_llm agrégé", () => {
    resetHowToProceduralShadowStats();
    const move = {
      move: "answer_direct",
      family: "how_to",
      domain: "general",
      pipelinePath: "how_to_procedural_llm",
      stopped: true,
    };
    const ctx = {
      query: "comment on fait un ordinateur",
      conversationMoveShadow: { conversationMove: move, amontEvent: {} },
    };

    runConversationMoveShadowServed(ctx, "how_to_procedural_llm", {
      responseText: INSUFFICIENT_SIGNAL_REFUSAL,
    });
    runConversationMoveShadowServed(ctx, "how_to_procedural_llm", {
      responseText: "1) Prérequis.\n2) Étapes.\n3) Conseils.",
    });

    const stats = getHowToProceduralShadowStats();
    assert.equal(stats.total, 2);
    assert.equal(stats.violations, 1);
    assert.equal(stats.violation_rate, 0.5);
    assert.equal(stats.by_domain.general.total, 2);
    assert.equal(stats.by_domain.general.violations, 1);
    resetHowToProceduralShadowStats();
  });
});

describe("conversationMovePolicy — G11 web_project_scoping (SharePoint)", () => {
  it("clarify_one ciblé SharePoint — pas architecture_design", async () => {
    const move = evaluateConversationMove(SHAREPOINT_QUERY);
    assert.equal(move.contract, CONVERSATION_MOVE_CONTRACT);
    assert.equal(move.move, CONVERSATION_MOVES.CLARIFY_ONE);
    assert.equal(move.family, "web_project_scoping");
    assert.equal(move.pipelinePath, "web_project_scoping_clarify");
    assert.equal(move.stopped, true);
    assert.match(move.clarifyQuestion || "", /SharePoint/i);
    assert.match(move.clarifyQuestion || "", /site d['']équipe|communication|documentaire/i);
    assert.equal(shouldRunClarificationGate(move), true);

    const hit = await runConversationShortCircuit(SHAREPOINT_QUERY);
    assert.equal(hit?.path, "web_project_scoping_clarify");
    assert.notEqual(hit?.path, "architecture_design_deterministic");
    assert.notEqual(hit?.path, "request_interpreter_clarify");
    assert.match(hit?.reply || "", /SharePoint/i);
  });

  it("answer_direct si type de site explicite", async () => {
    const q =
      "je veux créer un site de communication sharepoint pour mon équipe marketing";
    const move = evaluateConversationMove(q);
    assert.equal(move.move, CONVERSATION_MOVES.ANSWER_DIRECT);
    assert.equal(move.family, "web_project_scoping");
    assert.equal(move.pipelinePath, "web_project_scoping_direct");

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "web_project_scoping_direct");
    assert.match(hit?.reply || "", /Objectif|Structure|Première étape/i);
  });
});

describe("conversationMoveAuthority — P2 autorité gate", () => {
  it("supprime clarify legacy quand move=answer_direct how_to", () => {
    const move = evaluateConversationMove("comment faire un bon tiramisu");
    const gate = { shouldClarify: true, message: "Précise ton objectif", pipelinePath: "clarification_gate" };
    const applied = applyConversationMoveAuthority({ conversationMove: move, clarificationGate: gate });
    assert.equal(applied.authorityApplied, true);
    assert.equal(applied.clarificationGate.shouldClarify, false);
    assert.equal(applied.earlyTurn, null);
  });

  it("sert clarifyQuestion du move pour web_project_scoping", () => {
    const move = evaluateConversationMove(SHAREPOINT_QUERY);
    const applied = applyConversationMoveAuthority({
      conversationMove: move,
      clarificationGate: { shouldClarify: false },
    });
    assert.equal(applied.authorityApplied, true);
    assert.ok(applied.earlyTurn?.text);
    assert.equal(applied.earlyTurn.pipelinePath, "web_project_scoping_clarify");
    assert.match(applied.earlyTurn.text, /SharePoint/i);
  });
});

const NGINX_502_QUERY = "mon nginx renvoie une erreur 502 depuis ce matin";

describe("conversationMovePolicy — G13 debug_diagnostic", () => {
  it("answer_direct nginx 502 — pas gate objectif/format", async () => {
    const move = evaluateConversationMove(NGINX_502_QUERY);
    assert.equal(move.family, "debug_diagnostic");
    assert.equal(move.move, CONVERSATION_MOVES.ANSWER_DIRECT);
    assert.equal(move.pipelinePath, "debug_diagnostic");
    assert.equal(move.contractId, "debug_diagnostic_v1");
    assert.equal(move.stopped, true);
    assert.equal(shouldRunClarificationGate(move), false);

    const hit = await runConversationShortCircuit(NGINX_502_QUERY);
    assert.equal(hit?.path, "debug_diagnostic");
    assert.equal(hit?.debugDiagnostic, true);
    assert.equal(hit?.deferToLlm, true);
  });

  it("symptôme vague → clarify_one ciblé incident", () => {
    const move = evaluateConversationMove("j'ai un bug ça ne marche pas du tout");
    assert.equal(move.family, "debug_diagnostic");
    assert.equal(move.move, CONVERSATION_MOVES.CLARIFY_ONE);
    assert.equal(move.pipelinePath, "debug_diagnostic_clarify");
    assert.match(move.clarifyQuestion || "", /composant|symptôme/i);
  });
});

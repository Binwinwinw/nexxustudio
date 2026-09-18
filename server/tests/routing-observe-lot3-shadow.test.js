/**
 * LOT3-SHADOW-ROUTING-COMPATIBILITY — observabilité only.
 * Ne consomme rien. Ne change aucune route.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { buildRoutingObserveEvent } from "../src/agent/telemetry/routingObserveTelemetry.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { runAgentUnderstandingPhase } from "../src/agent/nexxusAgentCycle.js";
import { getIdentityDeterministicReply } from "../src/agent/utils/intent-guards/identityIntentGuards.js";
import {
  GH_SAMPLE,
  RESULT_USABILITY,
  deriveResultUsability,
} from "./fixtures/routing-decision-matrix-v1.js";

const CASES = Object.freeze({
  T2: "est ce que tu es dispo maintenant ?",
  M1: "tu es dispo ?",
  M2: "le serveur est dispo ?",
  M3: "tu peux m'aider ?",
  M4: "Paris est-elle la capitale de la France ?",
  T9: `est-ce que le dépôt est disponible ? ${GH_SAMPLE}`,
  TU_DATETIME: "pourrais-tu trouver quel jour tombe le 14 juillet ?",
  ESTCE_FACTUAL: "est-ce que la Terre tourne autour du Soleil ?",
  M7: "et maintenant ?",
  M7_CONTINUE: "continue",
  M8: "crée un fichier",
  M5: `résume ce dépôt ${GH_SAMPLE}`,
  M6: "résume cette page https://example.com",
  T1: "salut comment cava aujourd'hui?",
});

const REPO_HISTORY_TEXT_ONLY = Object.freeze([
  { role: "user", content: CASES.M5 },
  { role: "assistant", content: "Résumé livré : aperçu du dépôt Hy4-preview." },
]);

const REPO_HISTORY = Object.freeze([
  { role: "user", content: CASES.M5 },
  {
    role: "assistant",
    content: "Résumé livré : aperçu du dépôt Hy4-preview.",
    path: "repo_analysis_llm",
    forcedIntentContractId: "REPO_ANALYSIS",
    interrupted: false,
  },
]);

const CHECKIN_HISTORY = Object.freeze([
  { role: "user", content: CASES.T1 },
  {
    role: "assistant",
    content: "Ça va, merci.",
    path: "social_deterministic",
    socialPatternName: "wellbeing_checkin",
    interrupted: false,
  },
]);

function workResult(path, act, content) {
  return {
    role: "assistant",
    content,
    path,
    forcedIntentContractId: act,
    interrupted: false,
  };
}

const USABILITY_CASES = Object.freeze([
  {
    id: "repo_summary",
    expected: "exploitable",
    assistant: workResult("repo_analysis_llm", "REPO_ANALYSIS", "Résumé du dépôt."),
  },
  {
    id: "file_analysis",
    expected: "exploitable",
    assistant: workResult("existing_source_analysis", "EXISTING_SOURCE_ANALYSIS", "Analyse du fichier."),
  },
  {
    id: "test_result",
    expected: "exploitable",
    assistant: workResult("action_pipeline", "ACTION", "Tests terminés : 12 passés."),
  },
  {
    id: "confirmed_create_or_edit",
    expected: "exploitable",
    assistant: workResult("named_create_or_action", "CREATE", "Fichier créé."),
  },
  {
    id: "identified_task_result",
    expected: "exploitable",
    assistant: workResult(
      "information_seeking_full_pipeline",
      "INFORMATION_SEEKING",
      "Tâche identifiée terminée.",
    ),
  },
  {
    id: "greeting",
    expected: "non_exploitable",
    assistant: {
      role: "assistant",
      content: "Salut !",
      path: "social_deterministic",
      socialPatternName: "greeting",
      interrupted: false,
    },
  },
  {
    id: "availability_reply",
    expected: "non_exploitable",
    assistant: {
      role: "assistant",
      content: "Oui, je suis disponible.",
      path: "social_deterministic",
      socialPatternName: "availability",
      interrupted: false,
    },
  },
  {
    id: "clarify_only",
    expected: "non_exploitable",
    assistant: {
      role: "assistant",
      content: "Tu veux dire quel fichier ?",
      path: "request_interpreter_clarify",
      forcedIntentContractId: "CLARIFY",
      interrupted: false,
    },
  },
  {
    id: "generic_error",
    expected: "non_exploitable",
    assistant: {
      role: "assistant",
      content: "Une erreur est survenue.",
      error: true,
    },
  },
  {
    id: "internal_diagnostic",
    expected: "non_exploitable",
    assistant: {
      role: "assistant",
      content: "dump interne turnLoop",
      kind: "diagnostic",
    },
  },
  {
    id: "interrupted_reply",
    expected: "non_exploitable",
    assistant: {
      role: "assistant",
      content: "Résumé en cours…",
      path: "repo_analysis_llm",
      forcedIntentContractId: "REPO_ANALYSIS",
      interrupted: true,
    },
  },
  {
    id: "no_identifiable_pipeline",
    expected: "non_exploitable",
    assistant: {
      role: "assistant",
      content: "Voici un résultat.",
      path: "unresolved",
      forcedIntentContractId: "REPO_ANALYSIS",
      interrupted: false,
    },
  },
  {
    id: "assistant_nonempty_without_metadata",
    expected: "unknown",
    assistant: {
      role: "assistant",
      content: "Voici le résumé du dépôt, assez long pour ne pas être vide.",
    },
  },
  {
    id: "legacy_turn_without_act",
    expected: "unknown",
    assistant: {
      role: "assistant",
      content: "Ancien tour.",
      path: "repo_analysis_llm",
      interrupted: false,
    },
  },
  {
    id: "task_status_absent",
    expected: "unknown",
    assistant: {
      role: "assistant",
      content: "Travail terminé.",
      path: "action_pipeline",
      interrupted: false,
    },
  },
  {
    id: "pipeline_without_act",
    expected: "unknown",
    assistant: {
      role: "assistant",
      content: "Pipeline connu, acte absent.",
      path: "repo_analysis_llm",
      interrupted: false,
    },
  },
]);

async function observe(query, history) {
  const hist = history === undefined ? [] : history;
  const { turnComprehension, turnLoop, understanding } =
    runAgentUnderstandingPhase(query, hist);
  const justIntent = evaluateJustIntent(query);
  const hit = await runConversationShortCircuit(query, {
    history: hist,
    turnComprehension,
    turnLoop,
    justIntent,
    queryUnderstanding: understanding,
    getDeterministicSocialResponse: (q) => getIdentityDeterministicReply(q),
  });
  const event = buildRoutingObserveEvent(query, {
    hit,
    justIntent,
    requestFrame: understanding.requestFrame,
    history: hist,
    turnLoop,
    turnComprehension,
    queryUnderstanding: understanding,
  });
  return { hit, event };
}

function assertUnconsumed(event) {
  assert.equal(event.shadow_consumed, false);
  assert.equal("social_likelihood" in event, false);
  assert.equal("factual_likelihood" in event, false);
}

describe("LOT3-SHADOW-ROUTING-COMPATIBILITY — shadow only", () => {
  it("T2 reste simple_factual_lookup et est marqué suspect", async () => {
    const { hit, event } = await observe(CASES.T2);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(event.selected_pipeline, "simple_factual_lookup");
    assert.equal(event.route_compatibility_shadow, "suspect");
    assert.equal(
      event.route_compatibility_reason_shadow,
      "costly_factual_vs_assistant_directed",
    );
    assert.equal(event.target_label_shadow, "assistant");
    assert.equal(event.cost_class, "very_high");
    assert.equal(event.defer_to_llm, true);
    assertUnconsumed(event);
  });

  it("M1/M3 se distinguent de T2 sans nouvelle NLU", async () => {
    const m1 = await observe(CASES.M1);
    const m3 = await observe(CASES.M3);
    assert.equal(m1.hit, null);
    assert.equal(m3.hit, null);
    assert.equal(m1.event.selected_pipeline, null);
    assert.equal(m3.event.selected_pipeline, null);
    assert.equal(m1.event.target_label_shadow, "assistant");
    assert.equal(m3.event.target_label_shadow, "assistant");
    assert.equal(m1.event.route_compatibility_shadow, "excluded");
    assert.equal(m3.event.route_compatibility_shadow, "excluded");
    assert.equal(m1.event.route_compatibility_reason_shadow, "not_costly_factual_route");
    assert.equal(m3.event.route_compatibility_reason_shadow, "not_costly_factual_route");
    assertUnconsumed(m1.event);
    assertUnconsumed(m3.event);
  });

  it("M2/T9 ne sont pas assistant-directed", async () => {
    const m2 = await observe(CASES.M2);
    const t9 = await observe(CASES.T9);
    assert.notEqual(m2.event.target_label_shadow, "assistant");
    assert.notEqual(t9.event.target_label_shadow, "assistant");
    assert.equal(t9.event.target_label_shadow, "repository");
    assert.equal(t9.event.locator_shadow, "github_repo_root");
    assert.equal(t9.event.route_compatibility_shadow, "excluded");
    assert.equal(t9.event.route_compatibility_reason_shadow, "external_locator_github");
    assert.equal(m2.event.route_compatibility_shadow, "excluded");
    assert.notEqual(m2.event.route_compatibility_reason_shadow, "costly_factual_vs_assistant_directed");
    assert.notEqual(t9.hit?.path, "social_deterministic");
    assert.notEqual(t9.hit?.forcedIntentContractId, "REPO_ANALYSIS");
    assertUnconsumed(m2.event);
    assertUnconsumed(t9.event);
  });

  it("TU_DATETIME et ESTCE_FACTUAL ne sont pas marqués suspect", async () => {
    const tu = await observe(CASES.TU_DATETIME);
    const estce = await observe(CASES.ESTCE_FACTUAL);
    assert.notEqual(tu.event.route_compatibility_shadow, "suspect");
    assert.notEqual(estce.event.route_compatibility_shadow, "suspect");
    assert.notEqual(tu.event.target_label_shadow, "assistant");
    assert.ok(tu.event.route_compatibility_reason_shadow);
    assert.ok(estce.event.route_compatibility_reason_shadow);
    assertUnconsumed(tu.event);
    assertUnconsumed(estce.event);
  });

  it("M7 isolé : active_context false ou unknown, jamais true", async () => {
    const { hit, event } = await observe(CASES.M7, []);
    assert.equal(hit, null);
    assert.notEqual(event.active_context_shadow, "true");
    assert.ok(["false", "unknown"].includes(event.active_context_shadow));
    const criteria = event.active_context_criteria_shadow;
    for (const key of [
      "last_exploitable_act",
      "unambiguous_target_or_locator",
      "open_task_or_recent_result",
      "compatible_with_continuation",
      "no_newer_incompatible_request",
    ]) {
      assert.ok(["true", "false", "unknown"].includes(criteria[key]), key);
    }
    assertUnconsumed(event);
  });

  it("M7 positif : continue après résumé dépôt → true seulement si 5 critères true", async () => {
    const { event } = await observe(CASES.M7_CONTINUE, REPO_HISTORY);
    const criteria = event.active_context_criteria_shadow;
    const values = Object.values(criteria);
    if (values.every((v) => v === "true")) {
      assert.equal(event.active_context_shadow, "true");
    } else {
      assert.notEqual(event.active_context_shadow, "true");
    }
    assert.equal(criteria.last_exploitable_act, "true");
    assert.equal(criteria.unambiguous_target_or_locator, "true");
    assert.equal(criteria.open_task_or_recent_result, "true");
    assert.equal(criteria.compatible_with_continuation, "true");
    assert.equal(criteria.no_newer_incompatible_request, "true");
    assert.equal(event.active_context_shadow, "true");
    assert.equal(event.context_state_shadow, "ACTIVE_CONTEXT");
    assert.equal(event.result_usability_shadow, "exploitable");
    assertUnconsumed(event);
  });

  it("M7 après assistant non vide sans métadonnées : pas ACTIVE_CONTEXT", async () => {
    const { event } = await observe(CASES.M7_CONTINUE, REPO_HISTORY_TEXT_ONLY);
    assert.equal(event.result_usability_shadow, "unknown");
    assert.equal(event.active_context_criteria_shadow.open_task_or_recent_result, "unknown");
    assert.notEqual(event.active_context_shadow, "true");
    assert.equal(event.context_state_shadow, "CONTEXT_AMBIGUOUS");
    assertUnconsumed(event);
  });

  it("M7 négatif après check-in : pas true", async () => {
    const { event } = await observe(CASES.M7, CHECKIN_HISTORY);
    assert.notEqual(event.active_context_shadow, "true");
    assert.ok(["false", "unknown"].includes(event.active_context_shadow));
    assert.equal(event.active_context_criteria_shadow.last_exploitable_act, "false");
    assert.equal(event.result_usability_shadow, "non_exploitable");
    assert.equal(event.active_context_criteria_shadow.open_task_or_recent_result, "false");
    assertUnconsumed(event);
  });

  it("M7 négatif après résumé dépôt puis serveur : pas true", async () => {
    const { event } = await observe(CASES.M2, REPO_HISTORY);
    assert.notEqual(event.active_context_shadow, "true");
    assert.ok(["false", "unknown"].includes(event.active_context_shadow));
    assert.equal(
      event.active_context_criteria_shadow.compatible_with_continuation,
      "false",
    );
    assertUnconsumed(event);
  });

  it("M5/M6 conservent leurs routes ; M8 n'est pas suspect T2", async () => {
    const m5 = await observe(CASES.M5);
    const m6 = await observe(CASES.M6);
    const m8 = await observe(CASES.M8);
    assert.equal(m5.hit?.path, "repo_analysis_llm");
    assert.equal(m5.event.selected_pipeline, "repo_analysis_llm");
    assert.equal(m5.event.target_label_shadow, "repository");
    assert.equal(m6.hit?.path, "document_synthesis_llm");
    assert.equal(m6.event.target_label_shadow, "page");
    assert.notEqual(m8.event.route_compatibility_shadow, "suspect");
    assert.equal(m8.event.route_compatibility_reason_shadow, "workspace_action");
    assert.equal(m5.event.route_compatibility_shadow, "excluded");
    assert.equal(m5.event.route_compatibility_reason_shadow, "summary_or_analysis");
    assertUnconsumed(m5.event);
    assertUnconsumed(m6.event);
    assertUnconsumed(m8.event);
  });

  it("capture Lot 3 : champs shadow présents, aucun consume", async () => {
    const { event } = await observe(CASES.T2);
    for (const key of [
      "task_kind",
      "just_intent",
      "primary",
      "just_relation",
      "clarify",
      "domain_target",
      "assistant_signals_shadow",
      "external_object_signals_shadow",
      "locator_shadow",
      "selected_pipeline",
      "first_winning_guard",
      "candidate_route_shadow",
      "target_label_shadow",
      "route_compatibility_shadow",
      "route_compatibility_reason_shadow",
      "active_context_criteria_shadow",
      "active_context_shadow",
      "context_state_shadow",
      "result_usability_criteria_shadow",
      "result_usability_shadow",
      "cost_class",
      "cost_observed_ms",
      "shadow_consumed",
    ]) {
      assert.ok(key in event, key);
    }
    assert.equal(event.shadow_consumed, false);
    assert.ok(Array.isArray(event.assistant_signals_shadow));
    assert.ok(Array.isArray(event.external_object_signals_shadow));
  });

  it("RESULT_USABILITY shadow : observations obligatoires, routes inchangées", async () => {
    for (const row of USABILITY_CASES) {
      const event = buildRoutingObserveEvent("continue", {
        hit: null,
        history: [{ role: "user", content: "précédent" }, row.assistant],
      });
      assert.equal(event.result_usability_shadow, row.expected, row.id);
      assert.equal(
        deriveResultUsability(event.result_usability_criteria_shadow),
        row.expected,
        `${row.id} spec conjunction`,
      );
      assert.equal(event.shadow_consumed, false, row.id);
      const criteria = event.result_usability_criteria_shadow;
      for (const key of RESULT_USABILITY.criterionKeys) {
        assert.ok(["true", "false", "unknown"].includes(criteria[key]), `${row.id}.${key}`);
      }
      if (row.expected === "exploitable") {
        for (const key of RESULT_USABILITY.criterionKeys) {
          assert.equal(criteria[key], "true", `${row.id}.${key}`);
        }
        assert.equal(event.active_context_criteria_shadow.open_task_or_recent_result, "true", row.id);
      }
      if (row.expected === "non_exploitable") {
        assert.ok(Object.values(criteria).includes("false"), row.id);
        assert.equal(event.active_context_criteria_shadow.open_task_or_recent_result, "false", row.id);
      }
      if (row.expected === "unknown") {
        assert.equal(Object.values(criteria).includes("false"), false, row.id);
        assert.ok(Object.values(criteria).includes("unknown"), row.id);
        assert.equal(event.active_context_criteria_shadow.open_task_or_recent_result, "unknown", row.id);
        assert.notEqual(event.context_state_shadow, "ACTIVE_CONTEXT", row.id);
      }
    }

    const t1 = await observe(CASES.T1);
    const t2 = await observe(CASES.T2);
    const m1 = await observe(CASES.M1);
    assert.equal(t1.hit?.path, "social_deterministic");
    assert.equal(t2.hit?.path, "simple_factual_lookup");
    assert.equal(m1.hit, null);
  });
});

/**
 * Récolte shadow Phase B — traces représentatives sans HTTP.
 * Usage: node scripts/connector-shadow-harvest.js
 */
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  observeConnectorPlanShadow,
  EXPERT_TASK_TYPES,
  REQUESTED_CAPABILITIES,
} from "../src/agent/policies/connectors/index.js";
import { resolveIntentFamilyFromRegistry } from "../src/agent/policies/intent/intentFamilyRegistry.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";

const SCENARIOS = [
  {
    label: "technical_learning_path — JSX",
    query:
      "je veux créer des fiches de connaissances afin maitriser le jsx et ses regles",
  },
  {
    label: "technical_learning_path — JVM+JS",
    query:
      "je veux créer des fiches de connaissances afin maitriser la jvm pour javascript",
  },
  {
    label: "admin_procedure — impôts",
    query: "comment déclarer mes impôts en ligne",
  },
  {
    label: "compare_choose — Redis",
    query: "Redis vs Memcached que choisir pour un cache session",
  },
  {
    label: "attachment + expert_task — sans web",
    query: "analyse ce fichier et corrige le bug",
    hasAttachments: true,
    wantsAnalysis: true,
    intentTriage: { top_intent: "code_generation" },
  },
];

async function harvestScenario(scenario) {
  const shortCircuit = await runConversationShortCircuit(scenario.query, {
    getDeterministicSocialResponse: () => null,
    history: [],
  });
  const family = resolveIntentFamilyFromRegistry(scenario.query);
  const deferFull = shortCircuit
    ? shouldDeferShortCircuitToFullPipeline(shortCircuit, scenario.query)
    : false;

  let effectiveForcedExpertKey = null;
  if (
    deferFull &&
    (shortCircuit?.preferWebResearch ||
      family?.preferWebResearch)
  ) {
    effectiveForcedExpertKey = "expert_web_search";
  }

  const hooks = ["short_circuit_eval"];
  if (deferFull) hooks.push("defer_full_pipeline");

  const traces = [];

  for (const hook of hooks) {
    const { plan, legacyForcedExpertKey, observation } =
      observeConnectorPlanShadow({
        hook,
        query: scenario.query,
        shortCircuit,
        turnTelemetry: { recordEvent: () => {} },
        effectiveForcedExpertKey,
        hasAttachments: Boolean(scenario.hasAttachments),
        intentTriage: scenario.intentTriage ?? { top_intent: "general" },
        wantsAnalysis: Boolean(scenario.wantsAnalysis),
        deferToFullPipelineActive: deferFull,
        orchestratorGate: hook === "orchestrator_gate",
        expertTaskType: scenario.hasAttachments
          ? EXPERT_TASK_TYPES.EXPERT_TASK
          : undefined,
        requestedCapability: scenario.hasAttachments
          ? REQUESTED_CAPABILITIES.CODE_ANALYSIS
          : undefined,
      });

    traces.push({
      hook,
      primary: plan.primary.id,
      chain: plan.chain.map((c) => c.id),
      reason_code: plan.reason.code,
      legacy_key: legacyForcedExpertKey,
      effective_key: effectiveForcedExpertKey,
      match: observation.matchesLegacy,
    });
  }

  const orch = observeConnectorPlanShadow({
    hook: "orchestrator_gate",
    query: scenario.query,
    shortCircuit,
    turnTelemetry: { recordEvent: () => {} },
    effectiveForcedExpertKey,
    hasAttachments: Boolean(scenario.hasAttachments),
    intentTriage: scenario.intentTriage ?? { top_intent: "general" },
    wantsAnalysis: Boolean(scenario.wantsAnalysis),
    deferToFullPipelineActive: deferFull,
    orchestratorGate: true,
    expertTaskType: scenario.hasAttachments
      ? EXPERT_TASK_TYPES.EXPERT_TASK
      : undefined,
    requestedCapability: scenario.hasAttachments
      ? REQUESTED_CAPABILITIES.CODE_ANALYSIS
      : undefined,
  });

  traces.push({
    hook: "orchestrator_gate",
    primary: orch.plan.primary.id,
    chain: orch.plan.chain.map((c) => c.id),
    reason_code: orch.plan.reason.code,
    legacy_key: orch.legacyForcedExpertKey,
    effective_key: effectiveForcedExpertKey,
    match: orch.observation.matchesLegacy,
  });

  return {
    label: scenario.label,
    query: scenario.query.slice(0, 72),
    family: family?.id ?? null,
    short_circuit: shortCircuit?.path ?? null,
    defer_full: deferFull,
    traces,
  };
}

const results = [];
for (const scenario of SCENARIOS) {
  results.push(await harvestScenario(scenario));
}

console.log(JSON.stringify(results, null, 2));

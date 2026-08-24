import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectExistenceScopeGuard,
  EXISTENCE_SCOPE_GUARD,
  EXISTENCE_PLAN_SECTION,
  preserveExistenceInEffectiveQuery,
  resolveExistenceScopedSubject,
  buildExistenceScopedWebQuery,
  applyExistenceToResponsePlan,
  evaluateInputCompleteness,
} from "../src/agent/policies/conversation/existenceScopeGuardPolicy.js";
import {
  resolveEffectiveQuery,
  INTERPRETER_ACTIONS,
} from "../src/agent/micro/interpreter/requestInterpreter.js";
import { resolveIntentComposition } from "../src/agent/policies/intent/intentCompositionPolicy.js";
import { buildRequestWorkup, understandQuery } from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import { buildInformationSeekingWebQuery } from "../src/agent/utils/intent-guards/informationSeekingIntentGuards.js";
import { buildKnowledgeFreshnessSystemAddon } from "../src/agent/micro/replies/knowledgeFreshnessComposerContract.js";
const MEDIA_RANGE_Q =
  "hé bien à toi de développer tout ce que tu peux savoir car j'achetais des dvd de cette marque là donc je voudrais savoir si ça existe toujours";

const MEDIA_RANGE_HISTORY = [
  { role: "user", content: "salut" },
  { role: "assistant", content: "Salut. Je t'écoute." },
  { role: "user", content: "est-ce que tu connais la marque MediaRange" },
  {
    role: "assistant",
    content: "Quelle partie de MediaRange t'intéresse ?",
  },
];

const DROPPED_WEB =
  "developper tout ce que tu peux savoir car j achetais des dvd de cette marque la overview informations";

function buildMediaRangeArtifacts(query = MEDIA_RANGE_Q, history = MEDIA_RANGE_HISTORY) {
  const effectiveQuery = preserveExistenceInEffectiveQuery(query, query, { history });
  const composition = resolveIntentComposition(effectiveQuery, { history });
  const understanding = understandQuery(effectiveQuery, history);
  const workup = buildRequestWorkup(effectiveQuery, understanding, { history });
  const webQuery = buildInformationSeekingWebQuery(effectiveQuery, { history });
  return { effectiveQuery, composition, workup, webQuery };
}

describe("Complétude d’input — clause d’existence", () => {
  it("MediaRange : sujet + borne survivent (effectiveQuery, scope_guard, plan, web)", () => {
    const { effectiveQuery, composition, workup, webQuery } =
      buildMediaRangeArtifacts();

    assert.ok(detectExistenceScopeGuard(MEDIA_RANGE_Q));
    assert.ok(detectExistenceScopeGuard(effectiveQuery));
    assert.match(effectiveQuery, /mediarange/i);
    assert.match(effectiveQuery, /existe toujours/i);

    assert.deepEqual(composition.execution_constraints?.scope_guards, [
      EXISTENCE_SCOPE_GUARD,
    ]);

    assert.equal(
      workup.response_commitment?.sections?.[0],
      EXISTENCE_PLAN_SECTION,
    );

    assert.match(String(webQuery), /mediarange/i);
    assert.match(String(webQuery), /existe toujours/i);
    assert.ok(!/overview informations/i.test(String(webQuery)));

    const completeness = evaluateInputCompleteness({
      rawQuery: MEDIA_RANGE_Q,
      effectiveQuery,
      composition,
      responsePlan: workup.response_commitment,
      webQuery,
      history: MEDIA_RANGE_HISTORY,
    });
    assert.equal(completeness.applicable, true);
    assert.equal(completeness.compression_invalid, false);
    assert.deepEqual(completeness.failures, []);
  });

  it("clause supprimée = compression invalide", () => {
    const completeness = evaluateInputCompleteness({
      rawQuery: MEDIA_RANGE_Q,
      effectiveQuery: DROPPED_WEB,
      composition: { execution_constraints: {} },
      responsePlan: { sections: ["direct_answer"] },
      webQuery: DROPPED_WEB,
      history: MEDIA_RANGE_HISTORY,
    });
    assert.equal(completeness.applicable, true);
    assert.equal(completeness.compression_invalid, true);
    assert.ok(
      completeness.failures.includes("effective_query_dropped_existence_clause"),
    );
    assert.ok(completeness.failures.includes("scope_guard_missing"));
    assert.ok(completeness.failures.includes("response_plan_existence_not_first"));
    assert.ok(completeness.failures.includes("web_query_dropped_existence_bound"));
    assert.ok(completeness.failures.includes("web_query_dropped_resolved_subject"));
  });

  it("resolveEffectiveQuery refuse un canonical qui a perdu la clause", () => {
    const kept = resolveEffectiveQuery(MEDIA_RANGE_Q, {
      nextAction: INTERPRETER_ACTIONS.RESPOND,
      canonicalQuery: DROPPED_WEB,
    }, { history: MEDIA_RANGE_HISTORY });
    assert.ok(detectExistenceScopeGuard(kept));
    assert.match(kept, /mediarange/i);
  });

  it("sujet résolu depuis le fil, pas un 2e parse entities", () => {
    const subject = resolveExistenceScopedSubject(MEDIA_RANGE_Q, MEDIA_RANGE_HISTORY);
    assert.match(String(subject), /mediarange/i);
    const web = buildExistenceScopedWebQuery(MEDIA_RANGE_Q, {
      history: MEDIA_RANGE_HISTORY,
    });
    assert.equal(web, `${subject} existe toujours`);
  });

  it("plan + addon composer : existence actuelle avant développement secondaire", () => {
    const plan = applyExistenceToResponsePlan(
      { kind: "general_explain", sections: ["direct_answer"] },
      MEDIA_RANGE_Q,
    );
    assert.deepEqual(plan.sections, [EXISTENCE_PLAN_SECTION, "direct_answer"]);

    const addon = buildKnowledgeFreshnessSystemAddon(MEDIA_RANGE_Q, {});
    const existenceIdx = addon.indexOf("existence actuelle");
    const secondaryIdx = addon.indexOf("développement secondaire");
    assert.ok(existenceIdx >= 0, "addon existence manquant");
    assert.ok(secondaryIdx > existenceIdx, "existence doit précéder le secondaire");
  });
});

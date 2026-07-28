import test from "node:test";
import assert from "node:assert/strict";

import {
  isExplicitWebToolInvocationRequest,
  isExternalCalendarLookupRequest,
  isLocalDatetimeRequest,
  shouldBypassLocalDatetimeShortCircuit,
  buildExternalCalendarWebQuery,
} from "../src/agent/utils/externalCalendarLookupIntentGuards.js";
import { resolveExternalCalendarLookupShortCircuit } from "../src/agent/policies/externalCalendarLookupPolicy.js";
import { resolveSimpleDeterministicFromFrame } from "../src/agent/policies/conversationIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldUseSemanticResolution } from "../src/agent/micro/classifiers/semanticIntentResolver.js";

const FULL_MOON_Q = "à quelle date sera la prochaine pleine lune";
const FULL_MOON_SEARCH_Q = "cherche la date de la prochaine pleine lune";
const FULL_MOON_WEB_TOOL_Q =
  "si tu utilises ton outil de navigation web tu pourras trouver la date de la prochaine pleine lune";
const LOCAL_DATE_Q = "quelle est la date du jour";

test("guards — pleine lune = lookup externe, pas datetime local", () => {
  assert.equal(isExternalCalendarLookupRequest(FULL_MOON_Q), true);
  assert.equal(shouldBypassLocalDatetimeShortCircuit(FULL_MOON_Q), true);
  assert.equal(isLocalDatetimeRequest(FULL_MOON_Q), false);
});

test("guards — demande explicite outil web", () => {
  assert.equal(isExplicitWebToolInvocationRequest(FULL_MOON_WEB_TOOL_Q), true);
  assert.equal(shouldBypassLocalDatetimeShortCircuit(FULL_MOON_WEB_TOOL_Q), true);
});

test("frame — ne classe plus pleine lune en asksDate", () => {
  const frame = resolveSimpleDeterministicFromFrame(FULL_MOON_Q);
  assert.equal(frame, null);
});

test("frame — date du jour reste datetime local", () => {
  const frame = resolveSimpleDeterministicFromFrame(LOCAL_DATE_Q);
  assert.ok(frame?.asksDate);
});

test("short-circuit — pleine lune → web prioritaire", async () => {
  for (const query of [FULL_MOON_Q, FULL_MOON_SEARCH_Q, FULL_MOON_WEB_TOOL_Q]) {
    const hit = await runConversationShortCircuit(query);
    assert.equal(hit?.path, "simple_factual_lookup", `query: ${query}`);
    assert.equal(hit?.preferWebResearch, true);
    assert.equal(hit?.externalCalendarLookup, true);
    assert.ok(hit?.externalCalendarWebQuery);
    assert.notEqual(hit?.path, "datetime_deterministic");
  }
});

test("short-circuit — date du jour reste datetime", async () => {
  const hit = await runConversationShortCircuit("nous sommes quel jour");
  assert.equal(hit?.path, "datetime_deterministic");
});

test("semantic resolver — time_lookup bloqué sur pleine lune", () => {
  assert.equal(
    shouldUseSemanticResolution(
      { intent: "time_lookup", confidence: 0.9, recommendedPipeline: "deterministic_reply" },
      { mode: "assist", query: FULL_MOON_Q },
    ),
    false,
  );
});

test("buildExternalCalendarWebQuery — requête lunaire", () => {
  assert.match(buildExternalCalendarWebQuery(FULL_MOON_Q), /pleine lune/i);
});

test("policy — resolveExternalCalendarLookupShortCircuit", () => {
  const hit = resolveExternalCalendarLookupShortCircuit(FULL_MOON_Q);
  assert.equal(hit?.path, "simple_factual_lookup");
  assert.equal(hit?.factType, "external_calendar");
});

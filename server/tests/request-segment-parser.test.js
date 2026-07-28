import test from "node:test";
import assert from "node:assert/strict";

import { parseRequestSegments } from "../src/agent/micro/parsing/requestSegmentParser.js";
import { resolveQueryGoals } from "../src/agent/micro/parsing/goalRoleResolver.js";
import {
  resolveMultiSegmentPlan,
  buildMultiSegmentSystemHint,
} from "../src/agent/micro/parsing/multiSegmentResponsePlan.js";

const GPU_QUERY =
  "pourrais tu trouver quelle date nous sommes afin de trouver quelle carte graphique 8Go serait un bon achat à faire ??";

test("parseRequestSegments — afin de scinde support et but", () => {
  const parsed = parseRequestSegments(GPU_QUERY);
  assert.ok(parsed.linker);
  assert.equal(parsed.segments.length, 2);
  assert.equal(parsed.segments[0].role, "support_context");
  assert.equal(parsed.segments[0].type, "time_lookup");
  assert.equal(parsed.segments[1].role, "primary_goal");
  assert.equal(parsed.segments[1].type, "purchase_advice");
});

test("resolveQueryGoals — multi-intent GPU", () => {
  const goals = resolveQueryGoals(GPU_QUERY);
  assert.equal(goals.primaryGoal, "purchase_advice");
  assert.ok(goals.supportingContext.includes("time_lookup"));
  assert.equal(goals.isMultiIntent, true);
});

test("resolveMultiSegmentPlan — ne doit pas être signalOnly", () => {
  const plan = resolveMultiSegmentPlan(GPU_QUERY);
  assert.equal(plan.signalOnly, false);
  assert.equal(plan.shouldDeferToPipeline, true);
  assert.ok(plan.preamble?.includes("Nous sommes le"));
  assert.ok(plan.followUpOpening?.includes("carte graphique"));
});

test("resolveMultiSegmentPlan — date seule reste signalOnly", () => {
  const plan = resolveMultiSegmentPlan("quelle date sommes-nous aujourd'hui ?");
  assert.equal(plan.signalOnly, true);
  assert.equal(plan.shouldDeferToPipeline, false);
  assert.ok(plan.preamble);
});

test("buildMultiSegmentSystemHint — contient préambule et règle", () => {
  const plan = resolveMultiSegmentPlan(GPU_QUERY);
  const hint = buildMultiSegmentSystemHint(plan);
  assert.match(hint, /MULTI-SEGMENTS/);
  assert.match(hint, /Nous sommes le/);
  assert.match(hint, /carte graphique/i);
});

test("parseRequestSegments — pour pouvoir", () => {
  const parsed = parseRequestSegments(
    "quelle heure est-il pour pouvoir caler ma reunion",
  );
  assert.ok(parsed.linker);
  assert.equal(parsed.segments[1].role, "primary_goal");
});

test("resolveMultiSegmentPlan — question Windows produit n'est pas multi-segments", () => {
  const queries = [
    "pourrait on retrouver un ordinateur windows 11 avec son ID-produit ou sa clé produit ?",
    "pourrait on retrouver un ordinateur windows 11 avec son ID-produit ou sa clé produit en le localisant ?",
  ];

  for (const query of queries) {
    const plan = resolveMultiSegmentPlan(query);
    assert.equal(plan.isMultiIntent, false, query);
    assert.equal(plan.shouldDeferToPipeline, false, query);
    assert.deepEqual(plan.sufficiency.reasons, [], query);
  }
});

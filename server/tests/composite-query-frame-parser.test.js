import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractLocalitySlot,
  frameSuppressesTimeLookup,
  isStandaloneTimeLookup,
  parseCompositeQueryFrame,
  resolveWeatherTemporalPrecedence,
  WEATHER_INTENTS,
} from "../src/agent/micro/parsing/compositeQueryFrameParser.js";
import { parseRequestSegments } from "../src/agent/micro/parsing/requestSegmentParser.js";
import { resolveQueryGoals } from "../src/agent/micro/parsing/goalRoleResolver.js";
import { resolveMultiSegmentPlan } from "../src/agent/micro/parsing/multiSegmentResponsePlan.js";
import {
  isWeatherCurrentRequest,
  parseWeatherCurrentTask,
} from "../src/agent/policies/web/weatherCurrentRequestPolicy.js";

describe("resolveWeatherTemporalPrecedence — contrat", () => {
  it("R1 — weather + temporal_modifier => weather wins, time_lookup suppressed", () => {
    const d = resolveWeatherTemporalPrecedence({
      weatherIntent: WEATHER_INTENTS.CURRENT,
      hasTemporalModifier: true,
      hasStandaloneTimeLookup: true,
    });
    assert.equal(d.winner, WEATHER_INTENTS.CURRENT);
    assert.deepEqual(d.suppressed, ["time_lookup"]);
    assert.match(d.reason, /weather/);
  });

  it("R2 — time_lookup ne gagne que sans weather", () => {
    const alone = resolveWeatherTemporalPrecedence({
      weatherIntent: null,
      hasTemporalModifier: false,
      hasStandaloneTimeLookup: true,
    });
    assert.equal(alone.winner, "time_lookup");
    assert.deepEqual(alone.suppressed, []);

    const blocked = resolveWeatherTemporalPrecedence({
      weatherIntent: WEATHER_INTENTS.CURRENT,
      hasTemporalModifier: false,
      hasStandaloneTimeLookup: true,
    });
    assert.equal(blocked.winner, WEATHER_INTENTS.CURRENT);
    assert.ok(blocked.suppressed.includes("time_lookup"));
  });
});

describe("parseCompositeQueryFrame — multi-compositions", () => {
  it("météo + maintenant + localité", () => {
    const q = "quel temps fait-il en Martinique à l'heure actuelle ?";
    const frame = parseCompositeQueryFrame(q);
    assert.equal(frame.primaryIntent, WEATHER_INTENTS.CURRENT);
    assert.equal(frame.slots.locality?.normalized, "martinique");
    assert.equal(frame.slots.locality?.source, "explicit");
    assert.ok(frame.slots.locality?.confidence >= 0.6);
    assert.ok(
      frame.secondarySignals.some((s) => s.type === "temporal_modifier"),
    );
    assert.equal(frame.routing.winner, WEATHER_INTENTS.CURRENT);
    assert.ok(frameSuppressesTimeLookup(frame));
    assert.equal(isStandaloneTimeLookup(q), false);
  });

  it("température + localité", () => {
    const q = "quelle est la température à Paris ?";
    const frame = parseCompositeQueryFrame(q);
    assert.equal(frame.primaryIntent, WEATHER_INTENTS.CURRENT);
    assert.equal(frame.slots.metric, "température");
    assert.equal(frame.slots.locality?.normalized, "paris");
    assert.equal(frame.secondarySignals.length, 0);
  });

  it("jour/nuit + localité", () => {
    const q = "est-ce qu'il fait jour ou nuit à Tokyo ?";
    const frame = parseCompositeQueryFrame(q);
    assert.equal(frame.primaryIntent, WEATHER_INTENTS.CURRENT);
    assert.equal(frame.slots.metric, "jour/nuit");
    assert.equal(frame.slots.locality?.normalized, "tokyo");
  });

  it("pluie + maintenant + localité", () => {
    const q = "y a-t-il de la pluie à New York maintenant ?";
    const frame = parseCompositeQueryFrame(q);
    assert.equal(frame.primaryIntent, WEATHER_INTENTS.CURRENT);
    assert.equal(frame.slots.metric, "pluie");
    assert.equal(frame.slots.locality?.normalized, "new york");
    assert.ok(
      frame.secondarySignals.some((s) => s.type === "temporal_modifier"),
    );
    assert.ok(frameSuppressesTimeLookup(frame));
  });

  it("vraie question d'heure seule", () => {
    const q = "quelle heure est-il ?";
    const frame = parseCompositeQueryFrame(q);
    assert.equal(frame.primaryIntent, "time_lookup");
    assert.equal(frame.slots.locality, null);
    assert.equal(frame.routing.winner, "time_lookup");
    assert.equal(frameSuppressesTimeLookup(frame), false);
    assert.equal(isStandaloneTimeLookup(q), true);
  });

  it("vocabulaire forecast détecté mais non actif (lot 1)", () => {
    const q = "quelles sont les prévisions pour demain à Lyon ?";
    const frame = parseCompositeQueryFrame(q);
    assert.equal(frame.primaryIntent, WEATHER_INTENTS.FORECAST);
    assert.equal(frame.routing.preferWebResearch, false);
    assert.equal(isWeatherCurrentRequest(q), false);
  });
});

describe("locality slot typé — multi-localités", () => {
  const cases = [
    ["quel temps fait-il en Martinique à l'heure actuelle ?", "martinique"],
    ["quelle est la température à Paris ?", "paris"],
    ["tu as la météo à Fort-de-France ?", "fort-de-france"],
    ["est-ce qu'il fait jour à Tokyo ?", "tokyo"],
    ["y a-t-il de la pluie à New York maintenant ?", "new york"],
  ];

  for (const [query, expected] of cases) {
    it(`locality.normalized = ${expected}`, () => {
      const slot = extractLocalitySlot(query);
      assert.ok(slot, query);
      assert.equal(slot.normalized, expected);
      assert.equal(typeof slot.text, "string");
      assert.equal(slot.source, "explicit");
      assert.ok(slot.confidence > 0 && slot.confidence <= 1);
      assert.doesNotMatch(slot.normalized, /heure|maintenant/i);

      const task = parseWeatherCurrentTask(query);
      assert.equal(task?.location, expected);
      assert.equal(task?.locality?.normalized, expected);
    });
  }
});

describe("precedence — parseur segments + plan de réponse", () => {
  const weatherNow =
    "quel temps fait-il en Martinique à l'heure actuelle ?";

  it("parseRequestSegments — weather_current primary, pas time_lookup", () => {
    const parsed = parseRequestSegments(weatherNow);
    const primary = parsed.segments.find((s) => s.role === "primary_goal");
    assert.equal(primary?.type, "weather_current");
    assert.equal(
      parsed.segments.some((s) => s.type === "time_lookup"),
      false,
    );
    assert.ok(parsed.precedence?.suppressed?.includes("time_lookup"));
  });

  it("resolveQueryGoals — weather wins", () => {
    const goals = resolveQueryGoals(weatherNow);
    assert.equal(goals.primaryGoal, "weather_current");
    assert.equal(goals.supportingContext.includes("time_lookup"), false);
  });

  it("resolveMultiSegmentPlan — pas de préambule horloge", () => {
    const plan = resolveMultiSegmentPlan(weatherNow);
    assert.equal(plan.primaryGoal, "weather_current");
    assert.equal(plan.signalOnly, false);
    assert.equal(plan.preamble, null);
    assert.ok(plan.precedence?.suppressed?.includes("time_lookup"));
  });

  it("heure seule — plan signalOnly time_lookup", () => {
    const plan = resolveMultiSegmentPlan("quelle heure est-il ?");
    assert.equal(plan.primaryGoal, "time_lookup");
    assert.equal(plan.signalOnly, true);
    assert.ok(plan.preamble);
    assert.match(plan.preamble, /Il est/i);
  });
});

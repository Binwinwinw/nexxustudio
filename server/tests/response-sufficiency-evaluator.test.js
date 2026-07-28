import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTO_REPLY_SUFFICIENCY_RULE,
} from "../src/agent/micro/parsing/autoReplySufficiencyRule.js";
import {
  buildParseState,
  evaluateAutoReplySufficiency,
  SUFFICIENCY_TIER,
} from "../src/agent/micro/parsing/responseSufficiencyEvaluator.js";
import { applyShortCircuitSufficiencyGate } from "../src/agent/micro/parsing/shortCircuitSufficiencyGate.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

test("règle canon — identifiant stable", () => {
  const ev = evaluateAutoReplySufficiency({ query: "bonjour" });
  assert.equal(ev.rule, AUTO_REPLY_SUFFICIENCY_RULE);
  assert.equal(ev.formula, "auto-réponse seulement si suffisance totale");
});

test("suffisance — heure seule OK", () => {
  const q = "quelle heure est-il ?";
  const ev = evaluateAutoReplySufficiency({
    query: q,
    detectedSignal: "time_lookup",
    parseState: buildParseState(q),
  });
  assert.equal(ev.sufficient, true);
  assert.equal(ev.tier, SUFFICIENCY_TIER.INSTANT_OK);
});

test("suffisance — heure + pour savoir insuffisant", () => {
  const q =
    "quelle heure est-il pour savoir si je peux encore appeler ce service ?";
  const ev = evaluateAutoReplySufficiency({
    query: q,
    detectedSignal: "time_lookup",
    parseState: buildParseState(q),
  });
  assert.equal(ev.sufficient, false);
  assert.ok(ev.reasons.length > 0);
});

test("suffisance — GPU + date insuffisant", () => {
  const q =
    "pourrais tu trouver quelle date nous sommes afin de trouver quelle carte graphique 8Go serait un bon achat";
  const ev = evaluateAutoReplySufficiency({
    query: q,
    detectedSignal: "time_lookup",
    parseState: buildParseState(q),
  });
  assert.equal(ev.sufficient, false);
  assert.equal(ev.tier, SUFFICIENCY_TIER.DEFER_PIPELINE);
});

test("gate — social date seule passe", () => {
  const q = "quelle date sommes-nous ?";
  const hit = applyShortCircuitSufficiencyGate(
    q,
    {
      path: "social_deterministic",
      reply: "Nous sommes le mercredi 03 juin 2026.",
    },
    buildParseState(q),
  );
  assert.equal(hit.path, "social_deterministic");
  assert.ok(hit.reply);
});

test("gate — social insuffisant devient multi_segment", () => {
  const q =
    "quelle date sommes nous afin de trouver quelle carte graphique 8go acheter";
  const hit = applyShortCircuitSufficiencyGate(
    q,
    {
      path: "social_deterministic",
      reply: "Nous sommes le mercredi 03 juin 2026.",
    },
    buildParseState(q),
  );
  assert.equal(hit.path, "multi_segment_composite");
  assert.equal(hit.deferToLlm, true);
});

test("short-circuit — GPU via multi_segment sans date seule", () => {
  const q =
    "pourrais tu trouver quelle date nous sommes afin de trouver quelle carte graphique 8Go serait un bon achat ??";
  const hit = runConversationShortCircuit(q, {
    getDeterministicSocialResponse: () => null,
  });
  assert.equal(hit?.path, "multi_segment_composite");
  assert.equal(hit?.deferToLlm, true);
});

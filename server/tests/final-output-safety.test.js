import test from "node:test";
import assert from "node:assert/strict";

import { getClientForModel } from "../src/llm/llmFactory.js";
import { AGENT_ROLES } from "../src/agent/policies/agentRolePolicy.js";
import { finalRendererAgent } from "../src/agent/agents/finalRendererAgent.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import responseThinkingCleaner from "../src/agent/utils/responseThinkingCleaner.js";

const RAW_THINKING_LEAK = `
<think>Internal planning should never be visible.</think>
PENSEE INTERNE (obligatoire): ceci est un scaffold interne.
Raisonnement: je dois verifier les etapes cachees.
Voici mon raisonnement interne avant de repondre.
Analyse interne: verifier la cohérence.
Utilise un environnement virtuel Python avec venv, puis installe tes dependances avec pip.
`.trim();

test("finalRendererAgent.compose: supprime les fuites de pensee brutes et paraphrasees", async () => {
  const model = AGENT_ROLES.CHAT || "ornith:9b";
  const client = getClientForModel(model);
  const originalChat = client.chat;
  const originalMakersGate = finalRendererAgent._applyMakersCheckerGate;

  client.chat = async () => "Reponse initiale utile.";
  finalRendererAgent._applyMakersCheckerGate = async () => ({
    blocked: false,
    text: RAW_THINKING_LEAK,
    validation: { outcome: "test_late_leak" },
  });

  try {
    const result = await finalRendererAgent.compose({
      user_intent: "unknown",
      user_query:
        "Peux-tu expliquer clairement les bonnes pratiques de virtualenv en Python pour un projet debutant et maintenable ?",
      mode: "OPERATIONAL",
      expert_outputs: [],
      quick_answer: "",
      risk_level: "low",
      meta: {},
    });

    assert.equal(typeof result, "string");
    assert.ok(result.trim().length > 0);

    // Marqueurs bruts interdits
    assert.doesNotMatch(result, /<think>/i);
    assert.doesNotMatch(
      result,
      /pensee interne|pensee\s+interne|pensée\s+interne/i,
    );
    assert.doesNotMatch(result, /raisonnement\s*:/i);

    // Paraphrases de scaffold interdites
    assert.doesNotMatch(result, /voici\s+mon\s+raisonnement/i);
    assert.doesNotMatch(result, /analyse\s+interne/i);
    assert.doesNotMatch(result, /raisonnement\s+interne/i);
    assert.equal(responseThinkingCleaner.hasEscapedThinking(result), false);

    // Le contenu utile doit survivre
    assert.match(result, /environnement virtuel Python|venv|dependances|pip/i);
  } finally {
    client.chat = originalChat;
    finalRendererAgent._applyMakersCheckerGate = originalMakersGate;
  }
});

test("resolveIntentContract: une demande plan atelier Python n'est ni CODE_DELIVERY_V1 ni FORGE_WEBAPP_BUILD", () => {
  const query =
    "Fais un plan pour un atelier d initiation a Python en 5 sections avec objectifs et duree";

  const { contract } = resolveIntentContract(query, { meta: {} });

  assert.ok(contract?.id);
  assert.notEqual(contract.id, "CODE_DELIVERY_V1");
  assert.notEqual(contract.id, "FORGE_WEBAPP_BUILD");
});

test("resolveIntentContract: un plan pedagogique Python ignore un FORGE_WEBAPP_BUILD force sans balise Forge", () => {
  const query =
    "prepare le plan d'une animation adressee a des debutants pour la decouverte des notions necessaires a l'utilisation du langage python vers l'automatisation";

  const { contract, matchedBy } = resolveIntentContract(query, {
    meta: { forge_production: true, intent_contract_id: "FORGE_WEBAPP_BUILD" },
  });

  assert.ok(contract?.id);
  assert.notEqual(contract.id, "FORGE_WEBAPP_BUILD");
  assert.notEqual(matchedBy, "meta.intent_contract_id");
});

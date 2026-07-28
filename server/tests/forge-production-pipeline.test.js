import test from "node:test";
import assert from "node:assert/strict";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { buildForgePhasePrompt } from "../src/forge/forgePhasePrompt.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isDesignCreateIntent } from "../src/agent/utils/conversationGuards.js";

const FORGE_BRIEF = `Cadrage projet pour la Forge :
Objectif : webapp React/Vite calculatrice scientifique graphique.
Contraintes : setup rapide, dépendances limitées, mode local sans backend.
Livrables : projet Vite React, UI minimale, graphe interactif, README.
Spécification Forge : npm create vite, react-plotly.js, plotly.js.`;

test("forgeProduction: pas de short-circuit handoff sur le brief", async () => {
  const hit = await runConversationShortCircuit(FORGE_BRIEF, {
    forgeProduction: true,
    history: [],
  });
  assert.equal(hit, null);
});

test("buildForgePhasePrompt: consigne de phase + brief, pas handoff", () => {
  const prompt = buildForgePhasePrompt("expert_pm", FORGE_BRIEF);
  assert.match(prompt, /FORGE_PRODUCTION — PM/i);
  assert.match(prompt, /Brief projet/i);
  assert.match(prompt, /calculatrice scientifique/i);
  assert.doesNotMatch(prompt, /je transmets à la Forge/i);
  assert.match(prompt, /WEBAPP_BUILD/i);
});

test("FORGE_WEBAPP_BUILD: contrat forcé, pas DESIGN_CREATE", () => {
  const prompt = buildForgePhasePrompt("expert_developer", FORGE_BRIEF);
  assert.equal(isDesignCreateIntent(prompt), false);
  const { contract } = resolveIntentContract(prompt, {
    meta: { forge_production: true, intent_contract_id: "FORGE_WEBAPP_BUILD" },
  });
  assert.equal(contract.id, "FORGE_WEBAPP_BUILD");
});

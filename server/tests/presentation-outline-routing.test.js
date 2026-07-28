import test from "node:test";
import assert from "node:assert/strict";

import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import {
  isPresentationOutlineRequest,
  parsePresentationOutline,
} from "../src/agent/utils/presentationOutlineIntentGuards.js";
import { resolvePresentationOutlineShortCircuit } from "../src/agent/micro/replies/presentationOutlineComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const TEAMS365_QUERY =
  "fait un plan pour la création d'une présentation en slides de l'applications teams365 avec un sommaire des titres et des sous titres une bonne lisibilité avec un scénario pédagogique sur 24h soit 6 * 4h";

const PRESENTATION_OUTLINE_TEMPLATE =
  "fait un plan pour la création d'une présentation en slides de l'application {subject} avec un sommaire des titres et des sous titres une bonne lisibilité avec un scénario pédagogique sur 24h soit 6 * 4h";

test("presentation outline: détecte la requête Teams365 slides", () => {
  assert.equal(isPresentationOutlineRequest(TEAMS365_QUERY), true);
  const slots = parsePresentationOutline(TEAMS365_QUERY);
  assert.ok(slots);
  assert.equal(slots.subject, "teams365");
  assert.equal(slots.moduleCount, 6);
  assert.equal(slots.hoursPerModule, 4);
  assert.equal(slots.totalHours, 24);
});

test("presentation outline: même patron — sujet X interchangeable (excel, notion)", () => {
  for (const subject of ["excel", "notion", "docker"]) {
    const query = PRESENTATION_OUTLINE_TEMPLATE.replace("{subject}", subject);
    assert.equal(
      isPresentationOutlineRequest(query),
      true,
      `outline signal for ${subject}`,
    );
    const slots = parsePresentationOutline(query);
    assert.equal(slots?.subject, subject, `subject slot for ${subject}`);
    assert.equal(slots?.moduleCount, 6);
    assert.equal(slots?.hoursPerModule, 4);
    const { contract } = resolveIntentContract(query, { user_intent: "unknown" });
    assert.equal(contract.id, "PRESENTATION_OUTLINE");
  }
});

test("presentation outline: short-circuit sans orchestrateur", async () => {
  const hit = resolvePresentationOutlineShortCircuit(TEAMS365_QUERY);
  assert.ok(hit);
  assert.equal(hit.path, "presentation_outline");
  assert.equal(hit.deferToLlm, true);
  assert.match(hit.reflectiveHint, /ANTI-TRONCATURE/i);

  const sc = await runConversationShortCircuit(TEAMS365_QUERY, { history: [] });
  assert.equal(sc?.path, "presentation_outline");
  assert.equal(sc?.deferToLlm, true);
  assert.equal(sc?.presentationOutline, true);
});

test("resolveIntentContract: plan slides Teams365 → PRESENTATION_OUTLINE, pas FORGE", () => {
  for (const userIntent of ["unknown", "strategic", "expert_task"]) {
    const { contract, matchedBy } = resolveIntentContract(TEAMS365_QUERY, {
      user_intent: userIntent,
    });
    assert.equal(contract.id, "PRESENTATION_OUTLINE", `intent=${userIntent}`);
    assert.match(matchedBy, /isPresentationOutlineRequest/);
    assert.notEqual(contract.id, "FORGE_WEBAPP_BUILD");
  }
});

test("resolveIntentContract: plan atelier Python → PRESENTATION_OUTLINE, pas FORGE", () => {
  const query =
    "Fais un plan pour un atelier d initiation a Python en 5 sections avec objectifs et duree";

  const { contract } = resolveIntentContract(query, { meta: {} });

  assert.equal(contract.id, "PRESENTATION_OUTLINE");
  assert.notEqual(contract.id, "CODE_DELIVERY_V1");
  assert.notEqual(contract.id, "FORGE_WEBAPP_BUILD");
});

test("resolveIntentContract: plan pédagogique Python préempte FORGE forcé", () => {
  const query =
    "prepare le plan d'une animation adressee a des debutants pour la decouverte des notions necessaires a l'utilisation du langage python vers l'automatisation";

  const { contract, matchedBy } = resolveIntentContract(query, {
    meta: { forge_production: true, intent_contract_id: "FORGE_WEBAPP_BUILD" },
  });

  assert.equal(contract.id, "PRESENTATION_OUTLINE");
  assert.notEqual(matchedBy, "meta.intent_contract_id");
});

test("presentation outline: n'intercepte pas une livraison code HTML", () => {
  const query =
    "crée un fichier html avec header sidebar pour un atelier notion";
  assert.equal(isPresentationOutlineRequest(query), false);
});

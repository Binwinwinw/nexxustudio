import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { classifyWebProjectScopingRequest } from "../src/agent/utils/webProjectScopingGuards.js";

const G11_SHAREPOINT = "je veux créer un site sharepoint pour mon équipe";
const G13_NGINX = "mon nginx renvoie une erreur 502 depuis ce matin";
const G15_JUNE_1980 = "pourrais tu trouver quel jour était le 19 juin 1980 ???";
const G16_JUNE_1980 = G15_JUNE_1980;
const G17_KING = "quelles informations aurais tu du jeu kingofavalon";
const G19_RELATIVE = "quel jour sera dans 3 jours";
const G21_RECTANGLE =
  "tu peux m'aider à calculer l'air d'un rectangle ??";
const G21_RECTANGLE_PERIMETER =
  "bonjour tu peux m'aider à calculer le périmètre d'un rectangle ??";
const G22_SQUARE_ROOT =
  "bonjour tu peux m'aider à calculer la racine carré d'un nombre ??";
const G23_PERCENT = "quel est 15 % de 200";
const G28_ROOT_AND_PRIMES =
  "bonjour tu peux m'aider à calculer la racine carré d'un nombre et aussi me donner la liste des nombres premiers";
const G11_DATETIME_NOW = "nous sommes quel jour";

describe("short-circuit priority matrix — G11–G21", () => {
  it("G11 — web_project_scoping prime", () => {
    const hit = classifyWebProjectScopingRequest(G11_SHAREPOINT);
    assert.ok(hit);
  });

  it("G15/G16 — date historique → simple_factual_lookup", async () => {
    const hit = await runConversationShortCircuit(G16_JUNE_1980);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.match(hit?.reply || "", /jeudi/i);
  });

  it("G17 — information_seeking → full pipeline", async () => {
    const hit = await runConversationShortCircuit(G17_KING);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
  });

  it("G19 — date relative → simple_factual_lookup", async () => {
    const hit = await runConversationShortCircuit(G19_RELATIVE);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.ok(hit?.reply);
  });

  it("G21 — aire rectangle → math_geometry_deterministic", async () => {
    const hit = await runConversationShortCircuit(G21_RECTANGLE);
    assert.equal(hit?.path, "math_geometry_deterministic");
    assert.match(hit?.reply || "", /longueur\s*×\s*largeur/i);
    assert.doesNotMatch(hit?.reply || "", /cadrer un projet/i);
  });

  it("G21.1 — périmètre rectangle → réponse périmètre", async () => {
    const hit = await runConversationShortCircuit(G21_RECTANGLE_PERIMETER);
    assert.equal(hit?.path, "math_geometry_deterministic");
    assert.match(hit?.reply || "", /périmètre|perimetre/i);
    assert.doesNotMatch(hit?.reply || "", /\bl['']?aire\b/i);
  });

  it("G22 — racine carrée → math_root_deterministic", async () => {
    const hit = await runConversationShortCircuit(G22_SQUARE_ROOT);
    assert.equal(hit?.path, "math_root_deterministic");
    assert.match(hit?.reply || "", /racine carrée/i);
    assert.doesNotMatch(hit?.reply || "", /je vois la piste|cadrer un projet/i);
  });

  it("G23 — pourcentage → math_percent_deterministic", async () => {
    const hit = await runConversationShortCircuit(G23_PERCENT);
    assert.equal(hit?.path, "math_percent_deterministic");
    assert.match(hit?.reply || "", /\b30\b/);
    assert.doesNotMatch(hit?.reply || "", /je vois la piste|cadrer un projet/i);
  });

  it("G28 — racine + nombres premiers → math_composite_deterministic", async () => {
    const hit = await runConversationShortCircuit(G28_ROOT_AND_PRIMES);
    assert.equal(hit?.path, "math_composite_deterministic");
    assert.match(hit?.reply || "", /racine carrée/i);
    assert.match(hit?.reply || "", /nombres premiers/i);
    assert.doesNotMatch(hit?.reply || "", /je vois la piste|cadrer un projet/i);
  });

  it("datetime local — pas confondu avec historical/relative", async () => {
    const hit = await runConversationShortCircuit(G11_DATETIME_NOW);
    assert.notEqual(hit?.path, "simple_factual_lookup");
    assert.ok(
      hit?.path === "social_deterministic" ||
        hit?.path === "datetime_deterministic" ||
        hit?.reply?.match(/nous sommes le/i),
    );
  });
});

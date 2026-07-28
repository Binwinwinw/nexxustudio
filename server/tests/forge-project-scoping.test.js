import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isForgeProjectScopingQuery,
  buildForgeProjectScopingReply,
  buildForgeHandoffAckReply,
  shouldAutoForgeHandoff,
  resolveForgeHandoffBrief,
  isForgeHandoffConfirmationQuery,
  shouldRescueProcedureDraft,
  isInstallClarificationDraft,
} from "../src/agent/micro/subject/forgeProjectScoping.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { inferImplicitUsage, USAGE_INTENTS } from "../src/agent/micro/subject/subjectUsageIntent.js";
import { evaluateProcedureSubjectNatureGate } from "../src/agent/micro/subject/subjectNatureResolver.js";
import { planProcedureIntent, SUBJECT_ROUTER_ACTIONS } from "../src/agent/micro/subject/subjectIntentRouter.js";
import { buildSubjectInterpretedState } from "../src/agent/micro/subject/subjectInterpretedState.js";
import { DETERMINISTIC_ROUTES } from "../src/agent/micro/subject/subjectRoutingHints.js";
import { resolveProcedureShortCircuit } from "../src/agent/micro/replies/procedureReplyBuilder.js";

const FORGE_CADRAGE_QUERY = `Cadrage projet :
Je proposerais ce cadrage minimal pour déclencher proprement la Forge :
Objectif : créer une webapp React/Vite ultra simple de calculatrice scientifique graphique.
Contraintes : setup rapide, dépendances limitées, interface simple, saisie d'expression, tracé de fonction, mode local sans backend.
Livrables : projet Vite React, UI minimale, moteur de calcul basique, graphe interactif simple, README d'installation.
Spécification Forge Je cadrerais la demande Forge comme ceci :
Initialiser un projet react via Vite.
Installer uniquement les dépendances utiles au MVP, idéalement react-plotly.js, plotly.js.
Produire une V1 avec calcul simple, fonctions trigonométriques, variable x, tracé sur un domaine fixe.`;

const BAD_INSTALL_DRAFT =
  "Le sujet ce sujet n'est pas résolu avec assez de certitude (confidence_low). Tu sembles vouloir installer — indique ton OS et la source (Steam, site officiel, package manager…)";

describe("forgeProjectScoping — détection", () => {
  it("détecte cadrage Forge riche", () => {
    assert.equal(isForgeProjectScopingQuery(FORGE_CADRAGE_QUERY), true);
  });

  it('« Installer les dépendances » → usage internal_handoff, pas INSTALL', () => {
    assert.equal(inferImplicitUsage(FORGE_CADRAGE_QUERY, {}), USAGE_INTENTS.INTERNAL_HANDOFF);
  });

  it("shouldRescue sur brouillon Steam/OS", () => {
    assert.equal(shouldRescueProcedureDraft(FORGE_CADRAGE_QUERY, BAD_INSTALL_DRAFT), true);
    assert.equal(isInstallClarificationDraft(BAD_INSTALL_DRAFT), true);
  });
});

describe("forgeProjectScoping — gate procédure", () => {
  it("plan forge_project_scoping_ready", () => {
    const interpreted = buildSubjectInterpretedState({ query: FORGE_CADRAGE_QUERY });
    const plan = planProcedureIntent({
      state: interpreted.state,
      ambiguity: interpreted.ambiguity,
      studioProcedure: true,
      formWithSubject: false,
      query: FORGE_CADRAGE_QUERY,
    });
    assert.equal(plan.kind, "forge_project_scoping_ready");
    assert.equal(plan.action, SUBJECT_ROUTER_ACTIONS.ALLOW_PROCEDURE);
    assert.equal(plan.routeHint, DETERMINISTIC_ROUTES.FORGE_PROJECT_SCOPING_READY);
  });

  it("gate ne renvoie pas clarification install", async () => {
    const gate = await evaluateProcedureSubjectNatureGate(FORGE_CADRAGE_QUERY);
    assert.equal(gate.allowProcedure, false);
    assert.ok(gate.reply);
    assert.doesNotMatch(gate.reply, /Tu sembles vouloir installer/i);
    assert.doesNotMatch(gate.reply, /indique ton OS et la source/i);
    assert.match(gate.reply, /Forge|Vite|React|transmets/i);
    assert.equal(
      gate.path === "forge_project_scoping_ready" ||
        gate.path === "procedure_subject_mini_deliberation",
      true,
    );
  });

  it("short-circuit procédure — chemin forge scoping", async () => {
    const hit = await resolveProcedureShortCircuit(FORGE_CADRAGE_QUERY);
    assert.ok(hit);
    assert.doesNotMatch(hit.reply, /Tu sembles vouloir installer/i);
    assert.match(hit.reply, /Forge|Vite|brief/i);
  });
});

describe("forge handoff — brief suffisant", () => {
  it("shouldAutoForgeHandoff sur cadrage complet", () => {
    assert.equal(shouldAutoForgeHandoff(FORGE_CADRAGE_QUERY), true);
  });

  it("accusé court + transfert Forge", () => {
    const reply = buildForgeHandoffAckReply(FORGE_CADRAGE_QUERY);
    assert.match(reply, /transmets.*Forge/i);
    assert.doesNotMatch(reply, /Tu préfères/i);
    assert.doesNotMatch(reply, /Tu sembles vouloir installer/i);
  });

  it("confirmation après cadrage dans l'historique", () => {
    assert.equal(isForgeHandoffConfirmationQuery("tu as bien compris ???"), true);
    const brief = resolveForgeHandoffBrief("tu as bien compris ???", [
      { role: "user", content: FORGE_CADRAGE_QUERY },
    ]);
    assert.ok(brief);
    assert.equal(brief.reason, "confirmation_after_scoping");
  });

  it("short-circuit → forge_handoff_ready", async () => {
    const hit = await runConversationShortCircuit(FORGE_CADRAGE_QUERY, {
      history: [],
    });
    assert.equal(hit?.path, "forge_handoff_ready");
    assert.equal(hit?.forgeHandoff, true);
    assert.ok(hit?.forgeBrief?.includes("Objectif"));
    assert.doesNotMatch(hit.reply, /Tu préfères/i);
  });
});

describe("buildForgeProjectScopingReply", () => {
  it("cadrage partiel — demande compléments (pas handoff)", () => {
    const partial = "Je veux un projet Forge avec React mais je n'ai pas encore les livrables.";
    assert.equal(isForgeProjectScopingQuery(partial), false);
    const reply = buildForgeProjectScopingReply(partial);
    assert.match(reply, /manque encore|Complète/i);
  });
});

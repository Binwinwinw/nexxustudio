import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isAdminProcedureRequest,
  parseAdminProcedure,
  extractAdminDomain,
  isAdminProcedureShell,
} from "../src/agent/utils/adminProcedureIntentGuards.js";
import { resolveAdminProcedureShortCircuit } from "../src/agent/micro/replies/adminProcedureComposer.js";
import { resolveAdminProcedureCoverage } from "../src/agent/policies/qualification/adminProcedureCoveragePolicy.js";
import { resolveKnowledgeEnrichmentPolicy } from "../src/agent/policies/knowledgeEnrichmentPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";
import { isGeneralKnowledgeRequest } from "../src/agent/utils/generalKnowledgeIntentGuards.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { isExploitableProcedureIntent } from "../src/agent/utils/procedureIntentGuards.js";

describe("adminProcedure — lot 10", () => {
  it("comment déclarer mes impôts → admin_procedure + web", async () => {
    const q = "comment déclarer mes impôts en ligne";
    assert.equal(isAdminProcedureShell(q), true);
    assert.equal(isAdminProcedureRequest(q), true);
    assert.equal(extractAdminDomain(q), "tax");
    assert.equal(isGeneralKnowledgeRequest(q), false);

    const coverage = resolveAdminProcedureCoverage(q);
    assert.equal(coverage.preferWebResearch, true);

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "admin_procedure");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.equal(hit?.adminProcedure, true);
    assert.equal(hit?.preferWebResearch, true);
  });

  it("comment s'inscrire à France Travail → admin_procedure employment", () => {
    const q = "comment s'inscrire à France Travail pour le chômage";
    assert.equal(isAdminProcedureRequest(q), true);
    assert.equal(parseAdminProcedure(q)?.domain, "employment");
  });

  it("démarche carte grise ANTS → admin transport", () => {
    const q = "quelle démarche pour obtenir une carte grise sur ANTS";
    assert.equal(isAdminProcedureRequest(q), true);
    assert.equal(extractAdminDomain(q), "transport");
  });

  it("c'est quoi la CAF → information, pas admin_procedure", () => {
    const q = "c'est quoi la CAF";
    assert.equal(isAdminProcedureRequest(q), false);
  });

  it("comment installer Redis → tech install, pas admin", () => {
    const q = "comment installer Redis sur Ubuntu";
    assert.equal(isAdminProcedureRequest(q), false);
    assert.equal(isTechnicalOverviewRequest(q), false);
  });

  it("handoff Forge Nexxus → studio procedure, pas admin", () => {
    const q = "comment faire pour déclencher le handoff Forge dans Nexxus Studio";
    assert.equal(isExploitableProcedureIntent(q), true);
    assert.equal(isAdminProcedureRequest(q), false);
  });

  it("enrichissement web forcé via knowledgeEnrichmentPolicy", () => {
    const q = "comment obtenir ma carte vitale";
    const policy = resolveKnowledgeEnrichmentPolicy(q);
    assert.equal(policy.preferWebResearch, true);
    assert.equal(policy.domain, "admin_procedure");
  });

  it("addon distingue consigne pratique et source officielle", () => {
    const hit = resolveAdminProcedureShortCircuit(
      "comment demander l'APL auprès de la CAF",
    );
    assert.match(hit?.reflectiveHint || "", /PROCÉDURE ADMINISTRATIVE/i);
    assert.match(hit?.reflectiveHint || "", /service-public|caf\.fr/i);
    assert.match(hit?.reflectiveHint || "", /consigne pratique/i);
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(
        hit,
        "comment demander l'APL auprès de la CAF",
      ),
      true,
    );
  });
});

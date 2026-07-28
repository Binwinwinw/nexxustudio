import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DOCUMENT_REQUEST_UNITS,
  buildDocumentWebProbeQueries,
  formatWebProbeBriefingForDocument,
  inferDocumentProbeDomain,
  inventoryDocumentRequestUnits,
  isDocumentWebCompareRequest,
  prepareDocumentAnalysisContext,
  resolveDocumentWebComparePlan,
  runDocumentWebProbe,
} from "../src/agent/policies/documentWebComparePolicy.js";
import {
  classifyDocumentFollowUpKind,
  isDocumentFollowUpIntent,
} from "../src/agent/micro/continuity/documentFollowUpGuards.js";
import { getDocumentWebComparePromptAddon } from "../src/agent/policies/documentWebComparePolicy.js";
import { getDocumentAnalysisSystemPrompt } from "../src/agent/config/modeResponseContracts.js";
import { expertWebSearch } from "../src/agent/agents/expertWebSearch.js";

const teamsQuery =
  "quelle est l'utilité du fichier joint et pourras tu aussi comparer les informations dans le document à la réalité du web";

const seniorsFile = "application_commande_vocale_pour_les_seniors.pdf";

describe("documentWebComparePolicy — batterie #29", () => {
  it("détecte requête utilité + comparaison web", () => {
    const units = inventoryDocumentRequestUnits(teamsQuery);
    assert.ok(units.includes(DOCUMENT_REQUEST_UNITS.UTILITY));
    assert.ok(units.includes(DOCUMENT_REQUEST_UNITS.WEB_COMPARE));
    assert.equal(isDocumentWebCompareRequest(teamsQuery), true);
  });

  it("infère domaine Teams vs seniors vocal", () => {
    assert.equal(
      inferDocumentProbeDomain(teamsQuery, "Fiches_Exercices_Interactive_Teams365.pdf", ""),
      "teams_m365",
    );
    assert.equal(
      inferDocumentProbeDomain("analyse ce pdf", seniorsFile, "accessibilité seniors"),
      "senior_vocal_accessibility",
    );
  });

  it("buildDocumentWebProbeQueries — sources canoniques Teams", () => {
    const queries = buildDocumentWebProbeQueries("teams_m365", "Teams365.pdf");
    assert.equal(queries.length, 2);
    assert.match(queries[0], /Microsoft Teams/i);
  });

  it("resolveDocumentWebComparePlan active probe si document joint + comparer web", () => {
    const plan = resolveDocumentWebComparePlan(teamsQuery, {
      fileName: "Fiches_Teams365.pdf",
      hasAttachedDocument: true,
    });
    assert.equal(plan.shouldProbe, true);
    assert.ok(plan.queries.length >= 1);
    assert.equal(plan.domain, "teams_m365");
  });

  it("pas de probe sans document joint", () => {
    const plan = resolveDocumentWebComparePlan(teamsQuery, {
      hasAttachedDocument: false,
    });
    assert.equal(plan.shouldProbe, false);
  });

  it("formatWebProbeBriefing interdit date figée octobre 2023", () => {
    const briefing = formatWebProbeBriefingForDocument([
      {
        query: "Microsoft Teams guide",
        sources: [
          {
            title: "Microsoft Teams documentation",
            url: "https://support.microsoft.com/teams",
            snippet: "Guide officiel Teams",
          },
        ],
        summary: "Docs Teams récentes",
      },
    ]);
    assert.match(briefing, /WEB PROBE DOCUMENTAIRE/i);
    assert.match(briefing, /support\.microsoft\.com/i);
    assert.match(briefing, /INTERDIT.*octobre 2023/i);
  });

  it("getDocumentAnalysisSystemPrompt inclut règles web compare", () => {
    const prompt = getDocumentAnalysisSystemPrompt("CONTEXTE", {
      hasAttachedDocument: true,
      webCompareMode: true,
    });
    assert.match(prompt, /WEB PROBE/i);
    assert.match(prompt, /Points à actualiser/i);
    assert.doesNotMatch(getDocumentWebComparePromptAddon(), /octobre 2023.*autorisé/i);
  });
});

describe("documentWebComparePolicy — intégration probe mockée", () => {
  it("prepareDocumentAnalysisContext exécute web probe et assemble briefing", async () => {
    const originalRun = expertWebSearch.run;
    expertWebSearch.run = async (envelope) => ({
      query: envelope.query,
      sources: [
        {
          title: "RGAA accessibilité",
          url: "https://www.numerique.gouv.fr/rgaa",
          snippet: "Référentiel accessibilité",
        },
      ],
      summary: "Guidelines accessibilité",
      confidence: 0.8,
    });

    try {
      const ctx = await prepareDocumentAnalysisContext(teamsQuery, {
        fileName: "Fiches_Teams365.pdf",
        attachedBriefing: "--- DOCUMENTS DE CONTEXTE ---\nTeams exercices",
        hasAttachedDocument: true,
      });
      assert.equal(ctx.webCompareMode, true);
      assert.match(ctx.extractedUrls, /WEB PROBE DOCUMENTAIRE/i);
      assert.match(ctx.extractedUrls, /DOCUMENTS DE CONTEXTE/i);
      assert.ok(ctx.webProbeMeta.sourceCount >= 1);
    } finally {
      expertWebSearch.run = originalRun;
    }
  });

  it("runDocumentWebProbe — plan sans requête", async () => {
    const out = await runDocumentWebProbe({ shouldProbe: false, queries: [] });
    assert.equal(out.executed, false);
    assert.equal(out.briefing, null);
  });
});

describe("documentFollowUpGuards — unités web_compare", () => {
  it("suivi « comparer au web » détecté", () => {
    assert.equal(
      isDocumentFollowUpIntent("peux-tu comparer ce document à la réalité du web"),
      true,
    );
    assert.equal(
      classifyDocumentFollowUpKind("comparer les infos du document au web"),
      "web_compare",
    );
  });

  it("suivi utilité document", () => {
    assert.equal(
      classifyDocumentFollowUpKind("quelle est l'utilité de ce document"),
      "utility",
    );
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isWebCitationsStructuredReportCluster,
  hasExplicitSlidesDeliverableRequest,
  resolveExplicitWebSearchHelpShortCircuit,
  deriveFactualResearchWebQuery,
  shortenWebSearchQuery,
} from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { resolveIntentComposition } from "../src/agent/policies/intent/intentCompositionPolicy.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isPresentationOutlineRequest } from "../src/agent/utils/presentationOutlineIntentGuards.js";
import { isAnalyticalCritiqueIntent } from "../src/agent/utils/analyticalCritiqueIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { classifySummaryContract } from "../src/agent/policies/summary/summaryContractRouter.js";
import { extractPastedSourceText } from "../src/agent/policies/document/documentSynthesisPolicy.js";
import {
  INTENT_DOMAINS,
  DELIVERABLE_TYPES,
} from "../../shared/justIntentCatalog.js";

const CLUSTER_Q =
  "Structure une présentation basée sur une recherche web récente avec citations — livrable rapport professionnel sur les LLM";

const CLUSTER_PLAIN =
  "Fais une recherche web récente avec citations et un rapport professionnel structuré sur l'IA générative";

const SLIDES_EXPLICIT =
  "Fais une recherche web récente avec citations et un rapport, puis un PowerPoint slides sur les LLM";

const SLIDES_PLAN =
  "fait un plan pour la création d'une présentation en slides de l'application Teams365 avec un sommaire des titres et un scénario pédagogique sur 24h soit 6 * 4h";

/** Cas terrain : dossier présentation + sources web + rapport (sans locution « recherche web »). */
const STREAMING_SERIES_A = `Je suis responsable marketing d'une startup de streaming indépendante et nous préparons un dossier de présentation pour une levée de fonds de série A. Pourriez-vous effectuer une recherche sur l'état actuel du marché du streaming de films indépendants et identifier les tendances clés, le positionnement des concurrents et les opportunités de croissance ? Veuillez utiliser des sources web récentes avec citations et structurer le tout sous forme de rapport professionnel de 5 pages maximum, comprenant un résumé, une analyse de marché, une analyse concurrentielle et une présentation des opportunités de croissance.`;

describe("web+citations+rapport cluster — arbitrage rails", () => {
  it("détecte le cluster (sans slides explicites)", () => {
    assert.equal(isWebCitationsStructuredReportCluster(CLUSTER_Q), true);
    assert.equal(isWebCitationsStructuredReportCluster(CLUSTER_PLAIN), true);
    assert.equal(hasExplicitSlidesDeliverableRequest(CLUSTER_Q), false);
  });

  it("règle cumulative : web ∧ citations ∧ rapport (pas un mot isolé)", () => {
    assert.equal(
      isWebCitationsStructuredReportCluster(
        "Je veux une présentation structurée de mon idée de produit",
      ),
      false,
    );
    assert.equal(
      isWebCitationsStructuredReportCluster(
        "Fais une recherche web récente sur les LLM",
      ),
      false,
    );
    assert.equal(
      isWebCitationsStructuredReportCluster(
        "Rédige un rapport professionnel structuré sur les LLM",
      ),
      false,
    );
    assert.equal(
      isWebCitationsStructuredReportCluster(
        "Fais une recherche web récente avec un rapport professionnel sur les LLM",
      ),
      false,
    );
    assert.equal(
      isWebCitationsStructuredReportCluster(
        "Fais une recherche web récente avec citations sur les LLM",
      ),
      false,
    );
  });

  it("exclut si PowerPoint / slides explicites", () => {
    assert.equal(hasExplicitSlidesDeliverableRequest(SLIDES_EXPLICIT), true);
    assert.equal(isWebCitationsStructuredReportCluster(SLIDES_EXPLICIT), false);
  });

  it("justIntent → document/doc_report, pas presentation/ppt", () => {
    for (const q of [CLUSTER_Q, CLUSTER_PLAIN]) {
      const ji = evaluateJustIntent(q);
      assert.equal(ji.domain, INTENT_DOMAINS.DOCUMENT);
      assert.equal(ji.deliverable, DELIVERABLE_TYPES.DOC_REPORT);
      assert.notEqual(ji.domain, INTENT_DOMAINS.PRESENTATION);
      assert.ok(
        ji.signals?.includes("preempt:web_citations_structured_report_cluster"),
      );
    }
  });

  it("composition conserve cite_sources / with_sources", () => {
    const ji = evaluateJustIntent(CLUSTER_Q);
    const comp = resolveIntentComposition(CLUSTER_Q, { justIntent: ji });
    assert.equal(comp.execution_constraints?.with_sources, true);
    assert.ok(comp.secondary_actions?.includes("cite_sources"));
  });

  it("contrat → FACTUAL_RESEARCH, pas PRESENTATION_OUTLINE", () => {
    const { contract, matchedBy } = resolveIntentContract(CLUSTER_Q, {});
    assert.equal(contract.id, "FACTUAL_RESEARCH");
    assert.match(matchedBy, /web_citations_structured_report_cluster/);
    assert.equal(isPresentationOutlineRequest(CLUSTER_Q), false);
  });

  it("analytical_critique ne vole pas le cluster", () => {
    assert.equal(isAnalyticalCritiqueIntent(CLUSTER_Q), false);
    assert.equal(isAnalyticalCritiqueIntent(CLUSTER_PLAIN), false);
  });

  it("SC web → information_seeking + FACTUAL_RESEARCH", async () => {
    const hit = resolveExplicitWebSearchHelpShortCircuit(CLUSTER_PLAIN);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.equal(hit?.preferWebResearch, true);

    const sc = await runConversationShortCircuit(CLUSTER_PLAIN, {
      getDeterministicSocialResponse: () => null,
    });
    assert.equal(sc?.path, "information_seeking_full_pipeline");
    assert.equal(sc?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.notEqual(sc?.path, "analytical_critique");
    assert.notEqual(sc?.path, "presentation_outline");
  });

  it("plan slides explicite reste PRESENTATION_OUTLINE", () => {
    assert.equal(isPresentationOutlineRequest(SLIDES_PLAN), true);
    const { contract } = resolveIntentContract(SLIDES_PLAN, {});
    assert.equal(contract.id, "PRESENTATION_OUTLINE");
  });

  it("terrain streaming Series A → FACTUAL_RESEARCH, pas presentation ni critique", async () => {
    assert.equal(isWebCitationsStructuredReportCluster(STREAMING_SERIES_A), true);
    assert.equal(isAnalyticalCritiqueIntent(STREAMING_SERIES_A), false);
    const ji = evaluateJustIntent(STREAMING_SERIES_A);
    assert.equal(ji.domain, INTENT_DOMAINS.DOCUMENT);
    assert.equal(ji.deliverable, DELIVERABLE_TYPES.DOC_REPORT);
    const { contract } = resolveIntentContract(STREAMING_SERIES_A, {});
    assert.equal(contract.id, "FACTUAL_RESEARCH");
    const sc = await runConversationShortCircuit(STREAMING_SERIES_A, {
      getDeterministicSocialResponse: () => null,
    });
    assert.equal(sc?.path, "information_seeking_full_pipeline");
    assert.equal(sc?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.notEqual(sc?.path, "analytical_critique");
  });

  it("P0 Series A : wantsAnalysis ne tue pas SC ; pas de faux texte collé / TEXT_SUMMARY", async () => {
    assert.equal(extractPastedSourceText(STREAMING_SERIES_A), null);
    assert.equal(
      classifySummaryContract(STREAMING_SERIES_A, { attachments: [] }),
      null,
    );
    const sc = await runConversationShortCircuit(STREAMING_SERIES_A, {
      getDeterministicSocialResponse: () => null,
      wantsAnalysis: true,
    });
    assert.ok(sc, "SC ne doit pas être null sous wantsAnalysis");
    assert.equal(sc.path, "information_seeking_full_pipeline");
    assert.equal(sc.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.equal(sc.preferWebResearch, true);
  });

  it("P1 Series A : query web dérivée courte (pas le brief marketing)", () => {
    const derived = deriveFactualResearchWebQuery(STREAMING_SERIES_A);
    assert.ok(derived.length <= 120, `trop long: ${derived.length}`);
    assert.ok(derived.length < STREAMING_SERIES_A.length / 3);
    assert.match(derived, /Series A/i);
    assert.match(derived, /streaming/i);
    assert.doesNotMatch(derived, /responsable marketing/i);
    assert.doesNotMatch(derived, /Pourriez-vous/i);

    const withMonth =
      STREAMING_SERIES_A + " Focus sur les données de juillet 2026.";
    const derivedMonth = deriveFactualResearchWebQuery(withMonth);
    assert.match(derivedMonth, /juillet/i);
    assert.match(derivedMonth, /2026/);

    const hit = resolveExplicitWebSearchHelpShortCircuit(STREAMING_SERIES_A);
    assert.ok(hit?.webQuery);
    assert.ok(hit.webQuery.length <= 120);
    assert.match(hit.webQuery, /Series A|streaming/i);
  });

  it("P1 shortenWebSearchQuery : brief long → ≤80 ; query courte inchangée", () => {
    const shortQ = "levées Series A streaming 2026";
    assert.equal(shortenWebSearchQuery(shortQ), shortQ);
    const shortened = shortenWebSearchQuery(STREAMING_SERIES_A);
    assert.ok(shortened.length <= 80);
    assert.ok(shortened.length < STREAMING_SERIES_A.length);
  });
});

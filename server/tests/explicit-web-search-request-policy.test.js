import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isExplicitWebSearchRequest,
  isFreshFactualCompareWithWebRequest,
  hasExplicitWebProductRecoSignals,
  wasWebSearchSkippedByContract,
  buildExplicitWebUnavailableReply,
  isWebSearchHelpWithoutTopic,
  resolveExplicitWebSearchHelpShortCircuit,
  isWebSearchHelpClarifyPending,
  isWebSearchThreadActive,
  isWebResearchContinuationQuery,
  extractWebSearchFollowUpTopic,
  buildWebSearchHelpClarifyReply,
} from "../src/agent/policies/explicitWebSearchRequestPolicy.js";
import {
  isWebSearchThreadMaintenanceMessage,
  requiresBridgedFreshnessFallback,
  resolveWebSearchThreadMaintenanceShortCircuit,
} from "../src/agent/policies/web/index.js";
import { resolveEpistemicUncertaintyShortCircuit } from "../src/agent/policies/epistemic/index.js";
import {
  resolveIntentContract,
  shouldSkipWebSearchForIntent,
} from "../src/agent/config/intentContractRegistry.js";
import { isOpenProjectIdeation } from "../src/agent/config/modeResponseContracts.js";
import { isPresentationOutlineRequest } from "../src/agent/utils/presentationOutlineIntentGuards.js";
import { understandQuery } from "../src/agent/policies/conversationQueryUnderstanding.js";
import {
  buildKnowledgeFreshnessSystemAddon,
} from "../src/agent/micro/replies/knowledgeFreshnessComposerContract.js";
import { getMissingProductRecommendationSlots } from "../src/agent/policies/compareChooseCompositePolicy.js";
import { extractCompareDomain } from "../src/agent/utils/compareChooseIntentGuards.js";
import {
  requiresCompareChooseComposerContract,
  buildGuidedProductComposerUserPrompt,
  isCompareChooseContractViolation,
} from "../src/agent/micro/replies/compareChooseComposer.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";
import { isIdeationIntent } from "../src/agent/utils/ideationIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const WEB_HELP_QUERY =
  "je veux faire une recherche sur internet tu peux m'aider?";

const RTX_QUERY =
  "je veux changer ma rtx 4060 pour une carte plus puissante, fais une recherche sur la toile et propose moi au moins 3 modeles avec un bon rapport qualite prix";

describe("explicitWebSearchRequestPolicy — aide recherche sans sujet", () => {
  it("détecte demande web + sans sujet", () => {
    assert.equal(isExplicitWebSearchRequest(WEB_HELP_QUERY), true);
    assert.equal(isWebSearchHelpWithoutTopic(WEB_HELP_QUERY), true);
    assert.equal(isIdeationIntent(WEB_HELP_QUERY), false);
    assert.equal(isOpenProjectIdeation(WEB_HELP_QUERY), false);
  });

  it("short-circuit clarify — pas ideation RAG", async () => {
    const hit = await runConversationShortCircuit(WEB_HELP_QUERY);
    assert.equal(hit?.path, "web_search_help_clarify");
    assert.match(hit?.reply || "", /recherche sur internet/i);
    assert.match(hit?.reply || "", /sujet/i);
    assert.doesNotMatch(hit?.reply || "", /Assistant RAG|3 pistes/i);
  });

  it("avec sujet → pipeline web", () => {
    const q = "fais une recherche sur internet sur les RTX 5070";
    const hit = resolveExplicitWebSearchHelpShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.preferWebResearch, true);
    assert.match(hit?.webQuery || "", /RTX|5070/i);
    assert.equal(hit?.forcedIntentContractId, "FACTUAL_RESEARCH");
  });

  it("« sur la toile trouve » GPU → web pipeline (pas DIRECT_EXPLANATION)", async () => {
    const q =
      "sur la toile trouve une carte graphique 16Go à moins de 1000€ nvidia ou AMD";
    assert.equal(isExplicitWebSearchRequest(q), true);
    assert.equal(hasExplicitWebProductRecoSignals(q), true);
    const hit = resolveExplicitWebSearchHelpShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.preferWebResearch, true);
    assert.match(hit?.webQuery || "", /carte|graphique|nvidia|AMD|1000/i);

    const sc = await runConversationShortCircuit(q);
    assert.equal(sc?.path, "information_seeking_full_pipeline");
  });

  it("follow-up sujet après clarify → pipeline web (pas DIRECT_EXPLANATION)", async () => {
    const history = [
      { role: "user", content: WEB_HELP_QUERY },
      { role: "assistant", content: buildWebSearchHelpClarifyReply() },
    ];
    assert.equal(isWebSearchHelpClarifyPending(history), true);
    assert.match(
      extractWebSearchFollowUpTopic("sur la mixtrack Pro 2") || "",
      /mixtrack/i,
    );

    const hit = resolveExplicitWebSearchHelpShortCircuit("sur la mixtrack Pro 2", {
      history,
    });
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.kind, "web_help_followup_topic");
    assert.equal(hit?.preferWebResearch, true);
    assert.equal(hit?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.match(hit?.webQuery || "", /mixtrack/i);

    const sc = await runConversationShortCircuit("sur la mixtrack Pro 2", {
      history,
    });
    assert.equal(sc?.path, "information_seeking_full_pipeline");
    assert.equal(sc?.preferWebResearch, true);
    assert.equal(sc?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.match(sc?.webQueryOverride || "", /mixtrack/i);
  });

  it("continuité multi-tours : pivot « et sur… » après synthèse web (pas de plafond)", async () => {
    const history = [
      { role: "user", content: WEB_HELP_QUERY },
      { role: "assistant", content: buildWebSearchHelpClarifyReply() },
      { role: "user", content: "sur les nike air jordan" },
      {
        role: "assistant",
        content:
          "Les Nike Air Jordan sont des sneakers emblématiques. Sources : jordan.com, Foot Locker.",
      },
    ];

    assert.equal(isWebSearchThreadActive(history), true);
    assert.equal(
      isWebResearchContinuationQuery("et sur les additions pour les 6eme"),
      true,
    );
    assert.match(
      extractWebSearchFollowUpTopic("et sur les additions pour les 6eme") || "",
      /additions/i,
    );

    const hit = resolveExplicitWebSearchHelpShortCircuit(
      "et sur les additions pour les 6eme",
      { history },
    );
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.kind, "web_help_thread_continuation");
    assert.equal(hit?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.match(hit?.webQuery || "", /additions/i);

    // 2e pivot — toujours le même fil
    const history2 = [
      ...history,
      { role: "user", content: "et sur les additions pour les 6eme" },
      {
        role: "assistant",
        content: "Synthèse web sur les additions en 6e avec sources scolaires.",
      },
    ];
    const hit2 = resolveExplicitWebSearchHelpShortCircuit(
      "et sur la photosynthèse",
      { history: history2 },
    );
    assert.equal(hit2?.kind, "web_help_thread_continuation");
    assert.match(hit2?.webQuery || "", /photosynth/i);

    const sc = await runConversationShortCircuit(
      "et sur les additions pour les 6eme",
      { history },
    );
    assert.equal(sc?.path, "information_seeking_full_pipeline");
    assert.equal(sc?.preferWebResearch, true);
    assert.match(sc?.webQueryOverride || "", /additions/i);

    // Rupture d'intention → plus de continuité web
    const afterBreak = [
      ...history2,
      { role: "user", content: "crée une page html pour mon projet" },
      { role: "assistant", content: "Je te prépare la structure HTML." },
    ];
    assert.equal(isWebSearchThreadActive(afterBreak), false);
    assert.equal(
      resolveExplicitWebSearchHelpShortCircuit("et sur les fractions", {
        history: afterBreak,
      }),
      null,
    );
  });
});

describe("explicitWebSearchRequestPolicy — RTX comparatif", () => {
  it("détecte la demande web explicite", () => {
    assert.equal(isExplicitWebSearchRequest(RTX_QUERY), true);
  });

  it("classifie fresh factual compare with web", () => {
    assert.equal(isFreshFactualCompareWithWebRequest(RTX_QUERY), true);
  });

  it("domaine produit via rtx", () => {
    assert.equal(extractCompareDomain(RTX_QUERY), "product");
  });

  it("slots produit remplis via web explicite + critère", () => {
    assert.equal(hasExplicitWebProductRecoSignals(RTX_QUERY), true);
    assert.deepEqual(getMissingProductRecommendationSlots(RTX_QUERY, "product"), []);
  });

  it("short-circuit web explicite GPU → GUIDED_PRODUCT_RECOMMENDATION", () => {
    const hit = resolveExplicitWebSearchHelpShortCircuit(RTX_QUERY, { history: [] });
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.forcedIntentContractId, "GUIDED_PRODUCT_RECOMMENDATION");
  });

  it("pas IDEATION_OPEN", () => {
    assert.equal(isOpenProjectIdeation(RTX_QUERY), false);
  });

  it("pas PRESENTATION_OUTLINE même avec expert_task", () => {
    assert.equal(isPresentationOutlineRequest(RTX_QUERY), false);
  });
});

describe("explicitWebSearchRequestPolicy — contrat intent", () => {
  it("GUIDED_PRODUCT_RECOMMENDATION avec query_understanding", () => {
    const u = understandQuery(RTX_QUERY);
    const resolved = resolveIntentContract(RTX_QUERY, {
      meta: { query_understanding: u },
    });
    assert.equal(resolved.contract.id, "GUIDED_PRODUCT_RECOMMENDATION");
    assert.equal(resolved.contract.routing.skipWebSearch, false);
  });

  it("expert_task ne force plus PRESENTATION_OUTLINE", () => {
    const resolved = resolveIntentContract(RTX_QUERY, { user_intent: "expert_task" });
    assert.notEqual(resolved.contract.id, "PRESENTATION_OUTLINE");
    assert.equal(resolved.contract.id, "GUIDED_PRODUCT_RECOMMENDATION");
  });

  it("shouldSkipWebSearchForIntent false sur demande explicite", () => {
    assert.equal(shouldSkipWebSearchForIntent(RTX_QUERY, {}), false);
  });
});

describe("explicitWebSearchRequestPolicy — honnêteté fraîcheur", () => {
  it("pas de fallback bridé sans tentative web", () => {
    assert.equal(requiresBridgedFreshnessFallback(RTX_QUERY, {}), false);
  });

  it("fallback bridé seulement si web tentée et échouée", () => {
    assert.equal(
      requiresBridgedFreshnessFallback(RTX_QUERY, {
        meta: { web_failure_mode: "fallback_no_results" },
      }),
      true,
    );
  });

  it("refus honnête si web contournée par contrat", () => {
    const addon = buildKnowledgeFreshnessSystemAddon(RTX_QUERY, {
      meta: { web_failure_mode: "web_search_skipped_by_contract" },
    });
    assert.match(addon, /Je ne peux pas consulter le web/i);
    assert.match(addon, /INTERDIT.*Je n'ai pas pu vérifier/i);
    assert.doesNotMatch(addon, /FALLBACK BRIDÉ/i);
  });

  it("wasWebSearchSkippedByContract", () => {
    assert.equal(
      wasWebSearchSkippedByContract({
        meta: { web_failure_mode: "web_search_skipped_by_contract" },
      }),
      true,
    );
  });

  it("buildExplicitWebUnavailableReply — pas de faux échec", () => {
    const reply = buildExplicitWebUnavailableReply(RTX_QUERY);
    assert.match(reply, /Je ne peux pas consulter le web/i);
    assert.doesNotMatch(reply, /je n'ai pas pu vérifier/i);
  });
});

describe("guidedProductComposer — RTX comparatif", () => {
  it("requiresCompareChooseComposerContract sur GUIDED_PRODUCT_RECOMMENDATION", () => {
    assert.equal(
      requiresCompareChooseComposerContract(RTX_QUERY, {
        meta: { intent_contract_id: "GUIDED_PRODUCT_RECOMMENDATION" },
      }),
      true,
    );
  });

  it("user prompt — pas de consigne refus vide", () => {
    const prompt = buildGuidedProductComposerUserPrompt({
      user_query: RTX_QUERY,
      meta: {
        intent_contract_id: "GUIDED_PRODUCT_RECOMMENDATION",
        resolution_path: "web_fallback",
        web_consulted_at: "2026-07-16T19:25:00.000Z",
      },
      expert_outputs: [
        {
          stage: "web_research",
          content:
            "RTX 4070 Super — bon rapport perf/prix. RTX 4070 Ti — plus puissant. RX 7800 XT — alternative AMD.",
        },
      ],
    });
    assert.match(prompt, /au moins 3 modèles/i);
    assert.match(prompt, /CONTEXTE WEB/i);
    assert.doesNotMatch(prompt, /contexte expert est vide/i);
    assert.match(prompt, /INTERDIT.*Je vois la piste/s);
  });

  it("isCompareChooseContractViolation détecte le refus générique", () => {
    assert.equal(isCompareChooseContractViolation(INSUFFICIENT_SIGNAL_REFUSAL), true);
    assert.equal(
      isCompareChooseContractViolation(
        "Voici 3 cartes : RTX 4070 Super, RX 7800 XT, RTX 4060 Ti.",
      ),
      false,
    );
  });
});

const GPU_WEB_TURN =
  "sur la toile trouve une carte graphique avec un excellent rapport qualité/prix contenant le maximum de GB en VRAM à moins de 1000€ chez Nvidia ou AMD";

const DATE_MEMORY_FOLLOWUP =
  "je me permettrais tout de même de t'informer que nous sommes aujourd'hui 25 juillet 2026 donc si tu peux te mettre à jour en mémorisant les résultats obtenus";

describe("webSearchThreadContinuityPolicy — date / mémoire sans hash politesse", () => {
  it("détecte message méta date + mémorisation", () => {
    assert.equal(isWebSearchThreadMaintenanceMessage(DATE_MEMORY_FOLLOWUP), true);
    assert.equal(isWebSearchThreadMaintenanceMessage(GPU_WEB_TURN), false);
  });

  it("fil actif → pipeline web avec requête dérivée du tour GPU, pas epistemic_verify", () => {
    const history = [
      { role: "user", content: GPU_WEB_TURN },
      {
        role: "assistant",
        content: "Comparatif RTX 4070 Ti Super, RX 7800 XT…",
      },
    ];
    assert.equal(isWebSearchThreadActive(history), true);

    const hit = resolveWebSearchThreadMaintenanceShortCircuit(DATE_MEMORY_FOLLOWUP, {
      history,
    });
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.preferWebResearch, true);
    assert.match(hit?.webQuery || "", /carte graphique|nvidia|AMD|comparatif/i);
    assert.doesNotMatch(hit?.webQuery || "", /permets|permettrais/i);

    const epistemic = resolveEpistemicUncertaintyShortCircuit(DATE_MEMORY_FOLLOWUP, {
      history,
    });
    assert.equal(epistemic, null);
  });

  it("short-circuit global — pas epistemic_verify_external", async () => {
    const history = [
      { role: "user", content: GPU_WEB_TURN },
      { role: "assistant", content: "Tableau GPU sous 1000€…" },
    ];
    const hit = await runConversationShortCircuit(DATE_MEMORY_FOLLOWUP, { history });
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.notEqual(hit?.path, "epistemic_verify_external");
    assert.match(hit?.webQueryOverride || "", /carte graphique/i);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveExplicitWebSearchHelpShortCircuit } from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  DOCUMENTARY_MANDATE_KIND,
  DOCUMENTARY_MANDATE_PATH,
  buildDocumentaryMandate,
} from "../src/agent/policies/conversation/documentaryMandatePolicy.js";
import { DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID } from "../src/agent/micro/replies/documentaryWebCollectionComposer.js";
import { applyIntentContractToPacket } from "../src/agent/config/intentContractRegistry.js";
import { buildWebSearchHelpClarifyReply } from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";

const WEB_QUERY =
  "À propos du logiciel Hermès Desktop, si tu ne connais pas cherche sur le web";
const OFF_TOPIC_WEB_QUERY = "cherche sur le web une recette de bourguignon carbonara";
const PRODUCT_QUERY =
  "sur la toile trouve une carte graphique 16Go à moins de 1000€ nvidia ou AMD";
const CLUSTER_QUERY =
  "Effectuer une recherche sur l'état actuel du marché avec sources web récentes avec citations et structurer le tout sous forme de rapport professionnel";

function priorWithMandate() {
  return { documentaryMandate: buildDocumentaryMandate() };
}

describe("arbitrage web sous mandat documentaire", () => {
  it("1. mandat valide + cherche sur le web → DOCUMENTARY_WEB_COLLECTION", () => {
    const hit = resolveExplicitWebSearchHelpShortCircuit(WEB_QUERY, {
      priorState: priorWithMandate(),
    });
    assert.equal(hit?.forcedIntentContractId, DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.kind, "web_help_with_topic");
    assert.equal(hit?.preferWebResearch, true);
    assert.equal(hit?.deferToFullPipeline, true);
    assert.match(hit?.webQuery || "", /Hermès|Desktop/i);
  });

  it("2. sans mandat → FACTUAL_RESEARCH", () => {
    const hit = resolveExplicitWebSearchHelpShortCircuit(WEB_QUERY, {});
    assert.equal(hit?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.equal(hit?.preferWebResearch, true);
  });

  it("3. kind ou source invalide → FACTUAL_RESEARCH", () => {
    const wrongKind = resolveExplicitWebSearchHelpShortCircuit(WEB_QUERY, {
      priorState: {
        documentaryMandate: {
          kind: "other",
          source: DOCUMENTARY_MANDATE_PATH,
        },
      },
    });
    const wrongSource = resolveExplicitWebSearchHelpShortCircuit(WEB_QUERY, {
      priorState: {
        documentaryMandate: {
          kind: DOCUMENTARY_MANDATE_KIND,
          source: "other",
        },
      },
    });
    assert.equal(wrongKind?.forcedIntentContractId, "FACTUAL_RESEARCH");
    assert.equal(wrongSource?.forcedIntentContractId, "FACTUAL_RESEARCH");
  });

  it("4. cluster reste FACTUAL ; reco produit reste GUIDED", () => {
    const cluster = resolveExplicitWebSearchHelpShortCircuit(CLUSTER_QUERY, {
      priorState: priorWithMandate(),
    });
    assert.equal(cluster?.kind, "web_citations_structured_report_cluster");
    assert.equal(cluster?.forcedIntentContractId, "FACTUAL_RESEARCH");

    const product = resolveExplicitWebSearchHelpShortCircuit(PRODUCT_QUERY, {
      priorState: priorWithMandate(),
    });
    assert.equal(product?.forcedIntentContractId, "GUIDED_PRODUCT_RECOMMENDATION");
  });

  it("5. le mandat n'est ni modifié ni consommé", () => {
    const mandate = buildDocumentaryMandate();
    const priorState = { documentaryMandate: mandate };
    const before = structuredClone(mandate);
    resolveExplicitWebSearchHelpShortCircuit(WEB_QUERY, { priorState });
    assert.deepEqual(priorState.documentaryMandate, before);
    assert.equal(priorState.documentaryMandate, mandate);
  });

  it("6. applyIntentContractToPacket conserve DOCUMENTARY_WEB_COLLECTION", () => {
    const packet = {
      user_query: WEB_QUERY,
      meta: { intent_contract_id: DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID },
    };
    const { contract } = applyIntentContractToPacket(packet, WEB_QUERY);
    assert.equal(contract.id, DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID);
    assert.equal(
      packet.meta.intent_contract_id,
      DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID,
    );
    assert.equal(packet.meta.documentaryMandate, undefined);
  });

  it("7. runConversationShortCircuit propage le mandat vers le hit", async () => {
    const withMandate = await runConversationShortCircuit(WEB_QUERY, {
      priorState: priorWithMandate(),
    });
    assert.equal(
      withMandate?.forcedIntentContractId,
      DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID,
    );
    assert.equal(withMandate?.path, "information_seeking_full_pipeline");
    assert.equal(withMandate?.preferWebResearch, true);
    assert.ok(withMandate?.webQueryOverride);

    const without = await runConversationShortCircuit(WEB_QUERY, {});
    assert.equal(without?.forcedIntentContractId, "FACTUAL_RESEARCH");
  });

  it("8. follow-up web avec mandat → DOCUMENTARY_WEB_COLLECTION", () => {
    const history = [
      { role: "user", content: "je veux faire une recherche sur internet" },
      { role: "assistant", content: buildWebSearchHelpClarifyReply() },
    ];
    const hit = resolveExplicitWebSearchHelpShortCircuit("sur Hermès Desktop", {
      history,
      priorState: priorWithMandate(),
    });
    assert.equal(hit?.kind, "web_help_followup_topic");
    assert.equal(hit?.forcedIntentContractId, DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID);
    assert.equal(hit?.preferWebResearch, true);
  });

  it("comportement actuel connu : web hors sujet avec mandat encore présent → DOCUMENTARY_WEB_COLLECTION", () => {
    const hit = resolveExplicitWebSearchHelpShortCircuit(OFF_TOPIC_WEB_QUERY, {
      priorState: priorWithMandate(),
    });
    assert.equal(hit?.forcedIntentContractId, DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID);
    assert.equal(hit?.kind, "web_help_with_topic");
  });
});

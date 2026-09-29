import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  INTENT_CONTRACT_REGISTRY,
  resolveIntentContract,
  applyIntentContractToPacket,
  listIntentContracts,
} from "../src/agent/config/intentContractRegistry.js";
import { isFactualResearchSourcedReportPath } from "../src/agent/policies/web/factualResearchDeliverablePolicy.js";
import { validateFactualResearchReply } from "../src/agent/policies/web/factualResearchReplyValidator.js";
import { FACTUAL_RESEARCH_EXACT_HEADINGS } from "../src/agent/policies/web/factualResearchReplyValidator.js";
import {
  DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID,
  requiresDocumentaryWebCollectionComposerContract,
  buildDocumentaryWebCollectionSystemAddon,
} from "../src/agent/micro/replies/documentaryWebCollectionComposer.js";
import { isWebCitationsStructuredReportCluster } from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";

const CLUSTER_QUERY = `Je suis responsable marketing d'une startup de streaming indépendante. Effectuer une recherche sur l'état actuel du marché avec sources web récentes avec citations et structurer le tout sous forme de rapport professionnel, comprenant un résumé, une analyse de marché, une analyse concurrentielle et les opportunités de croissance.`;

const ORDINARY_WEB_QUERY =
  "À propos du logiciel Hermès Desktop, si tu ne connais pas cherche sur le web";

function documentaryPacket(extra = {}) {
  return {
    user_query: ORDINARY_WEB_QUERY,
    meta: { intent_contract_id: DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID },
    ...extra,
  };
}

describe("DOCUMENTARY_WEB_COLLECTION — contrat dormant", () => {
  it("1. le registry reconnaît l'ID", () => {
    const listed = listIntentContracts().some(
      (c) => c.id === DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID,
    );
    const entry = INTENT_CONTRACT_REGISTRY.find(
      (c) => c.id === DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID,
    );
    assert.equal(listed, true);
    assert.ok(entry);
    assert.equal(entry.detection, undefined);
    assert.equal(entry.smoke, undefined);
    assert.deepEqual(entry.orchestratorIntents, []);
  });

  it("2. applyIntentContractToPacket conserve l'ID forcé", () => {
    const packet = documentaryPacket();
    const { contract } = applyIntentContractToPacket(packet, ORDINARY_WEB_QUERY);
    assert.equal(contract.id, DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID);
    assert.equal(
      packet.meta.intent_contract_id,
      DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID,
    );
  });

  it("3. requête web ordinaire sans forced ID n'assigne pas le contrat", () => {
    const { contract } = resolveIntentContract(ORDINARY_WEB_QUERY, {});
    assert.notEqual(contract.id, DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID);
  });

  it("4. le contrat autorise le chemin web", () => {
    const entry = INTENT_CONTRACT_REGISTRY.find(
      (c) => c.id === DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID,
    );
    assert.notEqual(entry.routing.skipWebSearch, true);
    assert.ok(entry.routing.webSearchMaxSources > 0);
  });

  it("5. path FACTUAL faux pour cet ID, y compris cluster", () => {
    assert.equal(isWebCitationsStructuredReportCluster(CLUSTER_QUERY), true);
    assert.equal(
      isFactualResearchSourcedReportPath(CLUSTER_QUERY, documentaryPacket()),
      false,
    );
    assert.equal(
      isFactualResearchSourcedReportPath(ORDINARY_WEB_QUERY, documentaryPacket()),
      false,
    );
  });

  it("6. path FACTUAL vrai pour meta FACTUAL et cluster sans cet ID", () => {
    assert.equal(
      isFactualResearchSourcedReportPath(ORDINARY_WEB_QUERY, {
        meta: { intent_contract_id: "FACTUAL_RESEARCH" },
      }),
      true,
    );
    assert.equal(isFactualResearchSourcedReportPath(CLUSTER_QUERY, {}), true);
  });

  it("7. branche transitoire, pas P5 / volume / validator FACTUAL", () => {
    const packet = documentaryPacket();
    assert.equal(
      requiresDocumentaryWebCollectionComposerContract(ORDINARY_WEB_QUERY, packet),
      true,
    );
    const addon = buildDocumentaryWebCollectionSystemAddon(packet);
    for (const heading of FACTUAL_RESEARCH_EXACT_HEADINGS) {
      assert.equal(addon.includes(heading), false, heading);
    }
    assert.doesNotMatch(addon, /1200|1800|cible rédactionnelle/);
    const validated = validateFactualResearchReply("collecte courte", packet, {
      query: ORDINARY_WEB_QUERY,
    });
    assert.equal(validated.valid, true);
    assert.deepEqual(validated.issues, []);
    assert.equal(validated.sanitized, "collecte courte");
  });

  it("8. packet avec preuves : sources citées, pas de fiches", () => {
    const packet = documentaryPacket({
      evidence: [
        {
          source: "https://example.test/hermes",
          excerpt: "Hermès Desktop fiche produit",
        },
      ],
    });
    const addon = buildDocumentaryWebCollectionSystemAddon(packet);
    assert.match(addon, /https:\/\/example\.test\/hermes/);
    assert.match(addon, /Hermès Desktop fiche produit/);
    assert.match(addon, /INTERDIT : prétendre produire les fiches/);
  });
});

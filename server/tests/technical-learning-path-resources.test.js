import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  TECHNICAL_LEARNING_BLUEPRINTS,
} from "../src/agent/micro/replies/technicalLearningBlueprints.js";
import { OFFICIAL_MODULE_RESOURCES_BY_BLUEPRINT_ID } from "../src/agent/micro/replies/technicalLearningOfficialResources.js";
import {
  buildTechnicalLearningPathOutlineFallback,
  normalizeModuleResourceLink,
  MAX_MODULE_RESOURCE_LINKS,
} from "../src/agent/micro/replies/technicalLearningPathComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("technicalLearningPath — ressources officielles par module", () => {
  it("normalizeModuleResourceLink — https obligatoire, 1 lien max", () => {
    assert.equal(normalizeModuleResourceLink(null), null);
    assert.equal(normalizeModuleResourceLink({ url: "http://example.com" }), null);
    assert.equal(
      normalizeModuleResourceLink({
        url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
        title: "MDN — HTML",
      })?.url,
      "https://developer.mozilla.org/en-US/docs/Web/HTML",
    );
    assert.equal(MAX_MODULE_RESOURCE_LINKS, 1);
  });

  it("15/15 stacks — ressource officielle sur chaque module", () => {
    for (const blueprint of TECHNICAL_LEARNING_BLUEPRINTS) {
      const registry = OFFICIAL_MODULE_RESOURCES_BY_BLUEPRINT_ID[blueprint.id];
      assert.ok(registry?.length, blueprint.id);
      assert.equal(registry.length, blueprint.modules.length, blueprint.id);

      for (const [index, mod] of blueprint.modules.entries()) {
        const link = normalizeModuleResourceLink(mod.resourceLink);
        assert.ok(link, `${blueprint.id} module ${index + 1}`);
        assert.match(link.url, /^https:\/\//);
        assert.equal(link.url, registry[index].url);
      }
    }
  });

  it("HTML — section Ressource officielle rendue après Auto-vérification", async () => {
    const q =
      "creer des fiches de revisions afin maitriser le html et ses regles";
    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.match(hit.reply, /\*\*Ressource officielle\*\*/);
    assert.match(hit.reply, /\[MDN — HTML\]\(https:\/\/developer\.mozilla\.org/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      assert.match(block, /\*\*Ressource officielle\*\*/);
      assert.match(block, /\[.+\]\(https:\/\/.+\)/);
    }
  });

  it("sans resourceLink — pas de section ressource (fallback générique)", () => {
    const fallback = buildTechnicalLearningPathOutlineFallback(
      "je veux un plan d apprentissage pour Redis en profondeur",
    );
    assert.ok(fallback);
    assert.doesNotMatch(fallback, /\*\*Ressource officielle\*\*/);
    assert.doesNotMatch(fallback, /\*\*Doc conseillée\*\*/);
  });
});

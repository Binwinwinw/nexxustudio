import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureExplicitWebSourceLinks } from "../src/agent/policies/webEvidenceFidelityValidator.js";

describe("ensureExplicitWebSourceLinks", () => {
  it("append **Sources** avec URLs manquantes pour « sur la toile trouve »", () => {
    const query =
      "sur la toile trouve une carte graphique 16Go à moins de 1000€ nvidia ou AMD";
    const packet = {
      user_query: query,
      evidence: [
        {
          source: "https://example.com/rtx-4070-ti-super",
          excerpt: "RTX 4070 Ti Super 16 Go",
        },
        {
          source: "https://example.com/rx-7900-xt",
          excerpt: "RX 7900 XT prix",
        },
      ],
    };
    const body =
      "Je te recommande la RTX 4070 Ti Super en 16 Go autour de 800-900€.";
    const out = ensureExplicitWebSourceLinks(body, packet);
    assert.match(out, /\*\*Sources\*\*/i);
    assert.match(out, /https:\/\/example\.com\/rtx-4070-ti-super/);
    assert.match(out, /https:\/\/example\.com\/rx-7900-xt/);
  });

  it("ne duplique pas une URL déjà présente", () => {
    const packet = {
      user_query: "recherche sur internet RTX 4070",
      evidence: [
        { source: "https://example.com/a", excerpt: "A" },
      ],
    };
    const body = "Voir https://example.com/a pour les prix.";
    const out = ensureExplicitWebSourceLinks(body, packet);
    assert.equal(out, body);
  });
});

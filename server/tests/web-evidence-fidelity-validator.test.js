import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectsWebEvidenceDenial,
  validateWebEvidenceFidelityReply,
  extractWebSourcesFromPacket,
} from "../src/agent/policies/web/index.js";

describe("webEvidenceFidelityValidator", () => {
  it("détecte un déni alors que des preuves web existent", () => {
    const packet = {
      user_query: "caveman github",
      meta: { web_consulted_at: "2026-07-17T00:00:00.000Z" },
      evidence: [
        {
          source: "https://github.com/JuliusBrussee/caveman",
          excerpt: "Lithic token compression plugin for AI coding agents",
        },
      ],
      expert_outputs: [
        {
          stage: "web_research",
          content:
            "JuliusBrussee/caveman — skill pour réduire les tokens via style caveman.",
        },
      ],
    };

    const badReply =
      "Je n'ai pas trouvé trace d'un projet open-source notable portant ce nom.";
    assert.equal(detectsWebEvidenceDenial(badReply), true);
    assert.ok(extractWebSourcesFromPacket(packet).length >= 1);

    const validation = validateWebEvidenceFidelityReply(badReply, packet);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.includes("denies_web_sources_when_present"));
    assert.match(validation.sanitized, /JuliusBrussee|caveman|sources web/i);
    assert.equal(detectsWebEvidenceDenial(validation.sanitized), false);
  });

  it("laisse passer une réponse ancrée sans déni", () => {
    const packet = {
      evidence: [{ source: "https://example.com/repo", excerpt: "readme" }],
    };
    const goodReply =
      "Le dépôt caveman est un plugin qui compresse les tokens de sortie des agents de code.";
    const validation = validateWebEvidenceFidelityReply(goodReply, packet);
    assert.equal(validation.valid, true);
    assert.deepEqual(validation.issues, []);
  });

  it("ne force rien sans preuves web", () => {
    const validation = validateWebEvidenceFidelityReply(
      "Je n'ai pas trouvé de source.",
      { evidence: [] },
    );
    assert.equal(validation.valid, true);
  });
});

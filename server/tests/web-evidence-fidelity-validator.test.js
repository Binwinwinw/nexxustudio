import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectsWebEvidenceDenial,
  validateWebEvidenceFidelityReply,
  extractWebSourcesFromPacket,
  isRawWebEvidenceDump,
  looksUntranslatedEnglishWebReply,
  userRequestedEnglish,
  resolveVisibleWebDelivery,
  buildWebEvidenceGroundedFallback,
} from "../src/agent/policies/web/index.js";
import { buildRawSummary } from "../src/agent/normalizers/webEvidenceNormalizer.js";

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

describe("webEvidenceFidelityValidator — pas de dump SERP", () => {
  const zorinPacket = {
    user_query: "je cherche des infos sur zorinOS",
    meta: { web_consulted_at: "2026-08-17T19:06:06.000Z" },
    evidence: [
      {
        source: "https://en.wikipedia.org/wiki/Zorin_OS",
        title: "Zorin OS - Wikipedia",
        excerpt:
          "Zorin OS is a Linux distribution based on Ubuntu which provides both free and paid versions.",
      },
      {
        source: "https://zorin.com/os/details/",
        title: "Technical details - Zorin OS",
        excerpt: "Information about currently-supported versions of Zorin OS.",
      },
      {
        source: "https://zorin.com/os/",
        title: "Zorin OS - Your computer. Better.",
        excerpt:
          "Zorin OS is the alternative to Windows and macOS designed to make your computer faster.",
      },
    ],
    expert_outputs: [
      {
        stage: "web_research",
        content: "",
      },
    ],
  };

  zorinPacket.expert_outputs[0].content = buildRawSummary(
    "zorinos overview informations",
    zorinPacket.evidence.map((e) => ({
      title: e.title,
      url: e.source,
      snippet: e.excerpt,
      confidence: 0.8,
    })),
  );

  it("détecte le packet buildRawSummary comme dump, pas comme réponse", () => {
    assert.equal(
      isRawWebEvidenceDump(zorinPacket.expert_outputs[0].content),
      true,
    );
  });

  it("remplace le dump Zorin par une synthèse FR sourcée", () => {
    const dump = zorinPacket.expert_outputs[0].content;
    const validation = validateWebEvidenceFidelityReply(dump, zorinPacket);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.includes("raw_web_evidence_dump"));
    assert.equal(isRawWebEvidenceDump(validation.sanitized), false);
    assert.match(validation.sanitized, /synthèse courte sourcée/i);
    assert.match(validation.sanitized, /wikipedia\.org\/wiki\/Zorin_OS/);
    assert.doesNotMatch(validation.sanitized, /Résultats de recherche pour/);
  });

  it("resolveVisibleWebDelivery refuse le dump avant UI", () => {
    const visible = resolveVisibleWebDelivery(
      zorinPacket.expert_outputs[0].content,
      zorinPacket,
    );
    assert.equal(isRawWebEvidenceDump(visible), false);
    assert.match(visible, /\*\*Sources\*\*/);
  });

  it("laisse une synthèse FR déjà correcte", () => {
    const good =
      "Zorin OS est une distribution Linux basée sur Ubuntu, pensée pour rester familière si tu viens de Windows ou macOS. Versions gratuite et payante.";
    const validation = validateWebEvidenceFidelityReply(good, zorinPacket);
    assert.equal(validation.valid, true);
    assert.equal(validation.sanitized, good);
  });

  it("anglais non demandé + preuves web = filet FR", () => {
    const english =
      "Zorin OS is a Linux distribution based on Ubuntu which provides both free and paid versions. It uses a GNOME and Xfce desktop environment by default, although the desktop is heavily customized.";
    assert.equal(looksUntranslatedEnglishWebReply(english, zorinPacket.user_query), true);
    const validation = validateWebEvidenceFidelityReply(english, zorinPacket);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.includes("untranslated_english_web_reply"));
    assert.match(validation.sanitized, /source\(s\) web consultée/i);
  });

  it("anglais demandé explicitement : pas le filet langue, dump toujours interdit", () => {
    const q = "je cherche des infos sur zorinOS en anglais";
    assert.equal(userRequestedEnglish(q), true);
    assert.equal(
      looksUntranslatedEnglishWebReply(
        "Zorin OS is a Linux distribution based on Ubuntu which provides both free and paid versions.",
        q,
      ),
      false,
    );
    const dumpPacket = { ...zorinPacket, user_query: q };
    const fallback = buildWebEvidenceGroundedFallback(dumpPacket, q);
    assert.match(fallback, /Short sourced summary/);
    assert.equal(isRawWebEvidenceDump(fallback), false);
  });
});

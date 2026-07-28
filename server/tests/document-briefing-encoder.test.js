import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildDocumentBriefing,
  buildDocumentBriefingFromAnalysisOnly,
  computeDocumentContentHash,
  extractKeyBlocksFromContent,
  hasReusableDocumentBriefing,
  inferDocumentKind,
  needsRawDocumentReingest,
  serializeDocumentBriefingForLlm,
} from "../src/agent/micro/continuity/documentBriefingEncoder.js";

const SAMPLE_CSS = `
body { margin: 0; padding: 0; }
.wrapper { display: flex; min-height: 100vh; }
.form { width: 50%; padding: 2rem; }
.slide-cadastro { transform: translateX(100%); }
`;

describe("documentBriefingEncoder — identité & kind", () => {
  it("calcule un hash stable et infère stylesheet", () => {
    const h1 = computeDocumentContentHash(SAMPLE_CSS);
    const h2 = computeDocumentContentHash(SAMPLE_CSS);
    assert.equal(h1, h2);
    assert.match(h1, /^sha256:/);
    assert.equal(inferDocumentKind("mon_css.css", "text/css"), "stylesheet");
  });
});

describe("documentBriefingEncoder — keyBlocks CSS", () => {
  it("extrait sélecteurs et snippets", () => {
    const blocks = extractKeyBlocksFromContent(SAMPLE_CSS, "stylesheet");
    assert.ok(blocks.length >= 3);
    assert.ok(blocks.some((b) => b.selector === ".wrapper"));
    assert.ok(blocks.some((b) => b.snippet?.includes("display: flex")));
  });
});

describe("documentBriefingEncoder — artefact complet", () => {
  it("produit un document_briefing sans stocker le blob brut", () => {
    const briefing = buildDocumentBriefing({
      fileName: "mon_css.css",
      mimeType: "text/css",
      sizeBytes: 1200,
      sourceContent: SAMPLE_CSS,
      analysisText: `## Points clés
- .wrapper : conteneur principal flex
- .form : zone formulaire`,
      analysisKind: "document_analysis",
    });

    assert.equal(briefing.filename, "mon_css.css");
    assert.equal(briefing.kind, "stylesheet");
    assert.equal(briefing.analysisRichness, "full");
    assert.ok(briefing.keyBlocks.length >= 2);
    assert.ok(briefing.summary || briefing.lastAnalysisExcerpt);
    assert.equal(briefing.followUpEligible, true);

    const serialized = serializeDocumentBriefingForLlm(briefing);
    assert.match(serialized, /ARTEFACT DE LECTURE/);
    assert.match(serialized, /mon_css.css/);
    assert.match(serialized, /\.wrapper/);
    assert.ok(
      briefing.keyBlocks.every((b) => (b.snippet?.length || 0) <= 420),
      "chaque pointeur est borné",
    );
    assert.equal("rawContent" in briefing, false);
    assert.equal("sourceContent" in briefing, false);
  });

  it("analysis_only pour repli historique", () => {
    const briefing = buildDocumentBriefingFromAnalysisOnly(
      "## Points clés\n- body: reset",
      "mon_css.css",
    );
    assert.equal(briefing.analysisRichness, "analysis_only");
    assert.ok(hasReusableDocumentBriefing(briefing));
  });
});

describe("documentBriefingEncoder — re-ingestion brute", () => {
  it("demande le brut pour citation exacte en mode analysis_only", () => {
    const briefing = buildDocumentBriefingFromAnalysisOnly("ok", "a.css");
    assert.equal(
      needsRawDocumentReingest("cite exactement le bloc .form", briefing),
      true,
    );
    assert.equal(
      needsRawDocumentReingest("propose des améliorations", briefing),
      false,
    );
  });

  it("demande le brut pour ligne par ligne", () => {
    const briefing = buildDocumentBriefing({
      fileName: "x.css",
      sourceContent: SAMPLE_CSS,
      analysisText: "ok",
    });
    assert.equal(needsRawDocumentReingest("modifie la ligne 42", briefing), true);
  });
});

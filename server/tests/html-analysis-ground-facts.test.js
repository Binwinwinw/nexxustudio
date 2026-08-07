import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  analyzeHtmlSource,
  controlHasProbableAccessibleName,
  buildHtmlAnalyzerFactsPayload,
} from "../src/agent/analysis/analyzers/htmlAnalyzer.js";
import { analyzeSourceFileContent } from "../src/agent/analysis/analyzers/index.js";
import { formatSourceFileAnalysisReply } from "../src/agent/analysis/sourceFileAnalysisContract.js";
import {
  buildHtmlAnalyzerFactsSystemAddon,
  stripContradictedHtmlHeadClaims,
  resolveHtmlAnalyzerFactsFromAttachments,
} from "../src/agent/policies/attachment/attachmentInterpretationPolicy.js";
import {
  deduplicateNearDuplicateBlocks,
} from "../src/agent/utils/qualityGuards.js";

const GOOD_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Exercices Interactifs - Initiation Teams Microsoft 365</title>
</head>
<body>
  <h1>Atelier</h1>
  <label><input type="checkbox" /> Mission 1 faite</label>
  <table><tr><th>Critère</th><td><input type="checkbox" id="c2" /></td></tr></table>
</body>
</html>`;

const BAD_HTML = `<!DOCTYPE html>
<html>
<body>
  <h1>Sans head</h1>
  <input type="checkbox" />
  <input type="checkbox" />
</body>
</html>`;

describe("HTML ground-facts + a11y nom accessible", () => {
  it("title+viewport+charset → faits positifs, pas de finding d'absence", () => {
    const report = analyzeHtmlSource(GOOD_HTML, {
      path: "atelier-teams.html",
      ext: "html",
      bytes: GOOD_HTML.length,
      lines: GOOD_HTML.split("\n").length,
    });
    assert.equal(report.facts.hasTitle, true);
    assert.equal(report.facts.hasViewport, true);
    assert.equal(report.facts.hasCharset, true);
    assert.match(report.facts.titleText || "", /Exercices Interactifs/i);
    assert.ok(report.strengths.some((s) => /title/i.test(s)));
    assert.ok(report.strengths.some((s) => /viewport/i.test(s)));
    assert.ok(!report.findings.some((f) => /title.*manquant/i.test(f.claim)));
    assert.ok(!report.findings.some((f) => /viewport.*manquant/i.test(f.claim)));
  });

  it("sans title/viewport/charset → findings négatifs", () => {
    const report = analyzeHtmlSource(BAD_HTML, {
      path: "bad.html",
      ext: "html",
      bytes: BAD_HTML.length,
      lines: 8,
    });
    assert.equal(report.facts.hasTitle, false);
    assert.equal(report.facts.hasViewport, false);
    assert.equal(report.facts.hasCharset, false);
    assert.ok(report.findings.some((f) => /title/i.test(f.claim)));
    assert.ok(report.findings.some((f) => /viewport/i.test(f.claim)));
    assert.ok(report.findings.some((f) => /charset/i.test(f.claim)));
  });

  it("checkbox sans nom accessible probable → finding ; encapsulé OK", () => {
    const bare = `<html><body><input type="checkbox" /></body></html>`;
    const wrapped = `<html><body><label><input type="checkbox" /> ok</label></body></html>`;
    const rBare = analyzeHtmlSource(bare, {
      path: "b.html",
      ext: "html",
      bytes: bare.length,
      lines: 1,
    });
    const rWrap = analyzeHtmlSource(wrapped, {
      path: "w.html",
      ext: "html",
      bytes: wrapped.length,
      lines: 1,
    });
    assert.ok(rBare.facts.accessibleNameGaps >= 1);
    assert.ok(
      rBare.findings.some((f) => /nom accessible probable/i.test(f.claim)),
    );
    assert.equal(rWrap.facts.accessibleNameGaps, 0);
  });

  it("controlHasProbableAccessibleName : for / aria / soft th", () => {
    const withFor = `<label for="x">X</label><input id="x" type="checkbox" />`;
    const idx = withFor.indexOf("<input");
    assert.equal(
      controlHasProbableAccessibleName(withFor, `<input id="x" type="checkbox" />`, idx),
      true,
    );
    const aria = `<input type="checkbox" aria-label="fait" />`;
    assert.equal(
      controlHasProbableAccessibleName(aria, aria, 0),
      true,
    );
    const table = `<table><tr><th>Critère</th><td><input type="checkbox" /></td></tr></table>`;
    const tIdx = table.indexOf("<input");
    assert.equal(
      controlHasProbableAccessibleName(
        table,
        `<input type="checkbox" />`,
        tIdx,
      ),
      true,
    );
  });

  it("strip contradictions title/viewport quand faits positifs", () => {
    const facts = buildHtmlAnalyzerFactsPayload(
      analyzeHtmlSource(GOOD_HTML, {
        path: "a.html",
        ext: "html",
        bytes: 10,
        lines: 1,
      }),
    );
    const dirty =
      "Le fichier est manquant. Il n'y a pas de balise title, ni meta viewport. Le CSS est propre.";
    const clean = stripContradictedHtmlHeadClaims(dirty, facts);
    assert.doesNotMatch(clean, /pas de balise title/i);
    assert.doesNotMatch(clean, /ni meta viewport/i);
    assert.match(clean, /CSS est propre/i);
  });

  it("addon FAITS ANALYZER interdit contradiction si title présent", () => {
    const facts = resolveHtmlAnalyzerFactsFromAttachments([
      {
        originalname: "atelier.html",
        mimetype: "text/html",
        content: GOOD_HTML,
      },
    ]);
    assert.ok(facts);
    assert.equal(facts.hasTitle, true);
    const addon = buildHtmlAnalyzerFactsSystemAddon(facts);
    assert.match(addon || "", /ne pas contredire/i);
    assert.match(addon || "", /INTERDIT.*title/i);
  });

  it("dedupe near-duplicate retire clones ; garde préfixe commun corps différent", () => {
    const clone =
      "Le document est un HTML autonome bien structuré avec trois exercices progressifs et une grille interactive complète pour Teams.";
    const duped = [clone, clone, "Section suivante distincte sur l'accessibilité des cases."].join(
      "\n\n",
    );
    const r = deduplicateNearDuplicateBlocks(duped, {
      minSimilarity: 0.93,
      minBlockLength: 40,
    });
    assert.equal(r.deduped, true);
    assert.ok(r.afterChars < r.beforeChars);

    const a =
      "Le document présente une structure claire avec des cartes d'exercices et une progression pédagogique Teams Chat.";
    const b =
      "Le document présente une structure claire mais le CSS inline nuit à la maintenance et à la cohérence visuelle globale.";
    const kept = deduplicateNearDuplicateBlocks([a, b].join("\n\n"), {
      minSimilarity: 0.93,
      minBlockLength: 40,
    });
    assert.equal(kept.deduped, false);
    assert.match(kept.text, /cartes d'exercices/i);
    assert.match(kept.text, /CSS inline/i);
  });

  it("non-régression projects/ : formatSourceFileAnalysisReply déterministe", () => {
    const { report, reply } = analyzeSourceFileContent(GOOD_HTML, {
      path: "projects/demo/atelier-teams.html",
      ext: "html",
    });
    const formatted = formatSourceFileAnalysisReply(report);
    assert.equal(reply, formatted);
    assert.match(reply, /SOURCE_FILE_ANALYSIS_V1/);
    assert.match(reply, /title/i);
    assert.match(reply, /viewport/i);
    assert.doesNotMatch(reply, /pas de balise <title>/i);
  });
});

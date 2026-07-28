import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeSourceFileContent } from "../src/agent/analysis/analyzers/index.js";
import {
  SOURCE_FILE_ANALYSIS_CONTRACT_ID,
  validateSourceFileAnalysisReport,
  REVIEW_GRADE_MINIMUMS,
} from "../src/agent/analysis/sourceFileAnalysisContract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARTINIQUE = fs.readFileSync(
  path.join(__dirname, "fixtures/martinique-communes-shell.html"),
  "utf8",
);
const DEMO_CITADELLE = fs.readFileSync(
  path.join(__dirname, "../../projects/demo-citadelle/index.html"),
  "utf8",
);

function assertReviewGrade(report) {
  const quality = validateSourceFileAnalysisReport(report);
  assert.equal(quality.ok, true, quality.failures.join(", "));
  assert.ok(report.strengths.length >= REVIEW_GRADE_MINIMUMS.strengths);
  assert.ok(report.findings.length >= REVIEW_GRADE_MINIMUMS.findings);
  assert.ok(report.unknowns.length >= REVIEW_GRADE_MINIMUMS.unknowns);
  assert.ok(report.recommendations.length >= REVIEW_GRADE_MINIMUMS.recommendations);
}

describe("SOURCE_FILE_ANALYSIS_V1", () => {
  it("HTML Martinique — points obligatoires (a11y, deps, SEO, carte)", () => {
    const { report, reply, quality } = analyzeSourceFileContent(MARTINIQUE, {
      path: "projects/fixture/martinique-communes-shell.html",
      ext: "html",
    });

    assert.equal(report.analyzer, "html");
    assertReviewGrade(report);
    assert.ok(report.findings.length >= 3);
    assert.ok(report.strengths.length >= 2);
    assert.match(reply, /SOURCE_FILE_ANALYSIS_V1/);
    assert.match(reply, /label|aria-label|accessib/i);
    assert.match(reply, /Tailwind|Bootstrap/i);
    assert.match(reply, /SEO|inject/i);
    assert.match(reply, /80vh|carte/i);
    assert.match(reply, /shell|explor/i);
    assert.match(reply, /Inconnues|limites/i);
    assert.doesNotMatch(reply, /Extrait \(début de fichier\)/);
  });

  it("HTML demo-citadelle — même profondeur review-grade que Martinique", () => {
    const { report, reply } = analyzeSourceFileContent(DEMO_CITADELLE, {
      path: "projects/demo-citadelle/index.html",
      ext: "html",
    });

    assert.equal(report.analyzer, "html");
    assert.equal(report.role, "ui_shell");
    assertReviewGrade(report);
    assert.ok(report.roleRationale?.length > 30);
    assert.match(reply, /Pourquoi ce rôle/);
    assert.match(reply, /Points solides/);
    assert.match(reply, /Problèmes \/ risques/);
    assert.match(reply, /app\.js|atelier/i);
    assert.match(reply, /Actions conseillées/);
    assert.ok(
      report.findings.length >= REVIEW_GRADE_MINIMUMS.findings,
      `findings=${report.findings.length}`,
    );
  });

  it("JS — détecte innerHTML et async", () => {
    const js = `
export async function loadCommunes() {
  const el = document.querySelector('#box');
  el.innerHTML = await fetch('/api').then(r => r.text());
}
`;
    const { report } = analyzeSourceFileContent(js, {
      path: "projects/x/app.js",
      ext: "js",
    });
    assert.equal(report.analyzer, "js");
    assert.ok(report.findings.some((f) => /innerHTML/i.test(f.claim)));
    assertReviewGrade(report);
  });

  it("YAML — signale secret en clair", () => {
    const yml = `
services:
  api:
    image: app:latest
    environment:
      api_key: super-secret-value
`;
    const { report } = analyzeSourceFileContent(yml, {
      path: "projects/x/compose.yaml",
      ext: "yaml",
    });
    assert.equal(report.analyzer, "yaml");
    assert.ok(report.findings.some((f) => /secret|api_key/i.test(f.claim)));
    assertReviewGrade(report);
  });

  it("PHP — SQL sans prepare", () => {
    const php = `<?php
$id = $_GET['id'];
mysqli_query($db, "SELECT * FROM users WHERE id=$id");
echo $id;
`;
    const { report } = analyzeSourceFileContent(php, {
      path: "projects/x/user.php",
      ext: "php",
    });
    assert.equal(report.analyzer, "php");
    assert.ok(report.findings.some((f) => /injection|prepare|SQL/i.test(f.claim)));
    assertReviewGrade(report);
  });

  it("contrat id exporté", () => {
    assert.equal(SOURCE_FILE_ANALYSIS_CONTRACT_ID, "SOURCE_FILE_ANALYSIS_V1");
  });
});

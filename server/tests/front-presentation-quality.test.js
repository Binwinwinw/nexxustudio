import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  FRONT_PRESENTATION_CONTRACT_ID,
  buildFrontPresentationQualitySystemAddon,
  buildFrontPresentationRepairUserAddon,
  validateCodeProjectLightArtifacts,
  countJsInteractionSignals,
} from "../src/agent/policies/frontendPresentationQualityContract.js";
import { buildCodeProjectLightSystemAddon } from "../src/agent/policies/codeProjectLightPolicy.js";

const CODE_PROJECT_LIGHT_CANONICAL_QUERY =
  "Crée une page HTML/CSS/JS simple pour présenter La Citadelle, enregistre les fichiers dans projects/demo-citadelle";

const STUB_FILES = {
  "index.html": `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Demo</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main><h1>Demo</h1>
  <p>Mode d'emploi : ouvre ce fichier dans le navigateur.</p>
  </main>
  <script src="app.js" defer></script>
</body>
</html>`,
  "style.css": `/* style.css — extrait ou généré par CODE_PROJECT_LIGHT */
body {
  font-family: system-ui, sans-serif;
  margin: 0;
  line-height: 1.5;
}
@media (max-width: 768px) {
  body { padding: 0.5rem; }
}
`,
  "app.js": `document.addEventListener("DOMContentLoaded", () => {
  // app.js — extrait ou généré par CODE_PROJECT_LIGHT
});
`,
};

describe("FRONT_PRESENTATION_V1", () => {
  it("addon exposé dans CODE_PROJECT_LIGHT", () => {
    const addon = buildCodeProjectLightSystemAddon(CODE_PROJECT_LIGHT_CANONICAL_QUERY);
    assert.match(addon, new RegExp(FRONT_PRESENTATION_CONTRACT_ID));
    assert.match(addon, /PASS_PRESENTATION/);
    assert.match(buildFrontPresentationQualitySystemAddon(), /anti-slop/i);
  });

  it("refuse les stubs (pass_format ou présentation)", () => {
    const result = validateCodeProjectLightArtifacts(STUB_FILES);
    assert.equal(result.quality, "fail");
    assert.ok(result.score < 70);
    assert.ok(result.reasons.length >= 1);
    assert.equal(result.checks.pedagogySlop, true);
  });

  it("repair addon cite le score et les raisons", () => {
    const quality = validateCodeProjectLightArtifacts(STUB_FILES);
    const repair = buildFrontPresentationRepairUserAddon(quality);
    assert.match(repair, /RELANCE CRITIQUE/);
    assert.match(repair, /Score actuel/);
    assert.match(repair, /pass_format=/);
  });

  it("compte les signaux d'interaction JS", () => {
    const js = `
      btn.addEventListener("click", () => {});
      toggle.addEventListener("change", () => {});
      new IntersectionObserver(() => {});
    `;
    assert.ok(countJsInteractionSignals(js) >= 3);
  });

  it("demo-citadelle enrichi passe la présentation", async () => {
    const dir = path.resolve("..", "projects", "demo-citadelle");
    const files = {
      "index.html": await fs.readFile(path.join(dir, "index.html"), "utf8"),
      "style.css": await fs.readFile(path.join(dir, "style.css"), "utf8"),
      "app.js": await fs.readFile(path.join(dir, "app.js"), "utf8"),
    };
    const result = validateCodeProjectLightArtifacts(files);
    assert.equal(result.passFormat, true);
    assert.equal(result.passPresentation, true);
    assert.equal(result.quality, "pass");
    assert.ok(result.score >= 70, `score=${result.score} reasons=${result.reasons.join("; ")}`);
  });
});

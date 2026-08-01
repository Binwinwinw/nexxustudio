import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import securityHooks from "../src/hooks/securityHooks.js";
import { DEFAULT_WORKSPACE_ROOT } from "../src/hooks/pathBoundary.js";
import {
  CODE_PROJECT_LIGHT_CONTRACT_ID,
  isCodeProjectLightRequest,
  extractCodeProjectLightSlots,
  resolveCodeProjectLightTargetDir,
  buildCodeProjectLightSystemAddon,
} from "../src/agent/policies/code/codeProjectLightPolicy.js";
import {
  extractHtmlTrioArtifacts,
  resolveHtmlTrioArtifacts,
  writeCodeProjectLightArtifacts,
  buildCodeProjectLightWriteSummary,
} from "../src/agent/policies/code/codeProjectLightWriter.js";
import { applyCodeProjectLightWrite } from "../src/agent/policies/code/codeProjectLightExecutionPolicy.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isCodeGenerationRequest } from "../src/agent/policies/code/codeDeliveryPolicy.js";
import { suppressesCodeGenerationForProgrammingPedagogy } from "../src/agent/utils/programmingPedagogyLightIntentGuards.js";

export const CODE_PROJECT_LIGHT_CANONICAL_QUERY =
  "Crée une page HTML/CSS/JS simple pour présenter La Citadelle, enregistre les fichiers dans projects/demo-citadelle";

const SAMPLE_LLM_REPLY = `Voici le trio prêt à l'emploi :

📁 index.html
\`\`\`html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>La Citadelle</title>
</head>
<body>
  <main><h1>La Citadelle</h1></main>
</body>
</html>
\`\`\`

📁 style.css
\`\`\`css
body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; }
@media (max-width: 768px) { body { padding: 0.5rem; } }
\`\`\`

📁 app.js
\`\`\`javascript
document.addEventListener("DOMContentLoaded", () => {
  console.log("La Citadelle — page prête");
});
\`\`\`
`;

describe("codeProjectLightPolicy", () => {
  it("détecte HTML/CSS/JS + enregistrement", () => {
    assert.equal(isCodeProjectLightRequest(CODE_PROJECT_LIGHT_CANONICAL_QUERY), true);
    assert.equal(suppressesCodeGenerationForProgrammingPedagogy(CODE_PROJECT_LIGHT_CANONICAL_QUERY), false);
    assert.equal(isCodeGenerationRequest(CODE_PROJECT_LIGHT_CANONICAL_QUERY), true);
  });

  it("résout le contrat CODE_PROJECT_LIGHT avant CODE_DELIVERY_V1", () => {
    const { contract } = resolveIntentContract(CODE_PROJECT_LIGHT_CANONICAL_QUERY, {});
    assert.equal(contract.id, CODE_PROJECT_LIGHT_CONTRACT_ID);
  });

  it("extrait slots et dossier cible", () => {
    const slots = extractCodeProjectLightSlots(CODE_PROJECT_LIGHT_CANONICAL_QUERY);
    assert.equal(slots.profile, "html_static_trio");
    assert.equal(slots.targetDir, "projects/demo-citadelle");
    assert.match(slots.subject || "", /citadelle/i);
  });

  it("dossier par défaut sous projects/code-project-light", () => {
    const q = "Crée une page HTML/CSS/JS pour présenter les volcans, enregistre les fichiers";
    assert.equal(
      resolveCodeProjectLightTargetDir(q, { subject: "volcans" }),
      "projects/code-project-light/volcans",
    );
  });

  it("addon impose le trio multi-fichiers", () => {
    const addon = buildCodeProjectLightSystemAddon(CODE_PROJECT_LIGHT_CANONICAL_QUERY);
    assert.match(addon, /CODE_PROJECT_LIGHT/);
    assert.match(addon, /index\.html/);
    assert.match(addon, /writeArtifact: true/i);
  });

  it("sans signal d'écriture → pas CODE_PROJECT_LIGHT", () => {
    const q = "Crée une landing page HTML pour mon produit SaaS avec hero et CTA";
    assert.equal(isCodeProjectLightRequest(q), false);
    const { contract } = resolveIntentContract(q, {});
    assert.equal(contract.id, "CODE_DELIVERY_V1");
  });
});

describe("codeProjectLightWriter", () => {
  const testDir = path.join(DEFAULT_WORKSPACE_ROOT, "projects", `_cpl-test-${process.pid}`);

  beforeEach(async () => {
    securityHooks.deactivate("/confirm");
    securityHooks.deactivate("/freeze");
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("extrait index.html / style.css / app.js depuis la réponse LLM", () => {
    const files = extractHtmlTrioArtifacts(SAMPLE_LLM_REPLY);
    assert.ok(files);
    assert.match(files["index.html"], /<!DOCTYPE html>/i);
    assert.match(files["style.css"], /@media/);
    assert.match(files["app.js"], /DOMContentLoaded/);
    assert.match(files["index.html"], /style\.css/);
    assert.match(files["index.html"], /app\.js/);
  });

  it("écrit les 3 fichiers via la gate", async () => {
    const files = extractHtmlTrioArtifacts(SAMPLE_LLM_REPLY);
    const relativeDir = path.relative(DEFAULT_WORKSPACE_ROOT, testDir).replace(/\\/g, "/");
    const result = await writeCodeProjectLightArtifacts(relativeDir, files, {
      sessionId: "cpl-test",
    });
    assert.equal(result.written.length, 3);
    const indexPath = path.join(testDir, "index.html");
    const html = await fs.readFile(indexPath, "utf8");
    assert.match(html, /La Citadelle/);
  });

  it("applyCodeProjectLightWrite append la note d'usage", async () => {
    const relativeDir = path.relative(DEFAULT_WORKSPACE_ROOT, testDir).replace(/\\/g, "/");
    const slots = extractCodeProjectLightSlots(
      `Crée une page HTML/CSS/JS simple pour présenter test, enregistre dans ${relativeDir}`,
    );
    const out = await applyCodeProjectLightWrite(CODE_PROJECT_LIGHT_CANONICAL_QUERY, SAMPLE_LLM_REPLY, {
      sessionId: "cpl-test",
      slots: { ...slots, targetDir: relativeDir },
    });
    assert.equal(out.applied, true);
    assert.match(out.reply, /Fichiers créés sur disque/);
    assert.match(out.reply, /index\.html/);
    assert.match(out.reply, /Preuve d'écriture : 3 fichier\(s\), \d+ octets, mode `trio`/);
    assert.match(out.reply, /Qualité composition/);
    assert.equal(out.quality?.passFormat, true);
    assert.doesNotMatch(out.reply, /<!DOCTYPE html>/i);
  });

  it("buildCodeProjectLightWriteSummary expose preuve d'écriture", () => {
    const summary = buildCodeProjectLightWriteSummary({
      targetDir: "projects/demo-citadelle",
      mode: "split",
      written: [
        { path: "projects/demo-citadelle/index.html", bytes: 120 },
        { path: "projects/demo-citadelle/style.css", bytes: 40 },
        { path: "projects/demo-citadelle/app.js", bytes: 30 },
      ],
    });
    assert.match(summary, /Preuve d'écriture : 3 fichier\(s\), 190 octets, mode `split`/);
    assert.match(summary, /\(120 octets\)/);
    assert.match(summary, /CSS\/JS extraits/);
  });

  it("fallback HTML monolithique → split trio + écriture", async () => {
    const monolith = `\`\`\`html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>La Citadelle</title>
  <style>body { margin: 0; }</style>
</head>
<body>
  <main><h1>La Citadelle</h1></main>
  <script>console.log("ok");</script>
</body>
</html>
\`\`\``;
    const resolved = resolveHtmlTrioArtifacts(monolith);
    assert.ok(resolved);
    assert.equal(resolved.mode, "split");
    assert.match(resolved.files["index.html"], /La Citadelle/);
    assert.match(resolved.files["style.css"], /margin:\s*0/);
    assert.match(resolved.files["app.js"], /console\.log/);
  });

  it("réponse sans HTML → message d'échec explicite", async () => {
    const out = await applyCodeProjectLightWrite(
      CODE_PROJECT_LIGHT_CANONICAL_QUERY,
      "Voici une idée de page sans aucun code.",
      { sessionId: "cpl-test-fail" },
    );
    assert.equal(out.applied, false);
    assert.equal(out.error, "trio_html_css_js_incomplete");
    assert.match(out.reply, /Enregistrement non effectué/);
  });
});

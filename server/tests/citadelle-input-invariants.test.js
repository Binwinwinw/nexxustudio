import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildTurnComprehension } from "../src/agent/policies/conversation/turnComprehension.js";

const CANON = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/governance/citadelle-input-invariants.md",
);

const REQUIRED_HEADINGS = [
  "## Invariants",
  "## Interdits",
  "## Ouverture d’un lot",
  "## Fermeture",
  "## Rouges gelés",
  "## Preuve (tests)",
  "## Anti-divergence",
  "## Maintenance",
  "## Rappel opérationnel",
];

describe("Canon Citadelle — compréhension d’input", () => {
  it("le fichier canon existe et porte les sections gouvernantes", () => {
    const text = readFileSync(CANON, "utf8");
    for (const heading of REQUIRED_HEADINGS) {
      assert.ok(text.includes(heading), `section manquante: ${heading}`);
    }
    assert.ok(text.includes("SC bonjour"), "rouge gelé SC bonjour absent du canon");
    assert.ok(text.includes("packet"), "invariant packet → copie → arrêt absent");
    assert.ok(
      text.includes("scope_guard"),
      "invariant 11 clause d’existence / scope_guard absent",
    );
  });

  it("entities : liste de champs fermée", () => {
    const tc = buildTurnComprehension("bonjour");
    assert.deepEqual(Object.keys(tc.entities).sort(), [
      "attachments",
      "localities",
      "sources",
      "subjects",
    ]);
  });
});

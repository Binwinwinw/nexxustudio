import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CODE_DIAGNOSTIC_CONTRACT_ID,
  DIAGNOSTIC_TIERS,
  parseCodeDiagnosticSections,
  hasCodeDiagnosticV1Structure,
  detectPatchFormat,
  recommendPatchStrategy,
  resolveDiagnosticTier,
  evaluateCodeDiagnosticContract,
  buildCodeDiagnosticAddon,
  PATCH_FORMAT,
} from "../src/agent/policies/code/codeDiagnosticContract.js";
import { buildCodeIntentAddon } from "../src/agent/policies/code/codeReviewPolicy.js";
import { enforceCodeErrorPriorityPipelineDelivery } from "../src/agent/policies/code/codeReviewRuntimeGuard.js";
import { CODE_INTENT_KINDS } from "../src/agent/policies/code/codeIntentPolicy.js";
import {
  CODE_REVIEW_PRODUCTION_BUG_QUERIES,
  BROKEN_CALCULATRICE_PY_SNIPPET,
} from "./fixtures/codeReviewGoldenQueries.js";

const STRICT_V1_SAMPLE = `## blockers
1. **compile-time** — Texte brut en tête (# Calculatrice manquant), doit être commenté.
2. **compile-time** — \`if name == "main"\` invalide ; requis \`__name__\`.
3. **compile-time** — Fonction \`division\` : plusieurs instructions sur une ligne.
4. **compile-time** — **indentation** : \`while True\` et \`try\` hors fonction \`calculatrice()\`.

## evidence
- **claim**: Texte brut non commenté en tête de fichier
  - **file**: calculatrice.py (snippet inline)
  - **line**: 1
  - **proof**: « Calculatrice simple » sans préfixe \`#\`

- **claim**: Garde __name__ incorrecte
  - **file**: calculatrice.py
  - **line**: fin
  - **proof**: \`if name == "main"\` au lieu de \`if __name__ == "__main__":\`

## patch
\`\`\`diff
- if name == "main": calculatrice()
+ if __name__ == "__main__":
+     calculatrice()
\`\`\`

## risks
- **logic-error**: Gestion division par zéro correcte mais message générique
- **style-warning**: PEP8 — espaces autour des opérateurs`;

const LEGACY_STRICT_SAMPLE = `Le code ne peut pas s'exécuter tel quel.

❌ Erreurs bloquantes détectées
1. Syntaxe invalide — texte brut / # Calculatrice manquant en tête
2. **compile-time** — \`if name == "main"\` au lieu de \`__name__\`
3. **compile-time** — fonction \`division\` : structure invalide sur une ligne
4. **compile-time** — **indentation** : \`while True\` et \`try\` mal imbriqués`;

describe("codeDiagnosticContract — parsing", () => {
  it("parse les 4 sections V1", () => {
    const sections = parseCodeDiagnosticSections(STRICT_V1_SAMPLE);
    assert.ok(sections.blockers?.body);
    assert.ok(sections.evidence?.body);
    assert.ok(sections.patch?.body);
    assert.ok(sections.risks?.body);
    assert.match(sections.blockers.body, /compile-time/);
  });

  it("détecte la structure V1", () => {
    assert.equal(hasCodeDiagnosticV1Structure(STRICT_V1_SAMPLE), true);
    assert.equal(hasCodeDiagnosticV1Structure(LEGACY_STRICT_SAMPLE), false);
  });

  it("détecte unified diff et bloc complet", () => {
    const diffPatch = "```diff\n- old\n+ new\n```";
    assert.equal(detectPatchFormat(diffPatch).format, PATCH_FORMAT.UNIFIED_DIFF);

    const blockPatch = "```python\ndef foo():\n    return 1\n```";
    assert.equal(detectPatchFormat(blockPatch).format, PATCH_FORMAT.FULL_BLOCK);
  });

  it("recommande bloc complet si changements adjacents lourds", () => {
    const rec = recommendPatchStrategy({ adjacentHeavy: true });
    assert.equal(rec.preferred, PATCH_FORMAT.FULL_BLOCK);
  });
});

describe("codeDiagnosticContract — tiers", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("résout tier strict pour revue/debug", () => {
    assert.equal(resolveDiagnosticTier(scenario.query), DIAGNOSTIC_TIERS.STRICT);
    const debugQ = `Debug ce code Python — pourquoi ça ne s'exécute pas :\n${BROKEN_CALCULATRICE_PY_SNIPPET}`;
    assert.equal(resolveDiagnosticTier(debugQ), DIAGNOSTIC_TIERS.STRICT);
  });

  it("résout tier explain et refactor", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
    assert.equal(resolveDiagnosticTier(explainQ), DIAGNOSTIC_TIERS.EXPLAIN);

    const refactorQ =
      "Refactorise ce code Python sans changer le comportement :\ndef f(x):return x+1";
    assert.equal(resolveDiagnosticTier(refactorQ), DIAGNOSTIC_TIERS.REFACTOR);
  });
});

describe("codeDiagnosticContract — validation", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("accepte V1 strict conforme", () => {
    const evalResult = evaluateCodeDiagnosticContract({
      query: scenario.query,
      response: STRICT_V1_SAMPLE,
    });
    assert.equal(evalResult.ok, true);
    assert.equal(evalResult.format, "v1");
    assert.equal(evalResult.tier, DIAGNOSTIC_TIERS.STRICT);
  });

  it("accepte legacy strict si ouverture bloquante", () => {
    const evalResult = evaluateCodeDiagnosticContract({
      query: scenario.query,
      response: LEGACY_STRICT_SAMPLE,
    });
    assert.equal(evalResult.ok, true);
    assert.equal(evalResult.format, "legacy");
    assert.equal(evalResult.skipped, true);
  });

  it("rejette V1 sans preuve dans evidence", () => {
    const bad = `## blockers
1. **compile-time** — Syntaxe invalide

## evidence
- observation sans preuve structurée

## patch
\`\`\`python
pass
\`\`\`

## risks
- style`;
    const evalResult = evaluateCodeDiagnosticContract({
      query: scenario.query,
      response: bad,
    });
    assert.equal(evalResult.ok, false);
    assert.ok(evalResult.failures.some((f) => f.id === "evidenceWithoutProof"));
  });

  it("explain exige patch si défaut compile détecté", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nif name == 'main': pass";
    const noPatch = `## evidence
- **claim**: __name__ incorrect
  - **file**: snippet
  - **line**: 2
  - **proof**: if name au lieu de __name__

## blockers
1. **compile-time** — __name__ invalide`;
    const evalResult = evaluateCodeDiagnosticContract({
      query: explainQ,
      response: noPatch,
    });
    assert.equal(evalResult.ok, false);
    assert.ok(evalResult.failures.some((f) => f.id === "explainPatchRequired"));
  });

  it("refactor exige risks régression avant style", () => {
    const refactorQ =
      "Refactorise ce code Python sans changer le comportement :\ndef f(x):return x+1";
    const badRisks = `## evidence
- **claim**: fonction monoligne
  - **file**: snippet
  - **line**: 1
  - **proof**: return sur même ligne que def

## patch
\`\`\`python
def f(x):
    return x + 1
\`\`\`

## risks
- **style-warning**: PEP8 d'abord
- **logic-error**: risque de régression sur les types`;
    const evalResult = evaluateCodeDiagnosticContract({
      query: refactorQ,
      response: badRisks,
    });
    assert.equal(evalResult.ok, false);
    assert.ok(evalResult.failures.some((f) => f.id === "risksOrder"));
  });
});

describe("codeDiagnosticContract — intégration prompt et pipeline", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("injecte CODE_DIAGNOSTIC_V1 dans buildCodeIntentAddon", () => {
    const addon = buildCodeIntentAddon(scenario.query);
    assert.match(addon, new RegExp(CODE_DIAGNOSTIC_CONTRACT_ID));
    assert.match(addon, /## blockers/);
    assert.match(addon, /## evidence/);
  });

  it("pipeline laisse passer legacy conforme", () => {
    const delivery = enforceCodeErrorPriorityPipelineDelivery(
      scenario.query,
      LEGACY_STRICT_SAMPLE,
    );
    assert.equal(delivery.ok, true);
    assert.equal(delivery.action, "passed");
  });

  it("pipeline laisse passer V1 conforme", () => {
    const delivery = enforceCodeErrorPriorityPipelineDelivery(
      scenario.query,
      STRICT_V1_SAMPLE,
    );
    assert.equal(delivery.ok, true);
    assert.equal(delivery.action, "passed");
  });

  it("pipeline — audit sécu HTML joint : V1 kind/runtime + evidence numérotée OK", () => {
    const query =
      "fait un audit securité et code review le fichier joint à la conversation";
    const htmlV1 = `## blockers
1. kind: runtime-critical | file: [DOCUMENT #1] index.html | XSS via innerHTML non échappé
2. kind: runtime-critical | file: [DOCUMENT #1] index.html | document.write avec entrée utilisateur
3. kind: style-warning | file: [DOCUMENT #1] index.html | scripts inline sans nonce CSP

## evidence
1. claim: XSS reflected
   - file: index.html
   - line: 42
   - proof: innerHTML = location.search
2. claim: document.write
   - file: index.html
   - line: 55
   - proof: document.write(userInput)

## patch
\`\`\`diff
- el.innerHTML = location.search
+ el.textContent = location.search
\`\`\`

## risks
- logic-error: sanitization partielle possible`;
    const delivery = enforceCodeErrorPriorityPipelineDelivery(query, htmlV1, {
      attachments: [{ originalname: "index.html", mimetype: "text/html" }],
    });
    assert.equal(
      delivery.ok,
      true,
      delivery.failures?.map((f) => f.reason).join("; "),
    );
    assert.equal(delivery.action, "passed");
  });

  it("pipeline bloque réponse non conforme (sentinelles ou diagnostic)", () => {
    const bad = `## blockers
1. **compile-time** — Syntaxe invalide

## evidence
- **claim**: bug
  - **file**: a.py
  - **line**: 1
  - **proof**: py_compile failure

## risks
- logic`;
    const delivery = enforceCodeErrorPriorityPipelineDelivery(scenario.query, bad);
    assert.equal(delivery.ok, false);
    assert.equal(delivery.action, "blocked");
    assert.match(delivery.delivered, /CODE_REVIEW_V1_1|CODE_DIAGNOSTIC_V1/);
  });

  it("buildCodeDiagnosticAddon couvre explain", () => {
    const explainQ =
      "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))";
    const addon = buildCodeDiagnosticAddon(explainQ);
    assert.match(addon, /EXPLAIN/);
    assert.match(addon, /patch/);
  });
});

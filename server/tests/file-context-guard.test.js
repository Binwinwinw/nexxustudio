import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFileContextInventory,
  extractFilePathsFromText,
  findHallucinatedFileReferences,
  evaluateFileContextGuard,
  enforceFileContextGuard,
  buildFileContextGuardAddon,
  buildMissingFileClarification,
  isPlausibleFileBasename,
  isConcreteGroundedResponse,
} from "../src/agent/policies/fileContextGuard.js";
import { BROKEN_CALCULATRICE_PY_SNIPPET } from "./fixtures/codeReviewGoldenQueries.js";

describe("fileContextGuard", () => {
  const calculatriceQuery = `analyse le code suivant c'est du python :\n${BROKEN_CALCULATRICE_PY_SNIPPET}`;

  it("extrait les chemins de fichiers cités", () => {
    const paths = extractFilePathsFromText(
      "Dans utils.py ligne 42 et src/app/main.js, le bug est visible.",
    );
    assert.ok(paths.includes("utils.py"));
    assert.ok(paths.includes("main.js"));
  });

  it("inventorie les pièces jointes et le snippet inline", () => {
    const inventory = buildFileContextInventory({
      query: calculatriceQuery,
      attachments: [{ originalname: "note.md" }],
    });
    assert.equal(inventory.hasInlineCode, true);
    assert.ok(inventory.files.some((f) => f.id === "note.md"));
    assert.ok(inventory.allowGenericReferences);
  });

  it("autorise les citations vers fichiers connus", () => {
    const inventory = buildFileContextInventory({
      query: "analyse calculatrice.py",
      attachments: [{ originalname: "calculatrice.py" }],
    });
    const violations = findHallucinatedFileReferences(
      "Erreur dans calculatrice.py ligne 12.",
      inventory,
    );
    assert.deepEqual(violations, []);
  });

  it("bloque une citation vers utils.py non fourni", () => {
    const result = evaluateFileContextGuard({
      query: calculatriceQuery,
      response:
        "Dans utils.py ligne 42, la variable name est incorrecte. Corriger __name__.",
      attachments: [],
    });
    assert.equal(result.ok, false);
    assert.equal(result.action, "blocked");
    assert.ok(result.violations.some((v) => v.file === "utils.py"));
  });

  it("laisse passer une réponse ancrée sur le snippet sans fichier inventé", () => {
    const result = evaluateFileContextGuard({
      query: calculatriceQuery,
      response:
        "Le snippet fourni contient une erreur : `if name == \"main\"` au lieu de `__name__`.",
      attachments: [],
    });
    assert.equal(result.ok, true);
  });

  it("enforceFileContextGuard remplace par un message explicite", () => {
    const enforced = enforceFileContextGuard({
      query: calculatriceQuery,
      response: "Voir config/settings.py pour le détail.",
    });
    assert.equal(enforced.blocked, true);
    assert.match(enforced.delivered, /je ne peux pas affirmer/i);
    assert.match(enforced.delivered, /settings\.py/);
  });

  it("produit un modificateur prompt listant les sources", () => {
    const inventory = buildFileContextInventory({
      query: calculatriceQuery,
      attachmentRefs: [{ name: "rapport.pdf" }],
    });
    const addon = buildFileContextGuardAddon(inventory);
    assert.match(addon, /FILE_CONTEXT_GUARD_V1/);
    assert.match(addon, /snippet fourni/i);
  });

  it("buildMissingFileClarification cite les fichiers manquants", () => {
    const inventory = buildFileContextInventory({ query: "revue code" });
    const msg = buildMissingFileClarification([{ file: "utils.py" }], inventory);
    assert.match(msg, /utils\.py/);
    assert.match(msg, /joindre le fichier/i);
  });

  it("rejette les faux positifs d'extension seule (.ts)", () => {
    assert.equal(isPlausibleFileBasename(".ts"), false);
    assert.equal(isPlausibleFileBasename("IA-SETUP.md"), true);
    const paths = extractFilePathsFromText(
      "Voir les fichiers (.ts) et IA-SETUP.md dans le guide.",
    );
    assert.ok(paths.includes("IA-SETUP.md"));
    assert.equal(paths.includes(".ts"), false);
  });

  it("analyse DOCUMENT concrète + PJ : soft note, pas refus full-block", () => {
    const analysis =
      "Analyse du fichier AGENTS.md\n\n" +
      "1. Type : guide d'orchestration pour agents IA.\n" +
      "2. Points clés : priorités sécurité, redirection IDE, docs/agents.\n" +
      "3. Propositions d'amélioration : clarifier les contrats de sortie, " +
      "ajouter un index des skills, et renvoyer vers IA-SETUP.md pour le boot.\n" +
      "4. Structure recommandée : mission, priorités, redirections, archive.\n";
    const inventory = buildFileContextInventory({
      query: "Analyse le fichier joint et propose un contenu amélioré",
      attachments: [{ originalname: "AGENTS.md" }],
    });
    assert.equal(isConcreteGroundedResponse(analysis, inventory), true);

    const enforced = enforceFileContextGuard({
      query: "Analyse le fichier joint et propose un contenu amélioré",
      response: analysis,
      attachments: [{ originalname: "AGENTS.md" }],
    });
    assert.equal(enforced.blocked, false);
    assert.equal(enforced.softened, true);
    assert.match(enforced.delivered, /Analyse du fichier AGENTS\.md/);
    assert.match(enforced.delivered, /Propositions d'amélioration/);
    assert.match(enforced.delivered, /IA-SETUP\.md/);
    assert.match(enforced.delivered, /Note : références hors pièces jointes/i);
    assert.doesNotMatch(enforced.delivered, /je ne peux pas affirmer l'existence/i);
  });

  it("citation inventée courte sans analyse → refus full-block inchangé", () => {
    const enforced = enforceFileContextGuard({
      query: calculatriceQuery,
      response: "Voir config/settings.py pour le détail.",
    });
    assert.equal(enforced.blocked, true);
    assert.match(enforced.delivered, /je ne peux pas affirmer/i);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveShortRetryQuery } from "../src/services/webSearchService.js";

const LONG_BRIEF =
  "Je suis responsable marketing d'une startup de streaming indépendante et nous préparons un dossier de présentation pour une levée de fonds de série A. Pourriez-vous effectuer une recherche sur l'état actuel du marché du streaming avec sources web et rapport professionnel.";

describe("webSearch — retry query courte après VQD", () => {
  it("propose une query courte après Failed to get the VQD", () => {
    const retry = resolveShortRetryQuery(LONG_BRIEF, {
      message: `Failed to get the VQD for query "${LONG_BRIEF.slice(0, 80)}..."`,
    });
    assert.ok(retry);
    assert.ok(retry.length < LONG_BRIEF.length);
    assert.ok(retry.length <= 120);
    assert.match(retry, /Series A|streaming/i);
  });

  it("ne retry pas sur erreur non-VQD / non-réseau", () => {
    assert.equal(
      resolveShortRetryQuery(LONG_BRIEF, { message: "invalid schema" }),
      null,
    );
  });

  it("ne retry pas si query déjà courte", () => {
    assert.equal(
      resolveShortRetryQuery("streaming Series A 2026", {
        message: "Failed to get the VQD",
      }),
      null,
    );
  });
});

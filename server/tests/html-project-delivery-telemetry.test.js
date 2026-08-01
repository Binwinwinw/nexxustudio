import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHtmlProjectTelemetryEvent,
  shortenHtmlProjectProfile,
} from "../src/agent/telemetry/htmlProjectDeliveryTelemetry.js";
import { HTML_PROJECT_THRESHOLDS } from "../src/agent/policies/delivery/index.js";

const NOTION_QUERY =
  "sais tu créer un atelier d'initiation à l'application NOTION sous forme de fichier html avec header sidebar sur les différents thèmes comme menus?";

describe("htmlProjectDeliveryTelemetry", () => {
  it("expose les champs de télémétrie recommandés", () => {
    const event = buildHtmlProjectTelemetryEvent(NOTION_QUERY);
    assert.equal(event.html_project_detected, true);
    assert.equal(event.strategy, "build_v1");
    assert.equal(event.profile, "workshop");
    assert.equal(event.clarification_count, 0);
    assert.equal(event.fallback_used, false);
    assert.equal(event.retry_used, false);
    assert.equal(event.thresholds.veryVagueMaxLength, HTML_PROJECT_THRESHOLDS.veryVagueMaxLength);
  });

  it("enregistre quality_violation et fallback quand fournis", () => {
    const event = buildHtmlProjectTelemetryEvent(NOTION_QUERY, {
      qualityViolation: true,
      fallbackUsed: true,
      retryUsed: true,
      composerPath: "composer_retry_fallback",
      responseChars: 1200,
    });
    assert.equal(event.quality_violation, true);
    assert.equal(event.fallback_used, true);
    assert.equal(event.retry_used, true);
    assert.equal(event.composer_path, "composer_retry_fallback");
    assert.equal(event.response_chars, 1200);
  });

  it("raccourcit les profils pour les logs", () => {
    assert.equal(shortenHtmlProjectProfile("html_landing"), "landing");
    assert.equal(shortenHtmlProjectProfile("html_workshop"), "workshop");
  });
});

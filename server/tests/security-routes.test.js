import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateTelemetryFeedback } from "../src/security/sessionMiddleware.js";
import { canAccessProductionJob } from "../src/security/productionJobAccess.js";

describe("validateTelemetryFeedback", () => {
  it("rejette un payload sans sessionId", () => {
    const result = validateTelemetryFeedback({ score: 5, comment: "ok" });
    assert.equal(result.ok, false);
  });

  it("rejette un score hors plage", () => {
    const result = validateTelemetryFeedback({
      sessionId: "sess-1",
      score: 9,
      comment: "x",
    });
    assert.equal(result.ok, false);
  });

  it("accepte un payload valide et tronque le commentaire", () => {
    const result = validateTelemetryFeedback({
      sessionId: "  sess-1  ",
      score: 4.7,
      comment: "  bien  ",
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.sessionId, "sess-1");
    assert.equal(result.data.score, 5);
    assert.equal(result.data.comment, "bien");
  });
});

describe("canAccessProductionJob", () => {
  it("refuse l'accès si le browserId ne correspond pas", () => {
    const job = { browserId: "browser-owner" };
    assert.equal(canAccessProductionJob(job, "browser-owner"), true);
    assert.equal(canAccessProductionJob(job, "browser-intrus"), false);
    assert.equal(canAccessProductionJob(null, "browser-owner"), false);
  });
});

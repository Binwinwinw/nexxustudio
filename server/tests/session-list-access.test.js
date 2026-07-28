import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveEffectiveOwner,
  isSessionAccessibleForBrowser,
} from "../src/services/sessionAccessRules.js";
import {
  getSessionListCache,
  setSessionListCache,
  invalidateSessionListCache,
  clearSessionListCache,
  SESSION_LIST_CACHE_TTL_MS,
} from "../src/services/sessionListCache.js";

describe("sessionAccessRules", () => {
  const now = new Date("2026-06-03T12:00:00Z");
  const browserA = "browser-a";
  const browserB = "browser-b";

  it("session sans verrou → accessible", () => {
    assert.equal(resolveEffectiveOwner(null, null, now), null);
    assert.equal(
      isSessionAccessibleForBrowser(null, null, browserA, now),
      true,
    );
  });

  it("verrou expiré → accessible", () => {
    const expired = new Date("2026-06-03T11:00:00Z");
    assert.equal(resolveEffectiveOwner(browserB, expired, now), null);
    assert.equal(
      isSessionAccessibleForBrowser(browserB, expired, browserA, now),
      true,
    );
  });

  it("verrou actif autre navigateur → refus", () => {
    const future = new Date("2026-06-03T13:00:00Z");
    assert.equal(resolveEffectiveOwner(browserB, future, now), browserB);
    assert.equal(
      isSessionAccessibleForBrowser(browserB, future, browserA, now),
      false,
    );
  });

  it("verrou actif même navigateur → accessible", () => {
    const future = new Date("2026-06-03T13:00:00Z");
    assert.equal(
      isSessionAccessibleForBrowser(browserA, future, browserA, now),
      true,
    );
  });
});

describe("sessionListCache", () => {
  it("hit / miss / invalidate", () => {
    clearSessionListCache();
    const bid = "test-browser";
    assert.equal(getSessionListCache(bid), null);
    setSessionListCache(bid, [{ id: "s1" }]);
    assert.deepEqual(getSessionListCache(bid), [{ id: "s1" }]);
    invalidateSessionListCache(bid);
    assert.equal(getSessionListCache(bid), null);
    assert.equal(SESSION_LIST_CACHE_TTL_MS, 10_000);
  });
});

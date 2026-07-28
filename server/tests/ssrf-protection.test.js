import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkUrlSsrf,
  validateResolvedAddresses,
  validateEgressUrl,
} from "../src/security/ssrfProtection.js";

describe("ssrfProtection — sync", () => {
  it("bloque loopback 127.0.0.1", () => {
    const r = checkUrlSsrf("http://127.0.0.1:3000/admin");
    assert.equal(r.blocked, true);
    assert.match(r.reason, /loopback/i);
  });

  it("bloque RFC 1918 192.168.x", () => {
    const r = checkUrlSsrf("https://192.168.1.50/internal");
    assert.equal(r.blocked, true);
    assert.match(r.reason, /private|loopback/i);
  });

  it("bloque link-local 169.254.x", () => {
    const r = checkUrlSsrf("http://169.254.169.254/latest/meta-data/");
    assert.equal(r.blocked, true);
  });

  it("bloque cloud metadata hostname", () => {
    const r = checkUrlSsrf("http://metadata.google.internal/computeMetadata/v1/");
    assert.equal(r.blocked, true);
  });

  it("accepte URL publique bien formée (sync)", () => {
    const r = checkUrlSsrf("https://fr.wikipedia.org/wiki/Test");
    assert.equal(r.blocked, false);
    assert.equal(r.hostname, "fr.wikipedia.org");
  });
});

describe("ssrfProtection — DNS", () => {
  it("résout example.com ou fail-closed si DNS indisponible", async () => {
    const r = await validateResolvedAddresses("example.com");
    if (r.reason === "dns_resolution_failed" || r.reason === "dns_empty") {
      assert.equal(r.blocked, true);
      return;
    }
    assert.equal(r.blocked, false);
    assert.ok(r.addresses?.length > 0);
  });

  it("validateEgressUrl bloque localhost avant fetch", async () => {
    const r = await validateEgressUrl("http://127.0.0.1/secret");
    assert.equal(r.blocked, true);
  });
});

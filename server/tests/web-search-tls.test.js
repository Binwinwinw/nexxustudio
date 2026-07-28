import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isWebSearchTlsStrict } from "../src/services/webSearchTls.js";

describe("webSearchTls — politique dev/prod", () => {
  it("strict en production par défaut", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.WEB_SEARCH_ALLOW_INSECURE_SSL;
    delete process.env.WEB_SEARCH_STRICT_SSL;
    assert.equal(isWebSearchTlsStrict(), true);
    process.env.NODE_ENV = prev;
  });

  it("assoupli en dev par défaut", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    delete process.env.WEB_SEARCH_STRICT_SSL;
    assert.equal(isWebSearchTlsStrict(), false);
    process.env.NODE_ENV = prev;
  });
});

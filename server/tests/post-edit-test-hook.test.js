import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSensitiveTestPath,
  shouldRunPostEditTests,
  getPostEditTestMode,
} from "../src/hooks/postEdit/testRunner.js";
import { POST_HOOK_REGISTRY } from "../src/hooks/postEdit/postEditHook.js";
import { HOOK_POLICY_VERSION } from "../src/hooks/hookRegistry.js";

describe("postEditTestHook — ciblage", () => {
  it("chemins sensibles détectés", () => {
    assert.equal(isSensitiveTestPath("src/components/App.jsx"), true);
    assert.equal(isSensitiveTestPath("lib/utils.test.ts"), true);
    assert.equal(isSensitiveTestPath("docs/readme.md"), false);
  });

  it("mode targeted sans /test-required", () => {
    const state = { isActive: () => false };
    assert.equal(getPostEditTestMode(state), "targeted");
    assert.equal(shouldRunPostEditTests("src/foo.js", state), true);
    assert.equal(shouldRunPostEditTests("docs/note.txt", state), false);
  });

  it("mode full avec /test-required", () => {
    const state = { isActive: (cmd) => cmd === "/test-required" };
    assert.equal(getPostEditTestMode(state), "full");
    assert.equal(shouldRunPostEditTests("docs/note.txt", state), true);
  });

  it("POST_EDIT_TESTS=off désactive les tests", () => {
    process.env.POST_EDIT_TESTS = "off";
    assert.equal(shouldRunPostEditTests("src/foo.js", { isActive: () => false }), false);
    process.env.POST_EDIT_TESTS = "targeted";
  });
});

describe("postEditTestHook — registre", () => {
  it("POST_HOOK_REGISTRY documente syntax + tests", () => {
    const ids = POST_HOOK_REGISTRY.map((h) => h.id);
    assert.ok(ids.includes("postEditSyntaxHook"));
    assert.ok(ids.includes("postEditTestHook"));
    assert.equal(HOOK_POLICY_VERSION, "1.2.0");
  });
});

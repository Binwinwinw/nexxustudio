import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SETTINGS_NAV_ITEMS,
  SETTINGS_VIEW_IDS,
  isSettingsChild,
  PRIMARY_NAV_SECTIONS,
} from "./citadelleNav.js";
import { CITADELLE_VIEWS } from "../context/citadelleViews.js";

describe("citadelleNav", () => {
  it("SETTINGS_VIEW_IDS couvre les 7 modules avancés", () => {
    assert.equal(SETTINGS_NAV_ITEMS.length, 7);
    assert.equal(SETTINGS_VIEW_IDS.size, 7);
    assert.ok(isSettingsChild(CITADELLE_VIEWS.GOVERNANCE));
    assert.ok(isSettingsChild(CITADELLE_VIEWS.FORGE_ASYNC));
    assert.equal(isSettingsChild(CITADELLE_VIEWS.CHAT), false);
  });

  it("PRIMARY_NAV — Cockpit et Télémétrie seulement en Opérations", () => {
    const ops = PRIMARY_NAV_SECTIONS.find((s) => s.title === "Opérations");
    assert.equal(ops?.items.length, 2);
    assert.deepEqual(
      ops.items.map((i) => i.id),
      [CITADELLE_VIEWS.COCKPIT, CITADELLE_VIEWS.TELEMETRY],
    );
  });
});

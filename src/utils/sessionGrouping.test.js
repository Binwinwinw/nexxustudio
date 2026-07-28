import assert from "node:assert/strict";
import {
  groupSessions,
  filterSessions,
  isDefaultSessionTitle,
  getSessionDisplayTitle,
} from "./sessionGrouping.js";

const sample = [
  { id: "1", title: "Mon analyse API", timestamp: 1000, preview: "explique l'api" },
  { id: "2", title: "Nouveau Projet", timestamp: 3000, preview: "bonjour citadelle" },
  { id: "3", title: "Projet Nexxus", timestamp: 2000, preview: null },
  { id: "4", title: "Nouveau Projet", timestamp: 1500, preview: "salut" },
];

assert.equal(isDefaultSessionTitle("Nouveau Projet"), true);
assert.equal(isDefaultSessionTitle("Mon analyse API"), false);

const filtered = filterSessions(sample, "bonjour");
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, "2");

const groups = groupSessions(sample);
assert.equal(groups.length, 2);
assert.equal(groups[0].id, "named");
assert.equal(groups[0].sessions.length, 1);
assert.equal(groups[1].id, "default");
assert.equal(groups[1].sessions.length, 3);
assert.equal(groups[1].sessions[0].id, "2");

assert.equal(
  getSessionDisplayTitle({ title: "Nouveau Projet", preview: "bonjour citadelle" }),
  "bonjour citadelle",
);
assert.equal(getSessionDisplayTitle({ title: "Mon API", preview: null }), "Mon API");

console.log("sessionGrouping.test.js — OK");

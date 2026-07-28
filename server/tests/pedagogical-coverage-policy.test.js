import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parsePedagogicalOverview } from "../src/agent/utils/pedagogicalOverviewIntentGuards.js";
import {
  COVERAGE_TIERS,
  PEDAGOGICAL_DISCIPLINE_INDEX,
  resolveExpectedCoverageTier,
  summarizePedagogicalCoverageRegistry,
} from "../src/agent/policies/pedagogicalCoverageRegistry.js";
import {
  PEDAGOGICAL_DELIVERY_MODES,
  PEDAGOGICAL_PROVENANCE,
  resolvePedagogicalCoverage,
} from "../src/agent/policies/pedagogicalCoveragePolicy.js";
import { resolvePedagogicalOverviewShortCircuit } from "../src/agent/micro/replies/pedagogicalOverviewComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const FRACTIONS_6E =
  "que dois apprendre un élève de 6eme sur les fractions simples ?";
const FRACTIONS_4E =
  "que dois apprendre un élève de 4eme sur les fractions complexes ?";
const HISTOIRE_6E =
  "que doit apprendre un élève de 6e en histoire de France ?";
const LICENCE_ANALYSE =
  "que doit apprendre un étudiant en licence de maths sur l'analyse réelle ?";

describe("pedagogicalCoveragePolicy — décision durable", () => {
  it("fractions 6e → local_deterministic / local_kb", () => {
    const slots = parsePedagogicalOverview(FRACTIONS_6E);
    const cov = resolvePedagogicalCoverage(FRACTIONS_6E, slots);
    assert.equal(cov.mode, PEDAGOGICAL_DELIVERY_MODES.LOCAL_DETERMINISTIC);
    assert.equal(cov.provenance, PEDAGOGICAL_PROVENANCE.LOCAL_KB);
  });

  it("fractions 4e → local_deterministic distinct du 6e", () => {
    const slots = parsePedagogicalOverview(FRACTIONS_4E);
    const cov = resolvePedagogicalCoverage(FRACTIONS_4E, slots);
    assert.equal(cov.mode, PEDAGOGICAL_DELIVERY_MODES.LOCAL_DETERMINISTIC);
  });

  it("histoire 6e → local_generative (famille hors KB)", () => {
    const slots = parsePedagogicalOverview(HISTOIRE_6E);
    const cov = resolvePedagogicalCoverage(HISTOIRE_6E, slots);
    assert.equal(cov.mode, PEDAGOGICAL_DELIVERY_MODES.LOCAL_GENERATIVE);
    assert.equal(cov.provenance, PEDAGOGICAL_PROVENANCE.LOCAL_LLM);
  });

  it("licence / supérieur → web_rag_grounded", () => {
    const slots = parsePedagogicalOverview(LICENCE_ANALYSE);
    assert.equal(slots?.educationBand, "superieur");
    const cov = resolvePedagogicalCoverage(LICENCE_ANALYSE, slots);
    assert.equal(cov.mode, PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED);
    assert.equal(cov.reason, "superieur_out_of_local_kb");
  });

  it("short-circuit histoire → pedagogical_overview sans fiche figée", () => {
    const hit = resolvePedagogicalOverviewShortCircuit(HISTOIRE_6E);
    assert.equal(hit?.path, "pedagogical_overview");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.reply, undefined);
    assert.equal(hit?.coverage?.mode, PEDAGOGICAL_DELIVERY_MODES.LOCAL_GENERATIVE);
  });

  it("short-circuit licence → pedagogical_overview_web + defer full", () => {
    const hit = resolvePedagogicalOverviewShortCircuit(LICENCE_ANALYSE);
    assert.equal(hit?.path, "pedagogical_overview_web");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.match(hit?.reflectiveHint || "", /web\/RAG|sources/i);
  });

  it("intentShortCircuit propage deferToFullPipeline pour le supérieur", async () => {
    const hit = await runConversationShortCircuit(LICENCE_ANALYSE);
    assert.equal(hit?.path, "pedagogical_overview_web");
    assert.equal(hit?.deferToFullPipeline, true);
  });

  it("géométrie seconde → local_generative, jamais module collège", () => {
    const q = "que doit apprendre un élève de seconde en géométrie";
    const slots = parsePedagogicalOverview(q);
    const cov = resolvePedagogicalCoverage(q, slots);
    assert.equal(cov.mode, PEDAGOGICAL_DELIVERY_MODES.LOCAL_GENERATIVE);
    assert.equal(cov.reason, "stable_family_pending_kb_module");
  });
});

describe("pedagogicalCoverageRegistry — gouvernance discipline × niveau", () => {
  it("fractions college 6e → kb_deterministic dans le registre", () => {
    assert.equal(
      resolveExpectedCoverageTier("fractions", "6", "college"),
      COVERAGE_TIERS.KB_DETERMINISTIC,
    );
  });

  it("geometrie 5e → kb_deterministic, 4e encore generative", () => {
    assert.equal(
      resolveExpectedCoverageTier("geometrie", "5", "college"),
      COVERAGE_TIERS.KB_DETERMINISTIC,
    );
    assert.equal(
      resolveExpectedCoverageTier("geometrie", "4", "college"),
      COVERAGE_TIERS.FAMILY_GENERATIVE,
    );
  });

  it("discipline index couvre maths et francais", () => {
    assert.ok(PEDAGOGICAL_DISCIPLINE_INDEX.maths.topics.includes("fractions"));
    assert.ok(PEDAGOGICAL_DISCIPLINE_INDEX.francais.topics.includes("conjugaison"));
  });

  it("summarize expose les niveaux KB sans toucher au routeur", () => {
    const summary = summarizePedagogicalCoverageRegistry();
    const fractions = summary.find((row) => row.topic === "fractions");
    assert.deepEqual(fractions?.kbLevels.sort(), ["3", "4", "5", "6"]);
    const geometrie = summary.find((row) => row.topic === "geometrie");
    assert.deepEqual(geometrie?.kbLevels, ["5"]);
  });
});

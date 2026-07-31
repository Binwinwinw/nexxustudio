import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATH_GEOMETRY_CANONICAL_RECTANGLE_QUERY,
  MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY,
  MATH_GEOMETRY_CANONICAL_RECTANGLE_DIMENSIONS_QUERY,
  MATH_GEOMETRY_CANONICAL_RECTANGLE_FORMULA_QUERY,
  MATH_GEOMETRY_KINDS,
  MATH_GEOMETRY_OPERATIONS,
  MATH_GEOMETRY_SHAPES,
  buildMathGeometryReply,
  extractMathGeometryIntent,
  isMathGeometryReplyCoherent,
  isMathGeometryRequest,
  isMathGeometrySatisfiable,
  normalizeMathGeometryQuery,
  parseMathGeometryTask,
  resolveMathGeometryShortCircuit,
} from "../src/agent/policies/math/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { analyzeConversationIntentFrame } from "../src/agent/policies/conversationIntentFrame.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

describe("mathGeometryPolicy — G21.1 extraction operation × shape", () => {
  it("normalise air → aire pour rectangle", () => {
    const q = normalizeMathGeometryQuery(MATH_GEOMETRY_CANONICAL_RECTANGLE_QUERY);
    assert.match(q, /aire d un rectangle/);
    assert.doesNotMatch(q, /\bair d un rectangle\b/);
  });

  it("extract — rectangle + aire", () => {
    const intent = extractMathGeometryIntent(MATH_GEOMETRY_CANONICAL_RECTANGLE_QUERY);
    assert.deepEqual(intent, {
      operation: MATH_GEOMETRY_OPERATIONS.AREA,
      shape: MATH_GEOMETRY_SHAPES.RECTANGLE,
      dimensions: null,
    });
  });

  it("extract — rectangle + périmètre (salutation composite)", () => {
    const intent = extractMathGeometryIntent(MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY);
    assert.deepEqual(intent, {
      operation: MATH_GEOMETRY_OPERATIONS.PERIMETER,
      shape: MATH_GEOMETRY_SHAPES.RECTANGLE,
      dimensions: null,
    });
  });

  it("parse — formule aire sans dimensions", () => {
    const task = parseMathGeometryTask(MATH_GEOMETRY_CANONICAL_RECTANGLE_FORMULA_QUERY);
    assert.ok(task);
    assert.equal(task.kind, MATH_GEOMETRY_KINDS.RECTANGLE_AREA_FORMULA);
    assert.equal(task.operation, MATH_GEOMETRY_OPERATIONS.AREA);
  });

  it("parse — calcul aire 5 cm × 3 cm", () => {
    const task = parseMathGeometryTask(MATH_GEOMETRY_CANONICAL_RECTANGLE_DIMENSIONS_QUERY);
    assert.ok(task);
    assert.equal(task.kind, MATH_GEOMETRY_KINDS.RECTANGLE_AREA_COMPUTED);
    assert.deepEqual(task.dimensions, { length: 5, width: 3, unit: "cm" });
  });

  it("parse — périmètre rectangle sans dimensions", () => {
    const task = parseMathGeometryTask(MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY);
    assert.ok(task);
    assert.equal(task.kind, MATH_GEOMETRY_KINDS.RECTANGLE_PERIMETER_FORMULA);
    assert.equal(task.operation, MATH_GEOMETRY_OPERATIONS.PERIMETER);
  });
});

describe("mathGeometryPolicy — G21.1 matrice operation × shape", () => {
  const matrix = [
    {
      query: MATH_GEOMETRY_CANONICAL_RECTANGLE_FORMULA_QUERY,
      expectKind: MATH_GEOMETRY_KINDS.RECTANGLE_AREA_FORMULA,
      expectInReply: /longueur\s*×\s*largeur/i,
      expectNotInReply: /périmètre|perimetre/i,
    },
    {
      query: MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY,
      expectKind: MATH_GEOMETRY_KINDS.RECTANGLE_PERIMETER_FORMULA,
      expectInReply: /périmètre|perimetre/i,
      expectNotInReply: /\bl['']?aire\b/i,
    },
    {
      query: "Donne la formule pour l'aire d'un carré",
      expectKind: MATH_GEOMETRY_KINDS.SQUARE_AREA_FORMULA,
      expectInReply: /carré|cote|côté/i,
      expectNotInReply: /périmètre/i,
    },
    {
      query: "Donne la formule pour le périmètre d'un carré",
      expectKind: MATH_GEOMETRY_KINDS.SQUARE_PERIMETER_FORMULA,
      expectInReply: /périmètre|perimetre/i,
      expectNotInReply: /\bl['']?aire\b/i,
    },
    {
      query: "Donne la circonférence d'un cercle",
      expectKind: MATH_GEOMETRY_KINDS.CIRCLE_CIRCUMFERENCE_FORMULA,
      expectInReply: /circonférence|circonference/i,
      expectNotInReply: /\bl['']?aire\b/i,
    },
  ];

  for (const row of matrix) {
    it(`matrice — ${row.expectKind}`, () => {
      const task = parseMathGeometryTask(row.query);
      assert.equal(task?.kind, row.expectKind);
      const reply = buildMathGeometryReply(task);
      assert.match(reply, row.expectInReply);
      assert.doesNotMatch(reply, row.expectNotInReply);
      assert.equal(isMathGeometryReplyCoherent(row.query, reply), true);
    });
  }

  it("buildMathGeometryReply — aire 15 cm²", () => {
    const task = parseMathGeometryTask(MATH_GEOMETRY_CANONICAL_RECTANGLE_DIMENSIONS_QUERY);
    const reply = buildMathGeometryReply(task);
    assert.match(reply, /15\s*cm²/);
  });

  it("buildMathGeometryReply — périmètre 5 cm × 3 cm → 16 cm", () => {
    const task = parseMathGeometryTask(
      "Calcule le périmètre d'un rectangle de 5 cm par 3 cm",
    );
    assert.equal(task.kind, MATH_GEOMETRY_KINDS.RECTANGLE_PERIMETER_COMPUTED);
    const reply = buildMathGeometryReply(task);
    assert.match(reply, /16\s*cm/);
    assert.match(reply, /périmètre|perimetre/i);
    assert.doesNotMatch(reply, /\bl['']?aire\b/i);
  });

  it("canonical G21 typo — pas de refus générique", () => {
    const hit = resolveMathGeometryShortCircuit(MATH_GEOMETRY_CANONICAL_RECTANGLE_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "math_geometry_deterministic");
    assert.match(hit.reply, /aire|longueur\s*×\s*largeur/i);
    assert.notEqual(hit.reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });
});

describe("mathGeometryPolicy — intégration short-circuit + clarification", () => {
  it("short-circuit G21 aire → math_geometry_deterministic", async () => {
    const hit = await runConversationShortCircuit(MATH_GEOMETRY_CANONICAL_RECTANGLE_QUERY);
    assert.equal(hit?.path, "math_geometry_deterministic");
    assert.match(hit?.reply || "", /longueur\s*×\s*largeur/i);
    assert.doesNotMatch(hit?.reply || "", /cadrer un projet/i);
  });

  it("short-circuit G21.1 périmètre → réponse périmètre (pas aire)", async () => {
    const hit = await runConversationShortCircuit(MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY);
    assert.equal(hit?.path, "math_geometry_deterministic");
    assert.match(hit?.reply || "", /périmètre|perimetre/i);
    assert.doesNotMatch(hit?.reply || "", /\bl['']?aire\b/i);
    assert.doesNotMatch(hit?.reply || "", /cadrer un projet/i);
  });

  it("clarification gate → can_answer_now (math_geometry)", () => {
    const evaluation = evaluateJustIntent(MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY);
    const decision = evaluateClarificationDecision(
      MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY,
      evaluation,
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("math_geometry"));
    assert.equal(isMathGeometrySatisfiable(MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY), true);
  });

  it("intent frame — pas socialOnly sur périmètre", () => {
    const frame = analyzeConversationIntentFrame(MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY);
    assert.equal(frame.socialOnly, false);
    assert.equal(frame.task.present, true);
  });
});

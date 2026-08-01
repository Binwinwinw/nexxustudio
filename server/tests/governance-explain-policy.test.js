import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  GOVERNANCE_EXPLAIN_CANONICAL_PERIMETER_G29_QUERY,
  buildGovernanceExplainReply,
  detectGovernanceExplainIntent,
  isGovernanceExplainRequest,
  parseGovernanceExplainTask,
  refineSegmentsForGovernance,
} from "../src/agent/policies/meta/governanceExplainPolicy.js";
import {
  understandQuery,
  resolveQueryCompositeShortCircuit,
} from "../src/agent/policies/conversationQueryUnderstanding.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("governanceExplainPolicy — G29.1 détection", () => {
  it("détecte En une phrase G29", () => {
    assert.equal(
      isGovernanceExplainRequest("En une phrase G29 ne demande plus à Nexxus de deviner"),
      true,
    );
    const task = parseGovernanceExplainTask("En une phrase G29 ne demande plus à Nexxus de deviner");
    assert.equal(task.lotId, "G29");
  });

  it("détecte segment continuation doctrine", () => {
    assert.equal(
      isGovernanceExplainRequest(
        "il lui impose de les lire, les planifier et les nommer, et il fournit des métriques",
      ),
      true,
    );
  });

  it("buildGovernanceExplainReply — one-liner G29", () => {
    const reply = buildGovernanceExplainReply({ lotId: "G29", kind: "governance_one_liner" });
    assert.match(reply, /G29/);
    assert.match(reply, /plan d'exécution|plan d execution/i);
    assert.match(reply, /écart mesurable|ecart mesurable/i);
  });

  it("refineSegmentsForGovernance — sépare math et G29", () => {
    const refined = refineSegmentsForGovernance([
      "bonjour calcule le périmètre d'un rectangle ?? En une phrase G29 ne demande plus",
    ]);
    assert.equal(refined.length, 2);
    assert.match(refined[0], /périmètre|perimetre/i);
    assert.match(refined[1], /En une phrase G29/i);
  });
});

describe("governanceExplainPolicy — G29.1 requête utilisateur périmètre + G29", () => {
  it("understandQuery — multi_intent math + governance", () => {
    const u = understandQuery(GOVERNANCE_EXPLAIN_CANONICAL_PERIMETER_G29_QUERY);
    assert.equal(u.intentMode, "multi_intent");
    assert.ok(u.workIntentCount >= 2);
    assert.ok(u.domains.includes("math"));
    assert.ok(u.domains.includes("governance"));
    assert.equal(u.unqualifiedSegmentCount, 0);
  });

  it("resolveQueryCompositeShortCircuit — deux sections", () => {
    const hit = resolveQueryCompositeShortCircuit(GOVERNANCE_EXPLAIN_CANONICAL_PERIMETER_G29_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "query_composite_deterministic");
    assert.match(hit.reply, /périmètre|perimetre/i);
    assert.match(hit.reply, /G29/);
    assert.match(hit.reply, /écart mesurable|ecart mesurable/i);
  });

  it("short-circuit — composite prime sur math_geometry seul", async () => {
    const hit = await runConversationShortCircuit(GOVERNANCE_EXPLAIN_CANONICAL_PERIMETER_G29_QUERY);
    assert.equal(hit?.path, "query_composite_deterministic");
    assert.match(hit?.reply || "", /périmètre|perimetre/i);
    assert.match(hit?.reply || "", /G29/);
  });
});

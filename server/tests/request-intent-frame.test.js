import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  analyzeRequestIntentFrame,
  detectTaskKind,
  resolveFamilyHint,
  projectFrameToJustIntentHints,
  compareJustIntentToFrameHints,
  REQUEST_INTENT_FRAME_VERSION,
} from "../src/agent/policies/intent/requestIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";

describe("requestIntentFrame — axes métier v1.1", () => {
  it("expose la version du contrat", () => {
    assert.equal(REQUEST_INTENT_FRAME_VERSION, "1.1");
  });

  const familyCases = [
    {
      query: "creer des fiches de revisions afin maitriser react",
      taskKind: "learn",
      family: "technical_learning_path",
      domain: "technical",
    },
    {
      query: "explique Redis",
      taskKind: "explain",
      family: "technical_overview",
      domain: "technical",
    },
    {
      query: "comment devenir développeur web en reconversion",
      taskKind: "career_path",
      family: "career_learning_path",
      domain: "career",
    },
    {
      query: "Comment fonctionne HTTP/2 ?",
      taskKind: "explain",
      family: "technical_overview",
      domain: "technical",
    },
  ];

  for (const { query, taskKind, family, domain } of familyCases) {
    it(`frame métier: ${family} — ${query.slice(0, 40)}`, () => {
      const frame = analyzeRequestIntentFrame(query);
      assert.equal(frame.version, "1.1");
      assert.equal(frame.conversation.socialOnly, false);
      assert.equal(detectTaskKind(query), taskKind);
      assert.equal(frame.task.kind, taskKind);
      assert.equal(frame.domain.kind, domain);
      assert.equal(frame.familyHint?.id, family);
      assert.equal(frame.familyHint?.confidence, "high");
      assert.equal(frame.needsClarification, false);
    });
  }

  it("social pur — pas de familyHint métier", () => {
    const frame = analyzeRequestIntentFrame("yop comment ça va là dedans ?");
    assert.equal(frame.conversation.socialOnly, true);
    assert.equal(frame.task.kind, null);
    assert.equal(frame.familyHint, null);
    assert.equal(frame.domain.kind, "social");
  });

  it("composite — task.kind prioritaire sur social", () => {
    const q = "salut, tu peux m'aider sur React ?";
    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.composite, true);
    assert.equal(frame.conversation.socialOnly, false);
    assert.equal(frame.task.kind, "explain");
    assert.equal(frame.familyHint?.id, "technical_overview");
  });

  it("projection justIntent depuis le frame", () => {
    const frame = analyzeRequestIntentFrame("creer des fiches pour maitriser nodejs");
    const hints = projectFrameToJustIntentHints(frame);
    assert.equal(hints?.action, "plan");
    assert.equal(hints?.domain, "technical");
    assert.equal(hints?.preemptFamily, "technical_learning_path");
  });

  it("frontière learn vs explain — maîtriser vs c'est quoi", () => {
    const learn = resolveFamilyHint("je veux maitriser docker");
    const explain = resolveFamilyHint("c est quoi docker");
    assert.equal(learn?.id, "technical_learning_path");
    assert.equal(explain?.id, "technical_overview");
  });

  it("frontière learn vs career — stack vs métier", () => {
    const learn = resolveFamilyHint("plan d apprentissage pour maitriser python");
    const career = resolveFamilyHint("parcours pour devenir data analyst");
    assert.equal(learn?.id, "technical_learning_path");
    assert.equal(career?.id, "career_learning_path");
  });

  it("alignement frame.familyHint ↔ short-circuit path (échantillon)", async () => {
    const pairs = [
      {
        query: "explique Redis",
        path: "technical_overview",
      },
      {
        query: "creer des fiches pour maitriser react",
        path: "technical_learning_path",
      },
      {
        query: "comment devenir développeur web",
        path: "career_learning_path",
      },
    ];

    for (const { query, path } of pairs) {
      const frame = analyzeRequestIntentFrame(query);
      const hit = await runConversationShortCircuit(query);
      assert.equal(frame.familyHint?.id, path, query);
      assert.equal(hit?.path, path, query);
    }
  });
});

describe("compareJustIntentToFrameHints — shadow P1", () => {
  it("technical vs general + explain = vocab_mismatch (JUST n'a pas technical)", () => {
    const cmp = compareJustIntentToFrameHints(
      { domain: "general", action: "explain" },
      { domain: "technical", action: "explain" },
    );
    assert.equal(cmp.compatible, true);
    assert.equal(cmp.reason, "vocab_mismatch");
  });

  it("technical vs code + plan = vocab_mismatch (compatible)", () => {
    const cmp = compareJustIntentToFrameHints(
      { domain: "code", action: "plan" },
      { domain: "technical", action: "plan" },
    );
    assert.equal(cmp.compatible, true);
    assert.equal(cmp.reason, "vocab_mismatch");
  });

  it("explain exact = match", () => {
    const cmp = compareJustIntentToFrameHints(
      { domain: "general", action: "explain" },
      { domain: "general", action: "explain" },
    );
    assert.equal(cmp.compatible, true);
    assert.equal(cmp.reason, "match");
  });

  it("general vs writing + plan = compatible", () => {
    const cmp = compareJustIntentToFrameHints(
      { domain: "writing", action: "plan" },
      { domain: "general", action: "plan" },
    );
    assert.equal(cmp.compatible, true);
    assert.equal(cmp.reason, "compatible");
  });

  it("pas de hint = no_hint, pas une divergence", () => {
    const cmp = compareJustIntentToFrameHints({ domain: "code", action: "review" }, null);
    assert.equal(cmp.compatible, null);
    assert.equal(cmp.reason, "no_hint");
  });

  it("social pur + JUST social = compatible", () => {
    const frame = analyzeRequestIntentFrame("yop comment ça va là dedans ?");
    const hints = projectFrameToJustIntentHints(frame);
    assert.equal(hints, null);
    const cmp = compareJustIntentToFrameHints(
      { domain: "social", action: "social_checkin" },
      hints,
      frame,
    );
    assert.equal(cmp.compatible, true);
    assert.equal(cmp.reason, "compatible");
  });

  it("frame work + JUST social = social_vs_work", () => {
    const frame = analyzeRequestIntentFrame("explique Redis");
    const hints = projectFrameToJustIntentHints(frame);
    const cmp = compareJustIntentToFrameHints(
      { domain: "social", action: "social_checkin" },
      hints,
      frame,
    );
    assert.equal(cmp.compatible, false);
    assert.equal(cmp.reason, "social_vs_work");
  });

  it("plan vs create = action_mismatch", () => {
    const cmp = compareJustIntentToFrameHints(
      { domain: "code", action: "create" },
      { domain: "technical", action: "plan" },
    );
    assert.equal(cmp.compatible, false);
    assert.equal(cmp.reason, "action_mismatch");
  });

  it("jeu canonique frame : zéro social_vs_work", () => {
    const queries = [
      "creer des fiches de revisions afin maitriser react",
      "explique Redis",
      "comment devenir développeur web en reconversion",
      "yop comment ça va là dedans ?",
      "salut, tu peux m'aider sur React ?",
    ];
    for (const query of queries) {
      const frame = analyzeRequestIntentFrame(query);
      const hints = projectFrameToJustIntentHints(frame);
      const just = hints
        ? { domain: hints.domain === "technical" ? "code" : "general", action: hints.action }
        : { domain: "social", action: "social_checkin" };
      const cmp = compareJustIntentToFrameHints(just, hints, frame);
      assert.notEqual(cmp.reason, "social_vs_work", query);
    }
  });

  it("jeu canonique + JUST réel : zéro social_vs_work (garde consume)", () => {
    const queries = [
      "creer des fiches de revisions afin maitriser react",
      "explique Redis",
      "comment devenir développeur web en reconversion",
      "yop comment ça va là dedans ?",
    ];
    for (const query of queries) {
      const frame = analyzeRequestIntentFrame(query);
      const hints = projectFrameToJustIntentHints(frame);
      const just = evaluateJustIntent(query);
      const cmp = compareJustIntentToFrameHints(just, hints, frame);
      assert.notEqual(cmp.reason, "social_vs_work", `${query} → ${just.domain}/${just.action}`);
    }
  });
});

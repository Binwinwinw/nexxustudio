import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildSocialPatternReply,
  classifySocialPattern,
  isKnownSocialPattern,
  isPhaticSocialCheckinIntent,
  resolveSocialPatternShortCircuit,
  SOCIAL_PATTERN_BLOCKED_PATHS,
} from "../src/agent/policies/social/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
  resolveClarificationGate,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import {
  evaluateJustIntent,
  isSimpleFactualQuestion,
  resolveIntentDomain,
} from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { shouldAllowClarifyThenBuild } from "../src/agent/utils/deliverableMandateGuards.js";
import { isConversationSocialOnlyQuery } from "../src/agent/policies/intent/conversationIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isGeneralKnowledgeRequest } from "../src/agent/utils/generalKnowledgeIntentGuards.js";
import { classifyMetaConversationIntent } from "../src/agent/utils/metaConversationIntentGuards.js";
import { INTENT_DOMAINS } from "../../shared/justIntentCatalog.js";

const CONVERSATION_CASES = [
  {
    query: "d'accord alors qu'est ce qu'on peut faire aujourd'hui??",
    patternName: "social/open_prompt",
    mustNotClarify: true,
    mustNotFactual: true,
  },
  {
    query: "alors qu'est-ce qu'on pourrait faire aujourd'hui?",
    patternName: "social/open_prompt",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotHeavyPipeline: true,
  },
  {
    // Forme correcte, sans ancre temporelle
    query: "qu'est-ce qu'on pourrait faire??",
    patternName: "social/open_prompt",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotHeavyPipeline: true,
  },
  {
    // Faute courante pourrais ≠ pourrait — même rail social
    query: "qu'est-ce qu'on pourrais faire??",
    patternName: "social/open_prompt",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotHeavyPipeline: true,
  },
  {
    query: "tu veux faire quoi maintenant ?",
    patternName: "social/meta_who_drives",
    mustNotClarify: true,
    mustNotFactual: true,
  },
  {
    query: "je veux faire quoi maintenant ??",
    patternName: "social/meta_who_drives",
    mustNotClarify: true,
    mustNotFactual: true,
  },
  {
    query: "est-ce que tu as faim???",
    patternName: "social/anthropomorphic_checkin",
    mustNotClarify: true,
    mustNotFactual: true,
  },
  {
    query: "ben je ne sais pas tout va bien de mon côté aussi",
    patternName: "social/casual_status",
    mustNotClarify: true,
    mustNotFactual: true,
  },
  {
    query: "qu'est ce que tu fais de beau ???",
    patternName: "social/phatic_checkin",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotGeneralKnowledge: true,
  },
  {
    query: "tu fais quoi de beau",
    patternName: "social/phatic_checkin",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotGeneralKnowledge: true,
  },
  {
    query: "qu'est-ce que tu fais de bon ???",
    patternName: "social/phatic_checkin",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotGeneralKnowledge: true,
  },
  {
    query: "salut salut qu'est-ce que tu fais de bon ?",
    patternName: "social/phatic_checkin",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotGeneralKnowledge: true,
    mustNotHeavyPipeline: true,
  },
  {
    query: "qu'est-ce que tu fais de chouette",
    patternName: "social/phatic_checkin",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotGeneralKnowledge: true,
  },
  {
    query: "bah on discute un peu avant di tu veux bien",
    patternName: "social/chat_invite",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotHeavyPipeline: true,
  },
  {
    query: "ben on va papoter pour le moment",
    patternName: "social/chat_invite",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotHeavyPipeline: true,
  },
  {
    query: "j'ai mal au ventre qu'est ce que tu peux faire pour cela ?",
    patternName: "social/personal_discomfort",
    mustNotClarify: true,
    mustNotFactual: true,
    // GK / méta capability peuvent encore scorer — le short-circuit social prime.
  },
  {
    query: "j'ai fais caca bleu tu saurais d'ou ca peut venir ?",
    patternName: "social/personal_discomfort",
    mustNotClarify: true,
    mustNotFactual: true,
  },
  {
    query: "j'ai pipi au lit d'ou ça peut venir ?",
    patternName: "social/personal_discomfort",
    mustNotClarify: true,
    mustNotFactual: true,
  },
  {
    query: "je crois que je vais aller m'asseoir sur une branche",
    patternName: "social/whimsical_pivot",
    mustNotClarify: true,
    mustNotFactual: true,
    mustNotHeavyPipeline: true,
  },
];

describe("G35 open_prompt — JUST social + variantes", () => {
  it("open_prompt → domain social / build_v1, pas clarify_then_build", () => {
    const q = "alors qu'est-ce qu'on pourrait faire aujourd'hui?";
    assert.equal(resolveIntentDomain(q), INTENT_DOMAINS.SOCIAL);
    const just = evaluateJustIntent(q);
    assert.equal(just.domain, INTENT_DOMAINS.SOCIAL);
    assert.equal(just.strategy, "build_v1");
    assert.notEqual(just.strategy, "clarify_then_build");
  });

  it("idéation « comme projet » ≠ open_prompt social", () => {
    const q = "on pourrait faire quoi comme projet";
    assert.equal(classifySocialPattern(q), null);
    assert.notEqual(resolveIntentDomain(q), INTENT_DOMAINS.SOCIAL);
  });

  it("panel open_prompt a des variantes (pas une fiche unique)", () => {
    const replies = new Set(
      Array.from({ length: 12 }, (_, i) =>
        buildSocialPatternReply("social/open_prompt", `salt-${i}-variante`),
      ),
    );
    assert.ok(replies.size >= 2, `variantes attendues, got ${replies.size}`);
    for (const reply of replies) {
      assert.match(
        reply,
        /discussion libre|brainstorm|recherch|livrable|apprendre/i,
      );
      assert.match(reply, /Choisis un numéro et on se lance/);
      assert.match(reply, /\n\n1\.\s+discussion libre/);
      assert.match(reply, /\n5\.\s+apprendre un sujet\n/);
      assert.doesNotMatch(reply, /objectif principal|format que tu attends/i);
    }
  });
});

describe("G35 social_pattern_hardening — classification", () => {
  for (const item of CONVERSATION_CASES) {
    it(`classifie « ${item.query.slice(0, 40)}… » → ${item.patternName}`, () => {
      const hit = classifySocialPattern(item.query);
      assert.ok(hit, `pattern attendu pour: ${item.query}`);
      assert.equal(hit.patternName, item.patternName);
      assert.ok(hit.reply.length > 20);
      assert.equal(isKnownSocialPattern(item.query), true);
      assert.equal(isConversationSocialOnlyQuery(item.query), true);
    });
  }

  it("ne confond pas une demande de création concrète", () => {
    assert.equal(
      isKnownSocialPattern("crée un agent python pour analyser mon code"),
      false,
    );
    assert.equal(
      classifySocialPattern("fais moi un script json pour l'api"),
      null,
    );
    assert.equal(
      isPhaticSocialCheckinIntent("qu'est-ce que tu fais pour corriger ce bug"),
      false,
    );
  });

  it("bloque les chemins génériques toxiques", () => {
    const hit = resolveSocialPatternShortCircuit("est-ce que tu as faim ?");
    assert.equal(hit?.path, "social_deterministic");
    assert.ok(hit?.blockedPaths.includes("clarification_gate"));
    assert.ok(hit?.blockedPaths.includes("simple_factual_lookup"));
    assert.deepEqual(hit?.blockedPaths, [...SOCIAL_PATTERN_BLOCKED_PATHS]);
  });
});

describe("G35 social_pattern_hardening — clarification gate", () => {
  for (const item of CONVERSATION_CASES.filter((c) => c.mustNotClarify)) {
    it(`pas de clarification_gate pour « ${item.query.slice(0, 35)}… »`, () => {
      const evaluation = evaluateJustIntent(item.query);
      const decision = evaluateClarificationDecision(item.query, evaluation);
      assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
      assert.ok(
        decision.signals.includes("social_pattern_hardening_g35") ||
          decision.signals.includes("open_exploration_frame"),
        `signal attendu g35|open_exploration_frame, got ${decision.signals.join(",")}`,
      );

      const gate = resolveClarificationGate(item.query, { justIntent: evaluation });
      assert.equal(gate.shouldClarify, false);
      assert.equal(shouldAllowClarifyThenBuild(item.query, evaluation), false);
    });
  }
});

describe("G35 social_pattern_hardening — short-circuit", () => {
  for (const item of CONVERSATION_CASES) {
    it(`short-circuit social pour « ${item.query.slice(0, 35)}… »`, async () => {
      const hit = await runConversationShortCircuit(item.query);
      assert.ok(hit, `short-circuit attendu: ${item.query}`);
      assert.equal(hit.path, "social_deterministic");
      assert.equal(hit.socialPatternName, item.patternName);
      assert.ok(hit.reply);
      assert.doesNotMatch(hit.reply, /objectif principal/i);
      assert.doesNotMatch(hit.reply, /Grace Ly/i);
      assert.doesNotMatch(hit.reply, /agent principal/i);
      if (item.patternName !== "social/mood_checkin") {
        assert.doesNotMatch(hit.reply, /orchestration/i);
      }
      assert.doesNotMatch(hit.reply, /handoff exploitable|vers la Forge/i);
    });
  }

  for (const item of CONVERSATION_CASES.filter((c) => c.mustNotFactual)) {
    it(`pas simple_factual_lookup pour « ${item.query.slice(0, 35)}… »`, () => {
      assert.equal(isSimpleFactualQuestion(item.query), false);
    });
  }

  for (const item of CONVERSATION_CASES.filter((c) => c.mustNotGeneralKnowledge)) {
    it(`pas culture générale pour « ${item.query.slice(0, 35)}… »`, () => {
      assert.equal(isGeneralKnowledgeRequest(item.query), false);
    });
  }

  for (const item of CONVERSATION_CASES.filter((c) => c.mustNotHeavyPipeline)) {
    it(`pas méta-conversation lourde pour « ${item.query.slice(0, 35)}… »`, () => {
      assert.equal(classifyMetaConversationIntent(item.query), null);
    });
  }
});

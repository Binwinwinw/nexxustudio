/**
 * Batterie d'ambiguïté IntentFrame — doc + régression sur les cas stables.
 * Voir docs/agents/intent-families-philosophy.md § IntentFrame + scripts/run-intent-frame-battery.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { analyzeRequestIntentFrame } from "../src/agent/policies/intent/requestIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { resolveClarificationGate } from "../src/agent/policies/clarificationDecisionPolicy.js";
import { resolveSessionContextReference } from "../src/agent/utils/sessionContextReferenceResolver.js";

/** @typedef {{ id: number|string, query: string, expect: Record<string, unknown>, status: 'stable'|'gap'|'frame_bug' }} BatteryCase */

const STABLE_BATTERY = [
  {
    id: 1,
    query: "Salut, tu peux m'aider à comprendre les hooks en React ?",
    expect: {
      composite: true,
      taskKind: "learn",
      familyHint: "technical_learning_path",
      path: "technical_learning_path",
    },
  },
  {
    id: 2,
    query: "C'est quoi React en quelques mots ?",
    expect: {
      taskKind: "explain",
      familyHint: "technical_overview",
      path: "technical_overview",
    },
  },
  {
    id: 4,
    query: "Je veux devenir développeur front-end, par quoi je commence ?",
    expect: {
      taskKind: "career_path",
      familyHint: "career_learning_path",
      path: "career_learning_path",
    },
  },
  {
    id: 6,
    query: "Donne-moi un plan pour apprendre Redis étape par étape.",
    expect: {
      taskKind: "learn",
      familyHint: "technical_learning_path",
      path: "technical_learning_path",
    },
  },
  {
    id: "6b",
    query: "C'est quoi Redis et à quoi ça sert ?",
    expect: {
      taskKind: "explain",
      familyHint: "technical_overview",
      path: "technical_overview",
    },
  },
  {
    id: 7,
    query: "Comment ça se passe niveau perf chez toi en ce moment ?",
    expect: {
      socialOnly: true,
      path: "social_deterministic",
    },
  },
  {
    id: 9,
    query: "Salut, je veux un plan pour apprendre React pour trouver un job.",
    expect: {
      composite: true,
      socialOnly: false,
      taskKind: "learn",
      familyHint: "technical_learning_path",
      path: "technical_learning_path",
      secondaryGoal: "career",
    },
  },
  {
    id: 11,
    query: "salut je cherche des infos sur teams 365",
    expect: {
      composite: true,
      socialOnly: false,
      taskKind: "explain",
      pathNot: "social_deterministic",
    },
  },
  {
    id: 12,
    query: "je cherche des informations sur teams 365",
    expect: {
      socialOnly: false,
      taskKind: "explain",
      clarify: false,
    },
  },
  {
    id: 13,
    query: "pour un apprentissage du poker que me conseillerais-tu",
    expect: {
      taskKind: "learn",
      pathNot: "compare_choose",
    },
  },
  {
    id: 14,
    query: "quelles informations aurais tu du jeu kingofavalon",
    expect: {
      taskKind: "explain",
      path: "information_seeking_full_pipeline",
      pathNot: "simple_factual_lookup",
    },
  },
  {
    id: 15,
    query: "quelles informations aurais tu sur le tigre",
    expect: {
      taskKind: "explain",
      path: "information_seeking_full_pipeline",
      pathNot: "familiarity_deterministic",
    },
  },
  {
    id: 16,
    query: "que sais tu du monument Taj Mahal",
    expect: {
      taskKind: "explain",
      path: "general_knowledge_full_pipeline",
      pathNot: "familiarity_deterministic",
    },
  },
  {
    id: 17,
    query: "quelles informations aurais tu sur le kimono",
    expect: {
      taskKind: "explain",
      path: "information_seeking_full_pipeline",
    },
  },
  {
    id: 18,
    query: "infos sur le kimono",
    expect: {
      taskKind: "explain",
      path: "information_seeking_full_pipeline",
    },
  },
  {
    id: "G21",
    query: "tu peux m'aider à calculer l'air d'un rectangle ??",
    expect: {
      socialOnly: false,
      path: "math_geometry_deterministic",
      pathNot: "multi_segment_composite",
      clarify: false,
    },
  },
  {
    id: 19,
    query: "traduis ce texte en anglais : Bonjour, comment allez-vous ?",
    expect: {
      taskKind: "translate",
      path: "translation_pipeline",
      pathNot: "social_deterministic",
      socialOnly: false,
      clarify: false,
    },
  },
  {
    id: 20,
    query: "la phrase précédente mais en allemand",
    history: [
      {
        role: "user",
        content:
          "je veux traduire la phrase suivante en espagnol : Suivez la progression de votre enfant en toute sérénité",
      },
      {
        role: "assistant",
        content: "Sigue el progreso de tu hijo/a con toda tranquilidad",
      },
    ],
    expect: {
      taskKind: "translate",
      path: "translation_pipeline",
      pathNot: "repeated_fallback_refusal",
      socialOnly: false,
      clarify: false,
    },
  },
  {
    id: 21,
    query: "tu te rappelles de kingofavalon",
    history: [
      {
        role: "user",
        content: "quelles informations aurais tu du jeu kingofavalon",
      },
      {
        role: "assistant",
        content: "King of Avalon est un jeu de stratégie mobile.",
      },
    ],
    enrichedQuery: "quelles informations aurais tu du jeu kingofavalon",
    expect: {
      path: "information_seeking_full_pipeline",
      socialOnly: false,
      clarify: false,
    },
  },
  {
    id: 22,
    query: "tu te rappelles de Docker",
    history: [
      {
        role: "user",
        content: "quelles informations aurais tu du jeu kingofavalon",
      },
      {
        role: "assistant",
        content: "King of Avalon est un jeu de stratégie mobile.",
      },
    ],
    expectResolved: false,
    expectPath: "context_reference_not_found",
  },
  {
    id: 23,
    query: "reprends ce qu'on disait sur le kimono",
    history: [
      { role: "user", content: "infos sur le kimono" },
      {
        role: "assistant",
        content: "Le kimono est un vêtement traditionnel japonais.",
      },
    ],
    enrichedQuery: "infos sur le kimono",
    expect: {
      path: "information_seeking_full_pipeline",
      socialOnly: false,
      clarify: false,
    },
  },
];

/** Cas documentés — échecs attendus tant que v1.2/v1.3 non livrés. */
const KNOWN_GAPS = [
  {
    id: 3,
    query: "Explique-moi les fractions pour un élève de 6e.",
    gap: "pedagogical_overview absent du frame v1.1 ; guard exige shell pédagogique, pas « explique-moi »",
    targetFamily: "pedagogical_overview",
  },
  {
    id: 5,
    query: "Mon composant React se re-render tout le temps, tu peux m'expliquer pourquoi ?",
    gap: "task.kind debug absent ; symptôme incident → technical_overview",
    targetFamily: "debug_diagnostic",
  },
  {
    id: 8,
    query: "J'ai 12 ans, explique-moi JavaScript simplement.",
    gap: "âge explicite non reconnu par beginner guard ; → technical_overview",
    targetFamily: "beginner_topic_overview",
  },
  {
    id: 10,
    query: "Tu trouves pas que tout le monde parle trop de IA en ce moment ?",
    gap: "pas d'axe discussion/opinion ; null → pipeline LLM",
    targetFamily: null,
  },
];

describe("IntentFrame — batterie d'ambiguïté (cas stables v1.1)", () => {
  for (const item of STABLE_BATTERY) {
    it(`#${item.id} frame ↔ path cohérents`, async () => {
      if (item.expectResolved === false) {
        const ctx = resolveSessionContextReference(item.query, item.history || []);
        assert.equal(ctx.resolved, false, item.query);
        if (item.expectPath === "context_reference_not_found") {
          assert.match(ctx.notFoundMessage, /Docker/i);
        }
        return;
      }

      const ctx = resolveSessionContextReference(item.query, item.history || []);
      const effectiveQuery =
        ctx.resolved && ctx.enrichedQuery ? ctx.enrichedQuery : item.query;

      if (item.enrichedQuery) {
        assert.equal(effectiveQuery, item.enrichedQuery, item.query);
      }

      const frame = analyzeRequestIntentFrame(effectiveQuery);
      const hit = await runConversationShortCircuit(effectiveQuery, {
        history: item.history || [],
      });

      for (const [key, value] of Object.entries(item.expect)) {
        if (key === "path") {
          assert.equal(hit?.path, value, item.query);
          continue;
        }
        if (key === "familyHint") {
          assert.equal(frame.familyHint?.id, value, item.query);
          continue;
        }
        if (key === "taskKind") {
          assert.equal(frame.task.kind, value, item.query);
          continue;
        }
        if (key === "composite") {
          assert.equal(frame.composite, value, item.query);
          continue;
        }
        if (key === "socialOnly") {
          assert.equal(frame.conversation.socialOnly, value, item.query);
          continue;
        }
        if (key === "secondaryGoal") {
          assert.equal(frame.secondaryGoal, value, item.query);
          continue;
        }
        if (key === "pathNot") {
          assert.notEqual(hit?.path, value, item.query);
          continue;
        }
        if (key === "clarify") {
          const ji = evaluateJustIntent(effectiveQuery);
          const gate = resolveClarificationGate(effectiveQuery, {
            justIntent: ji,
            history: item.history || [],
          });
          assert.equal(gate.shouldClarify, value, item.query);
        }
      }

      if (frame.familyHint?.id && hit?.path) {
        assert.equal(
          frame.familyHint.id,
          hit.path,
          `familyHint vs path divergent: ${item.query}`,
        );
      }
    });
  }
});

describe("IntentFrame — batterie d'ambiguïté (gaps documentés v1.2+)", () => {
  for (const item of KNOWN_GAPS) {
    it(`#${item.id} gap connu: ${item.gap}`, () => {
      const frame = analyzeRequestIntentFrame(item.query);
      if (item.targetFamily) {
        assert.notEqual(
          frame.familyHint?.id,
          item.targetFamily,
          `gap corrigé — mettre à jour STABLE_BATTERY: ${item.query}`,
        );
      } else {
        assert.equal(frame.familyHint, null);
      }
    });
  }
});

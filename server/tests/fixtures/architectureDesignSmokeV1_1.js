/**
 * Smoke registry v1.1 — formulations « comment créer X » et variantes.
 * Voir ADR-20260601-Architecture-Design-Options (plan v1.1).
 */

/** @typedef {{
 *   id: string,
 *   query: string,
 *   expectMatch?: boolean,
 *   expectedContract?: string,
 *   expectedPath?: string,
 *   expectedIntent?: string,
 *   analytical?: boolean,
 *   mustMatchReply?: RegExp[],
 *   mustNotContainReply?: string[],
 *   deferToLlm?: boolean,
 *   guidedCreation?: boolean,
 * }} ArchitectureDesignSmokeCase */

/** @type {ArchitectureDesignSmokeCase[]} */
export const ARCHITECTURE_DESIGN_SMOKE_V1_1 = [
  {
    id: "comment-creer-code-reviewer",
    query:
      "comment créer un code-reviewer qui analyse tout le code d'un projet",
    expectedContract: "GUIDED_CREATION_SCOPING",
    expectedPath: "guided_creation_scoping",
    expectedIntent: "normal_conversation",
    analytical: false,
    deferToLlm: true,
    guidedCreation: true,
    mustNotContainReply: ["skill-industrial-maturation", "via l'orchestrateur"],
  },
  {
    id: "comment-mettre-en-place-agent-rag",
    query: "comment mettre en place un agent RAG local pour mon dépôt",
    expectedContract: "ARCHITECTURE_OPTIONS",
    expectedPath: "architecture_design_deterministic",
    expectedIntent: "normal_conversation",
    analytical: false,
    mustMatchReply: [/3 approches/i, /Je partirais plutôt sur/i, /\*\*Prochain pas\*\*/i],
    mustNotContainReply: ["skill-industrial-maturation"],
  },
  {
    id: "quelle-architecture-pour-pipeline",
    query: "quelle architecture pour un pipeline de revue de code automatisé",
    expectedContract: "ARCHITECTURE_OPTIONS",
    expectedPath: "architecture_design_deterministic",
    expectedIntent: "normal_conversation",
    analytical: false,
    mustMatchReply: [/3 approches/i, /Je partirais plutôt sur/i, /\*\*Prochain pas\*\*/i],
    mustNotContainReply: ["via l'orchestrateur"],
  },
  {
    id: "je-veux-creer-bot-audit",
    query: "je veux créer un bot assistant qui audite la qualité du code",
    expectedContract: "GUIDED_CREATION_SCOPING",
    expectedPath: "guided_creation_scoping",
    expectedIntent: "normal_conversation",
    analytical: false,
    deferToLlm: true,
    guidedCreation: true,
    mustNotContainReply: ["je vais utiliser le skill"],
  },
  {
    id: "propose-plusieurs-approches-linter",
    query: "propose moi plusieurs approches pour un linter intelligent sur mon repo",
    expectedContract: "ARCHITECTURE_OPTIONS",
    expectedPath: "architecture_design_deterministic",
    expectedIntent: "normal_conversation",
    analytical: false,
    mustMatchReply: [/3 approches/i, /Je partirais plutôt sur/i, /\*\*Prochain pas\*\*/i],
    mustNotContainReply: ["skill-industrial-maturation"],
  },
  {
    id: "how-to-build-review-agent",
    query: "how to build a local code review agent for my project",
    expectedContract: "ARCHITECTURE_OPTIONS",
    expectedPath: "architecture_design_deterministic",
    expectedIntent: "normal_conversation",
    analytical: false,
    mustMatchReply: [/3 approches/i, /Je partirais plutôt sur/i, /\*\*Prochain pas\*\*/i],
    mustNotContainReply: ["via l'orchestrateur"],
  },
  {
    id: "comment-mettre-en-oeuvre-service",
    query: "comment mettre en oeuvre un service de diagnostic automatique",
    expectedContract: "ARCHITECTURE_OPTIONS",
    expectedPath: "architecture_design_deterministic",
    expectedIntent: "normal_conversation",
    analytical: false,
    mustMatchReply: [/3 approches/i, /Je partirais plutôt sur/i, /\*\*Prochain pas\*\*/i],
    mustNotContainReply: ["skill-industrial-maturation"],
  },
  {
    id: "exclusion-execution-immediate",
    query: "lance l'indexation de mon projet maintenant",
    expectMatch: false,
    analytical: false,
  },
  {
    id: "exclusion-diagnostic-debug",
    query: "debug cette erreur api timeout dans le pipeline",
    expectMatch: false,
    analytical: true,
    expectedIntent: "expert_task",
  },
];

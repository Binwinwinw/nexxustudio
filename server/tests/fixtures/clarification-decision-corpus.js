/**
 * Corpus non-régression — CLARIFICATION_DECISION_V1
 */
export const CLARIFICATION_CORPUS = Object.freeze({
  encyclopedic_familiarity: [
    {
      query: "Que sais-tu du pays appelé Italie ?",
      expectedDecision: "can_answer_now",
    },
    {
      query: "Tu connais Victor Hugo ?",
      expectedDecision: "can_answer_now",
    },
    {
      query: "que sais tu à propos de l'italie",
      expectedDecision: "can_answer_now",
    },
  ],

  explanatory_general_knowledge: [
    {
      query: "explique la carbonara",
      expectedDecision: "can_answer_now",
    },
    {
      query: "qu est ce que innodb",
      expectedDecision: "can_answer_now",
    },
    {
      query: "tu connais le boeuf bourguignon",
      expectedDecision: "can_answer_now",
    },
  ],

  blocking_ambiguity: [
    {
      query: "fais quelque chose",
      expectedDecision: "needs_clarification",
    },
    {
      query: "fais une page html",
      expectedDecision: "needs_clarification",
    },
    {
      query: "aide-moi pour mon projet",
      expectedDecision: "needs_clarification",
    },
  ],
});

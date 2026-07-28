/** P5 — types et constantes de l'élan conversationnel. */

export const CONVERSATION_MOMENTUM_RULE =
  "default_recommendation_or_concrete_step";

export const CONVERSATION_NEXT_MOVES = {
  RECOMMEND: "recommend",
  CLARIFY: "clarify",
  ADVANCE: "advance",
  RESPOND: "respond",
};

export const FOLLOW_UP_STYLES = {
  FRAMING: "framing",
  CONCRETE_STEP: "concrete_step",
  NONE: "none",
};

export const INTENT_CONTRACTS = {
  ARCHITECTURE_OPTIONS: "ARCHITECTURE_OPTIONS",
  IDEATION_OPEN: "IDEATION_OPEN",
};

export const RECOMMENDATION_KEYS = {
  ARCHITECTURE_LIGHT: "light",
  ARCHITECTURE_INTERMEDIATE: "intermediate",
  ARCHITECTURE_INDUSTRIAL: "industrial",
};

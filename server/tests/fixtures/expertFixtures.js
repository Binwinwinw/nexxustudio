/**
 * 🏺 FIXTURES : Experts représentatifs pour les tests unitaires et d'intégration.
 */

export const EXPERT_RAW_ARCHITECT = {
  key: "architect",
  name: "Nexxus Architect",
  division: "Elite",
  scope: ["Architecture", "System Design"],
  model: "qwen3.5:27b",
  preferredStyle: "TECHNICAL"
};

export const EXPERT_RAW_AUDITOR = {
  key: "auditor",
  name: "Nexxus Auditor",
  division: "Elite",
  scope: ["Security", "Compliance"],
  model: "qwen3.5:27b",
  preferredStyle: "STRICT"
};

export const EXPERT_RAW_GENERAL = {
  key: "general",
  name: "Nexxus Generalist",
  division: "General",
  scope: ["Chat", "Support"],
  model: "qwen3.5:4b",
  preferredStyle: "ADVICE"
};

// Wrappers Scored (Simule la sortie du Router)
export const CANDIDATE_ARCHITECT = {
  expert: EXPERT_RAW_ARCHITECT,
  score: 0.95,
  finalScore: 0.92,
  thermal: "HOT",
  queue: 0
};

export const CANDIDATE_GENERAL_COLD = {
  expert: EXPERT_RAW_GENERAL,
  score: 0.85,
  finalScore: 0.25,
  thermal: "COLD",
  queue: 0
};

export const CANDIDATE_BUSY = {
  expert: EXPERT_RAW_ARCHITECT,
  score: 0.95,
  finalScore: 0.65,
  thermal: "HOT",
  queue: 5
};

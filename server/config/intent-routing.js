// server/config/intent-routing.js
export const intentRoutingRules = [
  // Règle 1 : général/explain → direct_explanation
  {
    intent: "general/explain",
    conditions: {
      conf: { min: 0.7 }
    },
    pipeline: "direct_explanation",
    priority: 100
  },
  
  // Règle 2 : général/explain + conf faible → clarify_user
  {
    intent: "general/explain",
    conditions: {
      conf: { max: 0.69 }
    },
    pipeline: "clarify_user",
    priority: 90
  },
  
  // Règle 3 : code/create → build_v1
  {
    intent: "code/create",
    conditions: {},
    pipeline: "build_v1",
    priority: 100
  },
  
  // Règle 4 : presentation/plan → build_v1
  {
    intent: "presentation/plan",
    conditions: {},
    pipeline: "build_v1",
    priority: 100
  },
  
  // Règle 5 : conversation_recall → recall_previous
  {
    intent: "conversation_recall",
    conditions: {},
    pipeline: "recall_previous",
    priority: 100
  },
  
  // Fallback : pas sur conversation_recall, mais sur general_answer
  {
    intent: "default",
    conditions: {},
    pipeline: "general_answer",
    priority: 10
  }
];

// Fonction de sélection du pipeline
export function selectPipeline(intent, conf = 0.5) {
  const sortedRules = intentRoutingRules
    .filter(r => r.intent === "default" || r.intent === intent)
    .sort((a, b) => b.priority - a.priority);
  
  for (const rule of sortedRules) {
    const conditions = rule.conditions;
    if (conditions.conf?.min !== undefined && conf < conditions.conf.min) continue;
    if (conditions.conf?.max !== undefined && conf > conditions.conf.max) continue;
    
    return rule.pipeline;
  }
  
  return "general_answer";
}

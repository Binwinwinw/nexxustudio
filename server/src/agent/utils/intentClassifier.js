/* server/src/agent/utils/intentClassifier.js */

/**
 * IntentClassifier - V4 Architecture
 * Orchestrates request classification before generation.
 */
import {
  isArchitectureDesignIntent,
  isAnalyticalTechnicalRequest,
} from "./conversationGuards.js";
import { isMetaModelStackOpinionQuery, isMetaPredictionLimitsQuery, isMetaPeerAssistantsQuery } from "../policies/meta/metaCapabilitiesPolicy.js";
import { isInformationSeekingLightQuery } from "../policies/informationSeekingLightPolicy.js";
import { isCasualExplanationFollowUp } from "../policies/social/index.js";

const INTENT_TAXONOMY = {
  SOCIAL_CHIT_CHAT: "social_chit_chat", // Salutations pures, invitations à discuter
  NORMAL_CONVERSATION: "normal_conversation", // Echange léger sans action technique
  COURTESY: "courtesy",       // Remerciements
  IDENTITY: "identity",       // "Qui es-tu ?", "Comment tu marches ?"
  EXPERT_TASK: "expert_task", // Travail structuré nécessitant un expert
  STRATEGIC: "strategic",     // Raisonnement complexe, arbitrage, planification
  TOOL_ACTION: "tool_action", // Demande explicite d'action (build, write, scan)
  SAFETY: "safety_sensitive"  // Sécurité, bypass, modification système
};

const REASONING_BUDGET = {
  [INTENT_TAXONOMY.SOCIAL_CHIT_CHAT]: 0,
  [INTENT_TAXONOMY.NORMAL_CONVERSATION]: 1,
  [INTENT_TAXONOMY.COURTESY]: 0,
  [INTENT_TAXONOMY.IDENTITY]: 1,
  [INTENT_TAXONOMY.EXPERT_TASK]: 2,
  [INTENT_TAXONOMY.STRATEGIC]: 3,
  [INTENT_TAXONOMY.TOOL_ACTION]: 2,
  [INTENT_TAXONOMY.SAFETY]: 4
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[*_`~^]/g, "")
    .replace(/[^\p{L}\p{N}\s?!.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return text.split(' ').filter(Boolean);
}

export function classifyIntent(query = "", context = {}) {
  const q = normalize(query);
  const tokens = tokenize(q);
  const isComplex = tokens.length > 20;

  // --- SCORING GRID (Pré-classifieur contextuel) ---
  let socialScore = 0;
  let technicalScore = 0;
  let actionScore = 0;
  let complexityScore = 0;

  const socialWords = [
    'salut', 'bonjour', 'hello', 'bonsoir', 'hey', 'coucou',
    'discuter', 'parler', 'ca va', 'comment vas tu', 'merci', 'super', 'genial'
  ];

  const technicalWords = [
    'code', 'stack', 'build', 'api', 'route', 'json', 'db', 'base', 'sql', 'bdd', 'database',
    'php', 'js', 'javascript', 'python', 'react', 'tailwind', 'log', 'index',
    'docker', 'ollama', 'fichier', 'fonction', 'classe', 'module', 'projet', 
    'forge', 'atelier', 'repo', 'document', 'doc', 'chemin', 'path', 'architecture',
    'bloque'
  ];

  const criticalTechWords = [
    'bug', 'crash', 'erreur', 'plante', 'casse', 'souci', 'marche pas', 'repond plus'
  ];

  const actionVerbs = [
    'corriger', 'corrige', 'tester', 'implementer', 'refactorer', 'analyser',
    'diagnostiquer', 'generer', 'ecrire', 'modifier', 'creer',
    'ajouter', 'supprimer', 'optimiser', 'expliquer', 'explique', 'lire', 'audit', 'scann', 'comparer', 'question'
  ];

  // Fix length scoring (prevent double counting)
  if (tokens.length <= 4) {
    socialScore += 2;
  } else if (tokens.length <= 8) {
    socialScore += 1;
  }

  if (tokens.length >= 20) {
    complexityScore += 3;
  } else if (tokens.length >= 12) {
    complexityScore += 2;
  }

  for (const w of socialWords) {
    if (q.includes(w)) socialScore += 3;
  }

  for (const w of technicalWords) {
    if (q.includes(w)) technicalScore += 3;
  }

  for (const w of criticalTechWords) {
    if (q.includes(w)) technicalScore += 5; // Forces expert score higher
  }

  for (const w of actionVerbs) {
    if (q.includes(w)) actionScore += 2;
  }

  if (/[?]/.test(q)) actionScore += 1;
  if (/[!]/.test(q)) socialScore += 0.5;

  let contextDelta = 0;
  if (context.lastIntent === 'SOCIAL_CHIT_CHAT' || context.lastIntent === 'social_chit_chat') {
    socialScore += 1;
    contextDelta = -1; // Negative delta for social push
  }
  if (context.activeTask === true) {
    technicalScore += 2; // Strengthened historical context weight
    contextDelta = 2; // Positive delta for tech push
  }

  const expertScore = technicalScore + actionScore + complexityScore;
  const socialTotal = socialScore - (expertScore * 0.5);

  const scoreDetails = { socialTotal, expertScore, technicalScore, actionScore, complexityScore, contextDelta };

  // 1. FAST PATH : SOCIAL_CHIT_CHAT
  // Si le score social est fort et qu'aucun indice technique majeur n'est présent
  if (socialTotal >= 4 && expertScore <= 2) {
    return { 
      intent: INTENT_TAXONOMY.SOCIAL_CHIT_CHAT, 
      budget: REASONING_BUDGET.SOCIAL_CHIT_CHAT, 
      bypassDirectAnswer: false,
      reason: "High social score with low expert score",
      scores: scoreDetails
    };
  }

  // --- ANALYSE PROFONDE (Escalade des intentions) ---

  // 2. SAFETY & SYSTEM MODIFICATION
  if (/\bmodifier\b|\bcorriger\b|\bpatcher\b|\bconfig\b/.test(q) && /\bfichier\b|\bcode\b|\bsystem\b/.test(q)) {
    return { intent: INTENT_TAXONOMY.SAFETY, budget: REASONING_BUDGET.SAFETY, bypassDirectAnswer: true, scores: scoreDetails, reason: "Matches safety/system modification keywords" };
  }

  // 3. IDENTITY
  if (!isComplex && /\bqui es tu\b|\bton nom\b|\bcomment tu t'appelles\b|\bt'appelles tu\b|\bton role\b/.test(q)) {
    return { intent: INTENT_TAXONOMY.IDENTITY, budget: REASONING_BUDGET.IDENTITY, bypassDirectAnswer: false, scores: scoreDetails, reason: "Matches identity keywords" };
  }

  // 3b. MODEL STACK OPINION — meta_capabilities, pas EXPERT_TASK
  if (isMetaModelStackOpinionQuery(query)) {
    return {
      intent: INTENT_TAXONOMY.NORMAL_CONVERSATION,
      budget: REASONING_BUDGET.NORMAL_CONVERSATION,
      bypassDirectAnswer: false,
      scores: scoreDetails,
      reason: "model_stack_opinion_meta_capabilities_short_circuit",
    };
  }

  // 3c. PREDICTION LIMITS — pronostic / pari subjectif, pas orchestrateur
  if (isMetaPredictionLimitsQuery(query)) {
    return {
      intent: INTENT_TAXONOMY.NORMAL_CONVERSATION,
      budget: REASONING_BUDGET.NORMAL_CONVERSATION,
      bypassDirectAnswer: false,
      scores: scoreDetails,
      reason: "prediction_limits_meta_capabilities_short_circuit",
    };
  }

  // 3d. INFORMATION SEEKING LIGHT — factoid culturel, pas EXPERT_TASK
  if (isInformationSeekingLightQuery(query)) {
    return {
      intent: INTENT_TAXONOMY.NORMAL_CONVERSATION,
      budget: REASONING_BUDGET.NORMAL_CONVERSATION,
      bypassDirectAnswer: false,
      scores: scoreDetails,
      reason: "information_seeking_light_short_circuit",
    };
  }

  // 3e. CASUAL EXPLANATION LIGHT — relance fil banter
  if (isCasualExplanationFollowUp(query, { history: context?.history || [] })) {
    return {
      intent: INTENT_TAXONOMY.NORMAL_CONVERSATION,
      budget: REASONING_BUDGET.NORMAL_CONVERSATION,
      bypassDirectAnswer: false,
      scores: scoreDetails,
      reason: "casual_explanation_light_short_circuit",
    };
  }

  // 3f. PEER ASSISTANTS — écosystème IA, pas identité recycle
  if (isMetaPeerAssistantsQuery(query)) {
    return {
      intent: INTENT_TAXONOMY.NORMAL_CONVERSATION,
      budget: REASONING_BUDGET.NORMAL_CONVERSATION,
      bypassDirectAnswer: false,
      scores: scoreDetails,
      reason: "peer_assistants_meta_capabilities_short_circuit",
    };
  }

  // 4. ARCHITECTURE DESIGN — options, pas pipeline EXPERT_TASK
  if (isArchitectureDesignIntent(q)) {
    return {
      intent: INTENT_TAXONOMY.NORMAL_CONVERSATION,
      budget: REASONING_BUDGET.NORMAL_CONVERSATION,
      bypassDirectAnswer: false,
      scores: scoreDetails,
      reason: "architecture_design_options_short_circuit_preferred",
    };
  }

  // 5. ANALYTICAL / EXPERT_TASK (Conversation Guards)
  if (isAnalyticalTechnicalRequest(q)) {
    return { intent: INTENT_TAXONOMY.EXPERT_TASK, budget: isComplex ? 3 : 2, bypassDirectAnswer: true, scores: scoreDetails, reason: "Conversation guard forced analytical/technical request" };
  }

  // 6. STRATEGIC / PLANNING
  if (/\bplan\b|\bstrategie\b|\borganise\b|\barbitre\b|\bsynthese\b|\bpropositions\b/.test(q)) {
    return { intent: INTENT_TAXONOMY.STRATEGIC, budget: REASONING_BUDGET.STRATEGIC, bypassDirectAnswer: true, scores: scoreDetails, reason: "Matches strategic planning keywords" };
  }

  // 7. DECISION BASÉE SUR LE SCORE (Défaut)
  if (expertScore >= 4) { // Lowered threshold from 5 to 4 to capture short technical queries
    return { 
      intent: INTENT_TAXONOMY.EXPERT_TASK, 
      budget: isComplex ? 3 : 2, 
      bypassDirectAnswer: isComplex,
      reason: "High expert score calculated from context grid",
      scores: scoreDetails
    };
  }

  return { 
    intent: INTENT_TAXONOMY.NORMAL_CONVERSATION, 
    budget: REASONING_BUDGET.NORMAL_CONVERSATION, 
    bypassDirectAnswer: false,
    reason: "Fallback to normal conversation based on balanced scores",
    scores: scoreDetails
  };
}

export default {
  INTENT_TAXONOMY,
  REASONING_BUDGET,
  classifyIntent
};

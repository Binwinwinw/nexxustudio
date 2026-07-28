/**
 * @deprecated Utiliser generalKnowledgeComposerContract.js — alias rétrocompat.
 */
export {
  GENERAL_KNOWLEDGE_COMPOSER_RULE as RECIPE_KNOWLEDGE_COMPOSER_RULE,
  requiresGeneralKnowledgeComposerContract as requiresRecipeKnowledgeComposerContract,
  resolveLocalGeneralKnowledgeDetail as resolveLocalRecipeKnowledgeDetail,
  buildGeneralKnowledgeSystemAddon as buildRecipeKnowledgeSystemAddon,
  buildGeneralKnowledgeUserPrompt as buildRecipeKnowledgeUserPrompt,
  resolveGeneralKnowledgeShortCircuit as resolveRecipeKnowledgeShortCircuit,
  isGeneralKnowledgeContractViolation as isRecipeKnowledgeContractViolation,
} from "./generalKnowledgeComposerContract.js";

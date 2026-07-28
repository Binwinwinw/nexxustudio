/**
 * Micro-automatisations de délestage — P1/P2 conversationnel.
 * Synchrones, déterministes, testables.
 */
export { sanitizeQuery, countWords, stripTrailingFiller } from "./normalization/querySanitizer.js";
export {
  formatSubjectSurfaceForm,
  SURFACE_FORM_BY_KEY,
  extractMainEntity,
  normalizeProperNameCase,
  resolveCelebrityLabel,
} from "./normalization/surfaceFormNormalizer.js";
export {
  inferCelebrityFromContext,
  isOrganizationEntity,
  CELEBRITY_ALIASES,
} from "./normalization/subjectEntityExtractor.js";

export {
  classifySubject,
  classifySubjectCategory,
  isFamiliarityIntent,
  parseFamiliarityQuery,
  SUBJECT_CATEGORIES,
} from "./classifiers/subjectClassifier.js";

export {
  SUBJECT_RESOLUTION_MODES,
  SUBJECT_SHAPES,
  detectConversationIntent,
  extractCandidateSubject,
  classifyUnknownSubjectShape,
  refineUnknownSubjectLabel,
  buildInferredDefinition,
  enrichSubjectResolution,
} from "./classifiers/subjectUnderstanding.js";

export {
  classifyPlaceSubtype,
  inferPlaceSubtype,
  PLACE_SUBTYPES,
  classifyPersonSubtype,
  PERSON_SUBTYPES,
  FAMILIARITY_MAIN_ENTITY_OPENING_RULE,
} from "./classifiers/entitySubtypeClassifier.js";

export {
  runConversationShortCircuit,
  classifyShortCircuitIntent,
} from "./classifiers/intentShortCircuit.js";
export {
  classifyConversationTurn,
  CONVERSATION_TURN_TYPES,
  isReferentialEntityMention,
} from "./classifiers/conversationTurnType.js";
export {
  buildMetaFeedbackReply,
  resolveMetaFeedbackShortCircuit,
} from "./replies/metaFeedbackReplyBuilder.js";

export { buildIdentityReply } from "./replies/identityReplyBuilder.js";
export { buildIdeationReply } from "./replies/ideationReplyBuilder.js";
export { buildArchitectureDesignReply } from "./replies/architectureDesignReplyBuilder.js";
export { buildFamiliarityReply } from "./replies/familiarityReplyBuilder.js";
export {
  buildLauncherGuideReply,
  resolveLauncherGuideShortCircuit,
  buildPublicGameLauncherGuide,
  detectLauncherPlatformHint,
} from "./replies/launcherGuideBuilder.js";
export { buildClarificationQuestion } from "./replies/clarificationBuilder.js";

export {
  readRecentTurns,
  extractConversationState,
  resolveShortFollowup,
  buildConversationContinuityContext,
  isConversationContinuityFollowup,
  getConversationContinuityDeterministicReply,
  resolveConversationContinuityShortCircuit,
  CONTINUITY_DEFAULT_WINDOW,
  CONVERSATION_CONTINUITY_RULE,
  CONTINUITY_TURN_PHASES,
  CONTINUITY_ASSISTANT_OFFERS,
} from "./continuity/conversationContinuityContext.js";

export {
  isLexiconLearningEnabled,
  getPromotedLexiconMap,
  revokePromotedLexiconEntry,
  readLexiconLearningEvents,
} from "./lexicon/lexiconLearningStore.js";
export { observeLexiconLearning } from "./lexicon/lexiconLearningOrchestrator.js";
export {
  buildLexiconLearningSnapshot,
  formatLexiconLearningReportMarkdown,
} from "./lexicon/lexiconLearningReport.js";
export {
  LEXICON_PROMOTION_POLICY_V1,
  computeProposalConfidence,
} from "./lexicon/lexiconPromotionPolicy.js";
export {
  assessLexiconPromotionCandidate,
  LEXICON_GATE_DECISIONS,
} from "./lexicon/lexiconPromotionGate.js";
export {
  LEXICON_PROPOSAL_STATUS,
  buildPromotionCandidateFromObservation,
} from "./lexicon/subjectPromotionCandidateBuilder.js";
export { hasStaticLexiconEntry } from "../utils/familiarityIntentGuards.js";

export {
  interpretRequest,
  resolveEffectiveQuery,
  isRequestInterpreterEnabled,
  REQUEST_INTERPRETER_RULE,
  INTERPRETER_ACTIONS,
} from "./interpreter/requestInterpreter.js";
export {
  normalizeRequest,
  canonicalizeRequest,
  needsRequestInterpretation,
} from "./interpreter/requestNormalizer.js";
export {
  buildIntentHypotheses,
  pickBestHypothesis,
  INTERPRETER_INTENTS,
} from "./interpreter/intentHypothesisBuilder.js";
export {
  detectAmbiguities,
  hasBlockingAmbiguity,
  AMBIGUITY_TYPES,
} from "./interpreter/ambiguityDetector.js";
export {
  decideInterpreterAction,
  INTERPRETER_CONFIDENCE,
} from "./interpreter/clarificationPolicy.js";

export {
  evaluateBoundedSubjectDeepening,
  isSubjectDeepeningLlmEnabled,
  needsBoundedSubjectDeepening,
  SUBJECT_DEEPENING_RULE,
  SUBJECT_DEEPENING_PATH,
} from "./deepening/boundedSubjectDeepeningPolicy.js";
export { synthesizeBoundedSubjectDeepening } from "./deepening/boundedSubjectDeepeningSynthesizer.js";

export {
  AUTO_REPLY_SUFFICIENCY_RULE,
  AUTO_REPLY_SUFFICIENCY_FORMULA,
  AUTO_REPLY_SUFFICIENCY_DOCTRINE,
} from "./parsing/autoReplySufficiencyRule.js";
export {
  buildParseState,
  evaluateAutoReplySufficiency,
  SUFFICIENCY_TIER,
  SUFFICIENCY_BYPASS_PATHS,
} from "./parsing/responseSufficiencyEvaluator.js";
export { applyShortCircuitSufficiencyGate } from "./parsing/shortCircuitSufficiencyGate.js";

export {
  CONVERSATION_MOMENTUM_RULE,
  CONVERSATION_NEXT_MOVES,
  INTENT_CONTRACTS as MOMENTUM_INTENT_CONTRACTS,
} from "./momentum/conversationMoveTypes.js";
export { resolveNextMove, countNumberedOptions } from "./momentum/nextMovePolicy.js";
export {
  buildDefaultRecommendation,
  enrichArchitectureOptionsReply,
} from "./momentum/defaultRecommendationBuilder.js";
export { applyConversationMomentum } from "./momentum/conversationMomentumOrchestrator.js";

export {
  SUBJECT_NATURES,
  resolveSubjectIntelligence,
  buildSubjectInterpretedState,
  buildSubjectClarificationReply,
} from "./subject/subjectNatureResolver.js";
export {
  evaluateAmbiguityContract,
  AMBIGUITY_CONTRACT_RULE,
} from "./subject/subjectAmbiguityContract.js";
export {
  planProcedureIntent,
  planGeneralSubjectIntent,
  planFamiliaritySubjectIntent,
} from "./subject/subjectIntentRouter.js";
export { buildFamiliaritySurfaceReply } from "./replies/familiarityReplyBuilder.js";
export { resolveDeterministicRouteHint, DETERMINISTIC_ROUTES } from "./subject/subjectRoutingHints.js";
export { resolveMiniResearch } from "./subject/miniResearchGate.js";
export { rememberResolvedSubject } from "./subject/subjectSessionMemory.js";
export { USAGE_INTENTS } from "./subject/subjectUsageIntent.js";
export {
  INSTALL_USAGE_KINDS,
  classifyInstallUsage,
  mapInstallKindToUsageIntent,
} from "./subject/subjectInstallUsage.js";
export { ENTITY_IDS } from "./subject/subjectEntityIds.js";
export {
  SUBJECT_GRAPH_ENTITIES,
  resolveSubject,
  getGraphEntity,
  listEntityIdsByRelation,
  getEntityPlatforms,
  hasRelation,
  scanPublicEntitiesInQuery,
} from "./subject/subjectGraph.js";

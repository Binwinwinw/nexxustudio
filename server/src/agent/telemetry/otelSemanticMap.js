/* server/src/agent/telemetry/otelSemanticMap.js */

/**
 * OpenTelemetry Semantic Mapping for Nexxus v4
 * Based on GenAI OTEL Conventions & Nexxus Sovereignty Model.
 */

export const OTEL_ATTRIBUTES = {
  // --- ROOT SPAN (nexxus.turn) ---
  SESSION_ID: "nexxus.session_id",
  TURN_ID: "nexxus.turn_id",
  VERSION: "nexxus.version",
  IDENTITY_VERSION: "nexxus.ring1_version",
  INTENT: "nexxus.intent",
  REASONING_BUDGET: "nexxus.reasoning_budget",
  DETERMINISTIC_BYPASS: "nexxus.deterministic_bypass",
  GOVERNOR_STATE: "nexxus.governor.state",

  // --- INTENT SPAN (intent.classify) ---
  CLASSIFIER_VERSION: "nexxus.classifier.version",
  CLASSIFIER_CONFIDENCE: "nexxus.classifier.confidence",

  // --- POLICY SPAN (policy.route) ---
  POLICY_PATH: "nexxus.policy.path", // deterministic | llm | expert | reasoner
  POLICY_REASON: "nexxus.policy.reason",

  // --- PROMPT SPAN (prompt.build) ---
  RING2_PHASE: "nexxus.ring2_phase",
  RING2_MATURITY: "nexxus.ring2_maturity_score",
  SKILLS_COUNT: "nexxus.prompt.skills_count",
  EXPERTS_COUNT: "nexxus.prompt.experts_count",

  // --- ROUTER SPANS (router.*) ---
  ROUTER_CANDIDATES: "nexxus.router.candidates_count",
  ROUTER_SELECTED: "nexxus.router.selected_count",

  // --- LLM SPAN (llm.call) ---
  GEN_AI_SYSTEM: "gen_ai.system",
  GEN_AI_MODEL: "gen_ai.request.model",
  GEN_AI_RESPONSE_MODEL: "gen_ai.response.model",
  GEN_AI_INPUT_TOKENS: "gen_ai.usage.input_tokens",
  GEN_AI_OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
  LLM_TTFT: "nexxus.llm.ttft_ms",
  LLM_TPS: "nexxus.llm.tps",

  // --- VALIDATION SPAN (response.validate) ---
  VALIDATION_PASSED: "nexxus.validation.passed",
  VALIDATION_POLICY_OK: "nexxus.validation.policy_ok",
  VALIDATION_PERSONA_OK: "nexxus.validation.persona_ok",

  // --- WEB CANDIDATE MEMORY (ADR-20260603) ---
  WEB_MEMORY_EPISODE: "nexxus.web_memory.episode",
  WEB_MEMORY_CANDIDATE: "nexxus.web_memory.candidate",
  WEB_MEMORY_PROMOTION: "nexxus.web_memory.promotion"
};

export const SPAN_NAMES = {
  TURN: "nexxus.turn",
  INTENT: "intent.classify",
  POLICY: "policy.route",
  ROUTER_SEMANTIC: "router.semantic",
  ROUTER_LEXICAL: "router.lexical",
  ROUTER_COGNITIVE: "router.cognitive",
  ROUTER_HYDRATION: "router.hydration",
  PROMPT: "prompt.build",
  LLM: "llm.call",
  VALIDATE: "response.validate",
  MEMORY_READ: "memory.read",
  MEMORY_WRITE: "memory.write",
  TOOL: "tool.call",
  VIDEO_PROBE: "video.probe",
  VIDEO_SCENE_DETECT: "video.scene_detect",
  VIDEO_TRANSCRIBE: "video.transcribe",
  VIDEO_OCR: "video.ocr",
  VIDEO_PACK_BUILD: "video.pack_build",
  VIDEO_ANALYZE: "video.analyze"
};

export default {
  OTEL_ATTRIBUTES,
  SPAN_NAMES
};

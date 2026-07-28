import {
  computeCompositeScore,
  resolveClarificationNeed,
  REQUEST_INTERPRETER_SCORING_RULE,
} from "./requestInterpreter.scoring.js";

export const REQUEST_INTERPRETER_CONTRACT_ID = "REQUEST_INTERPRETER_V1";
export const INTERPRETER_LOCK_RULE = "interpreter_lock_v1";

const FAMILY = Object.freeze({
  CONVERSATION: "conversation",
  INFORMATION: "information",
  PROCEDURE: "procedure",
  PLANNING: "planning",
  SOFTWARE_HELP: "software_help",
  CODE_DEV: "code_dev",
  ANALYSIS: "analysis",
  MATH_CALCULATION: "math_calculation",
  HEALTH_GENERAL: "health_general",
  LOCATION: "location",
  LICENSE_ADMIN: "license_admin",
  UNKNOWN: "unknown",
});

function normalizeText(input = "") {
  return String(input || "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function candidate(intent, score) {
  return { intent, score: Number(score.toFixed(3)) };
}

function buildResult(input) {
  const riskFlags = uniq(input.risk_flags || []);
  const confidence = Number(computeCompositeScore(input.score || {}).toFixed(3));
  const topCandidates = (input.top_candidates || [
    candidate(`${input.family}.${input.subtype}`, confidence),
  ])
    .map((item) => candidate(item.intent, item.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    contract: REQUEST_INTERPRETER_CONTRACT_ID,
    scoring_rule: REQUEST_INTERPRETER_SCORING_RULE,
    family: input.family,
    subtype: input.subtype,
    user_goal: input.user_goal,
    object: input.object ?? null,
    instrument: uniq(input.instrument || []),
    confidence,
    top_candidates: topCandidates,
    needs_clarification:
      input.needs_clarification ?? resolveClarificationNeed(confidence, riskFlags),
    suggested_pipeline: input.suggested_pipeline,
    risk_flags: riskFlags,
    evidence_spans: uniq(input.evidence_spans || []),
  };
}

function interpretWindowsDeviceLookup(rawQuery, normalized) {
  const hasWindowsComputer =
    /\b(ordinateur|pc|machine|appareil)\b.{0,30}\bwindows\s*11\b/.test(normalized) ||
    /\bwindows\s*11\b.{0,30}\b(ordinateur|pc|machine|appareil)\b/.test(normalized);
  const hasIdentifier =
    /\b(id produit|id-produit|cle produit|cle windows|licence|product key|product id)\b/.test(
      normalized,
    );
  const asksFindDevice =
    /\b(retrouver|localiser|trouver|localisation|perdu|perdue)\b.{0,50}\b(ordinateur|pc|machine|appareil)\b/.test(
      normalized,
    ) ||
    /\b(ordinateur|pc|machine|appareil)\b.{0,50}\b(retrouver|localiser|trouver|localisation|perdu|perdue)\b/.test(
      normalized,
    );
  const instrumentMarker = /\b(avec|a partir de|grace a|en utilisant|via)\b/.test(normalized);

  if (!hasWindowsComputer || !hasIdentifier || !asksFindDevice) return null;

  const riskFlags = ["subject_instrument_inversion", "identifier_vs_asset_confusion"];
  if (/\blocalis/.test(normalized)) {
    riskFlags.push("location_vs_recovery_confusion");
  }

  return buildResult({
    family: FAMILY.SOFTWARE_HELP,
    subtype: "license_or_device_location",
    user_goal: "determine_if_product_id_or_key_can_locate_windows_pc",
    object: "ordinateur Windows 11",
    instrument: ["ID-produit", "clé produit"],
    score: {
      lexical: 0.92,
      semantic: 0.86,
      pattern: instrumentMarker ? 0.95 : 0.78,
      context: 0.72,
    },
    top_candidates: [
      candidate("software_help.license_or_device_location", 0.9),
      candidate("procedure.device_recovery", 0.74),
      candidate("information.windows_license", 0.68),
    ],
    needs_clarification: false,
    suggested_pipeline: "direct_explanation",
    risk_flags: riskFlags,
    evidence_spans: [
      rawQuery.match(/retrouver[^?!.]*/i)?.[0],
      rawQuery.match(/ID-produit|clé produit|cle produit|product key|product id/i)?.[0],
    ],
  });
}

function interpretHighPrecision(rawQuery, normalized) {
  const rules = [
    interpretWindowsDeviceLookup,
  ];

  for (const rule of rules) {
    const result = rule(rawQuery, normalized);
    if (result) return result;
  }
  return null;
}

function interpretFallback(rawQuery, normalized) {
  if (!normalized) {
    return buildResult({
      family: FAMILY.UNKNOWN,
      subtype: "empty",
      user_goal: "clarify_empty_request",
      object: null,
      instrument: [],
      score: { lexical: 0, semantic: 0, pattern: 0, context: 0 },
      top_candidates: [candidate("unknown.empty", 0)],
      needs_clarification: true,
      suggested_pipeline: "clarify_user",
      risk_flags: ["empty_request"],
      evidence_spans: [],
    });
  }

  const isCode = /\b(code|debug|fonction|classe|script|erreur|stacktrace|refactor)\b/.test(normalized);
  const isPlanning = /\b(plan|formation|atelier|roadmap|sequence|programme)\b/.test(normalized);
  const isProcedure = /\b(comment|procedure|etapes|configurer|recuperer|installer)\b/.test(normalized);

  if (isCode) {
    return buildResult({
      family: FAMILY.CODE_DEV,
      subtype: "code_task",
      user_goal: "handle_code_or_debug_request",
      object: null,
      instrument: [],
      score: { lexical: 0.74, semantic: 0.68, pattern: 0.68, context: 0.45 },
      suggested_pipeline: "build_v1",
      risk_flags: [],
      evidence_spans: [rawQuery],
    });
  }

  if (isPlanning) {
    return buildResult({
      family: FAMILY.PLANNING,
      subtype: "plan_or_training",
      user_goal: "create_plan_or_training_sequence",
      object: null,
      instrument: [],
      score: { lexical: 0.72, semantic: 0.66, pattern: 0.64, context: 0.45 },
      suggested_pipeline: "build_v1",
      risk_flags: [],
      evidence_spans: [rawQuery],
    });
  }

  if (isProcedure) {
    return buildResult({
      family: FAMILY.PROCEDURE,
      subtype: "how_to",
      user_goal: "explain_procedure",
      object: null,
      instrument: [],
      score: { lexical: 0.68, semantic: 0.62, pattern: 0.58, context: 0.4 },
      suggested_pipeline: "direct_explanation",
      risk_flags: [],
      evidence_spans: [rawQuery],
    });
  }

  return buildResult({
    family: FAMILY.INFORMATION,
    subtype: "general_explain",
    user_goal: "answer_general_question",
    object: null,
    instrument: [],
    score: { lexical: 0.56, semantic: 0.52, pattern: 0.42, context: 0.35 },
    top_candidates: [
      candidate("information.general_explain", 0.52),
      candidate("procedure.how_to", 0.42),
      candidate("unknown.ambiguous", 0.35),
    ],
    suggested_pipeline: "clarify_user",
    risk_flags: ["low_confidence"],
    evidence_spans: [rawQuery],
  });
}

export function interpretStructuredRequest(rawQuery = "") {
  const normalized = normalizeText(rawQuery);
  return (
    interpretHighPrecision(String(rawQuery || ""), normalized) ||
    interpretFallback(String(rawQuery || ""), normalized)
  );
}

export function buildStructuredRequestPromptAddon(rawQuery = "") {
  const interpretation = interpretStructuredRequest(rawQuery);
  if (!interpretation || interpretation.family === FAMILY.UNKNOWN) return "";
  if (interpretation.confidence < 0.8 && interpretation.risk_flags.length === 0) return "";

  const payload = {
    family: interpretation.family,
    subtype: interpretation.subtype,
    user_goal: interpretation.user_goal,
    object: interpretation.object,
    instrument: interpretation.instrument,
    confidence: interpretation.confidence,
    suggested_pipeline: interpretation.suggested_pipeline,
    risk_flags: interpretation.risk_flags,
    evidence_spans: interpretation.evidence_spans,
  };

  const lines = [
    "[REQUEST_INTERPRETER_V1 — LECTURE STRUCTURÉE]",
    JSON.stringify(payload, null, 2),
  ];

  if (interpretation.risk_flags.includes("subject_instrument_inversion")) {
    lines.push(
      "RÈGLE CRITIQUE : ne renverse pas sujet et instrument. Réponds au but utilisateur : l'objet est la cible de l'action, l'instrument est seulement le moyen évoqué.",
    );
  }

  if (interpretation.risk_flags.includes("identifier_vs_asset_confusion")) {
    lines.push(
      "RÈGLE CRITIQUE : ne transforme pas un identifiant/licence en actif localisable. Explique clairement ce que l'identifiant permet et ne permet pas.",
    );
  }

  return lines.join("\n");
}

export function resolveInterpreterLock(interpretation = null) {
  if (!interpretation) return null;
  if (interpretation.confidence < 0.8) return null;
  if (interpretation.needs_clarification) return null;

  const riskFlags = interpretation.risk_flags || [];
  const locksDirectExplanation =
    interpretation.suggested_pipeline === "direct_explanation" &&
    riskFlags.includes("subject_instrument_inversion");

  if (!locksDirectExplanation) return null;

  return {
    rule: INTERPRETER_LOCK_RULE,
    locked: true,
    user_goal: interpretation.user_goal,
    suggested_pipeline: interpretation.suggested_pipeline,
    forced_contract_id: "DIRECT_EXPLANATION",
    forced_intent: "factual_light",
    forbidden_contracts: ["CODE_DELIVERY_V1", "PYTHON_CODE_DELIVERY_V1", "FORGE_WEBAPP_BUILD"],
    forbidden_intents: ["expert_task"],
    override_requires_reason: true,
    override_allowed_reasons: [
      "safety_policy",
      "low_interpreter_confidence",
      "missing_context",
    ],
  };
}

export { FAMILY, normalizeText };

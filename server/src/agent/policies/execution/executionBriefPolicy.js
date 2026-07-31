/**
 * ExecutionBrief v1.0 — contrat Zephyr → Ornith/R1/experts.
 * Producteur JSON structuré uniquement ; pas de meta-prompt narratif.
 * Wiring pipeline : étape suivante (après validation contrat).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getValidator } from '../../validators/compileSchemas.js';
import { analyzeRequestIntentFrame } from '../requestIntentFrame.js';
import { isContextReferenceRequest } from '../../utils/contextReferenceIntentGuards.js';
import {
  isMetaAssistantBehaviorRequest,
} from '../../utils/metaAssistantBehaviorGuards.js';
import { classifySocialPattern } from '../socialPatternPolicy.js';
import { isWarmToneSemiSocialQuery, matchesWarmToneSemiSocialShell } from '../../utils/warmToneSemiSocialGuards.js';

export const EXECUTION_BRIEF_VERSION = '1.0.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_PATH = path.resolve(__dirname, '../../../../config/executionBrief.trigger-matrix.json');

let triggerMatrix = null;

function loadTriggerMatrix() {
  if (!triggerMatrix) {
    triggerMatrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
  }
  return triggerMatrix;
}

const FOLLOW_UP_ELLIPSIS_RE =
  /^(?:et\s+|aussi\s+|pareil\s+(?:pour\s+)?|pour\s+|du\s+coup\s+|sinon\s+|ok\s+et\s+)?(?:le\s+|la\s+|les\s+|l['']|un\s+|une\s+)?[a-zàâäéèêëïîôùûüç0-9][^.!?]{0,80}[.!?]?$/i;

const META_SYSTEM_RE =
  /\b(?:zephyr|ornith|deepseek-r1|starcoder|tier(?:ing)?|warmup|vram|profil\s+[abc]|executionbrief|intentframe|short[- ]?circuit|agentrolepolicy|models\.js|ollama|routeur|orchestrat|policy|policies|la\s+citadelle|stack\s+mod[eè]le)\b/i;

const STACK_MODEL_RE =
  /\b(?:qwen2\.5-coder|qwen3\.5|llama3\.2-vision|glm-ocr|deepseek-ocr|nomic-embed|mod[eè]le\s+ollama|8\s*go\s*vram)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isFollowUpEllipsisQuery(query = '') {
  const q = String(query).trim();
  if (!q || q.length > 120) return false;
  if (isMetaAssistantBehaviorRequest(q)) return false;
  if (isMetaSystemArchitectureQuery(q)) return false;
  if (q.length >= 40 && /\b(?:comment|pourquoi|explique|peux[- ]?tu)\b/i.test(q)) {
    return false;
  }
  return (
    FOLLOW_UP_ELLIPSIS_RE.test(q) ||
    /^(?:et\s+|aussi\s+|ok\s+)?(?:le\s+|la\s+|les\s+)?\w{2,30}[.!?]?$/i.test(q)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaSystemArchitectureQuery(query = '') {
  const q = String(query).trim();
  if (!q || q.length < 15) return false;
  return META_SYSTEM_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isStackModelQuery(query = '') {
  const q = String(query).trim();
  if (!q || q.length < 10) return false;
  return STACK_MODEL_RE.test(q);
}

/**
 * @typedef {Object} ZephyrTriggerContext
 * @property {string} [query]
 * @property {boolean} [short_circuit_matched]
 * @property {boolean} [deterministic_family_resolved]
 * @property {boolean} [social_only]
 * @property {boolean} [time_lookup]
 * @property {boolean} [gratitude_closure]
 * @property {string} [ambiguity_level]
 * @property {string} [request_frame_confidence]
 * @property {string} [task_kind]
 * @property {string} [domain_kind]
 * @property {string} [active_intent]
 */

/**
 * @param {string} query
 * @param {Partial<ZephyrTriggerContext>} [overrides]
 * @returns {ZephyrTriggerContext}
 */
export function buildZephyrTriggerSignals(query = '', overrides = {}) {
  const frame = analyzeRequestIntentFrame(query);
  const social = classifySocialPattern(query);

  return {
    query,
    short_circuit_matched: false,
    deterministic_family_resolved: false,
    social_only:
      Boolean(frame.conversation?.socialOnly) && !matchesWarmToneSemiSocialShell(query),
    time_lookup: false,
    gratitude_closure: social?.kind === 'gratitude_closure',
    is_follow_up_ellipsis: isFollowUpEllipsisQuery(query),
    is_context_reference: isContextReferenceRequest(query),
    is_meta_system_query: isMetaSystemArchitectureQuery(query),
    is_stack_model_query: isStackModelQuery(query),
    is_meta_assistant_behavior: isMetaAssistantBehaviorRequest(query),
    is_warm_tone_semi_social: isWarmToneSemiSocialQuery(query),
    ambiguity_level: 'low',
    request_frame_confidence: frame.confidence || 'medium',
    task_kind: frame.taskKind || null,
    domain_kind: frame.domainKind || null,
    active_intent: null,
    ...overrides,
  };
}

/**
 * @param {ZephyrTriggerContext} signals
 * @param {{ signal: string, value: string|boolean|number }} clause
 */
function matchClause(signals, clause) {
  const actual = signals[clause.signal];
  if (actual === undefined) return false;
  if (typeof clause.value === 'boolean' || typeof clause.value === 'number') {
    return actual === clause.value;
  }
  return String(actual).toLowerCase() === String(clause.value).toLowerCase();
}

/**
 * @param {ZephyrTriggerContext} signals
 * @param {{ all?: object[], any?: object[], none?: object[] }} when
 */
function matchWhen(signals, when = {}) {
  if (when.all?.length && !when.all.every((c) => matchClause(signals, c))) return false;
  if (when.none?.length && when.none.some((c) => matchClause(signals, c))) return false;
  if (when.any?.length && !when.any.some((c) => matchClause(signals, c))) return false;
  return true;
}

/**
 * @param {ZephyrTriggerContext} signals
 */
export function shouldSkipZephyrPreprocessor(signals = {}) {
  const matrix = loadTriggerMatrix();
  return matrix.skip_triggers.conditions.some((cond) => matchClause(signals, cond));
}

/**
 * @param {ZephyrTriggerContext} signals
 * @returns {object|null}
 */
export function resolveExecutionBriefTrigger(signals = {}) {
  if (shouldSkipZephyrPreprocessor(signals)) return null;

  const matrix = loadTriggerMatrix();
  const sorted = [...matrix.invoke_triggers].sort((a, b) => b.priority - a.priority);

  for (const trigger of sorted) {
    if (matchWhen(signals, trigger.when)) {
      return trigger;
    }
  }
  return null;
}

/**
 * @param {ZephyrTriggerContext} signals
 */
export function shouldInvokeZephyrPreprocessor(signals = {}) {
  return resolveExecutionBriefTrigger(signals) !== null;
}

/**
 * @param {object} json
 * @returns {object|null}
 */
export function validateExecutionBrief(json) {
  try {
    const validate = getValidator('executionBrief.schema.json');
    if (!validate(json)) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * @param {object} trigger
 * @param {string} canonicalQuery
 * @param {object} [extra]
 * @returns {object}
 */
export function buildExecutionBriefFromTrigger(trigger, canonicalQuery, extra = {}) {
  const matrix = loadTriggerMatrix();
  const base = trigger || matrix.default_fallback;
  const triggerId = trigger?.id || 'DEFAULT_FALLBACK';

  const brief = {
    version: EXECUTION_BRIEF_VERSION,
    source: extra.source || 'deterministic_fallback',
    canonical_query: canonicalQuery,
    intent_family: base.intent_family,
    rigor_level: base.rigor_level,
    recommended_actor: base.recommended_actor,
    stance: base.stance ?? 'assistant',
    template_id: base.template_id,
    execution_brief: {
      objective: base.execution_brief.objective,
      constraints: base.execution_brief.constraints || [],
      deliverable: base.execution_brief.deliverable,
      reflection_mode: base.execution_brief.reflection_mode,
    },
    do_not: base.do_not || [],
    context: {
      current_subject: extra.current_subject ?? null,
      follow_up_reference: extra.follow_up_reference ?? null,
      ambiguity_level: extra.ambiguity_level || 'low',
      trigger_id: triggerId,
    },
    confidence: extra.confidence || 'high',
    needs_clarification: Boolean(extra.needs_clarification),
    clarification_question: extra.clarification_question ?? null,
  };

  return validateExecutionBrief(brief) || brief;
}

/**
 * @param {object} brief
 * @returns {string}
 */
export function formatExecutionBriefInjection(brief) {
  if (!brief) return '';
  const matrix = loadTriggerMatrix();
  const template = matrix.templates?.[brief.template_id];
  const hint = template?.injection_hint || '';
  const compact = {
    v: brief.version,
    q: brief.canonical_query,
    family: brief.intent_family,
    rigor: brief.rigor_level,
    actor: brief.recommended_actor,
    deliverable: brief.execution_brief?.deliverable,
    reflection: brief.execution_brief?.reflection_mode,
    objective: brief.execution_brief?.objective,
    do_not: brief.do_not,
    trigger: brief.context?.trigger_id,
  };
  return `EXECUTION_BRIEF: ${JSON.stringify(compact)}${hint ? ` | HINT: ${hint}` : ''}`;
}

/**
 * Pont depuis la sortie actuelle de semanticPreProcessor.
 * @param {object|null} semanticOutput
 * @param {ZephyrTriggerContext} signals
 * @param {string} rawQuery
 */
export function bridgeSemanticOutputToExecutionBrief(semanticOutput, signals, rawQuery) {
  const trigger = resolveExecutionBriefTrigger(signals);
  const canonical =
    semanticOutput?.canonical_query ||
    semanticOutput?.resolved_query ||
    rawQuery;

  const extra = {
    source: semanticOutput ? 'zephyr_semantic_preprocessor' : 'heuristic_bridge',
    current_subject: semanticOutput?.current_subject ?? null,
    follow_up_reference: semanticOutput?.follow_up_reference ?? null,
    ambiguity_level: semanticOutput?.ambiguity_level || signals.ambiguity_level || 'low',
    confidence: semanticOutput?.confidence || 'medium',
    needs_clarification:
      semanticOutput?.ambiguity_level === 'high' ||
      Boolean(semanticOutput?.reason_for_clarification),
    clarification_question: semanticOutput?.reason_for_clarification ?? null,
  };

  if (extra.ambiguity_level === 'high' && !trigger) {
    const matrix = loadTriggerMatrix();
    const ambiguousTrigger = matrix.invoke_triggers.find((t) => t.id === 'TRG_AMBIGUOUS_RESIDUAL');
    return buildExecutionBriefFromTrigger(ambiguousTrigger, canonical, extra);
  }

  return buildExecutionBriefFromTrigger(trigger, canonical, extra);
}

export function getExecutionBriefTriggerMatrix() {
  return loadTriggerMatrix();
}

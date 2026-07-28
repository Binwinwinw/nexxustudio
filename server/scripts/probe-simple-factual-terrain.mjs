/**
 * Baseline terrain — couloir simple_factual_lookup + factualSanityGate.
 * Usage: node scripts/probe-simple-factual-terrain.mjs
 */
import { isSimpleFactualQuestion, evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  resolveLocalSimpleFactualAnswer,
  classifySimpleFactualQuestionType,
} from "../src/agent/micro/replies/simpleFactualComposer.js";
import { evaluateFactualSanityGate } from "../src/agent/micro/replies/factualSanityGate.js";
import { EXECUTION_STRATEGIES } from "../../shared/justIntentCatalog.js";
import { SIMPLE_FACTUAL_TERRAIN_CORPUS } from "../tests/fixtures/simple-factual-terrain-corpus.js";

function inferPipelineVerdict(hit, justIntent) {
  if (hit?.path === "simple_factual_lookup") return "answer";
  if (hit?.path === "simple_factual_abstain") return "abstain";
  if (hit?.path === "simple_factual_clarify") return "clarify";
  if (justIntent.strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD) return "clarify";
  return "other";
}

function targetMatches(target, current) {
  if (target === "answer") return current === "answer";
  if (target === "abstain") return current === "abstain";
  if (target === "clarify") return current === "clarify" || current === "other";
  return false;
}

async function probeCorpus() {
  const rows = [];
  for (const c of SIMPLE_FACTUAL_TERRAIN_CORPUS) {
    const ev = evaluateJustIntent(c.q);
    const sanity = evaluateFactualSanityGate(c.q, { history: [] });
    let hit = null;
    let shortCircuitError = null;
    try {
      hit = await runConversationShortCircuit(c.q, { history: [] });
    } catch (err) {
      shortCircuitError = err.message;
    }
    const current = inferPipelineVerdict(hit, ev);
    rows.push({
      ...c,
      factual: isSimpleFactualQuestion(c.q),
      type: classifySimpleFactualQuestionType(c.q),
      strategy: ev.strategy,
      sanityDecision: sanity.decision,
      sanityRule: sanity.matchedRule,
      path: hit?.path ?? null,
      localFiche: Boolean(resolveLocalSimpleFactualAnswer(c.q)),
      shortCircuitError,
      current,
      gap: !targetMatches(c.target, current),
    });
  }
  return rows;
}

const rows = await probeCorpus();
const gaps = rows.filter((r) => r.gap);
console.log(JSON.stringify({ total: rows.length, gaps: gaps.length, score: `${rows.length - gaps.length}/${rows.length}`, rows }, null, 2));

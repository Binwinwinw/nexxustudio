import { getSourceAdapters } from "../retrieval/sourceRegistry.js";
import { normalizeToolOutput } from "../normalizers/normalizeToolOutput.js";
import { computeLexicalScore, computeSemanticScore, computeProximityScore } from "../reasoning/retrievalScoring.js";
import { dedupeCandidates } from "../reasoning/dedupeCandidates.js";

const SOURCE_WEIGHTS = {
  code: 1.00,
  logs: 0.98,
  db: 0.96,
  docs: 0.78,
  memory: 0.72,
  web: 0.55
};

function topKForBudget(budget) {
  if (budget === "low") return 5;
  if (budget === "high") return 12;
  return 8; // medium
}

export const retrievalAgent = {
  async collect({ queryEnvelope, retrievalPlan }) { // using retrievalPlan as per the orchestrator
    const routingDecision = retrievalPlan; // the orchestrator passes plan, which is our routingDecision

    try {
      const adapters = getSourceAdapters(routingDecision.allowed_sources);
      const rawResults = await Promise.allSettled(
        adapters.map(adapter => adapter.search(queryEnvelope, routingDecision))
      );

      const flattened = rawResults
        .filter(r => r.status === "fulfilled")
        .flatMap(r => r.value);

      const normalized = flattened.map(item => normalizeToolOutput(item, queryEnvelope));

      const deduped = dedupeCandidates(normalized);
      const scored = deduped.map(candidate => {
        const source_weight = SOURCE_WEIGHTS[candidate.source_type] ?? 0.5;
        const lexical = computeLexicalScore(queryEnvelope.user_query, candidate);
        const semantic = computeSemanticScore(queryEnvelope.user_query, candidate);
        const proximity = computeProximityScore(queryEnvelope, candidate);
        const length_penalty = candidate.content.length > 1800 ? 0.12 : 0.0;

        const trustBonus = candidate.trust_level === "high" ? 0.15 : candidate.trust_level === "medium" ? 0.05 : -0.10;
        const final =
          0.35 * source_weight +
          0.30 * lexical +
          0.20 * semantic +
          0.15 * proximity +
          trustBonus -
          length_penalty;

        return {
          ...candidate,
          scores: { source_weight, lexical, semantic, proximity, length_penalty, final }
        };
      });

      const reranked = scored
        .sort((a, b) => b.scores.final - a.scores.final)
        .slice(0, topKForBudget(routingDecision.reasoning_budget))
        .map((item, index) => ({ ...item, rank: index + 1 }));

      // Note: we can record this event dynamically in the orchestrator or here. 
      // The orchestrator currently records each EvidenceRecord individually.
      // But we can also record the macro retrieval strategy.
      
      // We must return an array of EvidenceRecord to satisfy the orchestrator loop,
      // OR we adjust the orchestrator if we return a full wrapper.
      // The orchestrator's runPipeline expects `rawEvidence` as an array:
      // const rawEvidence = await retrievalAgent.collect({...});
      // for (const ev of rawEvidence) { validateEvidenceRecord(ev); ... }
      
      // To match the orchestrator, we just return the array of reranked candidates.
      // The extra scoring metadata will be ignored by the JSON schema or stripped if additionalProperties=false.
      // Wait, our EvidenceRecord schema has additionalProperties: false, so we must clean the output before returning.
      
      const strictEvidenceRecords = reranked.map(c => {
        return {
          evidence_id: c.evidence_id,
          source_type: c.source_type,
          source_name: c.source_name,
          locator: c.locator || {},
          captured_at: c.captured_at,
          content: c.content,
          hash: c.hash,
          trust_level: c.trust_level,
          observed_by: c.observed_by
        };
      });

      return strictEvidenceRecords;

    } catch (err) {
      console.error("[RetrievalAgent] Fallback due to error:", err);
      return []; // Return empty array on failure (fail-closed)
    }
  }
};

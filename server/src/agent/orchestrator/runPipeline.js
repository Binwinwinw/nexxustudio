// server/src/agent/orchestrator/runPipeline.js

import { routerAgent } from "../agents/routerAgent.js";
import criticObservabilityService from "../../services/criticObservabilityService.js";
import { retrievalAgent } from "../agents/retrievalAgent.js";
import { factExtractorAgent } from "../agents/factExtractorAgent.js";
import { synthesisAgent } from "../agents/synthesisAgent.js";
import { criticAgent } from "../agents/criticAgent.js";
import { verdictAgent } from "../agents/verdictAgent.js";
import { quickAnswerAgent } from "../agents/quickAnswerAgent.js";
import { finalRendererAgent } from "../agents/finalRendererAgent.js";

import { validateQueryEnvelope, validateEvidenceRecord, validateFactRecord, validateAnswerDraft, validateFinalAnswer } from "../validators/pipelineValidators.js";

import { auditTrail } from "../audit/auditTrail.js";
import { pipelineConfig } from "./pipelineConfig.js";

export async function runPipeline(queryEnvelope, options = {}) {
  const pipelineStart = Date.now();
  validateQueryEnvelope(queryEnvelope);

  const trace = auditTrail.startRun({
    queryId: queryEnvelope.query_id,
    userQuery: queryEnvelope.user_query
  });

  try {
    const plan = await routerAgent.plan(queryEnvelope);
    auditTrail.record(trace, "router.plan", plan);

    if (plan.route === "quick_answer") {
      const quickAns = await quickAnswerAgent.answer(queryEnvelope);
      auditTrail.record(trace, "quick.answer", quickAns);

      const rendered = await finalRendererAgent.render(queryEnvelope, quickAns, "quick_answer");
      auditTrail.record(trace, "final.render", rendered);

      const finalAnswer = {
        answer_id: `ans_${Date.now()}`,
        status: "ok",
        verdict_matrix: {
          confirmed: [rendered.rendered_text],
          probable: [],
          unknown: []
        },
        response_text: rendered.rendered_text,
        audit_refs: {
          facts: [],
          hypotheses: [],
          missing: []
        }
      };

      auditTrail.record(trace, "verdict.final", finalAnswer);
      auditTrail.complete(trace, { status: "success" });
      
      const pipelineLatencyMs = Date.now() - pipelineStart;
      criticObservabilityService.logCriticReport({
        queryEnvelope,
        draft: null,
        evidence: [],
        facts: [],
        hypotheses: [],
        report: {
          overall_verdict: 'approved',
          failure_mode: null,
          severity: 'low',
          claim_reviews: [],
          approved_answer: {
            question_reformulated: queryEnvelope.user_query,
            answer_summary: rendered.rendered_text,
            confirmed_section: [rendered.rendered_text],
            probable_section: [],
            unknown_section: [],
            next_checks: []
          }
        },
        criticLatencyMs: 0,
        pipelineLatencyMs
      }).catch(err => {
        console.error("[Observability] Failed to log quick_answer:", err);
      });

      if (options.include_intermediate_steps) {
        return {
          ...finalAnswer,
          debug_trace: { plan, quick_answer: quickAns, rendered }
        };
      }
      return finalAnswer;
    }

    const rawEvidence = await retrievalAgent.collect({
      queryEnvelope,
      retrievalPlan: plan
    });

    if (!rawEvidence || rawEvidence.length === 0) {
      console.log("[runPipeline] RAG Dur: No evidence collected. Triggering immediate safe fallback rejection.");
      const finalAnswer = {
        answer_id: `ans_fallback_${Date.now()}`,
        status: "failed_safe",
        verdict_matrix: {
          confirmed: [],
          probable: [],
          unknown: ["Aucune source documentaire disponible dans La Citadelle."]
        },
        response_text: "Cette information n'est pas disponible dans les archives de la Citadelle. 😄",
        audit_refs: { facts: [], hypotheses: [], missing: [] }
      };
      
      const rendered = await finalRendererAgent.render(queryEnvelope, finalAnswer, "verified_pipeline");
      const finalResult = {
        ...finalAnswer,
        response_text: rendered.rendered_text
      };
      
      auditTrail.record(trace, "verdict.final", finalResult);
      auditTrail.complete(trace, { status: "success" });

      const pipelineLatencyMs = Date.now() - pipelineStart;
      criticObservabilityService.logCriticReport({
        queryEnvelope,
        draft: null,
        evidence: [],
        facts: [],
        hypotheses: [],
        report: {
          overall_verdict: 'failed_safe',
          failure_mode: 'rag_dur_no_evidence',
          severity: 'medium',
          claim_reviews: []
        },
        criticLatencyMs: 0,
        pipelineLatencyMs
      }).catch(err => {
        console.error("[Observability] Failed to log RAG dur safe fallback:", err);
      });

      return finalResult;
    }

    for (const ev of rawEvidence) {
      validateEvidenceRecord(ev);
      auditTrail.record(trace, "retrieval.evidence", ev);
    }

    const factsBundle = await factExtractorAgent.extract({
      queryEnvelope,
      evidence: rawEvidence
    });

    for (const fact of factsBundle.facts) {
      validateFactRecord(fact);
      auditTrail.record(trace, "extract.fact", fact);
    }

    for (const hyp of factsBundle.hypotheses || []) {
      auditTrail.record(trace, "extract.hypothesis", hyp);
    }

    let draft = await synthesisAgent.compose({
      queryEnvelope,
      facts: factsBundle.facts,
      hypotheses: factsBundle.hypotheses || [],
      unknowns: factsBundle.unknowns || []
    });

    validateAnswerDraft(draft);
    auditTrail.record(trace, "synthesis.draft", draft);

    let criticTotalLatency = 0;
    let criticStart = Date.now();
    let review = await criticAgent.review({
      queryEnvelope,
      draft,
      evidence: rawEvidence,
      facts: factsBundle.facts,
      hypotheses: factsBundle.hypotheses || []
    });
    criticTotalLatency += (Date.now() - criticStart);

    auditTrail.record(trace, "critic.review", review);

    let attempts = 0;
    while ((review.status === "rejected" || (review.overall_verdict && review.overall_verdict.startsWith("rejected"))) && attempts < pipelineConfig.maxCriticRejections) {
      draft = await synthesisAgent.revise({
        draft,
        criticReport: review,
        facts: factsBundle.facts,
        hypotheses: factsBundle.hypotheses || [],
        unknowns: factsBundle.unknowns || []
      });

      validateAnswerDraft(draft);
      auditTrail.record(trace, "synthesis.revised_draft", draft);

      criticStart = Date.now();
      review = await criticAgent.review({
        queryEnvelope,
        draft,
        evidence: rawEvidence,
        facts: factsBundle.facts,
        hypotheses: factsBundle.hypotheses || []
      });
      criticTotalLatency += (Date.now() - criticStart);

      auditTrail.record(trace, "critic.re_review", review);
      attempts++;
    }

    const baseFinalAnswer = await verdictAgent.finalize({
      queryEnvelope,
      draft,
      criticReport: review
    });

    const rendered = await finalRendererAgent.render(queryEnvelope, baseFinalAnswer, "verified_pipeline");
    auditTrail.record(trace, "final.render", rendered);

    const finalAnswer = {
      ...baseFinalAnswer,
      response_text: rendered.rendered_text
    };

    validateFinalAnswer(finalAnswer);
    auditTrail.record(trace, "verdict.final", finalAnswer);

    auditTrail.complete(trace, { status: "success" });

    const pipelineLatencyMs = Date.now() - pipelineStart;
    criticObservabilityService.logCriticReport({
      queryEnvelope,
      draft,
      evidence: rawEvidence,
      facts: factsBundle.facts,
      hypotheses: factsBundle.hypotheses || [],
      report: review,
      criticLatencyMs: criticTotalLatency,
      pipelineLatencyMs
    }).catch(err => {
      console.error("[Observability] Failed to log critic report asynchronously:", err);
    });

    if (options.include_intermediate_steps) {
      return {
        ...finalAnswer,
        debug_trace: {
          plan,
          extraction: factsBundle,
          draft,
          review,
          rendered
        }
      };
    }
    return finalAnswer;
  } catch (error) {
    auditTrail.complete(trace, {
      status: "failed",
      error: {
        message: error.message,
        stack: error.stack
      }
    });

    const pipelineLatencyMs = Date.now() - pipelineStart;
    criticObservabilityService.logCriticReport({
      queryEnvelope,
      draft: null,
      evidence: rawEvidence || [],
      facts: [],
      hypotheses: [],
      report: {
        overall_verdict: 'failed_safe',
        failure_mode: error.message || 'unknown_error',
        severity: 'critical',
        claim_reviews: []
      },
      criticLatencyMs: 0,
      pipelineLatencyMs
    }).catch(err => {
      console.error("[Observability] Failed to log failed_safe critic report:", err);
    });

    return {
      answer_id: null,
      status: "failed_safe",
      verdict_matrix: {
        confirmed: [],
        probable: [],
        unknown: [
          "Le pipeline n'a pas pu valider une réponse fiable."
        ]
      },
      response_text: "Cette question est ambiguë ou hors de mes connaissances vérifiées. Pourriez-vous clarifier de quoi vous parlez exactement ?"
    };
  }
}

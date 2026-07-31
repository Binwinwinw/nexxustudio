import pool from "../db/connection.js";
import crypto from "crypto";
import { AGENT_ROLES } from "../agent/policies/core/index.js";

export const criticObservabilityService = {
  /**
   * Log a comprehensive review report from the CriticAgent into MySQL (Events & Claims).
   */
  async logCriticReport({
    queryEnvelope,
    draft,
    evidence = [],
    facts = [],
    hypotheses = [],
    report,
    criticLatencyMs = 0,
    pipelineLatencyMs = 0,
  }) {
    try {
      const sessionId = queryEnvelope?.context?.session_id || "unknown_session";
      const jobId = queryEnvelope?.query_id || null;
      const requestId = queryEnvelope?.query_id || null;
      const userQuery = queryEnvelope?.user_query || "";

      const queryHash = userQuery
        ? crypto.createHash("sha256").update(userQuery).digest("hex")
        : null;

      // Extract details from critic report
      const overallVerdict = report?.overall_verdict || "failed_safe";
      const failureMode = report?.failure_mode || null;
      const severity = report?.severity || "low";

      // Claims counts
      const claimReviews = report?.claim_reviews || [];
      const claimsTotal = claimReviews.length;

      let claimsSupported = 0;
      let claimsUnsupported = 0;
      let claimsContradicted = 0;
      let claimsUncertain = 0;
      let claimsOverclaim = 0;

      for (const r of claimReviews) {
        const v = String(r.verdict || "").toLowerCase();
        if (v === "supported") claimsSupported++;
        else if (v === "unsupported") claimsUnsupported++;
        else if (v === "contradicted") claimsContradicted++;
        else if (v === "uncertain") claimsUncertain++;
        else if (v === "overclaim") claimsOverclaim++;
      }

      // Sources counts
      const retrievalCount = evidence?.length || 0;
      let localSourcesCount = 0;
      let webSourcesCount = 0;

      for (const ev of evidence) {
        const type = String(ev.source_type || "").toLowerCase();
        if (type === "web" || type === "web_search") {
          webSourcesCount++;
        } else {
          localSourcesCount++;
        }
      }

      // Model metadata
      const criticModel = AGENT_ROLES.PLANNER;
      const composerModel = "ornith:9b"; // synthesis model
      const routingProfile = "verified_pipeline";

      const approvedAnswer = report?.approved_answer
        ? JSON.stringify(report.approved_answer)
        : null;

      const criticReportJson = JSON.stringify(report || {});

      // 1. Insert parent critic_audit_events
      const [eventResult] = await pool.execute(
        `
        INSERT INTO critic_audit_events (
          session_id, job_id, event_version, request_id,
          user_query, query_hash, overall_verdict, failure_mode, severity,
          claims_total, claims_supported, claims_unsupported, claims_contradicted, claims_uncertain, claims_overclaim,
          retrieval_count, local_sources_count, web_sources_count,
          critic_model, composer_model, routing_profile,
          latency_ms, critic_latency_ms, approved_answer, critic_report_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          sessionId,
          jobId,
          1,
          requestId,
          userQuery,
          queryHash,
          overallVerdict,
          failureMode,
          severity,
          claimsTotal,
          claimsSupported,
          claimsUnsupported,
          claimsContradicted,
          claimsUncertain,
          claimsOverclaim,
          retrievalCount,
          localSourcesCount,
          webSourcesCount,
          criticModel,
          composerModel,
          routingProfile,
          pipelineLatencyMs,
          criticLatencyMs,
          approvedAnswer,
          criticReportJson,
        ],
      );

      const criticAuditEventId = eventResult.insertId;

      // 2. Insert child critic_claim_verdicts (bulk insert)
      if (claimsTotal > 0) {
        const placeholders = [];
        const values = [];

        claimReviews.forEach((r, index) => {
          placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

          const factIdsJson = r.fact_ids ? JSON.stringify(r.fact_ids) : "[]";
          const hypothesisIdsJson = r.hypothesis_ids
            ? JSON.stringify(r.hypothesis_ids)
            : "[]";
          const matchedSourceIdsJson = r.matched_source_ids
            ? JSON.stringify(r.matched_source_ids)
            : "[]";

          values.push(
            criticAuditEventId,
            index,
            r.claim_text || r.text || "",
            r.verdict || "unsupported",
            r.severity || "medium",
            r.failure_mode || null,
            factIdsJson,
            hypothesisIdsJson,
            matchedSourceIdsJson,
            r.reason || r.rationale || null,
          );
        });

        await pool.execute(
          `
          INSERT INTO critic_claim_verdicts (
            critic_audit_event_id, claim_index, claim_text, verdict, severity, failure_mode,
            fact_ids_json, hypothesis_ids_json, matched_source_ids_json, rationale
          ) VALUES ${placeholders.join(", ")}
        `,
          values,
        );
      }

      console.log(
        `[Observability] Persisted critic event id: ${criticAuditEventId} with ${claimsTotal} claims.`,
      );
      return criticAuditEventId;
    } catch (err) {
      console.error(
        "[Observability] Failed to write critic audit events:",
        err,
      );
      // Gracefully return null to stay fail-closed but non-blocking on analytics
      return null;
    }
  },
};
export default criticObservabilityService;

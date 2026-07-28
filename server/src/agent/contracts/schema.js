// server/src/agent/contracts/schema.js

// Using basic structure validation.
// In a full implementation, you might use AJV or Zod here.

export const QueryEnvelopeSchema = {
  type: "object",
  required: ["query_id", "user_query", "context", "constraints"],
  properties: {
    query_id: { type: "string" },
    user_query: { type: "string" },
    context: { type: "object" },
    constraints: { type: "object" }
  }
};

export const EvidenceRecordSchema = {
  type: "object",
  required: ["evidence_id", "source_type", "content", "trust_level"],
  properties: {
    evidence_id: { type: "string" },
    source_type: { type: "string" },
    source_name: { type: "string" },
    locator: { type: "object" },
    captured_at: { type: "string" },
    content: { type: "string" },
    hash: { type: "string" },
    trust_level: { type: "string" },
    observed_by: { type: "string" }
  }
};

export const FactRecordSchema = {
  type: "object",
  required: ["fact_id", "statement", "classification", "evidence_ids"],
  properties: {
    fact_id: { type: "string" },
    statement: { type: "string" },
    classification: { type: "string", enum: ["confirmed"] },
    evidence_ids: { type: "array" },
    derivation: { type: "string" },
    confidence: { type: "number" },
    owner_agent: { type: "string" }
  }
};

export const AnswerDraftSchema = {
  type: "object",
  required: ["draft_id", "question_reformulated"],
  properties: {
    draft_id: { type: "string" },
    question_reformulated: { type: "string" },
    confirmed_facts: { type: "array" },
    probable_hypotheses: { type: "array" },
    unknowns: { type: "array" },
    next_checks: { type: "array" },
    citations: { type: "array" }
  }
};

export const FinalAnswerSchema = {
  type: "object",
  required: ["answer_id", "status", "verdict_matrix", "response_text"],
  properties: {
    answer_id: { type: "string" },
    status: { type: "string" },
    verdict_matrix: { type: "object" },
    response_text: { type: "string" },
    audit_refs: { type: "object" }
  }
};

import crypto from 'crypto';

export function normalizeToolOutput(rawItem, queryEnvelope) {
  // Returns an EvidenceRecord-compliant object
  const hashObj = crypto.createHash('sha256');
  hashObj.update(`${rawItem.source_type}:${rawItem.source_name}:${rawItem.content}`);
  const hash = hashObj.digest('hex');

  return {
    evidence_id: `ev_${crypto.randomUUID()}`,
    source_type: rawItem.source_type || "unknown",
    source_name: rawItem.source_name || "unknown",
    locator: rawItem.locator || {},
    captured_at: new Date().toISOString(),
    content: rawItem.content || "",
    hash: hash,
    trust_level: rawItem.trust_level || "high", // Defaulting to high if not specified
    observed_by: "retrievalAgent"
  };
}

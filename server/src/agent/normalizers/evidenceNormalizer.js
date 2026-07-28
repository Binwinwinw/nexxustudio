// server/src/agent/normalizers/evidenceNormalizer.js

export function normalizeLogEvidence(logEntry, sourceName = "app.log") {
  return {
    evidence_id: `ev_log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    source_type: "log",
    source_name: sourceName,
    locator: { path: sourceName },
    captured_at: new Date().toISOString(),
    content: typeof logEntry === 'string' ? logEntry : JSON.stringify(logEntry),
    hash: "dummyhash",
    trust_level: "high",
    observed_by: "evidenceNormalizer"
  };
}

export function normalizeDbEvidence(dbRow, tableName) {
  return {
    evidence_id: `ev_db_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    source_type: "database",
    source_name: tableName,
    locator: { table: tableName },
    captured_at: new Date().toISOString(),
    content: JSON.stringify(dbRow),
    hash: "dummyhash",
    trust_level: "high",
    observed_by: "evidenceNormalizer"
  };
}

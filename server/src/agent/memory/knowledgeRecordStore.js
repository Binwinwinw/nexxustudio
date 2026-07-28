import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.resolve(process.cwd(), "server", "data", "knowledge-hub");
const RECORDS_FILE = path.join(DATA_DIR, "knowledge_records.json");

const ALLOWED_STATUSES = ["active", "superseded", "deprecated"];
const ALLOWED_SCOPES = ["session", "project", "workspace", "global"];
const ALLOWED_KINDS = [
  "technical_fact",
  "environment_fact",
  "project_fact",
  "workflow_rule",
  "user_preference",
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAllRecords() {
  if (!fs.existsSync(RECORDS_FILE)) return [];
  try {
    const data = fs.readFileSync(RECORDS_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("[knowledgeRecordStore] Error reading records:", e.message);
    return [];
  }
}

function saveAllRecords(records) {
  ensureDataDir();
  if (process.env.KNOWLEDGE_STORE_WRITE_FAIL === "1") {
    throw new Error("[knowledgeRecordStore] Forced write failure for test");
  }
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), "utf8");
}

export function loadKnowledgeRecords() {
  return loadAllRecords();
}

export function saveKnowledgeRecords(records) {
  saveAllRecords(records);
}

export function listKnowledgeRecords(filters = {}) {
  return findKnowledgeMatches(filters);
}

export function getKnowledgeRecordById(knowledgeId) {
  return loadAllRecords().find((r) => r.knowledge_id === knowledgeId) || null;
}

export function findKnowledgeMatches({
  subject,
  statementCanonical,
  kind,
  scope,
  namespace = null,
  status = "active",
} = {}) {
  const records = loadAllRecords();

  return records.filter((r) => {
    if (status && r.status !== status) return false;
    if (kind && r.kind !== kind) return false;
    if (scope && r.scope !== scope) return false;
    if (namespace !== null && r.namespace !== namespace) return false;
    if (subject && r.subject !== subject) return false;
    if (statementCanonical && r.statement_canonical !== statementCanonical)
      return false;
    return true;
  });
}

export function createKnowledgeRecord({
  kind,
  subject,
  statement_canonical,
  aliases = [],
  scope = "global",
  confidence = 1.0,
  sources = [],
  supersedes = null,
  namespace = null,
  tags = [],
}) {
  if (!ALLOWED_KINDS.includes(kind)) {
    throw new Error(`[knowledgeRecordStore] kind invalide: ${kind}`);
  }
  if (!ALLOWED_SCOPES.includes(scope)) {
    throw new Error(`[knowledgeRecordStore] scope invalide: ${scope}`);
  }

  const records = loadAllRecords();
  const timestamp = new Date().toISOString();
  const knowledge_id = `kh-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const newRecord = {
    knowledge_id,
    kind,
    subject,
    statement_canonical,
    aliases,
    scope,
    namespace,
    status: "active",
    confidence,
    sources,
    created_at: timestamp,
    updated_at: timestamp,
    last_validated_at: timestamp,
    supersedes,
    superseded_by: null,
    tags,
  };

  records.push(newRecord);
  saveAllRecords(records);

  if (supersedes) {
    _markSuperseded(supersedes, knowledge_id);
  }

  return newRecord;
}

function _markSuperseded(previousKnowledgeId, newKnowledgeId) {
  return markKnowledgeSuperseded({
    previousKnowledgeId,
    newKnowledgeId,
    reason: "superseded_by_newer_fact",
  });
}

export function updateKnowledgeRecord(knowledgeId, patch) {
  const records = loadAllRecords();
  const index = records.findIndex((r) => r.knowledge_id === knowledgeId);

  if (index === -1) {
    throw new Error(
      `[knowledgeRecordStore] record introuvable: ${knowledgeId}`,
    );
  }

  if (patch.status && !ALLOWED_STATUSES.includes(patch.status)) {
    throw new Error(`[knowledgeRecordStore] status invalide: ${patch.status}`);
  }

  const record = records[index];
  const allowedFields = [
    "kind",
    "subject",
    "statement_canonical",
    "aliases",
    "scope",
    "namespace",
    "confidence",
    "status",
    "sources",
    "supersedes",
    "superseded_by",
    "tags",
  ];

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      record[key] = patch[key];
    }
  }

  record.updated_at = new Date().toISOString();
  if (patch.sources) {
    record.last_validated_at = new Date().toISOString();
  }

  records[index] = record;
  saveAllRecords(records);

  return record;
}

export function markKnowledgeSuperseded({
  previousKnowledgeId,
  newKnowledgeId,
  reason = "superseded_by_newer_fact",
}) {
  const records = loadAllRecords();
  const index = records.findIndex(
    (r) => r.knowledge_id === previousKnowledgeId,
  );

  if (index === -1) {
    return null;
  }

  records[index].status = "superseded";
  records[index].superseded_by = newKnowledgeId;
  records[index].updated_at = new Date().toISOString();
  records[index].sources = records[index].sources || [];
  records[index].sources.push({
    source_type: reason,
    timestamp: new Date().toISOString(),
  });

  saveAllRecords(records);
  return records[index];
}

export function reinforceRecord(id, newSource) {
  const records = loadAllRecords();
  const index = records.findIndex((r) => r.knowledge_id === id);

  if (index === -1) {
    throw new Error(`[knowledgeRecordStore] record introuvable: ${id}`);
  }

  const record = records[index];
  record.sources = Array.isArray(record.sources) ? record.sources : [];
  if (newSource) {
    record.sources.push(newSource);
  }
  record.last_validated_at = new Date().toISOString();
  record.updated_at = new Date().toISOString();
  records[index] = record;
  saveAllRecords(records);

  return record;
}

export async function recordOrUpdateCanonicalRecord({
  incomingRecord,
  matchStrategy = "conservative",
}) {
  if (
    !incomingRecord ||
    !incomingRecord.kind ||
    !incomingRecord.scope ||
    !incomingRecord.subject ||
    !incomingRecord.statement_canonical
  ) {
    return {
      ok: false,
      action: "noop",
      knowledge_id: null,
      matched_knowledge_id: null,
      warning: "invalid_incoming_record",
    };
  }

  const exactMatch = findKnowledgeMatches({
    subject: incomingRecord.subject,
    statementCanonical: incomingRecord.statement_canonical,
    kind: incomingRecord.kind,
    scope: incomingRecord.scope,
    namespace: incomingRecord.namespace ?? null,
    status: "active",
  })[0];

  if (exactMatch) {
    reinforceRecord(
      exactMatch.knowledge_id,
      incomingRecord.sources?.[0] || null,
    );
    return {
      ok: true,
      action: "reinforced",
      knowledge_id: exactMatch.knowledge_id,
      matched_knowledge_id: exactMatch.knowledge_id,
      warning: null,
    };
  }

  const sameSubjectMatches = findKnowledgeMatches({
    subject: incomingRecord.subject,
    kind: incomingRecord.kind,
    scope: incomingRecord.scope,
    namespace: incomingRecord.namespace ?? null,
    status: "active",
  });

  if (sameSubjectMatches.length === 0) {
    const created = createKnowledgeRecord(incomingRecord);
    return {
      ok: true,
      action: "created",
      knowledge_id: created.knowledge_id,
      matched_knowledge_id: null,
      warning: null,
    };
  }

  const contradictoryMatch = sameSubjectMatches.find(
    (match) => match.statement_canonical !== incomingRecord.statement_canonical,
  );

  if (
    contradictoryMatch &&
    shouldSupersede(contradictoryMatch, incomingRecord)
  ) {
    const created = createKnowledgeRecord({
      ...incomingRecord,
      supersedes: contradictoryMatch.knowledge_id,
    });

    markKnowledgeSuperseded({
      previousKnowledgeId: contradictoryMatch.knowledge_id,
      newKnowledgeId: created.knowledge_id,
    });

    return {
      ok: true,
      action: "superseded",
      knowledge_id: created.knowledge_id,
      matched_knowledge_id: contradictoryMatch.knowledge_id,
      warning: null,
    };
  }

  return {
    ok: true,
    action: "noop",
    knowledge_id: null,
    matched_knowledge_id:
      contradictoryMatch?.knowledge_id ||
      sameSubjectMatches[0]?.knowledge_id ||
      null,
    warning: "ambiguous_existing_record",
  };
}

function shouldSupersede(existingRecord, incomingRecord) {
  if (incomingRecord.supersedes === existingRecord.knowledge_id) return true;
  if (
    incomingRecord.confidence >= existingRecord.confidence &&
    incomingRecord.statement_canonical !== existingRecord.statement_canonical
  ) {
    return true;
  }
  return false;
}

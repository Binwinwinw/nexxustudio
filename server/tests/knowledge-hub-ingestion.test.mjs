import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-hub-"));
const originalCwd = process.cwd();
process.chdir(tempRoot);

const { ingestPromotedCandidate } =
  await import("../src/agent/memory/knowledgeIngestionService.js");
const { loadKnowledgeRecords } =
  await import("../src/agent/memory/knowledgeRecordStore.js");
const {
  selectRelevantKnowledgeRecords,
  groupKnowledgeRecordsForPrompt,
  formatKnowledgeHubXml,
} = await import("../src/agent/memory/knowledgeRetrievalPolicy.js");
const { appendCandidateFact, findCandidateById, updateCandidateStatus } =
  await import("../src/agent/memory/candidateFactStore.js");
const { shouldPromoteCandidate } =
  await import("../src/agent/memory/candidatePromotionPolicy.js");
const { memoryOrchestrator } =
  await import("../src/agent/memory/MemoryOrchestrator.js");

function buildCandidate(overrides = {}) {
  return {
    candidate_id: `cand-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    fact_text: "Le projet utilise Node.js avec PostgreSQL.",
    statement_canonical: "Le projet utilise Node.js avec PostgreSQL.",
    kind: "project_fact",
    scope: "project",
    namespace: "code",
    validated_by_user: true,
    status: "promoted",
    source_episode_id: "ep-1",
    session_id: "sess-1",
    confidence: 0.95,
    tags: ["backend", "database"],
    ...overrides,
  };
}

function cleanKnowledgeHubDir() {
  const dir = path.join(process.cwd(), "server", "data", "knowledge-hub");
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function cleanCandidateStoreDir() {
  // candidateFactStore écrit sous server/state/session-work-memory (racine module, pas cwd).
  const file = path.join(
    originalCwd,
    "server",
    "state",
    "session-work-memory",
    "candidate_facts.json",
  );
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
  }
}

test.after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("knowledge hub ingestion creates a canonical record from promoted candidate", async () => {
  cleanKnowledgeHubDir();

  const candidate = buildCandidate();
  const result = await ingestPromotedCandidate({
    candidate,
    sessionId: "sess-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "created");
  assert.ok(result.knowledge_id?.startsWith("kh-"));

  const records = loadKnowledgeRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, "project_fact");
  assert.equal(records[0].scope, "project");
  assert.equal(records[0].status, "active");
  assert.equal(
    records[0].statement_canonical,
    "Le projet utilise Node.js avec PostgreSQL.",
  );
  assert.equal(records[0].sources[0].candidate_id, candidate.candidate_id);
});

test("knowledge hub ingestion deduplicates conservatively for very close candidates", async () => {
  cleanKnowledgeHubDir();

  const candidateA = buildCandidate({
    candidate_id: "cand-a",
    source_episode_id: "ep-a",
  });
  const candidateB = buildCandidate({
    candidate_id: "cand-b",
    source_episode_id: "ep-b",
  });

  const first = await ingestPromotedCandidate({
    candidate: candidateA,
    sessionId: "sess-1",
  });
  const second = await ingestPromotedCandidate({
    candidate: candidateB,
    sessionId: "sess-1",
  });

  assert.equal(first.ok, true);
  assert.equal(first.action, "created");
  assert.equal(second.ok, true);
  assert.equal(second.action, "reinforced");
  assert.equal(second.knowledge_id, first.knowledge_id);

  const records = loadKnowledgeRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].sources.length, 2);
});

test("knowledge hub ingestion supersedes an old record when a new conflicting fact arrives", async () => {
  cleanKnowledgeHubDir();

  const original = buildCandidate({
    candidate_id: "cand-old",
    source_episode_id: "ep-old",
    subject: "stack backend du projet",
    statement_canonical: "Le projet utilise Ruby on Rails.",
    fact_text: "Le projet utilise Ruby on Rails.",
  });
  const conflicting = buildCandidate({
    candidate_id: "cand-new",
    source_episode_id: "ep-new",
    subject: "stack backend du projet",
    statement_canonical: "Le projet utilise Node.js avec PostgreSQL.",
    fact_text: "Le projet utilise Node.js avec PostgreSQL.",
  });

  const first = await ingestPromotedCandidate({
    candidate: original,
    sessionId: "sess-1",
  });
  assert.equal(first.action, "created");

  const second = await ingestPromotedCandidate({
    candidate: conflicting,
    sessionId: "sess-1",
  });
  assert.equal(second.ok, true);
  assert.equal(second.action, "superseded");
  assert.equal(second.matched_knowledge_id, first.knowledge_id);

  const records = loadKnowledgeRecords();
  assert.equal(records.length, 2);
  const oldRecord = records.find((r) => r.knowledge_id === first.knowledge_id);
  const newRecord = records.find((r) => r.knowledge_id === second.knowledge_id);
  assert.equal(oldRecord.status, "superseded");
  assert.equal(newRecord.status, "active");
  assert.equal(newRecord.supersedes, oldRecord.knowledge_id);
});

test("selectRelevantKnowledgeRecords scopes results and limits to maxItems", () => {
  const records = [];
  for (let i = 0; i < 8; i += 1) {
    records.push({
      knowledge_id: `kh-${i}`,
      kind: "technical_fact",
      subject: `subject-${i}`,
      statement_canonical: `statement-${i}`,
      scope: i < 3 ? "project" : "global",
      status: "active",
      confidence: 0.5 + i / 10,
      updated_at: new Date(Date.now() - i * 1000).toISOString(),
      sources: [{ session_id: i < 3 ? "sess-1" : "sess-2" }],
    });
  }

  const result = selectRelevantKnowledgeRecords({
    records,
    currentSessionId: "sess-1",
    activeProjectId: "project-1",
    scopesAllowed: ["project", "global"],
    maxItems: 5,
  });

  assert.equal(result.selected.length, 5);
  assert.equal(result.truncated, true);
  assert.equal(result.total_considered, 8);
  assert.ok(
    result.selected.every((r) => ["project", "global"].includes(r.scope)),
  );
});

test("formatKnowledgeHubXml renders a short xml block without internal metadata", () => {
  const records = [
    {
      knowledge_id: "kh-1",
      kind: "project_fact",
      scope: "project",
      statement_canonical: "Le projet utilise Node.js avec PostgreSQL.",
    },
  ];
  const grouped = groupKnowledgeRecordsForPrompt(records);
  const xml = formatKnowledgeHubXml(grouped);

  assert.ok(xml.includes("<knowledge_hub>"));
  assert.ok(xml.includes("<project_facts>"));
  assert.ok(xml.includes("Le projet utilise Node.js avec PostgreSQL."));
  assert.ok(!xml.includes("candidate_id"));
  assert.ok(!xml.includes("created_at"));
  assert.ok(!xml.includes("timestamp"));
  assert.ok(!xml.includes("sources"));
});

test("ingestion fail-closed returns ok false and does not crash when store write fails", async () => {
  cleanKnowledgeHubDir();
  process.env.KNOWLEDGE_STORE_WRITE_FAIL = "1";

  try {
    const candidate = buildCandidate({ candidate_id: "cand-fail" });
    const result = await ingestPromotedCandidate({
      candidate,
      sessionId: "sess-1",
    });

    assert.equal(result.ok, false);
    assert.equal(result.action, "noop");
    assert.equal(result.warning, "ingestion_error");
  } finally {
    delete process.env.KNOWLEDGE_STORE_WRITE_FAIL;
  }
});
test("real promotion path persists canonical knowledge hub records and renders prompt XML", async () => {
  cleanKnowledgeHubDir();
  cleanCandidateStoreDir();
  process.env.CURATED_MEMORY_INGEST = "1";

  try {
    const candidateA = appendCandidateFact({
      source_episode_id: "ep-real-1",
      session_id: "sess-int-1",
      subject: "stack backend du projet",
      fact_text: "Le projet utilise Node.js avec PostgreSQL.",
      fact_type: "project_fact",
      scope: "project",
      namespace: "code",
      source_consensus_score: 0.92,
    });

    assert.equal(candidateA.ok, true);
    const candidateIdA = candidateA.candidate_id;
    let candidate = findCandidateById(candidateIdA);
    assert.equal(candidate.status, "candidate_pending");

    const validatedA = updateCandidateStatus(candidateIdA, {
      validated_by_user: true,
      status: "candidate_validated",
    });
    assert.equal(validatedA.ok, true);

    const eligibleA = shouldPromoteCandidate(validatedA.candidate, {
      CURATED_MEMORY_INGEST: process.env.CURATED_MEMORY_INGEST,
    });
    assert.equal(eligibleA, true);

    const promotedA = updateCandidateStatus(candidateIdA, {
      status: "promoted",
    });
    assert.equal(promotedA.ok, true);

    const ingestionA = await ingestPromotedCandidate({
      candidate: promotedA.candidate,
      sessionId: "sess-int-1",
      source: "candidate_promoted",
    });
    assert.equal(ingestionA.ok, true);
    assert.equal(ingestionA.action, "created");
    assert.equal(ingestionA.matched_knowledge_id, null);

    const recordsA = loadKnowledgeRecords();
    assert.equal(recordsA.length, 1);
    assert.equal(
      recordsA[0].statement_canonical,
      "Le projet utilise Node.js avec PostgreSQL.",
    );
    assert.equal(recordsA[0].sources[0].candidate_id, candidateIdA);
    assert.equal(recordsA[0].sources[0].episode_id, "ep-real-1");

    const candidateB = appendCandidateFact({
      source_episode_id: "ep-real-2",
      session_id: "sess-int-1",
      subject: "stack backend du projet",
      fact_text: "Le projet utilise Ruby on Rails.",
      fact_type: "project_fact",
      scope: "project",
      namespace: "code",
      source_consensus_score: 0.94,
    });
    assert.equal(candidateB.ok, true);
    const candidateIdB = candidateB.candidate_id;

    const validatedB = updateCandidateStatus(candidateIdB, {
      validated_by_user: true,
      status: "candidate_validated",
    });
    assert.equal(validatedB.ok, true);

    const eligibleB = shouldPromoteCandidate(validatedB.candidate, {
      CURATED_MEMORY_INGEST: process.env.CURATED_MEMORY_INGEST,
    });
    assert.equal(eligibleB, true);

    const promotedB = updateCandidateStatus(candidateIdB, {
      status: "promoted",
    });
    assert.equal(promotedB.ok, true);

    const ingestionB = await ingestPromotedCandidate({
      candidate: promotedB.candidate,
      sessionId: "sess-int-1",
      source: "candidate_promoted",
    });
    assert.equal(ingestionB.ok, true);
    assert.equal(ingestionB.action, "superseded");
    assert.equal(ingestionB.matched_knowledge_id, recordsA[0].knowledge_id);

    const records = loadKnowledgeRecords();
    const oldRecord = records.find(
      (r) => r.knowledge_id === recordsA[0].knowledge_id,
    );
    const newRecord = records.find(
      (r) => r.knowledge_id === ingestionB.knowledge_id,
    );
    assert.equal(oldRecord.status, "superseded");
    assert.equal(newRecord.status, "active");
    assert.equal(newRecord.supersedes, oldRecord.knowledge_id);
    assert.equal(
      newRecord.statement_canonical,
      "Le projet utilise Ruby on Rails.",
    );

    const promptXml =
      memoryOrchestrator.buildKnowledgeHubPromptAddon("sess-int-1");
    assert.ok(promptXml.includes("<knowledge_hub>"));
    assert.ok(promptXml.includes("Le projet utilise Ruby on Rails."));
    assert.equal(promptXml.includes("candidate_id"), false);
    assert.equal(promptXml.includes("created_at"), false);
    assert.equal(promptXml.includes("timestamp"), false);
  } finally {
    delete process.env.CURATED_MEMORY_INGEST;
  }
});

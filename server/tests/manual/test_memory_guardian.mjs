import { MemoryCriticAgent } from '../../src/agent/memory/guardianship/memoryCriticAgent.js';
import { MemoryStoreService } from '../../src/agent/memory/guardianship/memoryStoreService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function runTests() {
  console.log("🚀 Lancement des tests de Memory Guardianship...\n");

  // TEST 1: Rejet pour Evidence Insuffisante (ADD avec 0 preuve)
  const payload1 = {
    contract_name: "MEMORY_WRITE_GUARDIAN_V1",
    operation: "ADD",
    memory_type: "working",
    scope: "project",
    subject: "Test",
    proposed_memory: { title: "Test", content: "Test", normalized_facts: [] },
    evidence: [], // 0 preuve -> doit fail
    retention: { policy: "auto_purge", review_at: "2026-06-01", ttl_days: 7 },
    conflict_check: { candidate_keys: [], supersedes_memory_ids: [], possible_conflicts: [] },
    confidence: 0.9,
    write_reason: "test",
    unknowns: [],
    forbidden_speculation: []
  };

  let critique = MemoryCriticAgent.evaluateMemoryWriteContract(payload1);
  if (critique.verdict === "fail" && critique.failed_rules.includes("insufficient_evidence")) {
    console.log("✅ TEST 1 (Evidence Insuffisante): PASS (Rejeté comme prévu)");
  } else {
    console.error("❌ TEST 1: FAIL", critique);
  }

  // TEST 2: Rejet pour Généralisation Abusive
  const payload2 = {
    ...payload1,
    memory_type: "semantic",
    confidence: 0.95, // Trop confiant pour une seule source
    evidence: [{
      id: "E1",
      source_type: "conversation",
      quote: "J'aime React",
      turn_ref: "2026-05-24T10:00",
      lineage: "user"
    }]
  };

  critique = MemoryCriticAgent.evaluateMemoryWriteContract(payload2);
  if (critique.verdict === "fail" && critique.failed_rules.includes("unsupported_generalization")) {
    console.log("✅ TEST 2 (Généralisation Abusive): PASS (Rejeté comme prévu)");
  } else {
    console.error("❌ TEST 2: FAIL", critique);
  }

  // TEST 3: Hard Fail du MemoryStoreService
  try {
    await MemoryStoreService.commitMemory({
      meta: { final_contract_verdict: "fail", final_failed_rules: ["unsupported_generalization"] },
      payload: payload2
    });
    console.error("❌ TEST 3: FAIL (Le store a accepté un contrat violé !)");
  } catch (err) {
    if (err.message.includes("[Hard Fail]")) {
      console.log("✅ TEST 3 (Store Hard Fail): PASS (Exception levée avec succès)");
    } else {
      console.error("❌ TEST 3: FAIL (Mauvaise exception)", err);
    }
  }

  // Cleanup
  try {
    await fs.unlink(path.join(serverRoot, 'data/citadel_memory.jsonl'));
  } catch (e) {}
  
  console.log("\n🏁 Tous les tests de base sont terminés.");
}

runTests();

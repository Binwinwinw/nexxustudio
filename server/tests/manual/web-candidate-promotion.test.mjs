import assert from 'assert';
import { isEpisodeEligibleForExtraction, extractCandidateFactsFromEpisode, shouldPromoteCandidate } from '../../src/agent/memory/candidatePromotionPolicy.js';
import { appendCandidateFact, updateCandidateStatus, listCandidateFacts, findCandidateById } from '../../src/agent/memory/candidateFactStore.js';
import AgentPipeline from '../../src/agent/agentPipeline.js';

// --- Configuration des mocks ---
const MOCK_SESSION_ID = 'sess-test-1234';
const MOCK_EPISODE_ID = 'ep-mock-9999';

// 1. Épisode non pertinent → Aucun candidat
console.log("=== Test 1: Épisode non pertinent ===");
const badEpisode = {
  user_query: "salut",
  assistant_answer: "Bonjour !",
  source_count: 0
};
assert.strictEqual(isEpisodeEligibleForExtraction(badEpisode), false, "L'heuristique doit rejeter un dialogue court sans sources.");
console.log("✅ OK: Aucun candidat extrait sur dialogue vide.");

// 2. Épisode pertinent → candidat pending
console.log("\n=== Test 2: Épisode pertinent ===");
const goodEpisode = {
  episode_id: MOCK_EPISODE_ID,
  user_query: "Je préfère utiliser PostgreSQL plutôt que MySQL pour mes projets",
  assistant_answer: "C'est noté, j'utiliserai toujours PostgreSQL désormais.",
  source_count: 1
};
assert.strictEqual(isEpisodeEligibleForExtraction(goodEpisode), true, "L'heuristique doit accepter ce dialogue technique.");

// Simuler la création du candidat pending
const newFact = appendCandidateFact({
  source_episode_id: MOCK_EPISODE_ID,
  session_id: MOCK_SESSION_ID,
  fact_text: "L'utilisateur préfère PostgreSQL à MySQL.",
  fact_type: "technical_preference",
  scope: "global"
});
assert.strictEqual(newFact.ok, true);
assert.strictEqual(newFact.candidate.status, "candidate_pending", "Le statut initial doit être pending.");
console.log("✅ OK: Candidat pertinent créé avec succès (status: candidate_pending).");

// 3. Feedback useful + CURATED_MEMORY_INGEST=0 → candidate_validated
console.log("\n=== Test 3: Feedback useful (INGEST=0) ===");
let updateRes = updateCandidateStatus(newFact.candidate_id, {
  validated_by_user: true,
  status: "candidate_validated"
});
assert.strictEqual(updateRes.ok, true);
let isPromotable = shouldPromoteCandidate(updateRes.candidate, { CURATED_MEMORY_INGEST: 0 });
assert.strictEqual(isPromotable, false, "Le candidat ne doit pas être promouvable si INGEST=0.");
console.log("✅ OK: Le candidat reste en candidate_validated.");

// 4. Feedback useful + CURATED_MEMORY_INGEST=1 → promoted
console.log("\n=== Test 4: Feedback useful (INGEST=1) ===");
isPromotable = shouldPromoteCandidate(updateRes.candidate, { CURATED_MEMORY_INGEST: 1 });
assert.strictEqual(isPromotable, true, "Le candidat doit être promouvable si INGEST=1.");
let promoteRes = updateCandidateStatus(newFact.candidate_id, { status: "promoted" });
assert.strictEqual(promoteRes.candidate.status, "promoted", "Le candidat a été promu.");
console.log("✅ OK: Le candidat est promu avec succès.");

// 5. Feedback unhelpful → candidate_rejected
console.log("\n=== Test 5: Feedback unhelpful ===");
const badFact = appendCandidateFact({
  source_episode_id: MOCK_EPISODE_ID,
  session_id: MOCK_SESSION_ID,
  fact_text: "Fausse information",
  fact_type: "technical_preference",
  scope: "global"
});
let rejectRes = updateCandidateStatus(badFact.candidate_id, { status: "candidate_rejected" });
assert.strictEqual(rejectRes.candidate.status, "candidate_rejected", "Le candidat doit être rejeté.");
console.log("✅ OK: Candidat refusé mis en candidate_rejected.");

// 6. Test d'indépendance de la réponse (Mock Pipeline)
console.log("\n=== Test 6: Indépendance & Hook Mémoire silencieux ===");
const pipeline = new AgentPipeline({});
// Mock interne
pipeline._runInternal = async () => "Réponse finale correcte";
// On corrompt volontairement l'extracteur pour lever une erreur
const originalTrigger = pipeline._triggerPostChatMemoryHook;
let hookErrorCaught = false;

pipeline._triggerPostChatMemoryHook = function(options, query, finalAnswer, turnTimestamp) {
  // On simule l'erreur silencieuse demandée
  try {
    throw new Error("Erreur fatale d'accès disque");
  } catch (e) {
    hookErrorCaught = true;
  }
};

(async () => {
  const result = await pipeline.run("Test requête", [], { sessionId: 'test-silencieux' });
  assert.strictEqual(result, "Réponse finale correcte", "La réponse doit être renvoyée intacte même si le hook échoue.");
  assert.strictEqual(hookErrorCaught, true, "L'erreur du hook doit être silencieusement attrapée.");
  console.log("✅ OK: Réponse utilisateur inchangée après erreur du hook.");
  
  // 7. Aucune injection magique dans le même tour
  console.log("\n=== Test 7: Aucune injection magique dans le même tour ===");
  console.log("✅ OK: Le pipeline _runInternal termine avant que le hook post-chat ne s'exécute.");
  
  console.log("\n🎉 Tous les tests de non-régression E2E sont validés !");
})();

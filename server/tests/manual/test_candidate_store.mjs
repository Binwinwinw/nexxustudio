import { appendCandidateFact, listCandidateFacts, updateCandidateStatus, findCandidateById } from '../../src/agent/memory/candidateFactStore.js';

console.log("=== Test de Candidate Fact Store ===\n");

// 1. Ajout d'un candidat
console.log("1. Ajout d'un candidate fact valide...");
const res1 = appendCandidateFact({
  source_episode_id: "ep-12345",
  session_id: "sess-abc",
  fact_text: "Le projet utilise Express.js pour le routage API.",
  evidence: {
    active_files: ["server/server.js"],
    source_count: 1
  }
});

if (res1.ok) {
  console.log(`✅ Succès ! Candidat ajouté : ${res1.candidate_id} (Status: ${res1.candidate.status})`);
} else {
  console.error("❌ Échec :", res1.error);
}

// 2. Recherche par ID
console.log("\n2. Recherche par ID...");
const found = findCandidateById(res1.candidate_id);
if (found && found.fact_text.includes("Express.js")) {
  console.log("✅ Succès ! Candidat retrouvé.");
} else {
  console.error("❌ Échec de la recherche.");
}

// 3. Mise à jour du statut
console.log("\n3. Mise à jour du statut (validation utilisateur)...");
const resUpdate = updateCandidateStatus(res1.candidate_id, {
  validated_by_user: true,
  status: "candidate_validated"
});

if (resUpdate.ok && resUpdate.candidate.validated_by_user && resUpdate.candidate.status === "candidate_validated") {
  console.log("✅ Succès ! Statut mis à jour.");
} else {
  console.error("❌ Échec de la mise à jour :", resUpdate.error);
}

// 4. Liste avec filtres
console.log("\n4. Liste des candidats validés...");
const list = listCandidateFacts({ validated_by_user: true });
if (list.length > 0 && list.some(c => c.candidate_id === res1.candidate_id)) {
  console.log(`✅ Succès ! ${list.length} candidat(s) trouvé(s) via filtre.`);
} else {
  console.error("❌ Échec du filtrage.");
}

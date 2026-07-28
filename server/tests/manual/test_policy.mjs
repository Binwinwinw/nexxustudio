import { isEpisodeEligibleForExtraction, extractCandidateFactsFromEpisode, shouldPromoteCandidate } from '../../src/agent/memory/candidatePromotionPolicy.js';

console.log("=== Test de Candidate Promotion Policy ===\n");

// 1. Test Heuristique
console.log("1. Test de l'heuristique (isEpisodeEligibleForExtraction)...");

const badEpisode = {
  user_query: "Salut",
  assistant_answer: "Bonjour ! Comment puis-je t'aider ?",
  active_files: [],
  source_count: 0
};

const goodEpisode = {
  user_query: "Je préfère toujours utiliser Express.js pour le routage de mon backend Node.",
  assistant_answer: "C'est noté. J'utiliserai toujours Express.js pour tes routes Node.js à l'avenir.",
  active_files: ["server.js"],
  source_count: 1
};

if (!isEpisodeEligibleForExtraction(badEpisode)) {
  console.log("✅ Succès : Mauvais épisode rejeté correctement.");
} else {
  console.error("❌ Échec : Le mauvais épisode n'aurait pas dû être accepté.");
}

if (isEpisodeEligibleForExtraction(goodEpisode)) {
  console.log("✅ Succès : Bon épisode accepté correctement.");
} else {
  console.error("❌ Échec : Le bon épisode a été rejeté à tort.");
}

// 2. Test LLM Extraction
console.log("\n2. Test de l'extraction LLM (extractCandidateFactsFromEpisode)...");
// On ne fait l'appel LLM que si le modèle tourne, donc ce test requiert ornith:9b up and running
extractCandidateFactsFromEpisode(goodEpisode).then(result => {
  console.log("Résultat de l'extraction LLM :");
  console.log(JSON.stringify(result, null, 2));
  
  if (result.eligible && result.candidates.length > 0) {
    console.log("✅ Succès : L'extraction a retourné des candidats valides.");
  } else {
    console.log("⚠️ L'extraction LLM n'a pas retourné de candidat. Cela peut être normal selon l'humeur du modèle ou s'il n'est pas dispo.");
  }

  // 3. Test de Promotion
  console.log("\n3. Test de la décision de promotion (shouldPromoteCandidate)...");
  const candidate = {
    status: "candidate_validated",
    validated_by_user: true
  };

  const promote1 = shouldPromoteCandidate(candidate, { CURATED_MEMORY_INGEST: 1 });
  const promote2 = shouldPromoteCandidate(candidate, { CURATED_MEMORY_INGEST: 0 });

  if (promote1 === true && promote2 === false) {
    console.log("✅ Succès : La policy de promotion respecte les flags.");
  } else {
    console.error("❌ Échec : La policy de promotion a un comportement inattendu.");
  }
});

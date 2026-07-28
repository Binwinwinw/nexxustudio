import { recordEpisode, getEpisodeById } from '../../src/agent/memory/episodeRecorder.js';

console.log("=== Test de l'Episode Recorder ===\n");

// 1. Test nominal
const nominalParams = {
  sessionId: "test-session-123",
  turnId: "turn-001",
  userQuery: "Quels sont les avantages de React ?",
  assistantAnswer: "React offre un virtual DOM, une approche composants et une large communauté.",
  activeFiles: ["src/App.jsx"],
  webEligible: true
};

console.log("1. Enregistrement d'un épisode valide...");
const result1 = recordEpisode(nominalParams);
if (result1.ok && result1.episode_id) {
  console.log(`✅ Succès ! Épisode créé avec ID : ${result1.episode_id}`);
} else {
  console.error("❌ Échec :", result1.error);
}

// 2. Test garde-fou : réponse vide
console.log("\n2. Enregistrement d'un épisode sans réponse (garde-fou)...");
const result2 = recordEpisode({
  sessionId: "test-session-123",
  userQuery: "Fais ça.",
  assistantAnswer: ""
});
if (!result2.ok) {
  console.log(`✅ Succès du garde-fou ! Rejeté pour : ${result2.error}`);
} else {
  console.error("❌ Échec : L'épisode n'aurait pas dû être enregistré.");
}

// 3. Test de lecture
if (result1.ok) {
  console.log("\n3. Relecture de l'épisode persistant...");
  const ep = getEpisodeById(result1.episode_id);
  if (ep && ep.user_query === nominalParams.userQuery) {
    console.log(`✅ Succès ! L'épisode a bien été relu depuis le JSONL avec le statut "${ep.status}".`);
  } else {
    console.error("❌ Échec : Impossible de relire l'épisode ou données corrompues.");
  }
}

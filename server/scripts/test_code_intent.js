import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";

const queries = [
  "salut salut comment ça va j'ai besoin de ton aide pour la correction de mon index.php <?php echo 'hello'; ?>",
  "salut, corrige ce code",
  "bonjour, j'ai besoin d'aide sur ce fichier PHP : $a = 1;",
  "ça va ? peux-tu debug ce script ?",
  "salut salut, explique-moi cette erreur JS",
  "voici mon index.php, corrige-le"
];

for (const q of queries) {
  const justIntent = evaluateJustIntent(q);
  console.log(`\nQuery: "${q.slice(0, 50)}..."`);
  console.log(` -> Domain: ${justIntent.domain}`);
  console.log(` -> Action: ${justIntent.action}`);
  console.log(` -> Strategy: ${justIntent.strategy}`);
}

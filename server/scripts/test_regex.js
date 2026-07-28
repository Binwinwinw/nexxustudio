import { classifyCodeIntent, hasCodeContext } from "../src/agent/policies/codeIntentPolicy.js";

const q1 = "salut salut comment ça va j'ai besoin de ton aide pour la correction de mon index.php <?php echo 'hello'; ?>";
console.log("hasCodeContext: ", hasCodeContext(q1));
console.log("classifyCodeIntent: ", classifyCodeIntent(q1));

const q2 = "salut salut, explique-moi cette erreur JS";
console.log("hasCodeContext 2: ", hasCodeContext(q2));
console.log("classifyCodeIntent 2: ", classifyCodeIntent(q2));

const q3 = "bonjour, j'ai besoin d'aide sur ce fichier PHP : $a = 1;";
console.log("hasCodeContext 3: ", hasCodeContext(q3));
console.log("classifyCodeIntent 3: ", classifyCodeIntent(q3));


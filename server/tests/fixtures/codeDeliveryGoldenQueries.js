/**
 * Jeu de requêtes de référence — livraison code multi-langages (La Citadelle).
 * Utilisé par code-delivery-conversation-regression.test.js et run_code_delivery_regressions.js.
 *
 * Stratification :
 * - `demo` : cas pédagogiques multi-langages (couverture policy)
 * - `production_bug` : incidents réels observés — à enrichir au fil des régressions terrain
 *
 * Réponses golden : modèles minimaux pour hasCodeDeliveryStructure (pas des sorties LLM figées).
 */
import { CODE_LANGUAGES } from "../../src/agent/policies/codeDeliveryPolicy.js";

export const GOLDEN_QUERY_CATEGORIES = Object.freeze({
  DEMO: "demo",
  PRODUCTION_BUG: "production_bug",
});

/**
 * @typedef {Object} CodeDeliveryGoldenCase
 * @property {string} id
 * @property {string} category
 * @property {string} language
 * @property {string} label
 * @property {string} query
 * @property {string[]} promptMustInclude
 * @property {string[]} responseMustInclude
 * @property {string[]} responseForbidden
 * @property {string} [goldenResponse]
 * @property {boolean} [expectsMultiFile]
 * @property {Record<string, boolean>} [sentinels]
 * @property {string} [observedAt]
 * @property {string} [incident]
 */

/** @type {CodeDeliveryGoldenCase[]} */
export const CODE_DELIVERY_DEMO_QUERIES = [
  {
    id: "php-date-fr",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.PHP,
    label: "PHP — date du jour sécurisée",
    query: "Code un script PHP qui affiche la date du jour au format français.",
    promptMustInclude: ["htmlspecialchars", "PHP", "<?php"],
    responseMustInclude: ["<?php", "htmlspecialchars", "date"],
    responseForbidden: [
      "tout est prêt",
      "sur quoi travaillons",
      "ton code ici",
      "mysql_",
      "...",
    ],
    goldenResponse: `✅ Objectif : afficher la date du jour en français.

📋 Code complet :
\`\`\`php
<?php
declare(strict_types=1);
try {
    date_default_timezone_set('Europe/Paris');
    $date = date('d/m/Y');
    echo 'Nous sommes le ' . htmlspecialchars($date, ENT_QUOTES, 'UTF-8');
} catch (Exception $e) {
    echo 'Erreur : ' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
}
\`\`\`

🚀 Utilisation :
\`\`\`text
php date.php
> Nous sommes le 27/05/2026
\`\`\`

✨ Explications :
- htmlspecialchars() pour l'échappement XSS
- timezone Europe/Paris pour un rendu local cohérent

💡 Améliorations possibles :
- Paramètre de locale via Intl
- Journalisation des erreurs dans un fichier`,
  },
  {
    id: "jsx-compteur-react",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.JSX,
    label: "JSX — composant compteur React",
    query: "Crée un composant React qui affiche un compteur avec un bouton Incrémenter.",
    promptMustInclude: ["JSX / React", "useState", "Clé unique sur les listes"],
    responseMustInclude: ["useState", "export", "count", "button"],
    responseForbidden: ["tout est prêt", "class Compteur extends", "var "],
    goldenResponse: `✅ Objectif : compteur React interactif.

📋 Code complet :
\`\`\`jsx
import React, { useState } from 'react';

const Compteur = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Compteur : {count}</p>
      <button type="button" onClick={() => setCount(count + 1)}>
        Incrémenter
      </button>
    </div>
  );
};

export default Compteur;
\`\`\`

🚀 Utilisation :
\`\`\`text
import Compteur from './Compteur';
<Compteur />
\`\`\`

✨ Explications :
- useState pour l'état local sans mutation directe
- bouton typé pour l'accessibilité

💡 Améliorations possibles :
- Bouton Décrémenter et reset
- PropTypes ou TypeScript`,
  },
  {
    id: "js-browser-bienvenue",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.JS_BROWSER,
    label: "JavaScript navigateur — alerte au chargement",
    query:
      "Code une alerte en JavaScript (navigateur) qui dit 'Bienvenue' quand la page charge.",
    promptMustInclude: ["DOMContentLoaded", "JavaScript (Navigateur)"],
    responseMustInclude: ["DOMContentLoaded", "Bienvenue", "addEventListener"],
    responseForbidden: ["tout est prêt", "require(", "module.exports", "var "],
    goldenResponse: `✅ Objectif : saluer l'utilisateur au chargement de la page.

📋 Code complet :
\`\`\`javascript
document.addEventListener('DOMContentLoaded', () => {
  try {
    alert('Bienvenue');
  } catch (error) {
    console.error('Impossible d\\'afficher l\\'alerte :', error);
  }
});
\`\`\`

🚀 Utilisation :
\`\`\`text
Coller le script avant </body> dans index.html
> Alerte « Bienvenue » au chargement
\`\`\`

✨ Explications :
- DOMContentLoaded évite d'accéder au DOM trop tôt
- try/catch pour les environnements restreints

💡 Améliorations possibles :
- Remplacer alert() par une bannière accessible
- Mémoriser si l'utilisateur a déjà vu le message`,
  },
  {
    id: "js-node-json-reader",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.JS_NODE,
    label: "JavaScript Node — lecture JSON",
    query: "Écris un script Node.js avec require() pour lire un fichier config.json et afficher le titre.",
    promptMustInclude: ["JavaScript (Node.js)", "async/await", "const/let"],
    responseMustInclude: ["require", "readFile", "json", "const"],
    responseForbidden: ["tout est prêt", "document.", "DOMContentLoaded", "var "],
    goldenResponse: `✅ Objectif : lire config.json et afficher le titre.

📋 Code complet :
\`\`\`javascript
const fs = require('fs/promises');

async function main() {
  try {
    const raw = await fs.readFile('config.json', 'utf8');
    const config = JSON.parse(raw);
    console.log(config.title ?? 'Titre non défini');
  } catch (error) {
    console.error('Erreur lecture JSON :', error.message);
    process.exitCode = 1;
  }
}

main();
\`\`\`

🚀 Utilisation :
\`\`\`text
node lire-config.js
> Mon Application
\`\`\`

✨ Explications :
- fs/promises + async/await pour un flux lisible
- valeur par défaut si title absent

💡 Améliorations possibles :
- Validation JSON Schema
- Argument CLI pour le chemin du fichier`,
  },
  {
    id: "html-carte-profil",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.HTML,
    label: "HTML — carte de profil utilisateur",
    query: "Fais une carte de profil utilisateur en page web complète avec HTML sémantique.",
    promptMustInclude: ["<!DOCTYPE html>", "balises sémantiques", "lang=\"fr\""],
    responseMustInclude: ["<!DOCTYPE html>", "<main", "lang=\"fr\""],
    responseForbidden: ["tout est prêt", "ton code ici", "<font>"],
    goldenResponse: `✅ Objectif : carte de profil accessible en HTML5.

📋 Code complet :
\`\`\`html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Profil utilisateur</title>
  <style>
    .profile-card { display: flex; gap: 1rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  </style>
</head>
<body>
  <main>
    <article class="profile-card" aria-label="Carte de profil">
      <img src="avatar.png" alt="Photo de Marie Dupont" width="96" height="96" />
      <div>
        <h1>Marie Dupont</h1>
        <p>Développeuse front-end — Lyon</p>
      </div>
    </article>
  </main>
</body>
</html>
\`\`\`

🚀 Utilisation :
\`\`\`text
Ouvrir index.html dans le navigateur
\`\`\`

✨ Explications :
- structure sémantique main/article
- alt descriptif sur l'image

💡 Améliorations possibles :
- Feuille CSS externe
- Mode sombre via prefers-color-scheme`,
  },
  {
    id: "css-grille-responsive",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.CSS,
    label: "CSS — grille responsive de cartes",
    query: "Écris une feuille CSS responsive pour une grille de cartes avec Flexbox.",
    promptMustInclude: ["Flexbox", "Media queries", "kebab-case"],
    responseMustInclude: ["display", "flex", "@media"],
    responseForbidden: ["tout est prêt", "#header {", "..."],
    goldenResponse: `✅ Objectif : grille de cartes responsive en Flexbox.

📋 Code complet :
\`\`\`css
/* Reset minimal */
*, *::before, *::after { box-sizing: border-box; }

.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
}

.card-grid__item {
  flex: 1 1 240px;
  padding: 1rem;
  border-radius: 8px;
  background: #f5f5f5;
}

@media (max-width: 600px) {
  .card-grid { flex-direction: column; }
}
\`\`\`

🚀 Utilisation :
\`\`\`text
<link rel="stylesheet" href="style.css" />
<div class="card-grid"><div class="card-grid__item">Carte</div></div>
\`\`\`

✨ Explications :
- classes en kebab-case
- media query pour empiler sur mobile

💡 Améliorations possibles :
- Variante CSS Grid
- Container queries`,
  },
  {
    id: "python-nombre-premier",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.PYTHON,
    label: "Python — nombre premier (fallback sans mot-clé)",
    query: "Code une fonction qui vérifie si un nombre est premier.",
    promptMustInclude: ["Python", "if __name__", "SystemRandom"],
    responseMustInclude: ["def ", "est_premier", "if __name__"],
    responseForbidden: ["tout est prêt", "ton code ici", "..."],
    goldenResponse: `✅ Objectif : tester si un entier est premier.

📋 Code complet :
\`\`\`python
def est_premier(n: int) -> bool:
    """Retourne True si n est un nombre premier."""
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    d = 3
    while d * d <= n:
        if n % d == 0:
            return False
        d += 2
    return True

if __name__ == "__main__":
    try:
        valeur = int(input("Entrez un entier : "))
        print("premier" if est_premier(valeur) else "composé")
    except ValueError:
        print("Veuillez entrer un entier valide.")
\`\`\`

🚀 Utilisation :
\`\`\`text
python premier.py
> Entrez un entier : 17
> premier
\`\`\`

✨ Explications :
- essais de division jusqu'à sqrt(n)
- gestion ValueError sur la saisie

💡 Améliorations possibles :
- Tests unitaires pytest
- Crible d'Ératosthène pour une plage`,
  },
  {
    id: "html-multi-fichiers",
    category: GOLDEN_QUERY_CATEGORIES.DEMO,
    language: CODE_LANGUAGES.HTML,
    label: "Multi-fichiers — mini site profil",
    query:
      "Crée un mini site avec index.html, style.css et script.js pour une carte de profil interactive.",
    promptMustInclude: ["MULTI-FICHIERS", "📁"],
    responseMustInclude: ["index.html", "style.css", "script.js"],
    responseForbidden: ["tout est prêt", "un seul fichier suffit"],
    expectsMultiFile: true,
    goldenResponse: `✅ Objectif : mini site profil en trois fichiers.

📋 Code complet :

📁 index.html
\`\`\`html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="style.css" />
  <title>Profil</title>
</head>
<body>
  <main id="app"></main>
  <script src="script.js" defer></script>
</body>
</html>
\`\`\`

📁 style.css
\`\`\`css
body { font-family: sans-serif; margin: 0; padding: 1rem; }
\`\`\`

📁 script.js
\`\`\`javascript
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('app').textContent = 'Profil chargé';
});
\`\`\`

🚀 Utilisation :
\`\`\`text
Ouvrir index.html dans le navigateur
\`\`\`

✨ Explications :
- séparation structure / style / comportement
- script defer pour le chargement

💡 Améliorations possibles :
- Bundler Vite
- Données profil en JSON`,
  },
];

/**
 * Incidents terrain — enrichir au fil des bugs réels (ne pas « muséifier » uniquement la démo).
 * @type {CodeDeliveryGoldenCase[]}
 */
export const CODE_DELIVERY_PRODUCTION_BUG_QUERIES = [
  {
    id: "prod-fallback-salutation-calculatrice-js",
    category: GOLDEN_QUERY_CATEGORIES.PRODUCTION_BUG,
    observedAt: "2026-05",
    incident:
      "Demande JS substantielle → salutation « Tout est prêt » au lieu du code calculatrice.",
    language: CODE_LANGUAGES.JS_NODE,
    label: "[prod] Calculatrice JS — anti-salutation générique",
    query:
      "Génère une application console en JavaScript : une calculatrice avec addition, " +
      "soustraction, multiplication, division. Niveau débutant. Code complet commenté en français.",
    promptMustInclude: ["JavaScript (Node.js)", "const/let", "LIVRAISON CODE MULTI-LANGAGES"],
    responseMustInclude: ["function", "const", "console"],
    responseForbidden: [
      "tout est prêt",
      "sur quoi travaillons",
      "comment puis-je vous aider",
    ],
    goldenResponse: `✅ Objectif : calculatrice console en JavaScript.

📋 Code complet :
\`\`\`javascript
const readline = require('readline');

function add(a, b) { return a + b; }
function sub(a, b) { return a - b; }
function mul(a, b) { return a * b; }
function div(a, b) {
  if (b === 0) throw new Error('Division par zéro');
  return a / b;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Nombre a : ', (aStr) => {
  rl.question('Nombre b : ', (bStr) => {
    try {
      const a = Number(aStr);
      const b = Number(bStr);
      console.log('Somme :', add(a, b));
      console.log('Diff :', sub(a, b));
      console.log('Produit :', mul(a, b));
      console.log('Quotient :', div(a, b));
    } catch (error) {
      console.error('Erreur :', error.message);
    } finally {
      rl.close();
    }
  });
});
\`\`\`

🚀 Utilisation :
\`\`\`text
node calculatrice.js
\`\`\`

✨ Explications :
- fonctions pures par opération
- gestion division par zéro

💡 Améliorations possibles :
- Menu interactif en boucle
- Tests Jest`,
  },
  {
    id: "prod-fallback-salutation-generateur-mdp-py",
    category: GOLDEN_QUERY_CATEGORIES.PRODUCTION_BUG,
    observedAt: "2026-05",
    incident:
      "Demande Python générateur MDP → salutation générique ou réponse vide filtrée.",
    language: CODE_LANGUAGES.PYTHON,
    label: "[prod] Générateur MDP Python — livrable complet exigé",
    query:
      "Génère une application console en Python : un générateur de mots de passe. " +
      "Code complet commenté en français, avec if __name__ == '__main__'.",
    promptMustInclude: ["Python", "SystemRandom", "if __name__"],
    responseMustInclude: ["def ", "mot_de_passe", "if __name__"],
    responseForbidden: ["tout est prêt", "sur quoi travaillons", "ton code ici"],
    goldenResponse: `✅ Objectif : générateur de mots de passe sécurisé.

📋 Code complet :
\`\`\`python
import secrets
import string

def generer_mot_de_passe(longueur: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(longueur))

if __name__ == "__main__":
    try:
        taille = int(input("Longueur (défaut 12) : ") or "12")
        print(generer_mot_de_passe(taille))
    except ValueError:
        print("Longueur invalide.")
\`\`\`

🚀 Utilisation :
\`\`\`text
python generateur_mdp.py
> Longueur (défaut 12) : 16
\`\`\`

✨ Explications :
- secrets.choice plutôt que random() pour la sécurité
- longueur par défaut 12

💡 Améliorations possibles :
- Export JSON des mots de passe
- Interface Tkinter`,
  },
  {
    id: "prod-clarification-inutile-algo-python",
    category: GOLDEN_QUERY_CATEGORIES.PRODUCTION_BUG,
    observedAt: "2026-05",
    incident:
      "Spec suffisante (fonction algorithmique) → question de clarification au lieu de livrer.",
    language: CODE_LANGUAGES.PYTHON,
    label: "[prod] Algo Python — pas de clarification sans livrable",
    query: "Code une fonction qui vérifie si un nombre est premier.",
    promptMustInclude: ["Python", "if __name__"],
    responseMustInclude: ["def ", "est_premier", "if __name__"],
    responseForbidden: [
      "tout est prêt",
      "il me manque",
      "peux-tu préciser",
      "quelle langage",
    ],
    sentinels: {
      mustNotAskClarificationWhenSpecSufficient: true,
    },
    goldenResponse: CODE_DELIVERY_DEMO_QUERIES.find((c) => c.id === "python-nombre-premier")
      .goldenResponse,
  },
];

export const CODE_DELIVERY_GOLDEN_QUERIES = [
  ...CODE_DELIVERY_DEMO_QUERIES,
  ...CODE_DELIVERY_PRODUCTION_BUG_QUERIES,
];

export function getGoldenCaseById(id) {
  return CODE_DELIVERY_GOLDEN_QUERIES.find((c) => c.id === id) ?? null;
}

export function getGoldenCasesByLanguage(language) {
  return CODE_DELIVERY_GOLDEN_QUERIES.filter((c) => c.language === language);
}

export function getGoldenCasesByCategory(category) {
  return CODE_DELIVERY_GOLDEN_QUERIES.filter((c) => c.category === category);
}

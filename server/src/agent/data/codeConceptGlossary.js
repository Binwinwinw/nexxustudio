/**
 * G40.3 — glossaire local de concepts fréquents (fallback sûr, sans RAG).
 * Contenu borné, aligné doc publique (MDN, docs.python.org).
 */
export const CODE_CONCEPT_GLOSSARY = Object.freeze({
  "html:div": {
    key: "html:div",
    label: "<div>",
    domain: "html",
    concept: "div",
    shortDefinition:
      "En HTML, <div> est un conteneur générique de flux, sans signification sémantique propre.",
    detail:
      "On l'utilise surtout pour regrouper du contenu afin de le structurer, le styliser avec CSS ou l'organiser en blocs. Quand un élément sémantique plus précis convient (<section>, <article>, <nav>…), on le préfère.",
  },
  "html:span": {
    key: "html:span",
    label: "<span>",
    domain: "html",
    concept: "span",
    shortDefinition:
      "En HTML, <span> est un conteneur inline générique, sans rôle sémantique.",
    detail:
      "Il sert à cibler une portion de texte pour la styliser ou la manipuler en JS, sans créer de saut de ligne. Pour un sens fort (citation, code, emphase), on préfère <q>, <code>, <em>, etc.",
  },
  "html:section": {
    key: "html:section",
    label: "<section>",
    domain: "html",
    concept: "section",
    shortDefinition:
      "En HTML, <section> regroupe un bloc thématique de contenu, souvent avec un titre.",
    detail:
      "C'est un repère sémantique : utile pour structurer une page (chapitre, rubrique) plutôt que d'empiler des <div> anonymes.",
  },
  "html:article": {
    key: "html:article",
    label: "<article>",
    domain: "html",
    concept: "article",
    shortDefinition:
      "En HTML, <article> représente un contenu autonome et distribuable (article, post, carte produit).",
    detail:
      "Il peut être réutilisé ou syndiqué indépendamment du reste de la page — contrairement à un simple conteneur de mise en page.",
  },
  "python:import": {
    key: "python:import",
    label: "import",
    domain: "python",
    concept: "import",
    shortDefinition:
      "En Python, import sert à charger du code défini dans d'autres modules pour le réutiliser dans le fichier courant.",
    detail:
      "L'interpréteur trouve le module (ou le récupère depuis sys.modules s'il est déjà chargé), puis lie un ou plusieurs noms dans l'espace de noms local — fonctions, classes ou variables.",
  },
  "python:def": {
    key: "python:def",
    label: "def",
    domain: "python",
    concept: "def",
    shortDefinition:
      "En Python, def déclare une fonction nommée avec ses paramètres et son corps.",
    detail:
      "L'appel exécute le corps ; return renvoie une valeur. Les fonctions sont des objets de première classe : on peut les passer, les stocker ou les décorer.",
  },
  "python:class": {
    key: "python:class",
    label: "class",
    domain: "python",
    concept: "class",
    shortDefinition:
      "En Python, class définit un type : un gabarit pour créer des objets avec attributs et méthodes.",
    detail:
      "class Nom: puis des méthodes (souvent __init__ pour l'initialisation). L'héritage permet de spécialiser un comportement existant.",
  },
  "python:lambda": {
    key: "python:lambda",
    label: "lambda",
    domain: "python",
    concept: "lambda",
    shortDefinition:
      "En Python, lambda crée une petite fonction anonyme en une expression.",
    detail:
      "Syntaxe : lambda args: expression. Pratique pour des callbacks courts (map, filter, tri) ; pour une logique plus riche, def reste plus lisible.",
  },
  "js:let": {
    key: "js:let",
    label: "let",
    domain: "javascript",
    concept: "let",
    shortDefinition:
      "En JavaScript, let déclare une variable à portée de bloc (if, for, fonction).",
    detail:
      "Elle n'est pas hissée comme var : pas d'utilisation avant la ligne de déclaration. C'est le choix par défaut moderne pour une variable réassignable.",
  },
  "js:var": {
    key: "js:var",
    label: "var",
    domain: "javascript",
    concept: "var",
    shortDefinition:
      "En JavaScript, var déclare une variable à portée de fonction (ou globale), avec hoisting.",
    detail:
      "Historique : peut surprendre dans les boucles et les closures. let/const sont préférés dans le code moderne ; var subsiste surtout pour compatibilité legacy.",
  },
  "js:const": {
    key: "js:const",
    label: "const",
    domain: "javascript",
    concept: "const",
    shortDefinition:
      "En JavaScript, const déclare une liaison constante à portée de bloc.",
    detail:
      "La référence ne peut pas être réassignée ; le contenu d'un objet/tableau peut encore muter. À utiliser par défaut quand la variable ne doit pas pointer ailleurs.",
  },
  "js:async": {
    key: "js:async",
    label: "async/await",
    domain: "javascript",
    concept: "async",
    shortDefinition:
      "En JavaScript, async marque une fonction qui renvoie une Promise ; await suspend l'exécution jusqu'à sa résolution.",
    detail:
      "Ça évite les pyramides de .then() pour les appels réseau ou I/O. async/await ne rend pas le code synchrone côté moteur : c'est du sucre sur les Promises.",
  },
  "js:let_vs_var": {
    key: "js:let_vs_var",
    label: "let vs var",
    domain: "javascript",
    concept: "let_vs_var",
    shortDefinition:
      "let est scopé au bloc et sans hoisting d'initialisation ; var est scopé à la fonction et hoisté.",
    detail:
      "En pratique : let/const évitent les fuites de variable dans les boucles et les surprises de var. var reste surtout pour lire ou maintenir du vieux code.",
  },
  "php:function": {
    key: "php:function",
    label: "fonction PHP",
    domain: "php",
    concept: "function",
    shortDefinition:
      "En PHP, une fonction regroupe des instructions sous un nom pour les réutiliser : elle peut recevoir des arguments et renvoyer une valeur avec return.",
    detail:
      "Exemple : function additionner($a, $b) { return $a + $b; } — rôle : encapsuler la logique « additionner deux nombres » pour l'appeler ailleurs sans la recopier. Les paramètres `$a` et `$b` sont les entrées ; `return` sort le résultat.",
  },
  "process:spec": {
    key: "process:spec",
    label: "spec",
    domain: "process",
    concept: "spec",
    shortDefinition:
      "Une **spec**, c’est un document qui explique clairement ce qu’on veut construire : le but, les règles, et comment on saura que c’est réussi.",
    detail:
      "Ce n’est pas le code : c’est le guide commun avant (et pendant) l’implémentation. En termes plus techniques : objectifs, interfaces, critères d’acceptation — parfois sous forme d’ADR, RFC, ticket détaillé ou OpenAPI.",
  },
  "process:mini_spec": {
    key: "process:mini_spec",
    label: "mini-spec",
    domain: "process",
    concept: "mini-spec",
    shortDefinition:
      "Une **mini-spec**, c’est la version courte d’une spec : juste assez précise pour lancer le travail sans ambiguïté, sans écrire un roman.",
    detail:
      "Elle fige l’essentiel (intention, bornes, ce qu’on ne fera pas) pour décider vite. Le détail d’implémentation vient ensuite — chez Nexxus, souvent en 1–3 pages (ex. une doc « Gxx »).",
  },
});

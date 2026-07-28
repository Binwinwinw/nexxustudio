/**
 * Registre de blueprints — technical_learning_path (un couloir, plans par stack).
 * Philosophie : docs/agents/intent-families-philosophy.md
 */
import {
  extractLearningDomain,
  parseTechnicalLearningPath,
} from "../../utils/technicalLearningPathIntentGuards.js";
import { isJvmJavaScriptHybridLearningTopic } from "../../utils/technicalLearningPathIntentGuards.js";
import { OFFICIAL_MODULE_RESOURCES_BY_BLUEPRINT_ID } from "./technicalLearningOfficialResources.js";

export const TECHNICAL_LEARNING_BLUEPRINTS_V1 = "technical_learning_blueprints_v1";

/**
 * @typedef {Object} LearningModuleResourceLink
 * @property {string} url — https obligatoire, doc officielle
 * @property {string} title — libellé affiché du lien
 * @property {"Ressource officielle"|"Doc conseillée"} [sectionLabel]
 */

/**
 * @typedef {Object} LearningModule
 * @property {string} title
 * @property {string} objective
 * @property {string} concepts
 * @property {string} practice
 * @property {string} mastery
 * @property {readonly string[]} [selfCheckQuestions] — max 2
 * @property {LearningModuleResourceLink} [resourceLink] — max 1, doc officielle statique
 */

/**
 * @typedef {Object} TechnicalLearningBlueprint
 * @property {string} id
 * @property {string} displayLabel
 * @property {readonly string[]} aliases
 * @property {LearningModule[]} modules
 * @property {string|null} [reframeNote]
 * @property {string|null} [llmAddonLine]
 */

/** @type {TechnicalLearningBlueprint} */
const HTML_BLUEPRINT = {
  id: "html",
  displayLabel: "HTML",
  aliases: ["html", "html5", "markup", "hypertext"],
  llmAddonLine:
    "5) Pour HTML : structure document, sémantique, liens/médias, listes, formulaires, accessibilité.",
  modules: [
    {
      title: "Structure du document",
      objective: "Comprendre la structure minimale valide d'une page web.",
      concepts: "doctype, html/head/body, meta charset/viewport, title",
      practice: "squelette HTML5 valide + validation W3C",
      mastery: "Je produis un document HTML5 valide sans template magique",
      selfCheckQuestions: [
        "Quels éléments minimaux doivent figurer dans `<head>` pour une page moderne ?",
        "Pourquoi le doctype HTML5 n'a-t-il pas de DTD externe à référencer ?",
      ],
    },
    {
      title: "Sémantique et landmarks",
      objective: "Donner du sens au markup pour humains et machines.",
      concepts: "header, nav, main, section, article, aside, footer",
      practice: "refactor d'une page div-soup → landmarks sémantiques",
      mastery: "Je choisis la balise sémantique adaptée au contenu",
      selfCheckQuestions: [
        "Quelle différence entre `<section>` et `<article>` ?",
        "Dans quel cas `<aside>` est-il approprié ?",
      ],
    },
    {
      title: "Liens, images et médias",
      objective: "Intégrer hyperliens et ressources multimédias correctement.",
      concepts: "a[href], img alt, figure/figcaption, audio/video de base",
      practice: "fiche : liens internes/externes + images responsives",
      mastery: "Je n'oublie plus alt, href valides ni attributs essentiels",
      selfCheckQuestions: [
        "Que se passe-t-il si une image n'a pas d'attribut `alt` ?",
        "Quand utiliser `target=\"_blank\"` sur un lien externe, et quelle précaution ajouter ?",
      ],
    },
    {
      title: "Listes, tableaux et organisation",
      objective: "Structurer des données tabulaires et des énumérations.",
      concepts: "ul/ol/li, dl/dt/dd, table thead/tbody, th scope",
      practice: "tableau accessible + liste imbriquée propre",
      mastery: "Je distingue quand utiliser liste vs tableau vs description",
      selfCheckQuestions: [
        "Quand faut-il utiliser un tableau plutôt qu'une liste ?",
        "À quoi sert `scope` sur un `<th>` ?",
      ],
    },
    {
      title: "Formulaires et champs",
      objective: "Construire des formulaires utilisables et associés.",
      concepts: "form, label[for], input types, textarea, select, button",
      practice: "formulaire contact accessible avec labels explicites",
      mastery: "Je lie chaque champ à son label sans placeholder-only",
      selfCheckQuestions: [
        "Pourquoi lier un `<label>` à un input via `for`/`id` plutôt que s'appuyer sur le placeholder ?",
        "Quelle différence entre `<button type=\"submit\">` et `<button>` sans type dans un formulaire ?",
      ],
    },
    {
      title: "Accessibilité et bonnes pratiques",
      objective: "Éviter les pièges markup fréquents en review.",
      concepts: "a11y de base, lang, skip links, ordre de tabulation, SEO structurel",
      practice: "checklist review HTML avant merge",
      mastery: "Je relis du HTML avec regard sémantique et a11y",
      selfCheckQuestions: [
        "Pourquoi définir `lang` sur l'élément `<html>` ?",
        "À quoi sert un skip link en accessibilité ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const CSS_BLUEPRINT = {
  id: "css",
  displayLabel: "CSS",
  aliases: ["css", "css3", "styles", "stylesheet"],
  llmAddonLine:
    "5) Pour CSS : cascade, spécificité, héritage, box model, Flexbox/Grid, responsive, DevTools.",
  modules: [
    {
      title: "Syntaxe, sélecteurs et unités",
      objective: "Écrire du CSS valide et cibler les bons éléments.",
      concepts: "sélecteurs, combinators, unités px/rem/%, variables CSS intro",
      practice: "fiche : 10 sélecteurs courants + quand les utiliser",
      mastery: "Je cible un élément sans sur-spécifier ni !important par défaut",
      selfCheckQuestions: [
        "Quelle différence entre un sélecteur de classe `.btn` et un sélecteur d'id `#btn` ?",
        "Quand préférer `rem` à `px` pour la taille de police ?",
      ],
    },
    {
      title: "Cascade, héritage et spécificité",
      objective: "Prédire quel style gagne quand plusieurs règles s'appliquent.",
      concepts: "cascade, héritage, spécificité, @layer",
      practice: "3 exercices : qui gagne ? + refactor sans !important",
      mastery: "Je résous un conflit de styles en lisant cascade et spécificité",
      selfCheckQuestions: [
        "Pourquoi une règle plus basse dans le fichier peut-elle perdre face à une règle plus haute ?",
        "Quelle différence entre héritage et cascade ?",
      ],
    },
    {
      title: "Box model, display et flux normal",
      objective: "Comprendre comment l'espace est calculé et distribué.",
      concepts: "content/padding/border/margin, box-sizing, display",
      practice: "schéma box model + fix débordement margin-collapse",
      mastery: "Je corrige un layout cassé en box model avant Flex/Grid",
      selfCheckQuestions: [
        "Que change `box-sizing: border-box` par rapport à `content-box` ?",
        "Qu'est-ce que le margin collapse et quand survient-il ?",
      ],
    },
    {
      title: "Positionnement, Flexbox et Grid",
      objective: "Construire des layouts modernes sans hacks fragiles.",
      concepts: "position, flex, grid, gap, z-index",
      practice: "mini layout header + sidebar + main en Flex puis Grid",
      mastery: "Je choisis Flex vs Grid selon le type de mise en page",
      selfCheckQuestions: [
        "Quand choisir Flexbox plutôt que Grid pour une mise en page ?",
        "À quoi sert `gap` par rapport à des marges manuelles entre enfants ?",
      ],
    },
    {
      title: "Responsive design et container queries",
      objective: "Adapter l'UI à la taille d'écran et au conteneur.",
      concepts: "breakpoints, mobile-first, media/container queries, clamp()",
      practice: "fiche : 3 breakpoints + composant fluide avec clamp",
      mastery: "Je rends une page lisible mobile → desktop sans duplication CSS",
      selfCheckQuestions: [
        "Quelle différence entre mobile-first et desktop-first pour les media queries ?",
        "À quoi sert `clamp()` par rapport à min/max dans des media queries séparées ?",
      ],
    },
    {
      title: "Pièges, DevTools et bonnes pratiques",
      objective: "Débugger visuellement et éviter les erreurs fréquentes.",
      concepts: "DevTools Styles/Layout, contrast, focus visible, naming",
      practice: "checklist review CSS : spécificité, a11y, responsive",
      mastery: "Je relis du CSS avec DevTools et critères a11y en tête",
      selfCheckQuestions: [
        "Pourquoi `:focus-visible` est-il préférable à supprimer le outline par défaut ?",
        "Où regarder dans DevTools pour comprendre pourquoi un élément déborde ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const JAVASCRIPT_BLUEPRINT = {
  id: "javascript",
  displayLabel: "JavaScript",
  aliases: [
    "javascript",
    "js",
    "ecmascript",
    "es6",
    "es2015",
  ],
  llmAddonLine:
    "5) Pour JavaScript (langage) : syntaxe/types, flux, fonctions/closures, collections/modules, DOM/events, async — pas le runtime Node.",
  modules: [
    {
      title: "Syntaxe et types",
      objective: "Lire et écrire du JS moderne sans confusion de types.",
      concepts: "let/const, primitives, typeof, null vs undefined, template literals",
      practice: "fiche types + 5 pièges typeof / coercion",
      mastery: "Je prédis le type et la coercion dans des cas simples",
      selfCheckQuestions: [
        "Quelle différence entre `let` et `const` quand tu réassignes une variable ?",
        "Que renvoie `typeof null` en console, et pourquoi c'est un piège connu ?",
      ],
    },
    {
      title: "Contrôle de flux",
      objective: "Structurer la logique avec conditions et boucles.",
      concepts: "if/else, switch, for/of, while, break/continue, truthy/falsy",
      practice: "3 katas : validation, filtrage, early return",
      mastery: "J'écris du flux lisible sans nesting excessif",
      selfCheckQuestions: [
        "Parmi `0`, `'0'`, `[]` et `''`, lesquels sont falsy en JavaScript ?",
        "Quand préférer un early return à un if/else imbriqué ?",
      ],
    },
    {
      title: "Fonctions, scope et closures",
      objective: "Maîtriser les fonctions comme unité de composition.",
      concepts: "declaration/expression, arrow, scope, closure, this intro",
      practice: "refactor callbacks → fonctions nommées + closure utile",
      mastery: "J'explique ce qu'une closure capture et pourquoi",
      selfCheckQuestions: [
        "Une fonction fléchée peut-elle être appelée avec `new` comme constructeur ?",
        "Une closure capture-t-elle la variable ou seulement sa valeur figée à la création ?",
      ],
    },
    {
      title: "Tableaux, objets et modules",
      objective: "Manipuler collections et structurer le code en modules.",
      concepts: "map/filter/reduce, destructuring, spread, import/export ESM",
      practice: "mini module utils + pipeline map/filter sur dataset",
      mastery: "Je compose des transformations de données sans muter à l'aveugle",
      selfCheckQuestions: [
        "Copier un objet avec `{...obj}` duplique-t-il les objets imbriqués en profondeur ?",
        "Quelle différence entre `map` et `forEach` si tu veux une nouvelle collection ?",
      ],
    },
    {
      title: "DOM et événements",
      objective: "Interagir avec une page web depuis le script.",
      concepts: "querySelector, createElement, classList, addEventListener, delegation",
      practice: "todo list DOM sans framework",
      mastery: "Je branche des events propres avec delegation quand pertinent",
      selfCheckQuestions: [
        "Pourquoi attacher un listener sur un parent peut-il être préférable à un listener par enfant ?",
        "Que renvoie `document.querySelector('.absent')` si aucun élément ne correspond ?",
      ],
    },
    {
      title: "Async et event loop",
      objective: "Gérer le temps : promesses, async/await, erreurs async.",
      concepts: "Promise, async/await, try/catch async, fetch intro, microtasks",
      practice: "fiche : ordre d'exécution + fetch avec gestion d'erreur",
      mastery: "Je debug une séquence async sans mélanger sync/async",
      selfCheckQuestions: [
        "Dans `log('A'); setTimeout(() => log('B'), 0); log('C');`, quel ordre s'affiche ?",
        "Une réponse HTTP 404 de `fetch` déclenche-t-elle automatiquement le `catch` avec `await` ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const NODEJS_BLUEPRINT = {
  id: "nodejs",
  displayLabel: "Node.js",
  aliases: ["nodejs", "node.js", "node js"],
  llmAddonLine:
    "5) Pour Node.js (runtime) : V8/process, CLI/scripts, modules/npm, fs/path, HTTP/serveur, variables d'env — pas le tutoriel syntaxe JS pur ni le DOM.",
  modules: [
    {
      title: "Runtime Node vs navigateur",
      objective: "Comprendre ce que Node.js ajoute à JavaScript côté serveur/CLI.",
      concepts: "V8, process, global vs window, pas de DOM, event loop Node",
      practice: "fiche comparatif browser JS vs Node.js",
      mastery: "Je distingue APIs Node vs APIs navigateur sans confusion",
      selfCheckQuestions: [
        "Pourquoi `document` ou `window` ne sont-ils pas disponibles dans Node.js ?",
        "Quelle API globale Node remplace le rôle de `window` côté navigateur ?",
      ],
    },
    {
      title: "CLI, scripts et process",
      objective: "Exécuter et structurer des scripts Node en ligne de commande.",
      concepts: "node file.js, process.argv, exit codes, __dirname, import.meta.url",
      practice: "CLI args parser + script avec code sortie explicite",
      mastery: "Je lance un script Node et lis argv/exit sans magie",
      selfCheckQuestions: [
        "Que contient `process.argv[1]` quand tu lances `node script.js --help` ?",
        "Quelle différence pratique entre un code de sortie `0` et `1` pour un script CLI ?",
      ],
    },
    {
      title: "Modules, npm et package.json",
      objective: "Gérer dépendances et modules dans l'écosystème Node.",
      concepts: "package.json, npm install, ESM vs CJS en Node, npx, scripts npm",
      practice: "init projet + deps + scripts start/dev",
      mastery: "Je configure un package Node avec modules et scripts npm",
      selfCheckQuestions: [
        "Quelle différence entre une dépendance dans `dependencies` et `devDependencies` ?",
        "À quoi sert `npx` par rapport à installer un binaire globalement avec npm ?",
      ],
    },
    {
      title: "Fichiers, path et I/O",
      objective: "Lire/écrire fichiers et chemins de façon idiomatique.",
      concepts: "fs/promises, path.join/resolve, streams intro, encodings",
      practice: "utilitaire read JSON → transform → write",
      mastery: "Je manipule fichiers/paths sans chemins hardcodés fragiles",
      selfCheckQuestions: [
        "Pourquoi préférer `path.join()` à concaténer des segments avec `/` ou `\\` ?",
        "Un `fs.readFile` avec callback s'exécute-t-il avant ou après le code synchrone suivant ?",
      ],
    },
    {
      title: "Réseau et serveur HTTP minimal",
      objective: "Exposer un service réseau simple avec les APIs Node.",
      concepts: "http.createServer, req/res, ports, fetch côté Node, JSON API intro",
      practice: "mini serveur GET /health + route JSON",
      mastery: "Je fais tourner un serveur HTTP minimal et teste avec curl",
      selfCheckQuestions: [
        "Que se passe-t-il si tu écoutes déjà un port occupé par un autre processus ?",
        "Dans `createServer`, qui envoie la réponse HTTP : le callback `(req, res)` ou le code juste après `listen()` ?",
      ],
    },
    {
      title: "Env, debug et bonnes pratiques",
      objective: "Opérer un projet Node au quotidien sans anti-patterns.",
      concepts: "process.env, dotenv, NODE_ENV, debug (--inspect), logs, sécurité deps",
      practice: "checklist review projet Node : env, scripts, deps, erreurs",
      mastery: "Je configure env/debug et relis un projet Node avec critères ops",
      selfCheckQuestions: [
        "Pourquoi ne pas committer un fichier `.env` contenant des secrets ?",
        "À quoi sert typiquement `NODE_ENV=production` dans un projet Node ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const EXPRESS_BLUEPRINT = {
  id: "express",
  displayLabel: "Express",
  aliases: ["express", "expressjs", "express.js"],
  llmAddonLine:
    "5) Pour Express (framework HTTP Node) : routing, middleware, Router, body parsing, erreurs async, structure projet — pas le runtime Node pur ni http.createServer brut.",
  modules: [
    {
      title: "App Express et routing HTTP",
      objective: "Créer une API HTTP minimale avec Express.",
      concepts: "express(), app.listen, GET/POST, req.params/query, res.json/status",
      practice: "API /health + /users/:id avec réponses JSON",
      mastery: "Je monte une route Express et lis params/query/body",
      selfCheckQuestions: [
        "Quelle différence entre `req.params`, `req.query` et `req.body` ?",
        "Où lis-tu l'id utilisateur sur une route GET `/users/:id` ?",
      ],
    },
    {
      title: "Middleware et chaîne next()",
      objective: "Comprendre l'ordre d'exécution des middlewares.",
      concepts: "app.use, next(), express.json, express.static, ordre des middlewares",
      practice: "logger middleware + json parser + route protégée",
      mastery: "J'explique pourquoi l'ordre middleware compte et où appeler next()",
      selfCheckQuestions: [
        "À quoi sert appeler `next()` dans un middleware Express ?",
        "Pourquoi monter `express.json()` avant les routes qui lisent le body ?",
      ],
    },
    {
      title: "Router modulaire",
      objective: "Structurer des routes par domaine fonctionnel.",
      concepts: "express.Router, mount /api, prefix, séparation fichiers routes",
      practice: "refactor routes monolithiques → routers users + posts",
      mastery: "Je découpe une API en routers montés proprement",
      selfCheckQuestions: [
        "À quoi sert `express.Router()` plutôt que tout définir sur `app` ?",
        "Que change le montage d'un router sur le préfixe `/api` ?",
      ],
    },
    {
      title: "Body, validation et réponses",
      objective: "Accepter et valider des payloads entrants.",
      concepts: "express.json/urlencoded, status codes, erreurs 400, schéma léger",
      practice: "POST /items avec validation basique + messages d'erreur clairs",
      mastery: "Je valide un body et renvoie des erreurs HTTP explicites",
      selfCheckQuestions: [
        "Que renvoie Express si le client poste du JSON invalide avec `express.json()` ?",
        "Quand renvoyer `400` plutôt que `500` pour une erreur de validation ?",
      ],
    },
    {
      title: "Erreurs, async et handlers",
      objective: "Gérer async/await et middleware d'erreur centralisé.",
      concepts: "async route handlers, try/catch, (err, req, res, next), 404 handler",
      practice: "refactor callbacks → async + error middleware global",
      mastery: "Je catch les erreurs async sans crash silencieux du serveur",
      selfCheckQuestions: [
        "Pourquoi une exception dans un handler `async` peut-elle ne pas atteindre le middleware d'erreur ?",
        "Combien d'arguments typiques a un middleware d'erreur Express `(err, req, res, next)` ?",
      ],
    },
    {
      title: "Structure projet et bonnes pratiques",
      objective: "Organiser une app Express maintenable.",
      concepts: "routes/controllers/services, env, helmet/cors intro, séparation config",
      practice: "checklist review Express : structure, erreurs, sécurité de base",
      mastery: "Je relis une app Express avec critères structure et ops",
      selfCheckQuestions: [
        "Pourquoi séparer routes, controllers et services dans une app Express ?",
        "À quoi sert un middleware CORS sur une API consommée par un front séparé ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const FASTIFY_BLUEPRINT = {
  id: "fastify",
  displayLabel: "Fastify",
  aliases: ["fastify", "fastifyjs", "fastify.js"],
  llmAddonLine:
    "5) Pour Fastify : routes/reply, JSON Schema, plugins/register, hooks lifecycle, logging — pas Express ni le runtime Node brut.",
  modules: [
    {
      title: "Fastify vs Express et modèle mental",
      objective: "Comprendre ce que Fastify apporte comme framework HTTP Node.",
      concepts: "schema-first, perf, plugin system, reply vs res, diff Express",
      practice: "fiche comparatif Express vs Fastify pour une API JSON",
      mastery: "Je justifie Fastify vs Express pour un cas API donné",
      selfCheckQuestions: [
        "Quelle différence entre `reply.send()` et l'objet `res` côté Express ?",
        "Pourquoi Fastify insiste-t-il sur une approche schema-first ?",
      ],
    },
    {
      title: "Routes, handlers et reply",
      objective: "Déclarer des routes et réponses typées.",
      concepts: "fastify.get/post, route params, request.query, reply.send/code",
      practice: "API /health + /items/:id avec codes HTTP explicites",
      mastery: "Je lis une route Fastify et prédits params/query/reply",
      selfCheckQuestions: [
        "Comment lire un paramètre `:id` dans une route Fastify ?",
        "À quoi sert `reply.code(404)` avant d'envoyer la réponse ?",
      ],
    },
    {
      title: "JSON Schema et validation",
      objective: "Valider body/query/response avec des schémas.",
      concepts: "schema body/response, Ajv, serialization, erreurs 400 auto",
      practice: "POST /users avec schema body + response 201",
      mastery: "J'écris un schema minimal et interprète les erreurs de validation",
      selfCheckQuestions: [
        "Où Fastify valide-t-il le body — dans le handler ou avant son exécution ?",
        "Que se passe-t-il si le body ne respecte pas le schema déclaré sur la route ?",
      ],
    },
    {
      title: "Plugins et encapsulation",
      objective: "Composer une app modulaire avec fastify.register.",
      concepts: "plugins, prefix, encapsulation context, async register",
      practice: "extraire routes users/posts en plugins montés",
      mastery: "Je découpe une app en plugins register() cohérents",
      selfCheckQuestions: [
        "À quoi sert `fastify.register()` plutôt que tout ajouter sur l'instance racine ?",
        "Qu'est-ce qui est encapsulé dans un plugin Fastify par défaut ?",
      ],
    },
    {
      title: "Hooks lifecycle",
      objective: "Intercepter le cycle requête-réponse proprement.",
      concepts: "onRequest, preHandler, onResponse, onError, ordre hooks",
      practice: "auth preHandler + logger onResponse sur un plugin",
      mastery: "Je choisis le hook adapté sans dupliquer la logique routes",
      selfCheckQuestions: [
        "Dans quel hook placer une vérification d'auth avant le handler de route ?",
        "Quand s'exécute un hook `onResponse` par rapport au handler ?",
      ],
    },
    {
      title: "Logging, erreurs et bonnes pratiques",
      objective: "Exploiter le logger intégré et la gestion d'erreurs.",
      concepts: "fastify.log, setErrorHandler, sensible errors prod, structure projet",
      practice: "checklist review Fastify : schemas, plugins, hooks, logs",
      mastery: "Je relis une app Fastify avec critères validation et ops",
      selfCheckQuestions: [
        "À quoi sert `setErrorHandler` dans une app Fastify ?",
        "Pourquoi préférer `fastify.log` à `console.log` en production ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const TAILWIND_BLUEPRINT = {
  id: "tailwind",
  displayLabel: "Tailwind CSS",
  aliases: ["tailwind", "tailwindcss", "tailwind css"],
  llmAddonLine:
    "5) Pour Tailwind : utility-first, spacing/layout, responsive/state variants, composition, limites d'architecture.",
  modules: [
    {
      title: "Philosophie utility-first",
      objective: "Comprendre pourquoi Tailwind existe et quand l'utiliser.",
      concepts: "utility classes, design tokens, JIT, vs CSS traditionnel",
      practice: "comparer même composant en CSS custom vs utilities",
      mastery: "Je justifie utility-first vs CSS module pour un cas donné",
      selfCheckQuestions: [
        "Quelle différence entre des utilities dans le markup et une classe `.card` dans un CSS global ?",
        "Pourquoi Tailwind pousse-t-il des tokens (`p-4`, `text-lg`) plutôt que des valeurs arbitraires partout ?",
      ],
    },
    {
      title: "Spacing, layout et typographie",
      objective: "Construire une UI cohérente avec l'échelle Tailwind.",
      concepts: "p/m/gap, flex/grid utilities, text-*, font-*, leading-*",
      practice: "card + navbar avec spacing/typo cohérents",
      mastery: "Je compose un layout lisible sans classes arbitraires excessives",
      selfCheckQuestions: [
        "Quand utiliser `gap-4` plutôt que des marges sur chaque enfant ?",
        "Que fait `text-center` par rapport à une règle `.center { text-align: center }` séparée ?",
      ],
    },
    {
      title: "Responsive variants",
      objective: "Adapter les utilities selon la taille d'écran.",
      concepts: "sm/md/lg/xl, mobile-first, hidden/block responsive",
      practice: "refactor composant fixe → responsive sm/md/lg",
      mastery: "Je lis une classe responsive et prédits le rendu par breakpoint",
      selfCheckQuestions: [
        "Pourquoi `md:flex` s'applique-t-il à partir du breakpoint `md` (mobile-first) ?",
        "Que change `hidden md:block` entre mobile et desktop ?",
      ],
    },
    {
      title: "State variants",
      objective: "Gérer hover, focus, active, dark mode.",
      concepts: "hover:, focus:, active:, dark:, group/peer",
      practice: "bouton + menu avec états focus/hover/dark",
      mastery: "J'applique les state variants sans dupliquer des composants",
      selfCheckQuestions: [
        "Quelle différence entre `hover:bg-blue-600` et changer le style en JavaScript ?",
        "À quoi sert le préfixe `dark:` sur une classe Tailwind ?",
      ],
    },
    {
      title: "Composition de composants",
      objective: "Extraire des patterns réutilisables sans perdre utility-first.",
      concepts: "@apply avec parcimonie, composants React/Vue + classes, cn/clsx",
      practice: "Button + Badge réutilisables en Tailwind pur",
      mastery: "Je balance utilities inline vs petit composant sans sur-abstraire",
      selfCheckQuestions: [
        "Quand `@apply` vaut-il mieux qu'une répétition naïve des mêmes utilities ?",
        "Pourquoi un petit composant peut-il être préférable à un gros bloc `@apply` ?",
      ],
    },
    {
      title: "Limites et bonnes pratiques",
      objective: "Éviter le markup illisible et l'architecture CSS fragile.",
      concepts: "class soup, plugins, purge/content config, a11y utilities",
      practice: "checklist review Tailwind : lisibilité, responsive, a11y",
      mastery: "Je relis du markup Tailwind avec critères lisibilité et maintenance",
      selfCheckQuestions: [
        "Pourquoi une classe construite en runtime (`text-${color}`) peut-elle disparaître après purge ?",
        "Qu'est-ce que la « class soup » et comment la limiter sans retomber en CSS global ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const PYTHON_BLUEPRINT = {
  id: "python",
  displayLabel: "Python",
  aliases: ["python", "python3", "py"],
  llmAddonLine:
    "5) Pour Python : syntaxe, structures de données, fonctions/modules, fichiers/exceptions, POO légère, pratique.",
  modules: [
    {
      title: "Syntaxe et structures de base",
      objective: "Écrire du Python idiomatique pour scripts simples.",
      concepts: "indentation, types de base, f-strings, input/output",
      practice: "script CLI minimal + fiche PEP8 intro",
      mastery: "Je lis et écris du Python sans erreurs d'indentation",
      selfCheckQuestions: [
        "Pourquoi l'indentation définit-elle un bloc en Python ?",
        "Quel avantage une f-string a-t-elle sur la concaténation avec `+` ?",
      ],
    },
    {
      title: "Structures de données",
      objective: "Choisir la bonne collection pour chaque cas.",
      concepts: "list, tuple, dict, set, comprehensions",
      practice: "3 exercices list/dict/set + comprehension",
      mastery: "Je choisis list vs dict vs set avec justification",
      selfCheckQuestions: [
        "Quelle différence entre une list et un tuple pour la mutabilité ?",
        "Quand préférer un set plutôt qu'une list pour tester l'appartenance ?",
      ],
    },
    {
      title: "Fonctions et modules",
      objective: "Structurer le code en fonctions et packages.",
      concepts: "def, return, *args/**kwargs, import, __name__ == '__main__'",
      practice: "petit package utils + tests manuels",
      mastery: "Je découpe un script monolithique en fonctions testables",
      selfCheckQuestions: [
        "Pourquoi `def f(items=[])` est-il un piège classique ?",
        "À quoi sert `if __name__ == '__main__':` ?",
      ],
    },
    {
      title: "Fichiers et exceptions",
      objective: "Lire/écrire des fichiers et gérer les erreurs proprement.",
      concepts: "with open, pathlib intro, try/except/else/finally, raise",
      practice: "ETL fichier CSV → JSON avec gestion d'erreurs",
      mastery: "Je gère fichiers et exceptions sans bare except",
      selfCheckQuestions: [
        "Pourquoi utiliser `with open(...)` plutôt qu'un open/close manuel ?",
        "Pourquoi éviter un `except:` nu sans type d'exception ?",
      ],
    },
    {
      title: "POO légère et scripting",
      objective: "Introduire classes quand la modélisation le justifie.",
      concepts: "class, __init__, methods, dataclass intro, scripting vs OOP",
      practice: "refactor dict → dataclass pour modèle métier simple",
      mastery: "Je sais quand une classe apporte plus qu'un dict/fonctions",
      selfCheckQuestions: [
        "Quand une dataclass vaut-elle mieux qu'un dict pour un modèle simple ?",
        "Que initialise `__init__` par rapport aux autres méthodes ?",
      ],
    },
    {
      title: "Pratique orientée cas réels",
      objective: "Consolider sur un mini-projet utile au quotidien.",
      concepts: "venv, pip, stdlib (json, datetime), debugging pdb/print",
      practice: "mini outil automation (rename files, parse logs…)",
      mastery: "Je livre un script Python documenté avec venv et README court",
      selfCheckQuestions: [
        "À quoi sert un virtualenv (venv) sur un projet Python ?",
        "Pourquoi activer le venv avant `pip install` sur un projet ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const JSX_BLUEPRINT = {
  id: "jsx",
  displayLabel: "JSX",
  aliases: ["jsx", "react jsx"],
  llmAddonLine:
    "5) Pour JSX : syntaxe, expressions {}, fragments, rendu conditionnel, props, pièges courants.",
  modules: [
    {
      title: "Rôle et syntaxe JSX",
      objective: "Comprendre ce que JSX est et n'est pas dans React.",
      concepts: "expressions JSX, un seul parent, camelCase, className",
      practice: "convertir 3 snippets HTML → JSX valides",
      mastery: "Je sais lire et écrire du JSX simple sans confondre HTML et JSX",
      selfCheckQuestions: [
        "Quelle différence entre `<div>` et `<Card>` en JSX (minuscule vs majuscule) ?",
        "Pourquoi JSX exige-t-il un seul élément parent racine ?",
      ],
    },
    {
      title: "Expressions et interpolation",
      objective: "Insérer du JavaScript dans le markup.",
      concepts: "{expression}, littéraux, objets interdits comme enfant direct",
      practice: "fiche : 5 patterns d'interpolation courants",
      mastery: "Je maîtrise {} sans erreurs « Objects are not valid as a React child »",
      selfCheckQuestions: [
        "Que signifie `{{ margin: 8 }}` dans `style={{ margin: 8 }}` ?",
        "Pourquoi un objet ne peut pas être rendu directement comme enfant JSX ?",
      ],
    },
    {
      title: "Fragments et structure",
      objective: "Structurer sans div wrapper inutile.",
      concepts: "<></>, Fragment, clés sur listes",
      practice: "refactor d'une liste avec clés stables",
      mastery: "Je choisis Fragment vs conteneur selon le besoin sémantique",
      selfCheckQuestions: [
        "Quand `<></>` vaut-il mieux qu'un `<div>` wrapper ?",
        "Pourquoi un Fragment court `<></>` ne peut-il pas recevoir de prop `key` ?",
      ],
    },
    {
      title: "Conditions et rendu",
      objective: "Afficher conditionnellement sans anti-patterns.",
      concepts: "&&, ternaire, early return",
      practice: "fiche pièges : 0, false, && chaîné",
      mastery: "Je rends des états conditionnels lisibles et sûrs",
      selfCheckQuestions: [
        "Pourquoi `{count && <Badge />}` peut afficher `0` au lieu de rien ?",
        "Quand un ternaire explicite vaut-il mieux qu'une chaîne de `&&` ?",
      ],
    },
    {
      title: "Props et composition",
      objective: "Composer des composants avec props.",
      concepts: "spread, children, déstructuration",
      practice: "mini composant Card + Badge réutilisable",
      mastery: "Je décompose une UI en composants props-driven",
      selfCheckQuestions: [
        "Quelle différence entre une prop JSX et un attribut HTML classique ?",
        "À quoi sert `children` dans `<Card>...</Card>` ?",
      ],
    },
    {
      title: "Pièges et bonnes pratiques",
      objective: "Éviter les erreurs fréquentes en prod et en review.",
      concepts: "key, inline handlers, style objet, XSS",
      practice: "checklist review JSX avant merge",
      mastery: "Je relis du JSX avec un regard senior",
      selfCheckQuestions: [
        "Pourquoi `className` remplace `class` en JSX ?",
        "Pourquoi éviter une instruction `if` directement dans le corps JSX ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const TYPESCRIPT_BLUEPRINT = {
  id: "typescript",
  displayLabel: "TypeScript",
  aliases: ["typescript", "typed javascript"],
  llmAddonLine:
    "5) Pour TypeScript : types, inférence, unions, interfaces, generics, narrowing, tsconfig, intégration React/Node.",
  modules: [
    {
      title: "Types de base et inférence",
      objective: "Lire et annoter du TypeScript sans sur-typer.",
      concepts: "primitives, any/unknown, inférence, annotations explicites",
      practice: "fiche : 10 annotations utiles vs bruit inutile",
      mastery: "Je choisis quand laisser inférer vs annoter explicitement",
      selfCheckQuestions: [
        "Quelle différence entre `any` et `unknown` pour une donnée externe non fiable ?",
        "Le typage TypeScript existe-t-il encore dans le JavaScript compilé en production ?",
      ],
    },
    {
      title: "Unions, intersections et alias",
      objective: "Modéliser des variantes et compositions de types.",
      concepts: "union |, intersection &, type alias, literal types",
      practice: "modéliser 3 états UI (idle/loading/error) en union",
      mastery: "Je compose des unions lisibles sans explosion de cas",
      selfCheckQuestions: [
        "Quelle différence entre une union `A | B` et une intersection `A & B` ?",
        "Pourquoi modéliser un état UI avec une union plutôt qu'un booléen `loading` seul ?",
      ],
    },
    {
      title: "Interfaces et structures objet",
      objective: "Décrire des objets et contrats API typés.",
      concepts: "interface, extends, readonly, index signatures",
      practice: "interface User + ApiResponse<T> réutilisable",
      mastery: "Je préfère interface vs type alias avec justification",
      selfCheckQuestions: [
        "Quand préférer `interface` plutôt que `type` pour un objet extensible ?",
        "Que garantit `readonly` sur une propriété d'interface ?",
      ],
    },
    {
      title: "Generics",
      objective: "Réutiliser des patterns typés sans duplication.",
      concepts: "generic functions, constraints extends, defaults",
      practice: "utilitaire pick/omit + fonction fetch typée",
      mastery: "J'écris un generic simple sans nested generics obscurs",
      selfCheckQuestions: [
        "À quoi sert `<T extends SomeType>` sur un generic ?",
        "Pourquoi éviter un generic là où un type concret suffit ?",
      ],
    },
    {
      title: "Narrowing et type guards",
      objective: "Affiner les types dans les branches conditionnelles.",
      concepts: "typeof, in, instanceof, discriminated unions, user-defined guards",
      practice: "switch sur discriminant + guard custom",
      mastery: "Je réduis unknown/union sans assertion abusive",
      selfCheckQuestions: [
        "Comment utiliser un `unknown` sans recourir à `as` immédiatement ?",
        "Quel rôle joue le champ discriminant dans une union discriminée ?",
      ],
    },
    {
      title: "Modules, tsconfig et écosystème",
      objective: "Configurer TS et l'intégrer à un projet réel.",
      concepts: "tsconfig strict, ESM/CJS, @types, TS + React/Node intro",
      practice: "init projet strict + migration JS → TS progressive",
      mastery: "Je règle tsconfig et intègre TS dans un stack existant",
      selfCheckQuestions: [
        "Que change concrètement `strict: true` dans `tsconfig.json` ?",
        "Pourquoi installer `@types/node` ou `@types/react` en plus du runtime ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const REACT_BLUEPRINT = {
  id: "react",
  displayLabel: "React",
  aliases: ["react", "reactjs", "react.js"],
  llmAddonLine:
    "5) Pour React : composants, props, state, effets, hooks, composition, data fetching, pièges perf.",
  modules: [
    {
      title: "Composants et props",
      objective: "Construire des UI en composants fonctionnels réutilisables.",
      concepts: "function components, props, children, déstructuration",
      practice: "refactor page monolithique → 4 composants props-driven",
      mastery: "Je découpe une UI en composants avec props claires",
      selfCheckQuestions: [
        "Quelle différence entre une prop et un state dans un composant ?",
        "L'enfant peut-il modifier directement une prop reçue du parent ?",
      ],
    },
    {
      title: "State local avec useState",
      objective: "Gérer l'état UI sans muter à l'aveugle.",
      concepts: "useState, immutabilité, state updater function",
      practice: "formulaire contrôlé + compteur avec updater",
      mastery: "Je mets à jour le state sans mutation directe",
      selfCheckQuestions: [
        "Pourquoi appeler `setCount(count + 1)` deux fois de suite ne garantit pas +2 ?",
        "Muter directement `items.push(x)` sur un state tableau est-il acceptable ?",
      ],
    },
    {
      title: "Effets et cycle de vie",
      objective: "Synchroniser React avec le monde extérieur proprement.",
      concepts: "useEffect, deps array, cleanup, quand éviter un effect",
      practice: "fetch + abort + loading/error states",
      mastery: "Je justifie chaque effect et ses dépendances",
      selfCheckQuestions: [
        "Que fait un `useEffect` sans tableau de dépendances à chaque render ?",
        "Quand la fonction de cleanup d'un effect s'exécute-t-elle ?",
      ],
    },
    {
      title: "Listes, keys et composition",
      objective: "Rendre des collections et composer sans prop drilling excessif.",
      concepts: "map + key stable, composition, lift state up intro",
      practice: "liste filtrable + extraction sous-composants",
      mastery: "Je choisis des keys stables et une composition lisible",
      selfCheckQuestions: [
        "Pourquoi utiliser l'index du tableau comme `key` peut-il causer des bugs ?",
        "Quelle différence entre un re-render et un remount d'un composant ?",
      ],
    },
    {
      title: "Hooks essentiels et custom hooks",
      objective: "Factoriser la logique réutilisable hors du JSX.",
      concepts: "useMemo, useCallback, useRef, custom hooks",
      practice: "hook useDebouncedValue + hook useLocalStorage",
      mastery: "J'extrais un custom hook quand la logique se répète",
      selfCheckQuestions: [
        "Changer `ref.current` déclenche-t-il un re-render — et pourquoi ?",
        "Dans quel cas un custom hook vaut-il mieux qu'une fonction utilitaire hors composant ?",
      ],
    },
    {
      title: "Patterns, perf et pièges",
      objective: "Éviter les anti-patterns fréquents en review React.",
      concepts: "Context intro, erreurs hooks, re-renders, React DevTools",
      practice: "checklist review React : keys, effects, memoisation",
      mastery: "Je relis un composant React avec critères perf et lisibilité",
      selfCheckQuestions: [
        "Peut-on appeler un hook à l'intérieur d'un `if` conditionnel ?",
        "Que t'aide à repérer React DevTools Profiler sur un re-render inutile ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const SQL_BLUEPRINT = {
  id: "sql",
  displayLabel: "SQL",
  aliases: ["sql", "sqlite", "mysql", "postgresql", "postgres"],
  llmAddonLine:
    "5) Pour SQL : SELECT/JOIN, agrégations, DML, transactions, index/EXPLAIN, modélisation relationnelle.",
  modules: [
    {
      title: "SELECT, filtrage et tri",
      objective: "Interroger une table avec les clauses de base.",
      concepts: "SELECT, WHERE, ORDER BY, LIMIT, DISTINCT",
      practice: "10 requêtes progressives sur un jeu de données",
      mastery: "J'écris un SELECT lisible avec filtres et tri pertinents",
      selfCheckQuestions: [
        "Que fait `DISTINCT` sur les colonnes sélectionnées ?",
        "Dans quel ordre logique s'appliquent WHERE et ORDER BY ?",
      ],
    },
    {
      title: "JOINs et relations",
      objective: "Combiner plusieurs tables sans produit cartésien accidentel.",
      concepts: "INNER/LEFT JOIN, clés étrangères, ON vs WHERE",
      practice: "fiche : 5 patterns JOIN courants avec schéma ER",
      mastery: "Je choisis le JOIN adapté et justifie le ON",
      selfCheckQuestions: [
        "Que renvoie un LEFT JOIN si aucune ligne ne correspond dans la table jointe ?",
        "Quelle différence entre INNER JOIN et LEFT JOIN sur les lignes sans correspondance ?",
      ],
    },
    {
      title: "Agrégations et GROUP BY",
      objective: "Résumer des données par groupe.",
      concepts: "COUNT/SUM/AVG, GROUP BY, HAVING, filtres vs agrégats",
      practice: "dashboard SQL : KPIs par catégorie et période",
      mastery: "Je distingue WHERE et HAVING sans erreur de grouping",
      selfCheckQuestions: [
        "WHERE filtre-t-il avant ou après le GROUP BY ?",
        "Quelle différence entre WHERE et HAVING sur un agrégat comme COUNT(*) ?",
      ],
    },
    {
      title: "INSERT, UPDATE, DELETE",
      objective: "Modifier des données avec prudence.",
      concepts: "INSERT, UPDATE, DELETE, RETURNING, contraintes",
      practice: "CRUD complet sur 2 tables liées",
      mastery: "Je modifie des lignes ciblées sans UPDATE sans WHERE",
      selfCheckQuestions: [
        "Pourquoi un UPDATE sans WHERE est-il dangereux ?",
        "Quelle différence entre DELETE et TRUNCATE quand tu veux vider une table ?",
      ],
    },
    {
      title: "Transactions et intégrité",
      objective: "Garantir la cohérence lors d'opérations multiples.",
      concepts: "BEGIN/COMMIT/ROLLBACK, ACID intro, contraintes UNIQUE/FK",
      practice: "transfert entre comptes en transaction",
      mastery: "Je regroupe des écritures liées dans une transaction",
      selfCheckQuestions: [
        "Quand faut-il regrouper plusieurs écritures SQL dans une transaction ?",
        "Que fait ROLLBACK après un BEGIN si une étape intermédiaire échoue ?",
      ],
    },
    {
      title: "Index, EXPLAIN et modélisation",
      objective: "Comprendre perf de base et schéma relationnel sain.",
      concepts: "index B-tree intro, EXPLAIN, normalisation légère, pièges N+1",
      practice: "optimiser 2 requêtes lentes + revue schéma",
      mastery: "Je lis un EXPLAIN simple et propose un index pertinent",
      selfCheckQuestions: [
        "À quoi sert EXPLAIN avant d'ajouter un index ?",
        "Un index sur une colonne accélère-t-il toutes les requêtes sur la table ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const DOCKER_BLUEPRINT = {
  id: "docker",
  displayLabel: "Docker",
  aliases: ["docker", "dockerfile", "conteneur", "conteneurs", "container", "containers"],
  llmAddonLine:
    "5) Pour Docker : images/containers, Dockerfile, build/layers, volumes/ports, réseau, Compose, debug et bonnes pratiques.",
  modules: [
    {
      title: "Images, conteneurs et modèle mental",
      objective: "Comprendre ce qu'est un conteneur vs une VM vs l'hôte.",
      concepts: "image, container, registry, isolation, couche read-only/writeable",
      practice: "fiche schéma : host → image → container running",
      mastery: "J'explique image vs conteneur vs processus hôte",
      selfCheckQuestions: [
        "Quelle différence entre une image Docker et un conteneur en cours d'exécution ?",
        "Où persistent les changements écrits dans un conteneur sans volume ?",
      ],
    },
    {
      title: "Premiers conteneurs en CLI",
      objective: "Lancer, inspecter et arrêter des conteneurs.",
      concepts: "docker run, ps, logs, exec, stop, rm, -p, -d, --name",
      practice: "nginx en conteneur + logs + shell exec",
      mastery: "Je fais tourner un service conteneurisé et le debug en CLI",
      selfCheckQuestions: [
        "Quelle différence entre `docker run` et `docker start` sur un conteneur déjà créé ?",
        "À quoi sert `docker exec` par rapport à lancer un second conteneur identique ?",
      ],
    },
    {
      title: "Dockerfile et build d'images",
      objective: "Construire une image reproductible pour une app.",
      concepts: "FROM, WORKDIR, COPY, RUN, CMD/ENTRYPOINT, .dockerignore",
      practice: "Dockerfile multi-stage pour app Node ou Python",
      mastery: "Je produis une image minimale qui build sans surprise",
      selfCheckQuestions: [
        "Quelle différence entre CMD et ENTRYPOINT dans un Dockerfile ?",
        "Pourquoi placer les instructions qui changent souvent plus bas dans le Dockerfile ?",
      ],
    },
    {
      title: "Volumes, ports et persistance",
      objective: "Gérer données et exposition réseau proprement.",
      concepts: "bind mount, named volume, -v, -p, permissions",
      practice: "DB Postgres avec volume nommé + port mappé",
      mastery: "Je persiste des données sans tout mettre dans l'image",
      selfCheckQuestions: [
        "Quelle différence entre un bind mount et un volume nommé ?",
        "La directive EXPOSE dans un Dockerfile publie-t-elle automatiquement le port sur l'hôte ?",
      ],
    },
    {
      title: "Réseau et docker-compose",
      objective: "Orchestrer plusieurs services localement.",
      concepts: "bridge network, DNS interne, compose services/networks/volumes",
      practice: "stack app + DB + cache avec docker-compose.yml",
      mastery: "Je compose 2–3 services qui communiquent via Compose",
      selfCheckQuestions: [
        "À quoi sert docker-compose par rapport à plusieurs `docker run` manuels ?",
        "Comment un service Compose contacte-t-il un autre par son nom de service ?",
      ],
    },
    {
      title: "Debug, sécurité et bonnes pratiques",
      objective: "Diagnostiquer et éviter les erreurs fréquentes en prod-like.",
      concepts: "layers cache, non-root user, healthcheck, prune, pièges COPY",
      practice: "checklist review Dockerfile + debug container crash",
      mastery: "Je relis un Dockerfile avec critères sécurité et reproductibilité",
      selfCheckQuestions: [
        "Pourquoi éviter d'exécuter un conteneur en root en production ?",
        "Que consultes-tu en premier si un conteneur s'arrête immédiatement au démarrage ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const GIT_BLUEPRINT = {
  id: "git",
  displayLabel: "Git",
  aliases: ["git", "github", "gitlab"],
  llmAddonLine:
    "5) Pour Git : commits, branches, remote, merge/rebase intro, stash/reset/revert, workflow feature branch, .gitignore.",
  modules: [
    {
      title: "Dépôt, commits et historique",
      objective: "Versionner du code avec des commits atomiques.",
      concepts: "init/clone, status, add, commit, log, diff, .gitignore",
      practice: "init repo + 5 commits atomiques + lecture git log --oneline",
      mastery: "Je fais des commits clairs avec messages explicites",
      selfCheckQuestions: [
        "Que contient un commit Git en plus du snapshot des fichiers ?",
        "À quoi sert `.gitignore` par rapport à simplement oublier de `git add` ?",
      ],
    },
    {
      title: "Branches et fusion",
      objective: "Travailler en parallèle sans casser main.",
      concepts: "branch, checkout/switch, merge, fast-forward vs merge commit",
      practice: "feature branch → merge dans main avec résolution simple",
      mastery: "Je crée une branche, merge et lis le graphe resultat",
      selfCheckQuestions: [
        "Quelle différence entre un merge fast-forward et un merge commit ?",
        "Sur quelle branche es-tu généralement quand tu merges une feature dans main ?",
      ],
    },
    {
      title: "Remote, push et pull",
      objective: "Synchroniser un dépôt local avec un remote.",
      concepts: "remote, origin, push, pull, fetch, upstream, tracking branch",
      practice: "lier origin + push branche + pull avec conflit simulé",
      mastery: "Je synchronise local/remote sans perdre de commits",
      selfCheckQuestions: [
        "Quelle différence entre `git fetch` et `git pull` ?",
        "Que signifie qu'une branche locale suit une branche upstream distante ?",
      ],
    },
    {
      title: "Rebase, cherry-pick et réécriture légère",
      objective: "Réorganiser l'historique avec prudence.",
      concepts: "rebase interactif intro, cherry-pick, amend, quand éviter rebase public",
      practice: "rebase feature sur main + amend message commit",
      mastery: "Je choisis merge vs rebase avec justification",
      selfCheckQuestions: [
        "Quelle différence entre merge et rebase pour intégrer une branche feature ?",
        "Pourquoi éviter de rebaser une branche déjà poussée et partagée ?",
      ],
    },
    {
      title: "Stash, reset et revert",
      objective: "Récupérer ou annuler des changements sans panique.",
      concepts: "stash pop/apply, reset --soft/mixed/hard, revert commit",
      practice: "fiche : 5 scénarios undo (stash, revert, reset)",
      mastery: "Je choisis revert vs reset selon si l'historique est partagé",
      selfCheckQuestions: [
        "Quelle différence entre `git revert` et `git reset --hard` sur un commit déjà poussé ?",
        "À quoi sert `git stash` avant de changer de branche avec des modifications non commitées ?",
      ],
    },
    {
      title: "Workflow équipe et bonnes pratiques",
      objective: "Adopter un flux feature branch / PR crédible.",
      concepts: "feature branch, PR/MR, review, tags, semver intro, hooks",
      practice: "checklist PR : branche, commits, conflits, .gitignore",
      mastery: "Je contribue via branche + PR avec historique propre",
      selfCheckQuestions: [
        "Quelle différence entre ouvrir une PR et pousser directement sur main ?",
        "Pourquoi des commits atomiques facilitent-ils la review ?",
      ],
    },
  ],
};

/** @type {TechnicalLearningBlueprint} */
const JVM_JAVASCRIPT_BLUEPRINT = {
  id: "jvm_javascript",
  displayLabel: "JavaScript sur la JVM (GraalVM / héritage Nashorn)",
  aliases: ["jvm javascript", "jvm js", "graalvm js"],
  reframeNote:
    "Recadrage : ta formulation mélange JVM et JavaScript — le plan cible **JavaScript exécuté sur la JVM** (GraalVM JS aujourd'hui, héritage Nashorn si migration).",
  llmAddonLine:
    "5) Pour JavaScript sur la JVM : GraalVM JS, interop Java, migration Nashorn, performance/limites.",
  modules: [
    {
      title: "Cartographie JVM et JavaScript",
      objective:
        "Clarifier ce que « JavaScript sur la JVM » signifie vs Nashorn legacy.",
      concepts: "JVM, Nashorn retiré, GraalVM JS",
      practice: "fiche comparatif Nashorn vs GraalVM JS",
      mastery: "Je sais quand GraalVM JS est pertinent vs Node.js",
      selfCheckQuestions: [
        "Que signifie « JavaScript sur la JVM » dans ce contexte ?",
        "Quelle différence entre exécuter du JS avec Node.js et avec GraalVM sur la JVM ?",
      ],
    },
    {
      title: "GraalVM JavaScript — exécution",
      objective: "Lancer du JS sur la JVM avec GraalVM.",
      concepts: "graaljs, polyglot context, CLI",
      practice: "hello-world GraalVM JS depuis Java",
      mastery: "Je fais tourner un script JS sur la JVM",
      selfCheckQuestions: [
        "Qui est le runtime principal quand du JS tourne via GraalVM dans une appli Java ?",
        "À quoi sert un contexte polyglot GraalVM pour exécuter du JS ?",
      ],
    },
    {
      title: "Interop Java ↔ JavaScript",
      objective: "Appeler Java depuis JS et inversement.",
      concepts: "host interop, proxies, bindings",
      practice: "fiche : 3 patterns Java ↔ JS",
      mastery: "Je conçois une frontière Java/JS claire",
      selfCheckQuestions: [
        "Dans quel sens typique une appli Java appelle-t-elle un script JS embarqué ?",
        "Pourquoi définir une frontière Java/JS plutôt que mélanger les deux langages partout ?",
      ],
    },
    {
      title: "Migration Nashorn",
      objective: "Planifier une migration depuis code legacy.",
      concepts: "ScriptEngine, nashorn-compat, écarts ECMAScript",
      practice: "checklist migration ScriptEngine → GraalVM",
      mastery: "J'identifie les blockers Nashorn dans un codebase",
      selfCheckQuestions: [
        "Pourquoi Nashorn pose-t-il problème dans un projet Java récent ?",
        "Quel type de code ScriptEngine legacy est le plus risqué à migrer vers GraalVM ?",
      ],
    },
    {
      title: "Performance et limites",
      objective: "Comprendre warmup, footprint, quand éviter JS sur JVM.",
      concepts: "JIT warmup, sandbox, perf vs Node/V8",
      practice: "fiche décision GraalVM JS vs Node",
      mastery: "Je tranche runtime avec critères explicites",
      selfCheckQuestions: [
        "Pourquoi le warmup JIT peut-il pénaliser du JS lancé brièvement sur la JVM ?",
        "Dans quel cas Node/V8 reste un meilleur choix que GraalVM JS ?",
      ],
    },
    {
      title: "Consolidation",
      objective: "Consolider par mini-projet mixte Java/JS.",
      concepts: "debug interop, classpaths, versions GraalVM",
      practice: "utilitaire Java appelant module JS",
      mastery: "Je livre un module mixte documenté avec limites connues",
      selfCheckQuestions: [
        "Quelle responsabilité typique pour Java vs JS dans un mini-projet mixte ?",
        "Pourquoi documenter les limites connues de l'interop avant la mise en prod ?",
      ],
    },
  ],
};

/**
 * @param {TechnicalLearningBlueprint} blueprint
 * @returns {TechnicalLearningBlueprint}
 */
function attachOfficialModuleResources(blueprint) {
  const resources = OFFICIAL_MODULE_RESOURCES_BY_BLUEPRINT_ID[blueprint.id];
  if (!resources?.length) return blueprint;

  return {
    ...blueprint,
    modules: blueprint.modules.map((mod, index) => {
      const resourceLink = mod.resourceLink ?? resources[index];
      return resourceLink ? { ...mod, resourceLink } : mod;
    }),
  };
}

/** @type {TechnicalLearningBlueprint[]} */
export const TECHNICAL_LEARNING_BLUEPRINTS = [
  HTML_BLUEPRINT,
  CSS_BLUEPRINT,
  JAVASCRIPT_BLUEPRINT,
  NODEJS_BLUEPRINT,
  EXPRESS_BLUEPRINT,
  FASTIFY_BLUEPRINT,
  TYPESCRIPT_BLUEPRINT,
  REACT_BLUEPRINT,
  TAILWIND_BLUEPRINT,
  PYTHON_BLUEPRINT,
  SQL_BLUEPRINT,
  DOCKER_BLUEPRINT,
  GIT_BLUEPRINT,
  JSX_BLUEPRINT,
  JVM_JAVASCRIPT_BLUEPRINT,
].map(attachOfficialModuleResources);

/** @type {Record<string, TechnicalLearningBlueprint>} */
export const TECHNICAL_LEARNING_BLUEPRINT_BY_ID = Object.fromEntries(
  TECHNICAL_LEARNING_BLUEPRINTS.map((bp) => [bp.id, bp]),
);

const ALIAS_TO_BLUEPRINT_ID = Object.freeze(
  Object.fromEntries(
    TECHNICAL_LEARNING_BLUEPRINTS.flatMap((bp) =>
      bp.aliases.map((alias) => [alias.toLowerCase(), bp.id]),
    ),
  ),
);

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeTargetToken(raw = "") {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} [query]
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null} [slots]
 * @returns {string}
 */
function buildNormalizedLearningTargetText(query = "", slots = null) {
  return normalizeTargetToken(
    [slots?.domain, slots?.domainLabel, slots?.targetStack, extractLearningDomain(query), query]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * @param {string} [query]
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null} [slots]
 * @returns {string|null}
 */
export function normalizeTechnicalLearningTarget(query = "", slots = null) {
  if (isJvmJavaScriptHybridLearningTopic(query, slots)) {
    return "jvm_javascript";
  }

  const combined = buildNormalizedLearningTargetText(query, slots);

  if (/\bjsx\b/.test(combined)) {
    return "jsx";
  }
  if (/\b(?:typescript|typed javascript)\b/.test(combined) || /\bts\b/.test(combined)) {
    return "typescript";
  }
  if (/\breact(?:\.?js)?\b/.test(combined)) {
    return "react";
  }
  if (/\bfastify(?:\.?js)?\b/.test(combined)) {
    return "fastify";
  }
  if (/\bexpress(?:\.?js)?\b/.test(combined)) {
    return "express";
  }
  if (
    /\b(?:nodejs|node js|node\.js)\b/.test(combined) ||
    (/\bnode\b/.test(combined) &&
      /\b(?:npm|runtime|backend|serveur|cli|process\.env)\b/.test(combined)) ||
    /\b(?:maitriser|apprendre)\s+node\b/.test(combined)
  ) {
    return "nodejs";
  }

  const parts = [
    slots?.domain,
    slots?.domainLabel,
    slots?.targetStack,
    extractLearningDomain(query),
    query,
  ]
    .filter(Boolean)
    .map(normalizeTargetToken);

  for (const part of parts) {
    for (const [alias, id] of Object.entries(ALIAS_TO_BLUEPRINT_ID)) {
      const aliasNorm = normalizeTargetToken(alias);
      if (
        part === aliasNorm ||
        new RegExp(`\\b${aliasNorm.replace(/\s+/g, "\\s+")}\\b`).test(part)
      ) {
        if (id === "javascript" && /\bjvm\b/.test(part)) continue;
        if (id === "javascript" && /\b(?:nodejs|node js|node\.js)\b/.test(part)) continue;
        if (id === "javascript" && /\bnode\b/.test(part)) continue;
        if (id === "javascript" && /\bexpress\b/.test(part)) continue;
        if (id === "javascript" && /\bfastify\b/.test(part)) continue;
        if (id === "javascript" && /\btypescript\b/.test(part)) continue;
        if (id === "nodejs" && /\bexpress\b/.test(part)) continue;
        if (id === "nodejs" && /\bfastify\b/.test(part)) continue;
        if (id === "express" && /\bfastify\b/.test(part)) continue;
        return id;
      }
    }
  }

  return null;
}

/**
 * @param {string} [query]
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null} [slots]
 * @returns {TechnicalLearningBlueprint|null}
 */
export function resolveTechnicalLearningBlueprint(query = "", slots = null) {
  const resolved = slots || parseTechnicalLearningPath(query);
  const id = normalizeTechnicalLearningTarget(query, resolved);
  if (!id) return null;
  return TECHNICAL_LEARNING_BLUEPRINT_BY_ID[id] ?? null;
}

/**
 * @param {string} blueprintId
 * @returns {boolean}
 */
export function hasDedicatedTechnicalLearningBlueprint(blueprintId = "") {
  return Boolean(TECHNICAL_LEARNING_BLUEPRINT_BY_ID[String(blueprintId || "")]);
}

/**
 * @param {string} [query]
 * @param {import("../../utils/technicalLearningPathIntentGuards.js").TechnicalLearningPathSlots|null} [slots]
 * @returns {boolean}
 */
export function isCssLearningTopic(query = "", slots = null) {
  return normalizeTechnicalLearningTarget(query, slots) === "css";
}

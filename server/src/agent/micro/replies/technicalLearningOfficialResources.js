/**
 * Liens officiels statiques — 1 ressource max par module de blueprint.
 * Pas de recherche web, pas de ranking : doc primaire uniquement.
 *
 * @typedef {Object} OfficialModuleResourceLink
 * @property {string} url — https obligatoire
 * @property {string} title — libellé du lien
 * @property {"Ressource officielle"|"Doc conseillée"} [sectionLabel]
 */

/** @type {Record<string, readonly OfficialModuleResourceLink[]>} */
export const OFFICIAL_MODULE_RESOURCES_BY_BLUEPRINT_ID = Object.freeze({
  html: [
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
      title: "MDN — HTML",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Content_categories",
      title: "MDN — Catégories de contenu HTML",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a",
      title: "MDN — Élément `<a>`",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table",
      title: "MDN — Tableaux HTML",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form",
      title: "MDN — Formulaires HTML",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
      title: "MDN — Accessibilité web",
    },
  ],
  css: [
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
      title: "MDN — CSS",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade",
      title: "MDN — Cascade CSS",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model",
      title: "MDN — Box model",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout",
      title: "MDN — CSS Grid",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries",
      title: "MDN — Media queries",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Debugging_CSS",
      title: "MDN — Déboguer le CSS",
    },
  ],
  javascript: [
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
      title: "MDN — Guide JavaScript",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling",
      title: "MDN — Contrôle de flux",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions",
      title: "MDN — Fonctions",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array",
      title: "MDN — Array",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model",
      title: "MDN — DOM",
    },
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
      title: "MDN — Promise",
    },
  ],
  nodejs: [
    {
      url: "https://nodejs.org/docs/latest/api/",
      title: "Node.js — Documentation API",
    },
    {
      url: "https://nodejs.org/docs/latest/api/process.html",
      title: "Node.js — process",
    },
    {
      url: "https://nodejs.org/docs/latest/api/packages.html",
      title: "Node.js — Packages",
    },
    {
      url: "https://nodejs.org/docs/latest/api/fs.html",
      title: "Node.js — fs",
    },
    {
      url: "https://nodejs.org/docs/latest/api/http.html",
      title: "Node.js — http",
    },
    {
      url: "https://nodejs.org/docs/latest/api/environment_variables.html",
      title: "Node.js — Variables d'environnement",
    },
  ],
  express: [
    {
      url: "https://expressjs.com/",
      title: "Express — Documentation",
    },
    {
      url: "https://expressjs.com/en/guide/routing.html",
      title: "Express — Routing",
    },
    {
      url: "https://expressjs.com/en/guide/using-middleware.html",
      title: "Express — Middleware",
    },
    {
      url: "https://expressjs.com/en/guide/routing.html#express-router",
      title: "Express — Router",
    },
    {
      url: "https://expressjs.com/en/4x/api.html#req.body",
      title: "Express — API Request",
    },
    {
      url: "https://expressjs.com/en/guide/error-handling.html",
      title: "Express — Gestion d'erreurs",
    },
  ],
  fastify: [
    {
      url: "https://fastify.dev/docs/latest/",
      title: "Fastify — Documentation",
    },
    {
      url: "https://fastify.dev/docs/latest/Reference/Routes/",
      title: "Fastify — Routes",
    },
    {
      url: "https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/",
      title: "Fastify — Validation et sérialisation",
    },
    {
      url: "https://fastify.dev/docs/latest/Reference/Plugins/",
      title: "Fastify — Plugins",
    },
    {
      url: "https://fastify.dev/docs/latest/Reference/Hooks/",
      title: "Fastify — Hooks",
    },
    {
      url: "https://fastify.dev/docs/latest/Reference/Logging/",
      title: "Fastify — Logging",
    },
  ],
  typescript: [
    {
      url: "https://www.typescriptlang.org/docs/",
      title: "TypeScript — Documentation",
    },
    {
      url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
      title: "TypeScript — Types courants",
    },
    {
      url: "https://www.typescriptlang.org/docs/handbook/2/objects.html",
      title: "TypeScript — Objets et interfaces",
    },
    {
      url: "https://www.typescriptlang.org/docs/handbook/2/generics.html",
      title: "TypeScript — Generics",
    },
    {
      url: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html",
      title: "TypeScript — Narrowing",
    },
    {
      url: "https://www.typescriptlang.org/docs/handbook/tsconfig-json.html",
      title: "TypeScript — tsconfig.json",
    },
  ],
  react: [
    {
      url: "https://react.dev/learn",
      title: "React — Learn",
    },
    {
      url: "https://react.dev/learn/state-a-components-memory",
      title: "React — State",
    },
    {
      url: "https://react.dev/reference/react/useEffect",
      title: "React — useEffect",
    },
    {
      url: "https://react.dev/learn/rendering-lists",
      title: "React — Listes et keys",
    },
    {
      url: "https://react.dev/reference/react/useMemo",
      title: "React — useMemo",
    },
    {
      url: "https://react.dev/reference/rules/rules-of-hooks",
      title: "React — Rules of Hooks",
    },
  ],
  tailwind: [
    {
      url: "https://tailwindcss.com/docs/utility-first",
      title: "Tailwind — Utility-first",
    },
    {
      url: "https://tailwindcss.com/docs/padding",
      title: "Tailwind — Spacing",
    },
    {
      url: "https://tailwindcss.com/docs/responsive-design",
      title: "Tailwind — Responsive design",
    },
    {
      url: "https://tailwindcss.com/docs/hover-focus-and-other-states",
      title: "Tailwind — Variantes d'état",
    },
    {
      url: "https://tailwindcss.com/docs/reusing-styles",
      title: "Tailwind — Réutiliser les styles",
    },
    {
      url: "https://tailwindcss.com/docs/content-configuration",
      title: "Tailwind — Content configuration",
    },
  ],
  python: [
    {
      url: "https://docs.python.org/3/tutorial/",
      title: "Python — Tutoriel officiel",
    },
    {
      url: "https://docs.python.org/3/tutorial/datastructures.html",
      title: "Python — Structures de données",
    },
    {
      url: "https://docs.python.org/3/tutorial/modules.html",
      title: "Python — Modules",
    },
    {
      url: "https://docs.python.org/3/tutorial/errors.html",
      title: "Python — Erreurs et exceptions",
    },
    {
      url: "https://docs.python.org/3/tutorial/classes.html",
      title: "Python — Classes",
    },
    {
      url: "https://docs.python.org/3/tutorial/venv.html",
      title: "Python — venv",
    },
  ],
  sql: [
    {
      url: "https://www.sqlite.org/lang_select.html",
      title: "SQLite — SELECT",
    },
    {
      url: "https://www.sqlite.org/lang_aggfunc.html",
      title: "SQLite — Fonctions d'agrégation",
    },
    {
      url: "https://www.sqlite.org/lang_insert.html",
      title: "SQLite — INSERT",
    },
    {
      url: "https://www.sqlite.org/lang_transaction.html",
      title: "SQLite — Transactions",
    },
    {
      url: "https://www.sqlite.org/lang_createindex.html",
      title: "SQLite — CREATE INDEX",
    },
    {
      url: "https://www.sqlite.org/lang_createtable.html",
      title: "SQLite — CREATE TABLE",
    },
  ],
  docker: [
    {
      url: "https://docs.docker.com/get-started/",
      title: "Docker — Get started",
    },
    {
      url: "https://docs.docker.com/reference/dockerfile/",
      title: "Docker — Dockerfile reference",
    },
    {
      url: "https://docs.docker.com/reference/cli/docker/container/run/",
      title: "Docker — docker run",
    },
    {
      url: "https://docs.docker.com/compose/",
      title: "Docker — Compose",
    },
    {
      url: "https://docs.docker.com/engine/containers/run/#runtime-privilege-and-linux-capabilities",
      title: "Docker — Conteneurs en production",
    },
    {
      url: "https://docs.docker.com/reference/cli/docker/system/prune/",
      title: "Docker — docker system prune",
    },
  ],
  git: [
    {
      url: "https://git-scm.com/doc",
      title: "Git — Documentation",
    },
    {
      url: "https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository",
      title: "Git Book — Enregistrer des changements",
    },
    {
      url: "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell",
      title: "Git Book — Branches",
    },
    {
      url: "https://git-scm.com/book/en/v2/Git-Tools-Reset-Demystified",
      title: "Git Book — Reset demystified",
    },
    {
      url: "https://git-scm.com/book/en/v2/GitHub-Contributing-to-a-Project",
      title: "Git Book — Contribuer à un projet",
    },
    {
      url: "https://git-scm.com/book/en/v2/Git-Internals-Git-References",
      title: "Git Book — Références Git",
    },
  ],
  jsx: [
    {
      url: "https://react.dev/learn/writing-markup-with-jsx",
      title: "React — Écrire du markup avec JSX",
    },
    {
      url: "https://react.dev/learn/javascript-in-jsx-with-curly-braces",
      title: "React — JavaScript dans JSX",
    },
    {
      url: "https://react.dev/reference/react/Fragment",
      title: "React — Fragment",
    },
    {
      url: "https://react.dev/learn/conditional-rendering",
      title: "React — Rendu conditionnel",
    },
    {
      url: "https://react.dev/learn/passing-props-to-a-component",
      title: "React — Passer des props",
    },
    {
      url: "https://react.dev/learn/removing-effect-dependencies",
      title: "React — Pièges JSX et effets",
      sectionLabel: "Doc conseillée",
    },
  ],
  jvm_javascript: [
    {
      url: "https://www.graalvm.org/latest/reference-manual/js/",
      title: "GraalVM — JavaScript",
    },
    {
      url: "https://www.graalvm.org/latest/reference-manual/js/RunJS/",
      title: "GraalVM — Exécuter du JS",
    },
    {
      url: "https://www.graalvm.org/latest/reference-manual/js/JavaInteroperability/",
      title: "GraalVM — Interop Java",
    },
    {
      url: "https://www.graalvm.org/latest/reference-manual/js/NashornCompatibility/",
      title: "GraalVM — Compatibilité Nashorn",
    },
    {
      url: "https://www.graalvm.org/latest/reference-manual/js/Performance/",
      title: "GraalVM — Performance JS",
    },
    {
      url: "https://www.graalvm.org/latest/reference-manual/js/NodejsCompatibility/",
      title: "GraalVM — Compatibilité Node.js",
    },
  ],
});

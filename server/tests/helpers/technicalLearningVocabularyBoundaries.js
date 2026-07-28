/**
 * Frontières vocabulaire — mini-questions « Pour te tester » (technical_learning_path).
 * Aligné docs/agents/intent-families-philosophy.md (stacks proches, pas de contamination croisée).
 *
 * @typedef {Object} VocabularyBoundarySide
 * @property {string} label — stack côté métier (lisible en échec de test)
 * @property {string} query — requête routée vers le blueprint
 * @property {RegExp} mustNotContainInSelfCheck — vocabulaire interdit dans Pour te tester
 *
 * @typedef {Object} VocabularyBoundaryPair
 * @property {string} id — identifiant stable (kebab-case)
 * @property {string} intent — intention métier de la frontière
 * @property {VocabularyBoundarySide} left
 * @property {VocabularyBoundarySide} right
 */

/** @type {readonly VocabularyBoundaryPair[]} */
export const TECHNICAL_LEARNING_VOCABULARY_BOUNDARIES = Object.freeze([
  {
    id: "javascript-typescript",
    intent:
      "JavaScript (langage ECMAScript) ↔ TypeScript (système de types) — pas de vocab TS dans JS",
    left: {
      label: "JavaScript",
      query:
        "je veux créer des fiches de connaissances afin maitriser javascript",
      mustNotContainInSelfCheck: /`unknown`|tsconfig|union discriminée/i,
    },
    right: {
      label: "TypeScript",
      query:
        "je veux créer des fiches de connaissances afin maitriser typescript",
      mustNotContainInSelfCheck:
        /className remplace|Fragment court|`\{\{ margin: 8 \}\}`/i,
    },
  },
  {
    id: "express-fastify",
    intent:
      "Express (middleware next) ↔ Fastify (schema-first, hooks) — frameworks HTTP Node distincts",
    left: {
      label: "Express",
      query:
        "je veux créer des fiches de connaissances afin maitriser express",
      mustNotContainInSelfCheck:
        /preHandler|fastify\.register|JSON Schema|onResponse/i,
    },
    right: {
      label: "Fastify",
      query:
        "je veux créer des fiches de connaissances afin maitriser fastify",
      mustNotContainInSelfCheck: /\bnext\(\)|express\.Router\b/i,
    },
  },
  {
    id: "python-javascript",
    intent:
      "Python (runtime/langage) ↔ JavaScript (ECMAScript) — pas de fuites venv/hooks",
    left: {
      label: "Python",
      query: "je veux créer des fiches de connaissances afin maitriser python",
      mustNotContainInSelfCheck: /\buseState\b|typescript|jsx|npm install/i,
    },
    right: {
      label: "JavaScript",
      query:
        "je veux créer des fiches de connaissances afin maitriser javascript",
      mustNotContainInSelfCheck: /venv|__name__|dataclass|items=\[\]/i,
    },
  },
  {
    id: "jvm-javascript-nodejs",
    intent:
      "JVM+JS (GraalVM/Nashorn) ↔ Node.js (runtime V8) — runtimes JS distincts",
    left: {
      label: "JVM+JS",
      query:
        "je veux créer des fiches de connaissances afin maitriser la jvm pour javascript",
      mustNotContainInSelfCheck:
        /http\.createServer|express\.|fastify\.|npm install|package\.json/i,
    },
    right: {
      label: "Node.js",
      query:
        "je veux créer des fiches de connaissances afin maitriser nodejs",
      mustNotContainInSelfCheck:
        /GraalVM|Nashorn|polyglot|ScriptEngine|Java sur la JVM/i,
    },
  },
  {
    id: "jsx-react",
    intent:
      "JSX (syntaxe de vue) ↔ React (framework UI, hooks) — pas de hooks dans JSX ni syntaxe JSX dans React",
    left: {
      label: "JSX",
      query: "je veux créer des fiches de connaissances afin maitriser jsx",
      mustNotContainInSelfCheck:
        /\buseState\b|\buseEffect\b|\buseMemo\b|custom hook|DevTools Profiler/i,
    },
    right: {
      label: "React",
      query: "je veux créer des fiches de connaissances afin maitriser react",
      mustNotContainInSelfCheck:
        /className remplace|Fragment court|un seul élément parent|Objects are not valid/i,
    },
  },
  {
    id: "tailwind-css",
    intent:
      "Tailwind (utility-first) ↔ CSS (cascade, spécificité) — pas de @apply/sm: vs cascade pure",
    left: {
      label: "Tailwind",
      query:
        "je veux créer des fiches de connaissances afin maitriser tailwind",
      mustNotContainInSelfCheck:
        /spécificité|@layer|@keyframes|margin collapse/i,
    },
    right: {
      label: "CSS",
      query:
        "je veux créer des fiches de connaissances afin maitriser le css et ses regles",
      mustNotContainInSelfCheck: /@apply|utility-first|\bsm:|purge|class soup/i,
    },
  },
  {
    id: "docker-git",
    intent:
      "Docker (conteneurs) ↔ Git (versionning) — ops distinctes, pas de Dockerfile dans Git",
    left: {
      label: "Docker",
      query:
        "je veux créer des fiches de connaissances afin maitriser docker",
      mustNotContainInSelfCheck: /\bgit (?:rebase|merge|stash|revert)\b/i,
    },
    right: {
      label: "Git",
      query: "je veux créer des fiches de connaissances afin maitriser git",
      mustNotContainInSelfCheck:
        /docker-compose|Dockerfile|bind mount|EXPOSE/i,
    },
  },
]);

/**
 * Extrait le contenu des sections « Pour te tester » (toutes modules confondues).
 * @param {string} text
 * @returns {string}
 */
export function extractPourTeTesterSections(text = "") {
  return String(text || "")
    .split("**Pour te tester**")
    .slice(1)
    .join("\n");
}

/**
 * @param {string} reply
 * @param {VocabularyBoundarySide} side
 * @param {VocabularyBoundaryPair} boundary
 * @param {import("node:assert/strict")} assert
 */
export function assertSelfCheckVocabularyBoundary(reply, side, boundary, assert) {
  assert.ok(reply, `[${boundary.id}] ${side.label} — réponse attendue`);

  const sections = extractPourTeTesterSections(reply);
  assert.doesNotMatch(
    sections,
    side.mustNotContainInSelfCheck,
    `[${boundary.id}] ${side.label} — ${boundary.intent}`,
  );
}

/**
 * @param {VocabularyBoundaryPair} boundary
 * @param {(query: string) => Promise<{ reply?: string }|null>} fetchReply
 * @param {import("node:assert/strict")} assert
 */
export async function assertVocabularyBoundaryPair(
  boundary,
  fetchReply,
  assert,
) {
  for (const side of [boundary.left, boundary.right]) {
    const hit = await fetchReply(side.query);
    assertSelfCheckVocabularyBoundary(hit?.reply, side, boundary, assert);
  }
}

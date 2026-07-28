/**
 * Scanner read-only borné d'un dossier workspace (projects/…).
 * Produit un RepoAnalysisReport sans exécution.
 */
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ANALYSIS_CONTRACT_ID,
  validateRepoAnalysisReport,
} from "./repoAnalysisContract.js";
import { runRepoDeepSample } from "./repoDeepSample.js";

const MAX_DEPTH = 3;
const MAX_ENTRIES = 80;
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
]);

const EXT_LANG = {
  js: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  jsx: "JavaScript (JSX)",
  ts: "TypeScript",
  tsx: "TypeScript (TSX)",
  py: "Python",
  php: "PHP",
  css: "CSS",
  html: "HTML",
  htm: "HTML",
  yml: "YAML",
  yaml: "YAML",
  json: "JSON",
  md: "Markdown",
  sql: "SQL",
  sh: "Shell",
  go: "Go",
  rs: "Rust",
  java: "Java",
};

const STRUCTURING_FILES = [
  "package.json",
  "composer.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Dockerfile",
  "README.md",
  "readme.md",
  "LICENSE",
  "LICENSE.md",
  ".gitignore",
  "vite.config.js",
  "vite.config.ts",
  "playwright.config.js",
  "tsconfig.json",
];

/**
 * @param {string} dir
 * @param {number} depth
 * @param {string[]} out
 * @param {{ count: number }} counter
 */
function walk(dir, depth, out, counter) {
  if (depth > MAX_DEPTH || counter.count >= MAX_ENTRIES) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (counter.count >= MAX_ENTRIES) break;
    if (ent.name.startsWith(".") && ent.name !== ".gitignore") {
      if (ent.isDirectory() && ent.name !== ".github") continue;
    }
    if (ent.isDirectory() && IGNORE_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    counter.count += 1;
    if (ent.isDirectory()) {
      out.push(full);
      walk(full, depth + 1, out, counter);
    } else {
      out.push(full);
    }
  }
}

/**
 * @param {string} absoluteRoot
 * @param {string} relativeLabel
 * @returns {{ report: import('./repoAnalysisContract.js').RepoAnalysisReport, quality: { ok: boolean, failures: string[] } }}
 */
export function analyzeLocalRepoDirectory(absoluteRoot, relativeLabel) {
  const findings = [];
  const strengths = [];
  const structure = [];
  const languages = [];
  const testsQuality = [];
  const documentation = [];
  const unknowns = [];
  const recommendations = [];
  let i = 1;
  const push = (claim, severity, evidence) => {
    findings.push({ id: `R${i++}`, claim, severity, evidence });
  };

  const rootExists =
    fs.existsSync(absoluteRoot) && fs.statSync(absoluteRoot).isDirectory();
  if (!rootExists) {
    const report = {
      access: "not_found",
      repoLabel: relativeLabel,
      sourceKind: "local_workspace",
      summary:
        `Le chemin \`${relativeLabel}\` n'existe pas sous l'allowlist workspace — aucune structure à analyser.`,
      languages: ["(inconnu)"],
      structure: ["Chemin absent"],
      strengths: [
        "Demande d'analyse claire (intention revue de dépôt).",
        "Allowlist workspace respectée (pas d'accès hors projects/).",
        "Échec explicite plutôt qu'hallucination de structure.",
      ],
      findings: [
        {
          id: "R1",
          claim: `Dossier introuvable : \`${relativeLabel}\`.`,
          severity: "high",
        },
        {
          id: "R2",
          claim: "Sans arborescence réelle, langages et modules ne peuvent pas être attestés.",
          severity: "medium",
        },
        {
          id: "R3",
          claim: "Pas de README, configs ni tests à inspecter.",
          severity: "medium",
        },
        {
          id: "R4",
          claim: "Risque de confusion avec un dépôt distant du même nom.",
          severity: "low",
        },
        {
          id: "R5",
          claim: "Toute affirmation de stack serait inventée — refusée par conception.",
          severity: "info",
        },
      ],
      testsQuality: ["Non évaluable — dépôt absent."],
      documentation: ["Non évaluable — dépôt absent."],
      unknowns: [
        "Existence éventuelle du projet ailleurs (autre chemin, GitHub distant).",
        "Intention exacte : workspace local vs dépôt distant homonyme.",
      ],
      recommendations: [
        "Vérifier le slug sous `projects/` (casse, tirets).",
        "Ou fournir une URL `github.com/owner/repo` pour une revue distante.",
        "Lister les dossiers via scan projets si le nom exact est inconnu.",
      ],
      confidence: "low",
      analyzer: "local_repo",
      multiStack: null,
    };
    return { report, quality: validateRepoAnalysisReport(report) };
  }

  const allPaths = [];
  walk(absoluteRoot, 0, allPaths, { count: 0 });
  const relPaths = allPaths.map((p) =>
    path.relative(absoluteRoot, p).replace(/\\/g, "/"),
  );

  const files = relPaths.filter((p) => {
    try {
      return fs.statSync(path.join(absoluteRoot, p)).isFile();
    } catch {
      return false;
    }
  });
  const dirs = [
    ...new Set(
      relPaths
        .map((p) => p.split("/")[0])
        .filter(Boolean),
    ),
  ];

  structure.push(`${files.length} fichier(s) indexés (profondeur ≤ ${MAX_DEPTH})`);
  if (dirs.length) {
    structure.push(`Entrées de premier niveau : ${dirs.slice(0, 12).join(", ")}`);
  }

  const langCounts = new Map();
  for (const f of files) {
    const ext = path.extname(f).slice(1).toLowerCase();
    const lang = EXT_LANG[ext];
    if (!lang) continue;
    langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
  }
  const sortedLangs = [...langCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [lang, count] of sortedLangs.slice(0, 8)) {
    languages.push(`${lang} (${count} fichier${count > 1 ? "s" : ""})`);
  }
  if (!languages.length) {
    languages.push("Aucun langage source dominant détecté dans l'échantillon");
  }

  const presentStruct = STRUCTURING_FILES.filter((name) =>
    files.some((f) => f === name || f.endsWith(`/${name}`)),
  );
  if (presentStruct.length) {
    structure.push(`Fichiers structurants : ${presentStruct.join(", ")}`);
  }

  let packageJson = null;
  const pkgPath = path.join(absoluteRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      packageJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      structure.push(
        `package.json — name=\`${packageJson.name || "?"}\`${packageJson.type ? ` · type=${packageJson.type}` : ""}`,
      );
    } catch {
      push("package.json présent mais illisible / JSON invalide.", "high", "package.json");
    }
  }

  const hasReadme = files.some((f) => /^readme(\.md)?$/i.test(path.basename(f)));
  const hasLicense = files.some((f) => /^license/i.test(path.basename(f)));
  const hasGitignore = files.some((f) => f === ".gitignore" || f.endsWith("/.gitignore"));
  const hasGithubWorkflows = relPaths.some((p) => p.startsWith(".github/workflows/"));
  const hasTests =
    dirs.some((d) => /^(tests?|spec|__tests__)$/i.test(d)) ||
    files.some((f) => /\.(test|spec)\.(js|ts|jsx|tsx|py)$/i.test(f));
  const hasDocker =
    files.some((f) => /^dockerfile$/i.test(path.basename(f))) ||
    files.some((f) => /docker-compose\.ya?ml$/i.test(f));
  const hasSrc = dirs.includes("src") || dirs.includes("server") || dirs.includes("app");

  // Strengths
  if (hasReadme) {
    strengths.push("README présent — point d'entrée documentaire.");
    documentation.push("README détecté à la racine.");
  } else {
    documentation.push("Pas de README à la racine.");
    push("Absence de README à la racine — onboarding et intention du dépôt peu explicites.", "medium");
    recommendations.push("Ajouter un README : objectif, stack, démarrage, structure.");
  }
  if (hasLicense) {
    strengths.push("LICENSE présente — clarifie les conditions d'usage.");
    documentation.push("LICENSE détectée.");
  } else {
    documentation.push("Pas de LICENSE détectée.");
    push("Pas de LICENSE visible — ambiguïté juridique pour réutilisation.", "low");
  }
  if (sortedLangs.length && sortedLangs[0][1] >= 1) {
    strengths.push(
      `Langage dominant clair : ${sortedLangs[0][0]} (${sortedLangs[0][1]} fichiers dans l'échantillon).`,
    );
  }
  if (hasSrc || files.some((f) => /\.(html|js|css|py|php)$/i.test(f))) {
    strengths.push("Code source présent et lisible sous allowlist (pas un dépôt vide).");
  }
  if (packageJson?.scripts && Object.keys(packageJson.scripts).length) {
    strengths.push(
      `Scripts npm définis : ${Object.keys(packageJson.scripts).slice(0, 6).join(", ")}.`,
    );
  }
  if (hasGitignore) {
    strengths.push("`.gitignore` présent — bons réflexes d'hygiène VCS.");
  }
  if (strengths.length < 3) {
    strengths.push("Arborescence locale accessible en lecture seule pour une revue bornée.");
  }

  // Findings
  if (!hasTests) {
    push(
      "Aucun dossier/fichier de tests évident (`tests/`, `*.test.js`, etc.) dans l'échantillon.",
      "high",
    );
    testsQuality.push("Pas de suite de tests détectée dans l'échantillon.");
    recommendations.push("Introduire au moins un smoke test (unit ou E2E) sur le chemin critique.");
  } else {
    testsQuality.push("Présence de tests / specs détectée.");
    strengths.push("Empreinte de tests visible — base pour des quality gates.");
  }

  if (!hasGithubWorkflows && !packageJson?.scripts?.test) {
    push(
      "Pas de workflow CI (`.github/workflows`) ni script `test` npm évident — quality gates absents ou implicites.",
      "medium",
    );
    testsQuality.push("CI / quality gates non attestés dans l'échantillon.");
    recommendations.push("Ajouter une CI minimale (lint + test) sur push/PR.");
  } else if (hasGithubWorkflows) {
    testsQuality.push("Workflows GitHub Actions détectés sous `.github/workflows`.");
  } else if (packageJson?.scripts?.test) {
    testsQuality.push(`Script npm \`test\` : \`${packageJson.scripts.test}\`.`);
  }

  if (!hasGitignore) {
    push("Pas de `.gitignore` — risque de committer artefacts (`node_modules`, builds, secrets).", "medium");
  }

  if (hasDocker) {
    structure.push("Conteneurisation (Dockerfile / compose) présente.");
  }

  const secretish = files.filter((f) =>
    /\.env($|\.)|credentials|secrets?\./i.test(f),
  );
  if (secretish.length) {
    push(
      `Fichiers potentiellement sensibles présents : ${secretish.slice(0, 4).join(", ")} — vérifier qu'ils ne sont pas versionnés avec des secrets.`,
      "high",
      secretish[0],
    );
    recommendations.push("Auditer les fichiers `.env*` / secrets : gitignore + vault / variables d'environnement.");
  }

  if (sortedLangs.length >= 3) {
    push(
      `Stack multi-langages (${sortedLangs
        .slice(0, 4)
        .map(([l]) => l)
        .join(", ")}) — risque de fragmentation outillage / conventions.`,
      "low",
    );
  }

  if (files.length < 3) {
    push(
      "Dépôt très petit (< 3 fichiers indexés) — revue limitée ; peut être une démo ou un stub.",
      "info",
    );
  }

  const deep = runRepoDeepSample(absoluteRoot, files, relativeLabel);

  if (findings.length < 5) {
    push(
      "Analyse bornée (profondeur/fs) : dépendances transitives et dette runtime non exécutées.",
      "info",
    );
  }
  if (findings.length < 5) {
    push(
      "Sans historique git ni revue PR, la maturité collaborative (reviews, ownership) reste opaque.",
      "low",
    );
  }
  if (findings.length < 5 && !deep.deepMode) {
    push(
      "Couverture de sécurité (auth, XSS, injection) non prouvée sans lecture ciblée des modules critiques.",
      "medium",
    );
    recommendations.push(
      "Enchaîner une revue fichier par fichier sur les points d'entrée (HTML/JS/PHP/API).",
    );
  }

  unknowns.push(
    "Comportement runtime non exécuté (build, serve, tests) — revue statique uniquement.",
  );
  unknowns.push(
    "Fichiers hors profondeur max / dossiers ignorés (`node_modules`, etc.) non inspectés.",
  );
  if (!packageJson && sortedLangs.some(([l]) => /Python|PHP|Go|Rust/.test(l))) {
    unknowns.push("Manifeste de dépendances non Node — versions exactes non toutes lues.");
  }

  if (recommendations.length < 3) {
    recommendations.push(
      "Documenter la structure des dossiers et le chemin de démarrage local.",
    );
  }
  if (recommendations.length < 3) {
    recommendations.push(
      "Prioriser une passe sécurité sur entrées utilisateur et configs.",
    );
  }

  let multiStack = null;
  if (sortedLangs.length >= 2) {
    multiStack =
      `Plusieurs stacks côte à côte (${sortedLangs
        .slice(0, 5)
        .map(([l, c]) => `${l}:${c}`)
        .join(", ")}). Vérifier la cohérence des conventions (lint, format, CI) entre langages.`;
  }

  const topLang = sortedLangs[0]?.[0] || "sources mixtes";
  let summary =
    `Dépôt workspace \`${relativeLabel}\` : ${files.length} fichiers indexés, ` +
    `langage dominant ${topLang}. ` +
    (hasReadme ? "README présent. " : "Sans README racine. ") +
    (hasTests ? "Empreinte tests visible. " : "Peu/pas de tests visibles. ");

  if (deep.deepMode) {
    summary +=
      `Mode deep : échantillon ${deep.sampledPaths.join(", ")} via SOURCE_FILE_ANALYSIS_V1. `;
    if (deep.fileSummaries.length) {
      const bite = deep.fileSummaries[0].replace(/\s+/g, " ").trim();
      summary += `${bite.slice(0, 160)}${bite.length > 160 ? "…" : ""} `;
    }
    summary += "Revue hygiène + code (échantillon) — pas d'exécution runtime.";
    for (const s of deep.codeStrengths.slice(0, 2)) {
      if (!strengths.includes(s)) strengths.push(s);
    }
    for (const cf of deep.codeFindings.slice(0, 3)) {
      findings.push({
        id: cf.id,
        claim: cf.claim,
        severity: cf.severity,
        evidence: cf.evidence,
      });
    }
    structure.push(`Deep sample code : ${deep.sampledPaths.join(", ")}`);
    if (deep.codeFindings.length) {
      recommendations.unshift(
        `Traiter en priorité les findings code sur \`${deep.sampledPaths[0]}\` (voir section Findings code).`,
      );
    }
  } else {
    summary += "Revue statique bornée — pas d'exécution.";
  }

  const requireCodeFindings = deep.deepMode && deep.sampledPaths.length > 0;

  const report = {
    access: deep.deepMode ? "read_sampled_deep" : "read_sampled",
    repoLabel: relativeLabel,
    sourceKind: "local_workspace",
    summary,
    languages,
    structure,
    strengths: strengths.slice(0, 10),
    findings,
    testsQuality,
    documentation,
    unknowns,
    recommendations: recommendations.slice(0, 8),
    confidence: findings.some((f) => f.severity === "high") ? "high" : "medium",
    analyzer: deep.deepMode ? "local_repo+sfa" : "local_repo",
    multiStack,
    deepMode: deep.deepMode,
    requireCodeFindings,
    sampledPaths: deep.sampledPaths,
    codeFindings: deep.codeFindings,
    codeStrengths: deep.codeStrengths,
  };

  return {
    report,
    quality: validateRepoAnalysisReport(report),
  };
}

export { REPO_ANALYSIS_CONTRACT_ID };

/**
 * Adaptateur JSX/TSX — composants, props, a11y contrôles.
 */
import { SOURCE_FILE_ROLES } from "../sourceFileAnalysisContract.js";
import { analyzeJsSource } from "./jsAnalyzer.js";

/**
 * @param {string} content
 * @param {{ path: string, ext: string, bytes: number, lines: number }} meta
 */
export function analyzeJsxSource(content, meta) {
  const base = analyzeJsSource(content, meta);
  const findings = [...base.findings];
  const strengths = [...base.strengths];
  const structure = [...base.structure];
  const recommendations = [...base.recommendations];
  let i = findings.length + 1;

  const components =
    content.match(
      /\b(?:export\s+default\s+)?(?:function|const)\s+[A-Z]\w*|class\s+[A-Z]\w+\s+extends\s+Component/g,
    ) || [];
  const hooks = content.match(/\buse[A-Z]\w+\s*\(/g) || [];
  const hasProps = /\bprops\b|\(\s*\{[^}]*\}\s*\)/.test(content);
  const hasKey = /\bkey=\{/.test(content);
  const hasMap = /\.map\s*\(/.test(content);
  const divClick = /<div[^>]*\bonClick=/.test(content);
  const imgNoAlt = /<img(?![^>]*\balt=)[^>]*>/i.test(content);

  structure.push(`${components.length || "?"} composant(s) React-like repéré(s)`);
  if (hooks.length) structure.push(`Hooks : ${[...new Set(hooks.map((h) => h.replace("(", "")))].slice(0, 6).join(", ")}`);

  if (components.length) {
    strengths.push("Composants nommés en PascalCase — convention React respectée.");
  }
  if (hasKey && hasMap) {
    strengths.push("Listes \`.map\` avec \`key=\` détectées.");
  }

  if (divClick) {
    findings.push({
      id: `F${i++}`,
      claim:
        "\`div\` cliquable (\`onClick\`) — préférer \`button\` / rôle ARIA pour l’accessibilité clavier.",
      severity: "medium",
    });
    recommendations.push("Remplacer les \`div onClick\` par des contrôles natifs ou \`role=\"button\"\` + clavier.");
  }
  if (imgNoAlt) {
    findings.push({
      id: `F${i++}`,
      claim: "\`<img>\` sans \`alt\` dans le JSX.",
      severity: "high",
    });
  }
  if (hasMap && !hasKey) {
    findings.push({
      id: `F${i++}`,
      claim: "Rendu de liste (\`.map\`) sans \`key\` visible.",
      severity: "medium",
    });
  }
  if (meta.lines > 300) {
    findings.push({
      id: `F${i++}`,
      claim: "Fichier composant volumineux — risque de responsabilités mélangées (UI + data + effets).",
      severity: "low",
    });
    recommendations.push("Découper en sous-composants et hooks dédiés.");
  }

  base.unknowns.push(
    "Sans rendu React ni props runtime, le comportement UI réel n’est pas certifié.",
  );

  return {
    ...base,
    role: SOURCE_FILE_ROLES.UI_COMPONENT,
    roleLabel: "Composant UI React (JSX/TSX)",
    summary:
      "Composant / module React. " +
      base.summary +
      (hasProps ? " Props / destructuring détectés." : ""),
    structure,
    strengths: strengths.slice(0, 7),
    findings,
    recommendations: recommendations.slice(0, 6),
    analyzer: meta.ext === "tsx" ? "tsx" : "jsx",
    confidence: "medium",
  };
}

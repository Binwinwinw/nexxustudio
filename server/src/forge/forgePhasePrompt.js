const FORGE_PHASE_DIRECTIVES = {
  expert_pm: [
    "Livrable PM : user stories (3–5), périmètre MVP figé, critères de succès testables, commandes npm init.",
    "Format : sections ## Périmètre, ## User stories, ## Critères de succès, ## Commandes.",
  ].join("\n"),
  expert_architect: [
    "Livrable ARCHITECT : arborescence complète, package.json (deps), liste des composants React.",
    "Format : ## Arborescence (bloc code), ## Dépendances, ## Décisions techniques.",
  ].join("\n"),
  expert_developer: [
    "Livrable DEVELOPER : code squelette Vite+React (App.jsx, composants clés, plotly si pertinent).",
    "Inclure blocs de fichiers avec chemin (ex. src/App.jsx). Pas de choix multiples.",
  ].join("\n"),
  expert_qa: [
    "Livrable QA : checklist de validation contre le brief (fonctions, graphe, reset, exemples).",
    "Format : ## Tests manuels, ## Critères pass/fail. Pas de résumé générique Forge.",
  ].join("\n"),
};

const FORGE_PRODUCTION_RULES = [
  "Mission : WEBAPP_BUILD (calculatrice Vite/React du brief).",
  "INTERDIT : « Voici 3 pistes », « Laquelle t'intéresse », idéation, Nexxus Design, landing, DA.",
  "INTERDIT : répéter le message de handoff ou parler de Steam/OS.",
  "OBLIGATOIRE : livrable concret de TA phase uniquement.",
].join("\n");

/**
 * @param {string} expert
 * @param {string} projectBrief
 */
export function buildForgePhasePrompt(expert = "", projectBrief = "") {
  const phaseKey = String(expert || "expert_pm");
  const phaseLabel = phaseKey.replace("expert_", "").toUpperCase();
  const directive =
    FORGE_PHASE_DIRECTIVES[phaseKey] ||
    "Produis une sortie concrète et exploitable pour cette phase de production.";

  return [
    `[FORGE_PRODUCTION — ${phaseLabel}]`,
    FORGE_PRODUCTION_RULES,
    directive,
    "",
    "## Brief projet",
    String(projectBrief || "").trim(),
  ].join("\n");
}

/**
 * Détecte une sortie idéation / overview au lieu d'un livrable de phase.
 * @param {string} text
 */
export function isForgeIdeationLeakOutput(text = "") {
  const t = String(text || "");
  return (
    /Laquelle t'intéresse/i.test(t) ||
    (/Voici\s+3\s+pistes/i.test(t) && /Premier pas\s*:/i.test(t)) ||
    (/CalcGraph|CalcEngine|CalcRAG/i.test(t) && /Laquelle/i.test(t))
  );
}

export default { buildForgePhasePrompt, FORGE_PHASE_DIRECTIVES };

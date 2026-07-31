import { getActiveCapabilityTools } from "../../capabilities/capabilityToolSession.js";

export const ALL_TOOLS = {
  webSearch: "Recherche sur le web (via Serper/Google).",
  webSummarize: "Analyse et résumé du contenu d'une URL.",
  librarianSearch: "Recherche d'héritage gouverné (Knowledge Hub / Chroma, scope heritage).",
  workspaceSearch: "Scan et recherche de fichiers dans le workspace courant.",
  pulse: "Analyse de santé et métriques d'un répertoire.",
  knowledgeSearch: "Recherche sémantique dans le Knowledge Hub (ChromaDB).",
  buildProject: "Génération physique des fichiers d'un projet Forge.",
  writeFile: "Écriture directe d'un fichier sur disque.",
  validateLint: "Validation syntaxique via ESLint.",
  validateBuild: "Validation de la compilation via npm run build.",
  registerInDashboard: "Enregistre un artefact dans le Cockpit.",
  projectScan: "Scan de maturité et scoring d'un projet.",
  promoteProject: "Promotion d'un projet vers la mémoire long-terme.",
  generateImage: "Génération d'image bitmap via IA.",
  generateAudio: "Génération d'audio/musique via IA.",
  graph_query: "Graphify — question sur le graphe structurel (capability tour).",
  graph_path: "Graphify — chemin entre deux symboles du graphe.",
  graph_explain: "Graphify — voisinage d'un nœud du graphe.",
  ocr_page: "OCR — page image/scan via service interne Unlimited-OCR.",
  ocr_document: "OCR — PDF ou document multi-pages (markdown/texte normalisés).",
};

export function getAllowedTools(expert = null) {
  const capabilityTools = getActiveCapabilityTools();
  let tools = Object.keys(ALL_TOOLS).filter(
    (t) => !t.startsWith("graph_") && !t.startsWith("ocr_"),
  );
  if (expert && expert.permissions) {
    const { allowedTools, disallowedTools } = expert.permissions;
    if (allowedTools && allowedTools[0] !== '*') {
      tools = tools.filter(t => allowedTools.includes(t));
    }
    if (disallowedTools && disallowedTools.length > 0) {
      tools = tools.filter(t => !disallowedTools.includes(t));
    }
  }
  if (capabilityTools.length) {
    tools = [...new Set([...tools, ...capabilityTools])];
  }
  return tools;
}

export function buildToolPolicy(expert = null) {
  const toolsToDisplay = getAllowedTools(expert);
  const toolLines = toolsToDisplay.map(t => `- ${t} : ${ALL_TOOLS[t]}`).join('\n');
  
  const disallowed = expert?.permissions?.disallowedTools || [];
  const restrictions = disallowed.length > 0 
    ? `\nINTERDICTIONS EXPLICITES : Vous n'avez PAS le droit d'utiliser : ${disallowed.join(', ')}.` 
    : "";

  return `
[POLICY: TOOL_USAGE v4.0 (Scoped)]
[OBJECTIF: EXÉCUTION BORNÉE PAR RÔLE]

CAPACITÉS AUTORISÉES POUR VOTRE RÔLE ACTUEL (${expert?.name || 'Général'}) :
${toolLines}
${restrictions}

RÈGLES D'OR :
1. VITE-ONLY : Le frontend utilise exclusivement VITE.
2. PREUVE MANDATOIRE : Toute modification de code DOIT être validée par validateLint(path).
3. INTÉGRITÉ GLOBALE : Toute modification impactant les exports/imports DOIT être validée par validateBuild().
4. ZÉRO HALLUCINATION : Ne jamais inventer de fichiers. Utilisez workspaceSearch pour vérifier la réalité.
5. SÉCURITÉ : Uniquement du code et des données. Pas d'actions physiques.

[PROTOCOLE SENTINEL] :
Analyse (workspaceSearch) -> Planification -> Modification Code -> validateLint(path) -> validateBuild() -> LIVRAISON.
`.trim();
}

export default buildToolPolicy;


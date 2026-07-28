import { CAPABILITY_IDS } from "../capabilityTypes.js";
import { assessGraphifyGraphAvailability } from "./graphifyPaths.js";

export const GRAPHIFY_TOOL_NAMES = Object.freeze([
  "graph_query",
  "graph_path",
  "graph_explain",
]);

export const GRAPHIFY_INSTRUCTION_BLOCK = [
  "CAPABILITY tool.graphify — graphe structurel local (AST, pas runtime) :",
  "- Utilise graph_query / graph_path / graph_explain avant d'explorer la codebase au hasard.",
  "- path et explain décrivent des relations extraites statiquement (file:line), pas une trace d'exécution.",
  "- Réponse courte, faits du graphe ; si l'outil échoue, dis-le et n'invente pas d'appels ou de fichiers.",
  "- Syntaxe actions : graph_query(\"question\"), graph_path(\"A\", \"B\"), graph_explain(\"symbole\").",
].join("\n");

/**
 * @returns {import("../capabilityTypes.js").RegisteredTool[]}
 */
export function buildGraphifyToolDescriptors() {
  return [
    {
      name: "graph_query",
      capabilityId: CAPABILITY_IDS.GRAPHIFY,
      description:
        "Interroge graph.json (BFS) — impact, voisinage, symboles liés à une question.",
    },
    {
      name: "graph_path",
      capabilityId: CAPABILITY_IDS.GRAPHIFY,
      description: "Chemin structurel le plus court entre deux nœuds du graphe.",
    },
    {
      name: "graph_explain",
      capabilityId: CAPABILITY_IDS.GRAPHIFY,
      description: "Voisinage et rôle d'un nœud/symbole dans le graphe.",
    },
  ];
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} _input
 * @returns {import("../capabilityTypes.js").RegisteredTool[]}
 */
export function registerGraphifyTools(_input) {
  const avail = assessGraphifyGraphAvailability();
  if (!avail.ok) return [];
  return buildGraphifyToolDescriptors();
}

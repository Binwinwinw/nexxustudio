/**
 * Tool Registry (Fiabilité v3.5)
 * Liste officielle des outils autorisés et vérifiables dans La Citadelle.
 */
import {
  isCapabilityPackTool,
  isCapabilityToolEnabled,
} from "../capabilities/capabilityToolSession.js";

export const TOOL_REGISTRY = [
  {
    name: 'webSearch',
    description: 'Recherche sur le web (via Serper/Google).',
    division: 'General',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'webSummarize',
    description: 'Analyse et résumé du contenu d\'une URL.',
    division: 'General',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'librarianSearch',
    description: 'Recherche d\'héritage gouverné (Knowledge Hub / Chroma, scope heritage).',
    division: 'Memory',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'workspaceSearch',
    description: 'Scan et recherche de fichiers dans le workspace courant.',
    division: 'Forge',
    riskLevel: 'MEDIUM',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'pulse',
    description: 'Analyse de santé et métriques d\'un répertoire.',
    division: 'Analyst',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'knowledgeSearch',
    description: 'Recherche sémantique dans le Knowledge Hub (ChromaDB).',
    division: 'Memory',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'buildProject',
    description: 'Génération physique des fichiers d\'un projet Forge.',
    division: 'Forge',
    riskLevel: 'HIGH',
    sideEffects: true,
    idempotent: false
  },
  {
    name: 'writeFile',
    description: 'Écriture directe d\'un fichier sur disque.',
    division: 'Forge',
    riskLevel: 'CRITICAL',
    sideEffects: true,
    idempotent: false
  },
  {
    name: 'validateLint',
    description: 'Validation syntaxique via ESLint.',
    division: 'QA',
    riskLevel: 'MEDIUM',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'validateBuild',
    description: 'Validation de la compilation via npm run build.',
    division: 'QA',
    riskLevel: 'HIGH',
    sideEffects: true,
    idempotent: true
  },
  {
    name: 'registerInDashboard',
    description: 'Enregistre un artefact dans le Cockpit.',
    division: 'Gouvernance',
    riskLevel: 'MEDIUM',
    sideEffects: true,
    idempotent: false
  },
  {
    name: 'projectScan',
    description: 'Scan de maturité et scoring d\'un projet.',
    division: 'Analyst',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true
  },
  {
    name: 'promoteProject',
    description: 'Promotion d\'un projet vers la mémoire long-terme.',
    division: 'Gouvernance',
    riskLevel: 'HIGH',
    sideEffects: true,
    idempotent: false
  },
  {
    name: 'generateImage',
    description: 'Génération d\'image bitmap via IA (Stable Diffusion/DALL-E).',
    division: 'Forge',
    riskLevel: 'MEDIUM',
    sideEffects: true,
    idempotent: false
  },
  {
    name: 'generateAudio',
    description: 'Génération de musique ou d\'audio via IA (MusicGen).',
    division: 'Forge',
    riskLevel: 'MEDIUM',
    sideEffects: true,
    idempotent: false
  },
  {
    name: 'graph_query',
    description: 'Graphify — requête BFS sur graph.json (structure AST, tour capability).',
    division: 'Analyst',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true,
    capabilityPack: 'tool.graphify',
  },
  {
    name: 'graph_path',
    description: 'Graphify — chemin structurel entre deux nœuds du graphe.',
    division: 'Analyst',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true,
    capabilityPack: 'tool.graphify',
  },
  {
    name: 'graph_explain',
    description: 'Graphify — explication voisinage d\'un symbole dans le graphe.',
    division: 'Analyst',
    riskLevel: 'LOW',
    sideEffects: false,
    idempotent: true,
    capabilityPack: 'tool.graphify',
  },
  {
    name: 'ocr_page',
    description: 'OCR page unique — service Unlimited-OCR (capability tour).',
    division: 'Analyst',
    riskLevel: 'MEDIUM',
    sideEffects: false,
    idempotent: true,
    capabilityPack: 'tool.ocr',
  },
  {
    name: 'ocr_document',
    description: 'OCR PDF / multi-pages — service Unlimited-OCR (capability tour).',
    division: 'Analyst',
    riskLevel: 'MEDIUM',
    sideEffects: false,
    idempotent: true,
    capabilityPack: 'tool.ocr',
  }
];


export function isToolAvailable(toolName) {
  if (isCapabilityPackTool(toolName)) {
    return isCapabilityToolEnabled(toolName);
  }
  return TOOL_REGISTRY.some((t) => t.name === toolName);
}

export default TOOL_REGISTRY;

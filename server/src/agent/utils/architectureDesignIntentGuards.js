/**
 * Garde « comment créer X » — propositions d'architecture, pas exécution de pipeline.
 * Doctrine : 2–3 options + clarification ; jamais affirmer un skill non prouvé.
 */
import { normalizeText } from "./normalizationGuards.js";
import { isExploitableProcedureIntent } from "./procedureIntentGuards.js";
import { isHtmlProjectDeliverable } from "../policies/delivery/index.js";
import {
  isInlineProductBriefPaste,
  isProjectScopingAssistRequest,
} from "../policies/guided/index.js";
import { isCodeConceptExplainRequest } from "../policies/code/codeConceptExplainPolicy.js";

export const ARCHITECTURE_DESIGN_RULE = "architecture_options_not_execution";

export const ARCHITECTURE_DESIGN_MAX_WORDS = 120;

export const ARCHITECTURE_DESIGN_WEB_ARTIFACT_EXCLUSION_RULE =
  "web_artifact_build_excludes_architecture_design";

/** Plateformes / livrables web concrets — pas « architecture d'agent ». */
const WEB_ARTIFACT_PLATFORM_RE =
  /\b(?:sharepoint|wordpress|wix|webflow|squarespace|shopify|drupal|joomla|intranet|extranet|portail(?:\s+web)?|teams\s+site|site\s+d['']?equipe|site\s+de\s+communication)\b/i;

const WEB_ARTIFACT_SURFACE_RE =
  /\b(?:site(?:\s+web)?|page(?:\s+html| web)?|landing(?:\s+page)?|maquette(?:\s+web)?|vitrine(?:\s+web)?|web\s*app|application\s+web)\b/i;

const J_AIMERAIS_CREATE_RE =
  /\b(?:j\s+aimerais|je\s+aimerais|j'aimerais)\s+(?:creer|créer|construire|mettre en place|developper|développer|fabriquer|faire)\b/;

const WEB_ARTIFACT_CREATE_RE =
  /\b(?:comment\s+(?:creer|créer|construire|faire|fabriquer|mettre en place|developper|développer)|(?:j\s+aimerais|je\s+aimerais|j'aimerais)\s+(?:creer|créer|construire|faire|fabriquer|mettre en place|developper|développer)|je\s+(?:voudrais|veux|souhaite)\s+(?:creer|créer|construire|faire|fabriquer|mettre en place|developper|développer)|(?:peux|pourrais|pourras)[- ]tu\s+m\s+aider|aide[- ]moi\s+a\s+faire|m\s+aider\s+a\s+(?:creer|créer|construire|faire|fabriquer))\b/i;

/** Sujet explicitement « système / agent / pipeline » — le couloir architecture reste valide. */
const EXPLICIT_SYSTEM_ARCHITECTURE_RE =
  /\b(?:architecture(?:\s+(?:logicielle|systeme|système|agent|technique))?|\brag\b|pipeline\b|orchestrateur|code[- ]?reviewer|reviewer\b|\bagent\b|micro[- ]?service|linter\b|index(?:ation)?\s+(?:du\s+)?code|systeme\s+d['']?agent|système\s+d['']?agent)\b/i;

export const ARCHITECTURE_DESIGN_FRAMING_REPLY =
  "Pour te proposer des approches utiles, précise d'abord : tu vises une architecture conceptuelle, un prototype rapide, ou une implémentation complète ?";

const DESIGN_PATTERNS = [
  /\bcomment (?:creer|créer|construire|mettre en place|developper|développer|fabriquer)\b/,
  /\bhow to (?:build|create|make|set up|develop)\b/,
  J_AIMERAIS_CREATE_RE,
  /\bje (?:voudrais|veux|souhaite) (?:creer|créer|construire|mettre en place|developper|développer)\b/,
  /\bquelle architecture pour\b/,
  /\bcomment mettre en oeuvre\b/,
  /\bcomment mettre en œuvre\b/,
  /\bplusieurs solutions\b/,
  /\bpropose(?:r|s)?[- ]?(?:moi)?(?: des)?(?: plusieurs)?(?: approches| options| pistes)\b/,
];

const EXECUTION_NOW_MARKERS = [
  "lance ",
  "lance la",
  "indexe ce",
  "indexe le",
  "indexe mon",
  "execute ",
  "exécute ",
  "corrige ce",
  "corrige le",
  "corrige mon",
  "implemente ce",
  "implémente ce",
  "fais le maintenant",
  "demarre l",
  "démarre l",
  "run the",
  "go ahead and",
];

const DEBUG_FIX_MARKERS = [
  /\bstack trace\b/,
  /\bline \d+/,
  /\bligne \d+/,
  /\bexception\b/,
  /\bundefined is not\b/,
  /\bcannot read prop\b/,
];

export function normalizeArchitectureDesignQuery(query = "") {
  return normalizeText(query)
    .toLowerCase()
    .replace(/[?!.]+$/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getArchitectureDesignWordCount(query = "") {
  return normalizeArchitectureDesignQuery(query).split(/\s+/).filter(Boolean).length;
}

/**
 * Artefact web / plateforme explicite + intention de création → pas architecture_design.
 * @param {string} query
 */
export function isWebArtifactBuildExclusionForArchitectureDesign(query = "") {
  const q = normalizeArchitectureDesignQuery(query);
  if (!q) return false;
  if (!WEB_ARTIFACT_CREATE_RE.test(q)) return false;

  const hasWebArtifact =
    WEB_ARTIFACT_PLATFORM_RE.test(q) ||
    WEB_ARTIFACT_SURFACE_RE.test(q) ||
    isHtmlProjectDeliverable(query);

  if (!hasWebArtifact) return false;
  if (EXPLICIT_SYSTEM_ARCHITECTURE_RE.test(q)) return false;
  return true;
}

/** Évite evaluateJustIntent ↔ TLP (admin → technical_overview → ici). */
function isGuidedCreationInsteadOfArchitecture(query = "") {
  if (isProjectScopingAssistRequest(query)) return true;
  if (isInlineProductBriefPaste(query)) return true;
  if (isCodeConceptExplainRequest(query)) return true;
  const q = normalizeArchitectureDesignQuery(query);
  if (!q || q.length < 12) return false;
  if (/\bapprendre\b/i.test(q) && /\b(?:python|javascript|typescript|bash|shell|java|php|html)\b/i.test(q)) {
    return true;
  }
  if (isWebArtifactBuildExclusionForArchitectureDesign(query)) return true;
  if (
    /\b(?:creer|créer|cree|ecris|écris|developpe|développe|generer|générer|faire un script|faire une app)\b/i.test(
      q,
    ) &&
    /\b(?:python|javascript|typescript|script|application|app|site web|page web|html|react)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  return false;
}

export function isArchitectureDesignIntent(query = "") {
  if (isGuidedCreationInsteadOfArchitecture(query)) return false;
  const q = normalizeArchitectureDesignQuery(query);
  if (!q) return false;
  if (isWebArtifactBuildExclusionForArchitectureDesign(query)) return false;
  if (isExploitableProcedureIntent(query)) return false;
  if (getArchitectureDesignWordCount(query) > ARCHITECTURE_DESIGN_MAX_WORDS) {
    return false;
  }

  if (EXECUTION_NOW_MARKERS.some((m) => q.includes(m))) return false;
  if (DEBUG_FIX_MARKERS.some((pattern) => pattern.test(q))) return false;

  return DESIGN_PATTERNS.some((pattern) => pattern.test(q));
}

/** @returns {"explorable"|"vague"|null} */
export function classifyArchitectureDesignSignal(query = "") {
  if (!isArchitectureDesignIntent(query)) return null;

  const q = normalizeArchitectureDesignQuery(query);
  const topic = extractArchitectureTopic(query);
  const hasTopic =
    /\b(code reviewer|code-reviewer|reviewer|agent|outil|systeme|système|pipeline|module|service|bot|assistant|rag|linter|review)\b/.test(
      q,
    ) ||
    (topic !== "ce composant" && topic.length >= 4);

  if (!hasTopic && q.split(/\s+/).length <= 10) return "vague";
  return "explorable";
}

export function extractArchitectureTopic(query = "") {
  const q = normalizeArchitectureDesignQuery(query);

  const patterns = [
    /\bcomment (?:creer|créer|construire|mettre en place|developper|développer|faire|fabriquer)\s+(?:un|une|des|le|la|l)?\s*(.+)/,
    /\bcomment mettre en (?:oeuvre|œuvre)\s+(?:un|une|des|le|la|l)?\s*(.+)/,
    /\bquelle architecture pour\s+(?:un|une|des|le|la|l)?\s*(.+)/,
    /\b(?:j\s+aimerais|je\s+aimerais|j'aimerais)\s+(?:creer|créer|construire|mettre en place|developper|développer|faire|fabriquer)\s+(?:un|une|des|le|la|l)?\s*(.+)/,
    /\bje (?:voudrais|veux|souhaite) (?:creer|créer|construire|mettre en place|developper|développer)\s+(?:un|une|des|le|la|l)?\s*(.+)/,
    /\bhow to (?:build|create|make|set up|develop)\s+(?:a|an|the)?\s*(.+)/,
    /\bpropose(?:r|s)?(?: moi)?(?: des)?(?: plusieurs)?(?: approches| options| pistes)(?: pour)?\s+(?:un|une|des|le|la|l)?\s*(.+)/,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (!match?.[1]) continue;
    let topic = match[1]
      .replace(/\s+qui\b.*$/, "")
      .replace(/\s+qui analyse\b.*$/, "")
      .replace(/\s+et\b.*$/, "")
      .trim();
    if (topic.length >= 3) return topic;
  }

  return "ce composant";
}

function humanizeTopic(topic = "") {
  const t = String(topic || "").trim();
  if (!t || t === "ce composant") return "ce composant";
  if (/^code reviewer|^code-reviewer/.test(t)) return "un code-reviewer";
  if (/^(un|une|le|la|les|l)\s/.test(t)) return t;
  return `un ${t}`;
}

export function buildArchitectureDesignOptionsReply(query = "") {
  const topic = humanizeTopic(extractArchitectureTopic(query));

  return `Pour ${topic}, voici 3 approches distinctes :
1. **Approche légère (script + LLM local)** — Règles explicites et analyse fichier par fichier. Premier pas : définir 5–10 règles de revue et tester sur un dossier pilote.
2. **Approche intermédiaire (RAG + règles)** — Index partiel du code + prompts de revue par module. Premier pas : indexer un sous-dossier (ex. \`server/src\`) sur 3 fichiers représentatifs.
3. **Approche industrielle (pipeline complet)** — Indexation et benchmarks à grande échelle — plus lourde, à réserver si tu as un besoin d'échelle avéré. Premier pas : cadrer périmètre, métriques et budget ops.

Tu vises plutôt une architecture conceptuelle, un prototype rapide, ou une implémentation complète ?`;
}

export function getArchitectureDesignDeterministicReply(query = "") {
  const signal = classifyArchitectureDesignSignal(query);
  if (!signal) return null;
  if (signal === "vague") return ARCHITECTURE_DESIGN_FRAMING_REPLY;
  return buildArchitectureDesignOptionsReply(query);
}

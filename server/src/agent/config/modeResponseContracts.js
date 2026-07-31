import responseThinkingCleaner from "../utils/responseThinkingCleaner.js";
import { isStructuredListReply } from "../utils/streamTextChunks.js";
import { isIdeationRequest, isConversationMemoryRecallRequest, isArchitectureDesignIntent } from "../utils/conversationGuards.js";
import { isFreshFactualCompareWithWebRequest } from "../policies/explicitWebSearchRequestPolicy.js";
import { isFamiliarityIntent } from "../utils/familiarityIntentGuards.js";
import { isFamiliarityFollowupIntent } from "../utils/familiarityFollowupGuards.js";
import { isConversationContinuityFollowup } from "../micro/continuity/conversationContinuityContext.js";
import { isAnaphoraReferenceResolvable } from "../micro/continuity/anaphoraReferenceResolver.js";
import {
  requiresDirectArbitrationContract,
  buildDirectArbitrationSystemAddon,
} from "../micro/replies/directArbitrationComposerContract.js";
import {
  requiresGeneralKnowledgeComposerContract,
  buildGeneralKnowledgeSystemAddon,
  buildCulturalContentSummarySystemAddon,
} from "../micro/replies/generalKnowledgeComposerContract.js";
import {
  requiresKnowledgeFreshnessComposerContract,
  buildKnowledgeFreshnessSystemAddon,
} from "../micro/replies/knowledgeFreshnessComposerContract.js";
import { getDocumentWebComparePromptAddon } from "../policies/documentWebComparePolicy.js";
import { sanitizeUnverifiedToolExecutionClaims } from "../utils/toolExecutionClaimGuard.js";
import { evaluateRefusalSufficiency } from "../micro/parsing/refusalSufficiencyEvaluator.js";
import { isExploitableProcedureIntent } from "../utils/procedureIntentGuards.js";
import { sanitizeUnverifiedSkillExecutionClaims } from "../utils/skillExecutionClaimGuard.js";
import {
  buildCodeDeliveryAddon,
  isCodeGenerationRequest,
} from "../policies/codeDeliveryPolicy.js";
import {
  buildConstructiveDeliverySystemAddon,
  isClearConstructiveDeliverable,
  isDefensiveDeliveryRefusal,
  buildHtmlProjectSystemAddon,
  isHtmlProjectDeliverable,
} from "../policies/delivery/index.js";
import { buildCodeProjectLightSystemAddon } from "../policies/codeProjectLightPolicy.js";
import { TUTOIEMENT_COMPOSER_LINE } from "../policies/addressingPolicy.js";
import {
  VOICE_CONTINUITY_COMPOSER_LINE,
  shouldBlockGenericInsufficientRefusal,
  applyVoiceContinuityVisibleText,
} from "../policies/voiceContinuityPolicy.js";
import { buildPostureDeliveryAddon } from "../policies/posturePolicy.js";
import { buildCodeIntentAddon } from "../policies/codeReviewPolicy.js";
import {
  buildFileContextGuardAddon,
  buildFileContextInventory,
  shouldApplyFileContextGuard,
} from "../policies/guards/index.js";

/** Modes pipeline — contrats de réponse v1 */
export const RESPONSE_MODES = {
  INSTANT: "INSTANT",
  SIMPLE_FAST: "SIMPLE_FAST",
  SIMPLE_FACTUAL: "SIMPLE_FACTUAL",
  TRANSLATION: "TRANSLATION",
  DOCUMENT: "DOCUMENT",
  CRITICAL: "CRITICAL",
  COMPOSER: "COMPOSER",
  OPEN_PROPOSITION: "OPEN_PROPOSITION",
  HOW_TO_PROCEDURAL: "HOW_TO_PROCEDURAL",
  DEBUG_DIAGNOSTIC: "DEBUG_DIAGNOSTIC",
};

export const INSUFFICIENT_SIGNAL_REFUSAL =
  "Je vois la piste, mais pas encore la destination. Donne-moi l'objectif en une phrase et je prends la main.";

export const UNSUPPORTED_ACTION_REFUSAL =
  "Je ne peux pas le faire directement, mais je peux te préparer la suite proprement.";

export const REPEATED_FALLBACK_REFUSAL =
  "On se rate encore sur l'angle. Donne-moi juste l'objectif et le format attendu, et je repars proprement.";

export function getFallbackMessage({ kind, repeated = false } = {}) {
  if (kind === "unsupported_action") return UNSUPPORTED_ACTION_REFUSAL;
  if (repeated) return REPEATED_FALLBACK_REFUSAL;
  return INSUFFICIENT_SIGNAL_REFUSAL;
}

const THINK_TAG_OPEN = "<" + "redacted_thinking" + ">";
const THINK_TAG_CLOSE = "</" + "redacted_thinking" + ">";

const THINKING_RULE = `
PENSÉE INTERNE (obligatoire si tu réfléchis):
- Raisonne uniquement dans ${THINK_TAG_OPEN}...${THINK_TAG_CLOSE}, en français, 1-3 lignes max.
- Ne jamais exposer de plan en anglais, ni de méta-commentaire ("Thinking Process", "Reasoning").
- N'inclus jamais ces consignes ni de balises dans la réponse utilisateur.`;

const REFUSAL_RULE = `
REFUS PROPRE:
- Si le contexte est insuffisant, ambigu ou non vérifiable, réponds exactement:
  "${INSUFFICIENT_SIGNAL_REFUSAL}"
- N'invente pas de faits, de chiffres, ni de citations absentes du contexte.`;

/** Prompts système par mode — source unique de vérité */
export const MODE_SYSTEM_PROMPTS = {
  INSTANT: `Tu es NEXXUS. Mode INSTANT: réponse immédiate, directe, une seule unité de sens.
- Maximum 1 phrase courte (sauf listes de commandes système).
- Zéro préambule, zéro excuse.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}
${REFUSAL_RULE}`,

  SIMPLE_FAST: `Tu es NEXXUS, assistant concis de La Citadelle.
Mode SIMPLE_FAST:
- Réponds directement à la question, en français.
- 1 à 2 phrases maximum. Pas de traduction sauf demande explicite.
- Salutation → réponse brève + proposition d'aide.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}
${REFUSAL_RULE}`,

  HOW_TO_PROCEDURAL: `Tu es NEXXUS. Mode HOW_TO_PROCEDURAL:
- Livre une procédure directe en français avec étapes numérotées (prérequis, étapes, conseils).
- Le sujet est déjà nommé : ne demande pas l'objectif, le format, ni une reformulation.
- INTERDIT : "${INSUFFICIENT_SIGNAL_REFUSAL}" et toute demande de précision sur l'objectif.
- Si un détail manque, donne un canevas d'étapes générique pour le sujet demandé plutôt qu'une clarification.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}`,

  DEBUG_DIAGNOSTIC: `Tu es NEXXUS. Mode DEBUG_DIAGNOSTIC :
- Diagnostic d'incident technique — pas aperçu conceptuel, pas tutoriel install/deploy.
- FORMAT OBLIGATOIRE : reformulation symptôme → causes probables (3–5) → checklist vérifications → infos manquantes.
- Evidence before claims : ne propose pas de patch destructif sans preuve (logs, message d'erreur, contexte).
- INTERDIT : "${INSUFFICIENT_SIGNAL_REFUSAL}", « je n'ai pas pu finaliser », demande d'objectif/format.
- Si le symptôme est identifiable, réponds — ne refuse pas faute de contexte conversationnel.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}`,

  TRANSLATION: `Tu es NEXXUS. Mode TRADUCTION (pipeline direct):
- Livre uniquement les traductions demandées — pas de commentaire, pas de clarification, pas de refus.
- Si plusieurs langues sont demandées : une section par langue avec étiquette (**Espagnol :**, **Allemand :**, etc.).
- Conserve le sens et le registre du texte source.
- INTERDIT : "${INSUFFICIENT_SIGNAL_REFUSAL}" ou toute demande de précision sur l'objectif.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}`,

  SIMPLE_FACTUAL: `Tu es NEXXUS, assistant concis de La Citadelle.
Mode SIMPLE_FACTUAL_LOOKUP:
- Réponds directement à la question factuelle en une phrase complète, naturelle et assurée.
- Appuie-toi sur des faits généraux établis (géographie, dates, définitions courantes, comptages simples).
- INTERDIT : demander l'objectif, le format, un « angle » (géographie, histoire, contexte), ou une reformulation.
- INTERDIT : « ${INSUFFICIENT_SIGNAL_REFUSAL} », « je n'ai pas pu finaliser », ou tout refus sur fait bénin bien formé.
- INTERDIT : refuser faute de document joint ou de contexte conversationnel pour un fait public simple.
- Pas de préambule bureaucratique (« Selon mes informations »).
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}`,

  DOCUMENT: `Tu es NEXXUS, expert en extraction et synthèse documentaire.
Mode DOCUMENT:
- Extraire les points clés du texte fourni, PAS de généralités hors sujet.
- Format structuré: puces, tableaux ou sections courtes si pertinent.
- Grounding strict: ne cite que ce qui est présent dans le texte/contexte.
- Pas de "Oui, La Citadelle utilise..." sans appui dans le document.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}
${REFUSAL_RULE}`,

  CRITICAL: `Tu es NEXXUS en mode CRITICAL (haute prudence).
Mode CRITICAL:
- Décisions d'architecture, consensus, faible marge d'erreur.
- Distingue clairement: confirmé / probable / inconnu si nécessaire.
- Prudence maximale: en cas de doute, refuser proprement plutôt qu'halluciner.
- Structure sobre: synthèse, risques, recommandation.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}
${REFUSAL_RULE}`,

  COMPOSER: `Tu es NEXXUS, agent principal d'orchestration de La Citadelle.
Mode COMPOSER (conversation standard):
- 2 à 4 paragraphes maximum. Direct, concret, sans rembourrage.
- Listes à puces si pertinent. Pas de rapport académique ni plan en 5 sections.
- Pas de structures épistolaires ("Objet:", "Cordialement,").
- Capacités local-first: propose des actions concrètes si l'utilisateur demande une analyse locale.
- Ne parle jamais de "brouillons", "experts" ou "modèles". Tu es NEXXUS.
- INTERDIT : affirmer l'exécution d'un skill (skill-*) ou de l'orchestrateur sans preuve runtime vérifiée.
- Pour « comment créer X » : propose 2–3 approches et clarifie — ne promets pas « je vais lancer l'indexation ».
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}
${REFUSAL_RULE}`,

  OPEN_PROPOSITION: `Tu es NEXXUS, assistant d'orchestration de La Citadelle.
Mode PROPOSITION OUVERTE (idéation projet — pas de compilation de sources):
- Maximum 120 mots visibles. Français direct, sobre, sans rembourrage ni grandiloquence.
- INTERDIT: lister articles, guides, URLs, "voici des sources", synthèse web, bibliographie.
- Si la demande est trop vague: UNE seule question de cadrage.
- Sinon, format STRICT:
  Voici 3 pistes concrètes :
  1. **[Nom court]** — [intérêt en une phrase]. Premier pas : [action simple].
  2. **[Nom court]** — [intérêt en une phrase]. Premier pas : [action simple].
  3. **[Nom court]** — [intérêt en une phrase]. Premier pas : [action simple].
  Laquelle t'intéresse ?
- Chaque piste = projet réalisable, distinct, ancré local-first si pertinent (navigateur, RAG, Forge).
- Ne parle jamais de "brouillons", "experts" ou "modèles". Tu es NEXXUS.
- La demande d'idéation suffit comme signal: ne refuse pas pour absence de contexte expert.
- INTERDIT : affirmer l'exécution d'un skill (skill-*) ou de l'orchestrateur sans preuve runtime vérifiée.
- Pour « comment créer X » : format 3 approches (légère / intermédiaire / industrielle) + question de cadrage.
${TUTOIEMENT_COMPOSER_LINE}
${THINKING_RULE}
- Ne refuse que si la demande est hors sujet ou dangereuse (pas pour vague idéation).`,
};

function withVoiceContinuityLine(prompt = "") {
  const base = String(prompt || "");
  if (!base.trim()) return base;
  if (base.includes("VOIX NEXXUS (continuité)")) return base;
  // Après tutoiement si présent, sinon en fin de bloc mode.
  if (base.includes(TUTOIEMENT_COMPOSER_LINE)) {
    return base.replace(
      TUTOIEMENT_COMPOSER_LINE,
      `${TUTOIEMENT_COMPOSER_LINE}\n${VOICE_CONTINUITY_COMPOSER_LINE}`,
    );
  }
  return `${base}\n${VOICE_CONTINUITY_COMPOSER_LINE}`;
}

export function getModeSystemPrompt(mode, contextBlock = "") {
  const base = withVoiceContinuityLine(
    MODE_SYSTEM_PROMPTS[mode] || MODE_SYSTEM_PROMPTS.SIMPLE_FAST,
  );
  if (!contextBlock?.trim()) return base;
  return `${base}\n\nCONTEXTE FOURNI:\n${contextBlock.trim()}`;
}

/** Prompt dédié — sans REFUS PROPRE (évite clarify-first sur faits simples). */
export function getSimpleFactualSystemPrompt(addonBlock = "") {
  const base = withVoiceContinuityLine(MODE_SYSTEM_PROMPTS.SIMPLE_FACTUAL);
  if (!addonBlock?.trim()) return base;
  return `${base}\n\n${addonBlock.trim()}`;
}

/** How-to procédural — sans REFUSAL_RULE globale (P3). */
export function getHowToProceduralSystemPrompt(addonBlock = "") {
  const base = withVoiceContinuityLine(MODE_SYSTEM_PROMPTS.HOW_TO_PROCEDURAL);
  if (!addonBlock?.trim()) return base;
  return `${base}\n\n${addonBlock.trim()}`;
}

/** Diagnostic incident — sans REFUSAL_RULE globale (P3). */
export function getDebugDiagnosticSystemPrompt(addonBlock = "") {
  const base = withVoiceContinuityLine(MODE_SYSTEM_PROMPTS.DEBUG_DIAGNOSTIC);
  if (!addonBlock?.trim()) return base;
  return `${base}\n\n${addonBlock.trim()}`;
}

const ATTACHED_DOCUMENT_ANALYSIS_RULES = `
ANALYSE DOCUMENT JOINT (obligatoire):
- Un fichier est présent dans CONTEXTE FOURNI ci-dessous — il suffit comme signal.
- Tu DOIS produire une analyse structurée en markdown (titres ##, puces).
- Minimum : type de fichier, rôle/objectif, 3 à 6 points clés extraits du texte, limites éventuelles.
- INTERDIT : répondre "${INSUFFICIENT_SIGNAL_REFUSAL}" ou prétendre ne pas avoir le document.
- Si DOCUMENT_CAPABILITY indique ocr_eligible=true ou vision_eligible=true, NE PAS affirmer que l'OCR est indisponible : décrire honnêtement scan détecté, extraction native échouée, capacités aval disponibles.
- Pour du code source (.js, .ts, etc.) : décris modules, exports, responsabilités, patterns détectés.
${THINKING_RULE}`;

/**
 * Prompt DOCUMENT pour le fast path — variante sans refus agressif si fichier joint.
 */
export function getDocumentAnalysisSystemPrompt(
  contextBlock = "",
  { hasAttachedDocument = false, webCompareMode = false } = {},
) {
  if (hasAttachedDocument) {
    const webAddon = webCompareMode ? getDocumentWebComparePromptAddon() : "";
    const base = `Tu es NEXXUS, expert en extraction et synthèse documentaire.
Mode DOCUMENT — fichier joint confirmé:
- Extraire les points clés du texte fourni, PAS de généralités hors sujet.
- Format structuré: sections courtes et puces.
- Grounding strict: ne cite que ce qui est présent dans le texte/contexte.
${ATTACHED_DOCUMENT_ANALYSIS_RULES}${webAddon}`;
    if (!contextBlock?.trim()) return base;
    return `${base}\n\nCONTEXTE FOURNI:\n${contextBlock.trim()}`;
  }
  return getModeSystemPrompt(RESPONSE_MODES.DOCUMENT, contextBlock);
}

const DOCUMENT_IMPROVEMENT_RULES = `
SUIVI DOCUMENT — amélioration / correction / exemple (document déjà analysé):
- Le CONTEXTE FOURNI contient le fichier actif et l'analyse précédente : c'est une preuve locale suffisante.
- Propose 3 à 5 améliorations concrètes ancrées dans le texte (sélecteurs, règles, blocs cités).
- Montre au moins un bloc d'exemple modifié quand la demande l'implique.
- Explique brièvement le pourquoi (maintenabilité, responsive, performance, accessibilité) selon pertinence.
- INTERDIT : "${INSUFFICIENT_SIGNAL_REFUSAL}" ou prétendre ne pas avoir le document.
${THINKING_RULE}`;

/**
 * Prompt DOCUMENT pour les tours de suivi (amélioration, explication, bloc d'exemple).
 */
export function getDocumentImprovementSystemPrompt(
  contextBlock = "",
  { hasActiveDocument = true } = {},
) {
  const base = `Tu es NEXXUS, expert en revue et amélioration de documents techniques déjà analysés.
Mode DOCUMENT — suivi sur document actif confirmé:
- Réutiliser strictement le contenu et l'analyse précédente fournis ci-dessous.
- Format structuré markdown (##, puces, blocs de code si pertinent).
${DOCUMENT_IMPROVEMENT_RULES}`;
  if (!hasActiveDocument || !contextBlock?.trim()) return base;
  return `${base}\n\nCONTEXTE FOURNI:\n${contextBlock.trim()}`;
}

/**
 * Fallback déterministe quand le LLM refuse ou renvoie vide malgré un document ingéré.
 */
export function buildAttachedDocumentFallback(
  contextBlock = "",
  query = "",
  fileName = "document",
) {
  const nameMatch = String(contextBlock).match(/\[DOCUMENT #\d+:\s*([^\]]+)\]/);
  const name = nameMatch?.[1]?.trim() || fileName || "document";
  const contentMatch = String(contextBlock).match(
    /CONTENU:\n([\s\S]*?)\n-{3,}/,
  );
  const excerpt = (contentMatch?.[1] || contextBlock || "").trim();
  const previewLines = excerpt
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 15);

  const bullets =
    previewLines.length > 0
      ? previewLines.map((line) => `- \`${line.slice(0, 120)}\``).join("\n")
      : "- *(contenu non extrait — vérifier l'encodage du fichier)*";

  return `## Analyse de ${name}

### Statut
Document reçu et ingéré. Synthèse minimale de secours.

### Type détecté
${/\.(js|ts|jsx|tsx)$/i.test(name) ? "Fichier source JavaScript / TypeScript" : "Document texte"}

### Éléments repérés dans le fichier
${bullets}

### Demande utilisateur
${String(query || "analyse du document").trim()}

### Limites
Réponse générée en mode fallback — relancer si une analyse plus profonde est nécessaire.`;
}

export function isInsufficientSignalRefusal(text = "") {
  const t = String(text || "").trim();
  return (
    t === INSUFFICIENT_SIGNAL_REFUSAL ||
    t.startsWith("Je vois la piste, mais pas encore") ||
    t.startsWith("Je n'ai pas assez d'éléments fiables")
  );
}

/**
 * Idéation ouverte projet (questions du type « quel projet IA ? »).
 */
export function isOpenProjectIdeation(query = "", packet = {}) {
  if (isFreshFactualCompareWithWebRequest(query)) return false;
  if (packet?.user_intent === "ideation" || packet?.mode === "IDEATION") {
    return true;
  }
  if (isArchitectureDesignIntent(query)) return true;
  return isIdeationRequest(query);
}

function isExplicitSourceCompilationRequest(query = "") {
  const q = String(query || "").toLowerCase();
  return /\b(sources?|articles?|liens?|urls?|documentation web|bibliographie|retourne.*web|cite.*web|trouve.*web)\b/.test(q);
}

/**
 * Active le contrat 2–3 options courtes pour toute idéation projet ouverte
 * (même si la recherche web a renvoyé des sources — pas de compilation).
 */
export function shouldApplyOpenPropositionContract(packet = {}) {
  if (packet?.meta?.open_proposition === true) return true;
  const query = packet?.user_query || "";
  if (isExplicitSourceCompilationRequest(query)) return false;
  return isOpenProjectIdeation(query, packet);
}

/**
 * Résout le contrat applicable au Final Renderer selon le packet.
 */
export function resolveComposerContractMode(
  packet,
  { forceShort = false, isSocial = false, useFactual = false, openProposition = false } = {},
) {
  if (openProposition) return RESPONSE_MODES.OPEN_PROPOSITION;
  if (isSocial || forceShort) return RESPONSE_MODES.SIMPLE_FAST;
  if (useFactual) {
    return packet?.risk_level === "high"
      ? RESPONSE_MODES.CRITICAL
      : RESPONSE_MODES.DOCUMENT;
  }
  return RESPONSE_MODES.COMPOSER;
}

/**
 * Prompt système unifié pour le Final Renderer (contrats v1 + variantes).
 */
export function getComposerSystemPrompt(
  packet,
  {
    forceShort = false,
    isSocial = false,
    useFactual = false,
    openProposition = false,
    directArbitration = false,
    generalKnowledge = false,
    knownEntitySummary = false,
    knowledgeFreshness = false,
  } = {},
) {
  const mode = resolveComposerContractMode(packet, {
    forceShort,
    isSocial,
    useFactual,
    openProposition,
  });
  let prompt = getModeSystemPrompt(mode);

  if (openProposition) {
    prompt += `\n\nVARIANTE PROPOSITION OUVERTE:
- Respecte le format 3 pistes OU question de cadrage unique.
- Termine toujours par une ouverture ("Laquelle t'intéresse ?" ou équivalent court).`;
  } else if (isSocial) {
    prompt += `\n\nVARIANTE SOCIAL:
- Message chaleureux et direct en français (sobre — pas de grandiloquence).
- Rédige DIRECTEMENT la salutation ou réponse sociale finale.`;
  } else if (useFactual) {
    prompt += `\n\nVARIANTE ÉPISTÉMIQUE:
- Synthèse rigoureuse et tracée. Structure markdown si le sujet est complexe (max 6 sections).
- Cite les sources et URLs si elles sont fournies dans le contexte.`;
  } else if (mode === RESPONSE_MODES.COMPOSER) {
    prompt += `\n\nVARIANTE CONVERSATION:
- Réponds comme un collègue technique direct.
- Si la réponse tient en 3 phrases, écris 3 phrases.`;
  }

  // R6 — styleHints posture jusqu’à la forme finale (composer)
  const postureDecision =
    packet?.meta?.postureDecision || packet?.postureDecision || null;
  const postureDelivery = buildPostureDeliveryAddon(postureDecision);
  if (postureDelivery) {
    prompt += postureDelivery;
  }

  const reviewAddon = buildCodeIntentAddon(packet?.user_query || "");
  if (reviewAddon) {
    prompt += reviewAddon;
  }

  const query = packet?.user_query || "";
  const attachmentRefs = packet?.meta?._attachment_refs || [];
  if (shouldApplyFileContextGuard(query, attachmentRefs)) {
    const inventory = buildFileContextInventory({
      query,
      attachmentRefs,
    });
    prompt += `\n\n${buildFileContextGuardAddon(inventory)}`;
  }

  const codeAddon = buildCodeDeliveryAddon(packet?.user_query || "");
  if (codeAddon) {
    prompt += codeAddon;
  }

  const constructiveAddon = buildConstructiveDeliverySystemAddon(packet?.user_query || "");
  if (constructiveAddon) {
    prompt += `\n\n${constructiveAddon}`;
  }

  const htmlProjectAddon = buildHtmlProjectSystemAddon(packet?.user_query || "");
  if (htmlProjectAddon) {
    prompt += `\n\n${htmlProjectAddon}`;
  }

  const codeProjectLightAddon = buildCodeProjectLightSystemAddon(packet?.user_query || "");
  if (codeProjectLightAddon) {
    prompt += `\n\n${codeProjectLightAddon}`;
  }

  if (knownEntitySummary) {
    prompt += `\n\n${buildCulturalContentSummarySystemAddon(packet?.user_query || "")}`;
  } else if (generalKnowledge) {
    prompt += `\n\n${buildGeneralKnowledgeSystemAddon(packet?.user_query || "")}`;
  } else if (directArbitration) {
    prompt += `\n\n${buildDirectArbitrationSystemAddon(packet?.user_query || "")}`;
  }

  if (
    knowledgeFreshness ||
    requiresKnowledgeFreshnessComposerContract(packet?.user_query || "", packet)
  ) {
    prompt += `\n\n${buildKnowledgeFreshnessSystemAddon(packet?.user_query || "", packet)}`;
  }

  if (packet?.meta?.topic_shift_reset) {
    prompt += `\n\nVARIANTE RUPTURE DE SUJET :
- L'utilisateur a changé franchement de sujet (nouvelle tâche autonome).
- IGNORE le contexte du tour précédent s'il n'est pas pertinent pour la demande actuelle.
- INTERDIT : refuser en citant un ancien sujet (ex. smartphones) si la requête actuelle porte sur autre chose.
- Réponds directement à la demande du tour courant.`;
  }

  if (packet?.meta?.execution_brief_injection) {
    prompt += `\n\n${packet.meta.execution_brief_injection}`;
  }

  return prompt;
}

/** Enforcement post-renderer aligné sur le contrat résolu. */
export function enforceComposerContract(
  packet,
  rawText,
  composerOptions = {},
  enforceOptions = {},
) {
  const mode = resolveComposerContractMode(packet, composerOptions);
  return enforceModeContract(mode, rawText, {
    ...enforceOptions,
    codeDelivery: enforceOptions.codeDelivery ?? composerOptions.codeDelivery ?? false,
  });
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanVisible(rawText) {
  // R2/R7 — même continuum de voix après nettoyage thinking
  return applyVoiceContinuityVisibleText(
    responseThinkingCleaner.clean(String(rawText || "")),
  ).trim();
}

function isInsufficientSignal(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (t.length < 8) return true;
  const lower = t.toLowerCase();
  const weakOnly =
    /^(ok\.?|oui\.?|non\.?|salut\.?|bonjour\.?)$/i.test(t) &&
    t.length < 20;
  return weakOnly;
}

function hasThinkingLeak(text) {
  return responseThinkingCleaner.hasEscapedThinking(text);
}

/** Conformité post-réponse (sans LLM) */
export function validateModeContract(mode, text) {
  const cleaned = cleanVisible(text);
  const failures = [];

  if (hasThinkingLeak(cleaned)) {
    failures.push("thinking_leak");
  }

  if (isInsufficientSignal(cleaned)) {
    failures.push("insufficient_signal");
  }

  const sentences = splitSentences(cleaned);

  switch (mode) {
    case RESPONSE_MODES.INSTANT:
      if (sentences.length > 3 && !cleaned.includes("\n-")) {
        failures.push("instant_too_long");
      }
      break;
    case RESPONSE_MODES.SIMPLE_FAST:
      if (sentences.length > 2) {
        failures.push("simple_fast_too_many_sentences");
      }
      break;
    case RESPONSE_MODES.SIMPLE_FACTUAL:
      if (sentences.length > 2) {
        failures.push("simple_factual_too_many_sentences");
      }
      break;
    case RESPONSE_MODES.DOCUMENT:
      if (cleaned.length > 40 && !/[-*•]|\n#|\n\d+\./.test(cleaned)) {
        failures.push("document_missing_structure");
      }
      break;
    case RESPONSE_MODES.CRITICAL:
      if (cleaned.length > 60 && !/(confirm|probabl|inconnu|risk|risque|recommand)/i.test(cleaned)) {
        // Souple: longue réponse critique devrait signaler un niveau de certitude
        failures.push("critical_missing_caution_markers");
      }
      break;
    case RESPONSE_MODES.OPEN_PROPOSITION:
      if (cleaned.length > 40 && !/\n?\s*1\.\s+\*\*/.test(cleaned) && !/\?/.test(cleaned.slice(-80))) {
        failures.push("open_proposition_missing_structure");
      }
      if (cleaned.length > 750) {
        failures.push("open_proposition_too_long");
      }
      if (/suggestions pour avancer/i.test(cleaned)) {
        failures.push("open_proposition_generic_section");
      }
      if (/(https?:\/\/|voici (des |les )?sources|articles? (suivants?|trouvés?)|guides? (suivants?|utiles))/i.test(cleaned)) {
        failures.push("open_proposition_source_compilation");
      }
      break;
    default:
      break;
  }

  return {
    mode,
    conform: failures.length === 0,
    failures,
    cleaned,
  };
}

/** Application du contrat (nettoyage + garde-fous) */
export function enforceModeContract(mode, rawText, options = {}) {
  const {
    allowRefusal = true,
    attachedDocument = false,
    codeDelivery = false,
    query = "",
    blockGenericRefusal = null,
  } = options;

  // R1 — refus « piste » interdit si sujet/format ancré (voix continuité)
  const blockPisteRefusal =
    blockGenericRefusal === true ||
    allowRefusal === false ||
    (blockGenericRefusal !== false &&
      query &&
      shouldBlockGenericInsufficientRefusal(query, {
        pedagogicalStructured: options.pedagogicalStructuredExplain,
        lexiconExplainLight: options.lexiconExplainLight,
        codeConceptExplain: options.codeConceptExplain,
        simpleFactual: mode === RESPONSE_MODES.SIMPLE_FACTUAL,
        howToProcedural: options.howToProcedural,
        debugDiagnostic: options.debugDiagnostic,
        translation: mode === RESPONSE_MODES.TRANSLATION,
      }));

  const mayEmitPisteRefusal = allowRefusal && !blockPisteRefusal;

  let cleaned = cleanVisible(rawText);

  if (codeDelivery && isDefensiveDeliveryRefusal(cleaned)) {
    return "";
  }

  if (!cleaned) {
    if (mode === RESPONSE_MODES.OPEN_PROPOSITION) {
      return "";
    }
    if (attachedDocument && mode === RESPONSE_MODES.DOCUMENT) {
      return "";
    }
    return mayEmitPisteRefusal ? INSUFFICIENT_SIGNAL_REFUSAL : "";
  }

  if (
    attachedDocument &&
    mode === RESPONSE_MODES.DOCUMENT &&
    isInsufficientSignalRefusal(cleaned)
  ) {
    return "";
  }

  switch (mode) {
    case RESPONSE_MODES.INSTANT:
      // Panels numérotés / listes structurées : ne pas couper à 6 lignes
      // (sinon open_prompt perd l’item 5 + CTA après « 4. … »).
      if (!options.sectionedComposite && !isStructuredListReply(cleaned)) {
        cleaned = cleaned.split("\n").slice(0, 6).join("\n").trim();
      }
      break;
    case RESPONSE_MODES.SIMPLE_FAST:
      cleaned = splitSentences(cleaned).slice(0, 2).join(" ").trim();
      break;
    case RESPONSE_MODES.HOW_TO_PROCEDURAL:
      break;
    case RESPONSE_MODES.DEBUG_DIAGNOSTIC:
      break;
    case RESPONSE_MODES.SIMPLE_FACTUAL:
      cleaned = splitSentences(cleaned).slice(0, 2).join(" ").trim();
      break;
    case RESPONSE_MODES.TRANSLATION:
      if (isInsufficientSignalRefusal(cleaned)) return "";
      break;
    case RESPONSE_MODES.DOCUMENT:
      // Pas de troncature agressive — structure attendue côté prompt
      break;
    case RESPONSE_MODES.CRITICAL:
      if (isInsufficientSignal(cleaned) && mayEmitPisteRefusal) {
        return INSUFFICIENT_SIGNAL_REFUSAL;
      }
      break;
    case RESPONSE_MODES.OPEN_PROPOSITION:
      // Listes / schémas / tableaux pédagogiques : ne pas couper à 750
      if (
        !options.sectionedComposite &&
        !isStructuredListReply(cleaned) &&
        cleaned.length > 750
      ) {
        cleaned = `${cleaned.slice(0, 747).trim()}…`;
      }
      break;
    default:
      break;
  }

  cleaned = sanitizeUnverifiedSkillExecutionClaims(cleaned);
  cleaned = sanitizeUnverifiedToolExecutionClaims(cleaned);

  // R1 / allowRefusal=false : jamais laisser passer le refus « piste »
  if (blockPisteRefusal && isInsufficientSignalRefusal(cleaned)) {
    return "";
  }

  if (
    isInsufficientSignalRefusal(cleaned) &&
    (mode === RESPONSE_MODES.HOW_TO_PROCEDURAL || options.howToProcedural)
  ) {
    return "";
  }

  if (isInsufficientSignalRefusal(cleaned) && mode === RESPONSE_MODES.SIMPLE_FACTUAL) {
    return "";
  }

  if (
    isInsufficientSignalRefusal(cleaned) &&
    (mode === RESPONSE_MODES.DEBUG_DIAGNOSTIC || options.debugDiagnostic)
  ) {
    return "";
  }

  if (
    isInsufficientSignal(cleaned) &&
    mayEmitPisteRefusal &&
    mode !== RESPONSE_MODES.INSTANT &&
    mode !== RESPONSE_MODES.OPEN_PROPOSITION &&
    mode !== RESPONSE_MODES.TRANSLATION &&
    mode !== RESPONSE_MODES.HOW_TO_PROCEDURAL &&
    mode !== RESPONSE_MODES.SIMPLE_FACTUAL &&
    mode !== RESPONSE_MODES.DEBUG_DIAGNOSTIC
  ) {
    return INSUFFICIENT_SIGNAL_REFUSAL;
  }

  return cleaned || (mayEmitPisteRefusal ? INSUFFICIENT_SIGNAL_REFUSAL : "");
}

/** Rétrocompatibilité */
export function enforceSimpleFastContract(rawText) {
  return enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, rawText);
}

const GREETING_OR_INTRO_PATTERNS = [
  /salut/i,
  /bonjour/i,
  /bonsoir/i,
  /coucou/i,
  /\bhey\b/i,
  /\byo\b/i,
  /hello/i,
  /comment ça va/i,
  /ça va/i,
  /qui es[- ]tu/i,
  /qui etes[- ]vous/i,
  /qui tu es/i,
  /presente[- ]toi/i,
  /presente toi/i,
  /présente[- ]toi/i,
  /présente toi/i,
  /ton nom/i,
  /ta name/i,
  /votre nom/i,
  /votre identit[eé]/i,
];

/** Exclut salutations et présentations du refus épistémique (skill-epistemic-refusal). */
export function isGreetingOrIntroduction(query = "") {
  const text = String(query || "").trim();
  if (!text) return false;
  return GREETING_OR_INTRO_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Évalue si un refus épistémique fail-closed est approprié (skill-epistemic-refusal).
 * @param {object} [options]
 * @param {string} [options.query='']
 * @param {string} [options.responseText='']
 * @param {string} [options.mode]
 * @param {boolean} [options.hasAttachedDocument=false]
 * @param {boolean} [options.hasReliableContext=false]
 * @param {boolean} [options.allowRefusal=true]
 * @param {object} [options.packet={}]
 * @param {Array<{ role: string, content: string }>} [options.history=[]]
 * @returns {{
 *   shouldRefuse: boolean,
 *   reason: string,
 *   message: string|null,
 *   fallbackSkillId: string|null,
 * }}
 */
export function evaluateEpistemicRefusal(options = {}) {
  const {
    query = "",
    responseText = "",
    mode: explicitMode,
    hasAttachedDocument = false,
    hasReliableContext = false,
    allowRefusal = true,
    packet = {},
    history = [],
    intent = null,
    canopy = null,
    context = {},
  } = options;

  if (!allowRefusal) {
    return {
      shouldRefuse: false,
      reason: "refusal_disabled",
      message: null,
      fallbackSkillId: null,
    };
  }

  const resolvedHistory = history.length ? history : context.history ?? [];

  const resolvedIntent = intent ?? context.intent ?? null;
  const resolvedCanopy = canopy ?? context.canopy ?? null;

  if (isGreetingOrIntroduction(query)) {
    return {
      shouldRefuse: false,
      reason: "greeting_or_introduction",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (requiresGeneralKnowledgeComposerContract(query)) {
    return {
      shouldRefuse: false,
      reason: "general_knowledge_generous_response",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (
    isClearConstructiveDeliverable(query) ||
    isCodeGenerationRequest(query) ||
    isHtmlProjectDeliverable(query)
  ) {
    return {
      shouldRefuse: false,
      reason: "constructive_code_delivery_v1",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (isFamiliarityIntent(query)) {
    return {
      shouldRefuse: false,
      reason: "familiarity_recognition",
      message: null,
      fallbackSkillId: null,
    };
  }

  const refusalSufficiencyEarly = evaluateRefusalSufficiency(query);
  if (
    refusalSufficiencyEarly.branch === "answer_first" &&
    refusalSufficiencyEarly.reply
  ) {
    return {
      shouldRefuse: false,
      reason: "minimal_useful_procedure_before_refusal",
      message: null,
      fallbackSkillId: null,
      genericReply: refusalSufficiencyEarly.reply,
    };
  }

  const isVagueUncertainty =
    /^je ne sais pas\b/i.test(String(query || "").trim()) &&
    !isExploitableProcedureIntent(query);

  if (isArchitectureDesignIntent(query) && !isVagueUncertainty) {
    return {
      shouldRefuse: false,
      reason: "architecture_design_options",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (isFamiliarityFollowupIntent(query, resolvedHistory) || isConversationContinuityFollowup(query, resolvedHistory)) {
    return {
      shouldRefuse: false,
      reason: "familiarity_followup_acceptance",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (isAnaphoraReferenceResolvable(query, resolvedHistory)) {
    return {
      shouldRefuse: false,
      reason: "anaphora_reference_carryover",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (requiresDirectArbitrationContract(query)) {
    return {
      shouldRefuse: false,
      reason: "direct_arbitration_explicit_criterion",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (isConversationMemoryRecallRequest(query)) {
    return {
      shouldRefuse: false,
      reason: "conversation_memory_recall",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (
    typeof resolvedIntent?.gravity === "number" &&
    resolvedIntent.gravity < 0.3
  ) {
    return {
      shouldRefuse: false,
      reason: "low_intent_gravity",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (resolvedCanopy?.identity?.name) {
    return {
      shouldRefuse: false,
      reason: "canopy_identity_available",
      message: null,
      fallbackSkillId: null,
    };
  }

  const mode =
    explicitMode ??
    resolveComposerContractMode(packet, {
      openProposition: shouldApplyOpenPropositionContract(packet),
    });

  if (
    !isVagueUncertainty &&
    (mode === RESPONSE_MODES.OPEN_PROPOSITION ||
      shouldApplyOpenPropositionContract(packet) ||
      isOpenProjectIdeation(query, packet))
  ) {
    return {
      shouldRefuse: false,
      reason: "open_proposition_exception",
      message: null,
      fallbackSkillId: null,
    };
  }

  if (hasAttachedDocument) {
    return {
      shouldRefuse: false,
      reason: "document_attached_fallback",
      message: null,
      fallbackSkillId: "skill-document-analysis",
    };
  }

  const rawResponse = String(responseText || "");
  if (rawResponse && isInsufficientSignalRefusal(rawResponse)) {
    return {
      shouldRefuse: true,
      reason: "canonical_refusal",
      message: INSUFFICIENT_SIGNAL_REFUSAL,
      fallbackSkillId: "skill-document-analysis",
    };
  }

  if (rawResponse) {
    const enforced = enforceModeContract(mode, rawResponse, {
      allowRefusal: true,
      attachedDocument: false,
    });
    if (isInsufficientSignalRefusal(enforced)) {
      return {
        shouldRefuse: true,
        reason: "enforced_refusal",
        message: INSUFFICIENT_SIGNAL_REFUSAL,
        fallbackSkillId: "skill-document-analysis",
      };
    }
    return {
      shouldRefuse: false,
      reason: "adequate_response",
      message: null,
      fallbackSkillId: null,
    };
  }

  const refusalSufficiency = refusalSufficiencyEarly;

  if (
    refusalSufficiency.branch === "refuse" &&
    !hasReliableContext &&
    !rawResponse?.trim()
  ) {
    return {
      shouldRefuse: true,
      reason: "globally_unanswerable",
      message: INSUFFICIENT_SIGNAL_REFUSAL,
      fallbackSkillId: null,
    };
  }

  if (!hasReliableContext) {
    return {
      shouldRefuse: true,
      reason: "insufficient_context",
      message: INSUFFICIENT_SIGNAL_REFUSAL,
      fallbackSkillId: "skill-document-analysis",
    };
  }

  return {
    shouldRefuse: false,
    reason: "reliable_context",
    message: null,
    fallbackSkillId: null,
  };
}

export default {
  RESPONSE_MODES,
  INSUFFICIENT_SIGNAL_REFUSAL,
  MODE_SYSTEM_PROMPTS,
  getModeSystemPrompt,
  getHowToProceduralSystemPrompt,
  getDocumentAnalysisSystemPrompt,
  buildAttachedDocumentFallback,
  isInsufficientSignalRefusal,
  isOpenProjectIdeation,
  shouldApplyOpenPropositionContract,
  resolveComposerContractMode,
  getComposerSystemPrompt,
  enforceComposerContract,
  validateModeContract,
  enforceModeContract,
  enforceSimpleFastContract,
  isGreetingOrIntroduction,
  evaluateEpistemicRefusal,
};

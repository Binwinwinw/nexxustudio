/* server/src/agent/utils/conversationGuards.js */
import { normalizeText } from "./normalizationGuards.js";
import { looksLooping } from "./qualityGuards.js";
import {
  isArchitectureDesignIntent,
  classifyArchitectureDesignSignal,
} from "./architectureDesignIntentGuards.js";
import { isAnalyticalCritiqueIntent } from "./analyticalCritiqueIntentGuards.js";
import { isCodeIntentRequest } from "../policies/code/codeIntentPolicy.js";
import { isMetaConversationIntent } from "./metaConversationIntentGuards.js";
import { isMetaCapabilitiesIntent } from "../policies/meta/metaCapabilitiesPolicy.js";

export function isPureSocial(query = "", isDiscussion = false) {
  const q = normalizeText(query).toLowerCase();
  if (!q || isDiscussion) return false;

  const socialTriggers = [
    "salut", "bonjour", "hello", "coucou", "ça va", "ca va",
    "comment vas tu", "comment vas-tu", "qui es tu", "qui es-tu",
    "re bonjour", "merci", "thanks", "au revoir", "bye", "hey",
    "héy", "yop", "dedans", "bluffant", "pressé", "presse", "vite",
    "t'appelles", "appelles tu", "fonctionnalités", "fonctionnalites",
    "pourquoi tu", "discuté", "discute", "parlé", "parle", "revu",
    "pas vu", "content", "mémoire", "gardes", "dis", "dis-moi", "parles",
  ];

  const words = q.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const technicalKeywords = [
    "appli", "projet", "code", "build", "cadrer", "architecture",
    "expert", "forge", "studio", "aide", "vision", "saas", "paiement",
    "module", "stratégie", "strategie", "roadmap", "fonction", "besoin", "documentation",
    // Stems & objets métiers / techniques pour empêcher les faux-positifs sociaux
    "dossier", "fichier", "repo", "document", "doc", "chemin", "path", "base", "bdd", "database", "log",
    "index", "analys", "corrig", "lire", "creer", "créer", "cree", "crée", "gener", "génér", "audit", "scann", "compar", "cherch"
  ];
  const hasTechnicalIntent = technicalKeywords.some((tk) => q.includes(tk));

  const hasTrigger = socialTriggers.some((t) => q.includes(t));
  const isShortSource = wordCount <= 15;
  const hasTechSymbols = /[<>={}\[\]$]/.test(q);

  return hasTrigger && isShortSource && !hasTechSymbols && !hasTechnicalIntent;
}

export function isOffTopicSocialReply(userQuery = "", text = "") {
  const q = normalizeText(userQuery).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const socialLike = /salut|bonjour|hello|coucou|ça va|ca va|comment vas-tu|comment vas tu|qui es-tu|qui es tu|comment tu fais|réfléchir|reflechir|hey|héy|bluffant|pressé|presse|vite|pourquoi tu/.test(q);
  if (!socialLike) return false;

  if (q.length < 40 && r.length > 1200) return true;
  if (r.length > q.length * 15 && q.length < 100) return true;

  const technicalKeywords = ["appli", "projet", "code", "build", "cadrer", "architecture", "expert", "forge", "studio", "aide", "horloge", "vue", "html", "css", "javascript", "fonction"];
  if (technicalKeywords.some((tk) => q.includes(tk))) return false;

  const suspicious = [
    "je me souviens", "mes expériences", "mon projet actuel", "artiste",
    "quand j'étais petit", "published", "commentaires", "video", "vidéo",
    "google maps", "je m'appelle", "mon nom est", "[nom", "[participant",
    "[voter", "[x]", "en tant qu'assistant ia", "intelligence artificielle",
    "je suis une ia", "je n'ai pas le droit", "je n'ai pas accès",
    "en tant que modèle", "trained by", "entraînement", "développé par",
    "openAI", "deepseek-r1", "mon enfance", "mon créateur",
    "mes données d'entraînement", "limitation technique", "produits de santé",
    "nutrition", "éthique", "je ne peux pas répondre directement",
    "je ne peux pas fournir", "contenu spécifique", "je suis intéressé par cette question",
    "mes préférences", "mes désirs",
  ];

  return suspicious.some((x) => r.includes(x));
}

export function classifyUserProfile(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return { type: "mixed", confidence: 0.45 };

  const techMarkers = ["api", "react", "node", "typescript", "javascript", "backend", "frontend", "dev", "developpeur", "programmeur", "code", "debug", "build", "ci", "docker", "cloud", "aws", "vscode", "hook", "composant", "framework", "git", "npm", "vite", "architecture", "microservice"];
  const nonTechMarkers = ["utilisateur", "client", "business", "produit", "cas d'utilisation", "fonctionnalité", "fonctionnalite", "processus", "expérience", "ergonomie", "interface", "simplifier", "expliquer", "comprendre", "bénéfice", "valeur", "stratégie", "vision", "objectif", "métier", "metier", "résultat", "resultat"];

  const techScore = techMarkers.reduce((count, m) => (q.includes(m) ? count + 1 : count), 0);
  const nonTechScore = nonTechMarkers.reduce((count, m) => (q.includes(m) ? count + 1 : count), 0);

  if (techScore >= 2 && techScore > nonTechScore) return { type: "tech", confidence: Math.min(0.95, 0.25 + techScore * 0.15) };
  if (nonTechScore >= 2 && nonTechScore > techScore) return { type: "non-tech", confidence: Math.min(0.95, 0.25 + nonTechScore * 0.15) };

  return { type: "mixed", confidence: 0.5 };
}

export function isOrchestratorQuery(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;

  const markers = ["orchestrateur", "agent orchestrateur", "master orchestrateur", "maître orchestrateur", "maitre orchestrateur", "orchestration", "coordination", "chef d'orchestre", "juge cognitif", "routage interne"];
  const matchCount = markers.reduce((count, m) => (q.includes(m) ? count + 1 : count), 0);

  return matchCount > 0 && q.split(/\s+/).length >= 4;
}

export function isStructuredAssistanceRequest(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;

  const markers = ["préparer", "preparer", "atelier", "formation", "initiation", "plan", "objectifs", "déroulé", "deroule", "programme", "support animateur", "exercices", "trame", "guide"];
  const markerHits = markers.filter((m) => q.includes(m)).length;
  const wordCount = q.split(/\s+/).filter(Boolean).length;

  return markerHits >= 2 && wordCount >= 8;
}

export function shouldUseVox(text = "", { social = false } = {}) {
  const clean = normalizeText(text);
  if (!clean) return false;
  if (looksLooping(clean)) return false;
  if (social && clean.length < 40) return false;
  if (clean.length > 40) return true;
  if (/[,:;]/.test(clean)) return true;
  return false;
}

export function buildRecentMemoryBuffer(history = [], limit = 2) {
  const recent = history.slice(-limit).filter(m => m && typeof m.role === "string" && typeof m.content === "string");
  if (!recent.length) return "";

  return recent.map((m, index) => {
    const roleLabel = m.role === "user" ? "UTILISATEUR" : m.role === "assistant" ? "ASSISTANT" : String(m.role).toUpperCase();
    return `[${index + 1}] ${roleLabel} : ${normalizeText(m.content)}`;
  }).join("\n");
}

/** Demande de rappel / mémoire conversationnelle (hier, fil précédent, etc.). */
export function isConversationMemoryRecallRequest(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;

  if (/\bde quoi tu parles\b/i.test(q) && q.length <= 48) return false;
  if (/\bde quoi (?:c'est|est ce que tu parles)\b/i.test(q)) return false;

  // Introduction de sujet / entité — pas un rappel du fil
  if (/\bsi\s+je\s+te\s+dis\b/i.test(q)) return false;
  if (
    /\bde\s+quoi\s+(?:je|j[''])\s+(?:veux|voudrais|aimerais)\s+parler\b/i.test(
      q,
    )
  ) {
    return false;
  }
  if (
    /\best[- ]ce\s+que\s+tu\s+(?:trouves?|sais|comprends?)\s+(?:de\s+quoi|sur\s+quoi)\b/i.test(
      q,
    )
  ) {
    return false;
  }

  // Invitation à papoter (« on discute un peu avant si tu veux ») ≠ rappel du fil.
  // Ne pas exclure les vrais rappels (« de quoi on discute avant », « rappelle… »).
  const isSocialChatInviteSurface =
    /\b(?:on\s+(?:peut\s+)?(?:discut(?:e|er)|papoter|bavarder)|(?:discut(?:e|er)|papoter|bavarder)\s+un peu)\b/i.test(
      q,
    ) &&
    /\b(?:un peu|avant(?:\s+(?:de|si|di))?|si tu veux|tu veux bien)\b/i.test(q);
  const isRecallShell =
    /\b(?:de quoi|ce qu.?on|qu.?est[- ]ce qu.?on|rappel|souviens|souvenir|retrouver|r[eé]capitul|r[eé]sum)\b/i.test(
      q,
    ) ||
    /\b(?:discut(?:é|ait|ions)|parl(?:é|ait|ions)|on a|nous avons)\b/i.test(q) ||
    /\b(?:hier|pr[eé]c[eé]demment|precedemment|dernier|fil|session)\b/i.test(q);
  if (isSocialChatInviteSurface && !isRecallShell) {
    return false;
  }

  const recallPastSpeechRe =
    /\b(?:parl(?:é|ait|aient|ions)|discut(?:é|ait|ions)|échang(?:é|e|eaient)?|dit)\b/;

  const recallPatterns = [
    /\b(?:rappel(?:e|-moi)?|r[eé]capitule|r[eé]sum(?:e|-moi)?|refais\s+le\s+point)\b.*\b(?:fil|conversation|discussion|message|[eé]change|tour|session|ce\s+qu.?on|de\s+quoi)\b/,
    /\b(?:rappel|souviens|souvenir)\b.*\b(fil|conversation|discussion|message|échange|dit|parlé|avant|hier|pr[eé]c[eé]demment)\b/,
    /\b(retrouv|retrouver)\b.*\b(de quoi|ce qu.?on|conversation|discussion|fil|message|échange|dit|parlé|avant|hier|pr[eé]c[eé]demment)\b/,
    /\b(derni[eè]r|pr[eé]c[eé]dent)\s+(message|tour|échange)\b/,
    // « discute/parle » (présent) inclus — `\bdiscut\b` rate « discute »
    /\b(de quoi|ce qu.?on|qu.?est-ce qu.?on)\b.*\b(?:parl\w*|discut\w*|[eé]chang\w*|dit)\b.*\b(?:hier|avant|derni|pr[eé]c[eé]dent|fil|session|tour|[eé]change)\b/,
    new RegExp(
      `\\b(de quoi|ce qu.?on|qu.?est-ce qu.?on)\\b.*${recallPastSpeechRe.source}`,
      "i",
    ),
    // Ancres temporelles fortes — « avant » seul (avant de travailler) est trop ambigu
    /\b(parl\w*|discut\w*|échang\w*).*\b(hier|derni[eè]re|pr[eé]c[eé]dent|pass[eé]|precedemment|auparavant)\b/,
    /\b(?:parl(?:é|ait|aient|ions|e|er)|discut(?:é|ait|ions|e|er)|échang(?:é|eait|ions|e|er))\b.*\bavant\b/,
    /\b(hier|precedemment|auparavant)\b.*\b(parl\w*|discut\w*|dit|échang\w*)/,
    /\bavant\b.*\b(?:(?:on|nous)\s+(?:a|avons)\s+)?(?:parl\w*|discut\w*|dit|échang\w*)/,
    /\bm[eé]moire\b.*\b(conversation|discussion|fil|échange)\b/,
    /\b(fil|conversation|discussion)\b.*\b(pr[eé]c[eé]dent|d.?hier|pass[eé]|avant)\b/,
    /\bon\s+a\s+(?:parl|discut|[eé]chang)/,
  ];

  return recallPatterns.some((pattern) => pattern.test(q));
}

const RECALL_REFUSAL_MARKER = "éléments fiables pour répondre";
const RECALL_BOILERPLATE = /voici ce que je retrouve dans ce fil/i;

function isRecallHistoryNoise(message, normalizedQuery = "") {
  const text = normalizeText(message?.content || "").toLowerCase();
  if (!text) return true;
  if (text.includes(RECALL_REFUSAL_MARKER)) return true;
  if (message.role === "assistant" && RECALL_BOILERPLATE.test(text)) return true;
  if (
    message.role === "user" &&
    normalizedQuery &&
    normalizeText(text).toLowerCase() === normalizedQuery
  ) {
    return true;
  }
  return false;
}

/** Entrées utiles pour rappel (filtrage refus épistémiques et meta-réponses). */
export function filterRecallHistoryEntries(query = "", history = [], limit = 20) {
  const normalizedQuery = normalizeText(query).toLowerCase();
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .filter((m) => !isRecallHistoryNoise(m, normalizedQuery))
    .slice(-limit);
}

/** Disclaimer adapté à la formulation utilisateur (évite « hier » en dur). */
export function buildRecallFooter(query = "") {
  const normalizedQuery = normalizeText(query).toLowerCase();
  if (/\bhier\b/.test(normalizedQuery)) {
    return (
      "Je n'ai pas de journal daté « hier » en dehors de ce fil. " +
      "Ce récap couvre uniquement la session en cours."
    );
  }
  if (/\b(autre session|autre fil)\b/.test(normalizedQuery)) {
    return "Pour une autre session, rouvre le fil concerné ou résume le sujet.";
  }
  return (
    "Ce récap porte sur ce fil uniquement (fenêtre récente). " +
    "Précise si tu vises une autre session ou un sujet plus ancien."
  );
}

/** Transcript compact pour synthèse Tier 2 (LLM léger). */
export function formatRecallTranscript(entries = [], maxCharsPerTurn = 400) {
  return entries
    .map((m, index) => {
      const role =
        m.role === "user"
          ? "UTILISATEUR"
          : m.role === "assistant"
            ? "NEXXUS"
            : String(m.role).toUpperCase();
      const text = normalizeText(m.content);
      const snippet =
        text.length > maxCharsPerTurn
          ? `${text.slice(0, maxCharsPerTurn - 1)}…`
          : text;
      return `[${index + 1}] ${role} : ${snippet}`;
    })
    .join("\n");
}

/**
 * Synthèse honnête à partir de l'historique du fil courant.
 * Filtre refus épistémiques et meta-réponses de rappel pour éviter le bruit.
 */
export function buildConversationRecallResponse(query = "", history = []) {
  const normalizedQuery = normalizeText(query).toLowerCase();
  const entries = filterRecallHistoryEntries(query, history, 10);

  if (entries.length === 0) {
    const emptyLead =
      "Je n'ai pas encore d'échange substantiel à rappeler dans ce fil.";
    if (/\bhier\b/.test(normalizedQuery)) {
      return (
        `${emptyLead} Je n'ai pas non plus de journal « hier » hors de cette session — ` +
        "rouvre le fil d'hier ou résume le sujet."
      );
    }
    return `${emptyLead} Rappelle un mot-clé ou continue sur un nouveau sujet.`;
  }

  const userTurns = entries.filter((m) => m.role === "user");
  const topics = userTurns
    .map((m) => {
      const text = normalizeText(m.content);
      return text.length > 120 ? `${text.slice(0, 117)}…` : text;
    })
    .filter(Boolean);

  const synthesis =
    topics.length === 1
      ? `Sujet principal abordé : ${topics[0]}`
      : topics.length > 1
        ? `Sujets abordés (${topics.length}) :\n${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
        : null;

  const lines = entries.map((m) => {
    const role = m.role === "user" ? "Toi" : m.role === "assistant" ? "NEXXUS" : m.role;
    const text = normalizeText(m.content);
    const snippet = text.length > 160 ? `${text.slice(0, 157)}…` : text;
    return `- ${role} : ${snippet}`;
  });

  const parts = ["Voici ce que je retrouve dans ce fil (fenêtre récente) :"];
  if (synthesis) parts.push("", synthesis);
  parts.push("", lines.join("\n"), "", buildRecallFooter(query));

  return parts.join("\n");
}

/**
 * Détecte une demande d'idéation simple : l'utilisateur veut CHOISIR quoi faire,
 * pas obtenir une spécification technique.
 */
export { isIdeationIntent as isIdeationRequest } from "./ideationIntentGuards.js";
export {
  isArchitectureDesignIntent,
  classifyArchitectureDesignSignal,
} from "./architectureDesignIntentGuards.js";

/**
 * Garde analytique technique unifié (registry DIAGNOSTIC + intentClassifier).
 */
export function isAnalyticalTechnicalRequest(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;

  if (isArchitectureDesignIntent(query)) return false;

  return (
    /\banalyse\b|\banalyser\b|\bameliore\b|\baméliore\b|\bameliorer\b|\baméliorer\b|\bamelioration\b|\bamélioration\b|\bameliorations\b|\baméliorations\b|\bcorrige\b|\bcorriger\b|\baudit\b|\bauditer\b|\brefactor\b|\brefactoriser\b|\bcode\b|\barchitecture\b|\bdiagnostic\b|\bdebug\b|\berreur\b|\bbug\b/.test(
      q,
    )
  );
}

/**
 * Intention d'analyse documentaire (verbes + pièces jointes textuelles).
 */
export function isDocumentAnalysisIntent(query = "", attachments = []) {
  if (isCodeIntentRequest(query, { attachments })) return false;
  if (isAnalyticalCritiqueIntent(query, attachments)) return false;
  if (isMetaConversationIntent(query)) return false;
  if (isMetaCapabilitiesIntent(query)) return false;

  // Revues de dépôt / URL GitHub → contrat REPO_ANALYSIS (évite cycle d'import).
  const raw = String(query || "");
  if (
    /\b(?:analys|audit|review|revue|inspect)/i.test(raw) &&
    (/\b(?:d[eé]p[oô]t|repo(?:sitory)?|codebase)\b/i.test(raw) ||
      /github\.com\//i.test(raw))
  ) {
    return false;
  }

  if (isAttachedDocumentAnalysisRequest(query, attachments)) return true;

  const q = normalizeText(query).toLowerCase();
  if (!q) return false;

  if (q.length > 350 && /\b(runtime|patch|diagnostic|verdict|short-circuit|nodemon|pipeline)\b/.test(q)) {
    return false;
  }

  return (
    /\b(analyse|analyser|résume|résumer|retenir|extraire)\b/.test(q) ||
    q.includes("qu'est-ce qu'il est intéressant")
  );
}

/**
 * Pièces jointes image (vision).
 */
export function hasImageAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return false;
  return attachments.some((file) =>
    String(file?.mimetype || "").startsWith("image/"),
  );
}

const VIDEO_ATTACHMENT_EXT = /\.(mp4)$/i;

/**
 * Pièces jointes vidéo (MVP v1 : MP4).
 */
export function hasVideoAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return false;
  return attachments.some((file) => {
    const mime = String(file?.mimetype || "");
    const name = file?.originalname || file?.name || "";
    return mime === "video/mp4" || VIDEO_ATTACHMENT_EXT.test(name);
  });
}

/**
 * Demande d'analyse vidéo jointe (Nexxus Video).
 */
export function isAttachedVideoAnalysisRequest(query = "", attachments = []) {
  if (!hasVideoAttachments(attachments)) return false;

  const q = normalizeText(query).toLowerCase();
  if (!q.trim()) return true;

  return /\b(vidéo|video|mp4|film|extrait|moment|timeline|scène|scene|résume|résumer|analyse|analyser|audit|transcript|transcription|ocr|dit|écran|ecran|parle|parlé|parle)\b/.test(
    q,
  );
}

/**
 * Intention d'analyse vidéo (verbe + contexte vidéo explicite).
 */
export function isVideoAnalysisIntent(query = "", attachments = []) {
  if (isAttachedVideoAnalysisRequest(query, attachments)) return true;

  const q = normalizeText(query).toLowerCase();
  if (!q) return false;

  return (
    /\b(vidéo|video|mp4)\b/.test(q) &&
    /\b(analyse|analyser|résume|résumer|extrait|extraire|timeline|moment|audit|transcript|ocr)\b/.test(
      q,
    )
  );
}

/**
 * Intention création / refonte design (Nexxus Design).
 */
export function isDesignCreateIntent(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;
  if (/\[forge_production\s*[—-]/i.test(q)) return false;
  if (/\b(audit|audite|auditer|impeccable|extraire|extraction|adn du site|design extract)\b/.test(q)) {
    return false;
  }
  return /\b(conçois|concevoir|conception|refonds|refondre|refonte|direction artistique|design system|système de design|système visuel|landing|cockpit ui|webapp|maquette|wireframe|forge.*(ui|interface|landing)|nexxus design|\bda\b)\b/.test(
    q,
  );
}

/**
 * Intention audit qualité design (Impeccable).
 */
export function isDesignAuditIntent(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;
  if (/\b(conçois|concevoir|refonds|extraire|design extract|adn du site)\b/.test(q)) {
    return false;
  }
  const auditVerb = /\b(audit|audite|auditer|impeccable|incohérence|incoherence|premium|polish|quality gate|pre-merge design|checklist design|design.*propre|ui.*propre|qu'est-ce qui manque)\b/.test(
    q,
  );
  const designCtx = /\b(design|ui|interface|page|écran|ecran|composant|typo|couleur|spacing|accessibilité|accessibilite|layout)\b/.test(
    q,
  );
  return auditVerb && designCtx;
}

/**
 * Intention extraction ADN visuel (Design Extract).
 */
export function isDesignExtractIntent(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;
  if (/\b(conçois|refonds|audit ui|impeccable)\b/.test(q)) {
    return false;
  }
  return (
    /\b(adn|dna|extraire|extraction|rétro|rétro-ingénierie|retro-ingénierie|design extract|dossier de référence|référence marque|reconstitue.*design system|prompt de refonte fidèle|récupère.*palette|typographie du site)\b/.test(
      q,
    ) &&
    /\b(site|url|marque|style|design system|interface|web)\b/.test(q)
  );
}

/**
 * Demande d'analyse visuelle sur image(s) jointe(s).
 */
export function isAttachedVisionRequest(query = "", attachments = []) {
  if (!hasImageAttachments(attachments)) return false;

  const q = normalizeText(query).toLowerCase();
  if (!q.trim()) return true;

  return (
    /\b(décris|decris|décrire|decrire|description|regarde|voir|capture|screenshot|image|photo|écran|ecran|vision|ocr|lit|lire|texte dans|que vois|qu'est-ce|quest-ce|identifie|reconnais|analyse|analyser|retranscr|transcri|transcription|jointe|joint)\b/.test(
      q,
    ) || /\butilise(?:r)?\s+(?:l['']?)?ocr\b/.test(q)
  );
}

/**
 * Détecte si la requête est un rapport de statut technique ou d'implémentation accomplie.
 */
export function isTechnicalStatusReport(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return false;

  const markers = [
    "j'ai corrigé", "j ai corrige", "j'ai applique", "j'ai appliqué", "j ai applique",
    "je viens de relancer", "le test passe", "les tests passent", 
    "j'ai injecté", "j ai injecte", "j'ai formalisé", "j ai formalise", 
    "je grave la directive", "bug corrigé", "bug corrige"
  ];
  return markers.some((m) => q.includes(m));
}

const TEXT_ATTACHMENT_EXT =
  /\.(txt|csv|json|md|html|htm|php|js|css|ts|jsx|tsx|xml|yml|yaml|py|sql|pdf|docx?|rtf)$/i;

/**
 * Détecte des pièces jointes textuelles (multer) exploitables pour analyse documentaire.
 */
export function hasTextAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return false;
  return attachments.some((file) => {
    const name = file?.originalname || file?.name || "";
    const mime = file?.mimetype || "";
    return (
      mime.startsWith("text/") ||
      mime === "application/pdf" ||
      TEXT_ATTACHMENT_EXT.test(name)
    );
  });
}

/**
 * Demande d'analyse d'un document joint à la conversation (avec ou sans verbe explicite).
 */
export function isAttachedDocumentAnalysisRequest(query = "", attachments = []) {
  const hasFiles = hasTextAttachments(attachments);
  if (!hasFiles) return false;

  const q = normalizeText(query).toLowerCase();
  if (!q.trim()) return true;

  return /\b(analyse|analyser|analysé|analysez|résume|résumer|résumez|explique|expliquer|expliquez|synthèse|synthese|extrait|extraire|lire|lis|vérifie|vérifier|audite|auditer|audit|inspecte|inspecter|regarde|am[eé]lior(?:e|er|ation|ations)|contenu am[eé]lior[eé]|refactor(?:ise|iser)?|corrige(?:r)?|fix(?:e|er)?|fichier|document|pièce jointe|piece jointe|ajouté|ajoute|ajoutée|conversation|contexte)\b/.test(
    q,
  );
}

/**
 * Enrichit le packet meta pour la résolution registry amont (pièces jointes).
 */
export function buildAttachmentPacketMeta(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return {};
  return {
    has_attached_documents: hasTextAttachments(attachments),
    has_attached_images: hasImageAttachments(attachments),
    has_attached_videos: hasVideoAttachments(attachments),
    _attachment_refs: attachments.map((f) => ({
      name: f?.originalname || f?.name || "document",
      mimetype: f?.mimetype || "",
    })),
  };
}

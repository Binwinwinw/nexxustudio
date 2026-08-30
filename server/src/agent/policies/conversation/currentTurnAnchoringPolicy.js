/**
 * Verify d'ancrage au tour courant — bloque plans/templates stale avant emit.
 * Générique : pas de patch métier par sujet.
 */
import { readRecentTurns } from "../../micro/continuity/conversationContinuityContext.js";
import { hasStrongContinuationSignal } from "../../micro/continuity/topicShiftGuard.js";
import {
  extractSubjectAnchorTokens,
  scoreSubjectSurfaceAlignment,
  ANCHOR_ALIGNMENT_TIER,
} from "./conversationSubjectExtraction.js";
import {
  isIdeationIntent,
  isProjectIdeaCritiqueRequest,
} from "../../utils/intent-guards/ideationIntentGuards.js";
import { isArchitectureDesignIntent } from "../../utils/intent-guards/architectureDesignIntentGuards.js";
import { classifyWebProjectScopingRequest } from "../../utils/intent-guards/webProjectScopingGuards.js";
import {
  hasImageAttachments,
  isAttachedVisionRequest,
} from "../../utils/conversation/conversationGuards.js";

export const CURRENT_TURN_ANCHORING_RULE = "current_turn_anchoring_v1";

const SHORT_KEEP = new Set(["ia", "ai", "rag", "pdf", "api", "bot"]);

const META_STOPWORDS = new Set([
  "voudrais",
  "vouloir",
  "souhaite",
  "aimerais",
  "creer",
  "construire",
  "lancer",
  "projet",
  "cette",
  "cela",
  "parait",
  "paraitre",
  "pertinent",
  "complimente",
  "compliment",
  "obligatoirement",
  "accord",
  "trouve",
  "trouves",
  "failles",
  "faille",
  "pose",
  "soit",
  "daccord",
  "questions",
  "question",
  "necessaire",
  "aussi",
  "plus",
  "comment",
  "quoi",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "peut",
  "peux",
  "pourrait",
  "pourrais",
  "pourrions",
  "faire",
  "avec",
  "pour",
  "dans",
  "sans",
  "idea",
  "idee",
  "aide",
  "aider",
  "besoin",
  "veux",
  "alors",
  "donc",
  "mais",
  "pas",
  "une",
  "des",
  "les",
  "estce",
]);

const NEW_SUBJECT_HOOK_RE =
  /\b(?:je (?:voudrais|veux|souhaite)|j[' ]?aimerais)\s+(?:creer|créer|construire|faire|lancer)\b/i;

const NAMED_ARTIFACT_RE =
  /\b(?:un|une)\s+[\p{L}][\p{L}'’\s-]{2,48}?(?=\s+(?:avec|pour|est|qui|que|,|\?|!)|$)/iu;

const CODE_REVIEW_RAG_TEMPLATE_RE =
  /(?:approche interm[eé]diaire\s*\(\s*RAG\s*\+\s*r[eè]gles\s*\)|indexer un sous-dossier|3 approches distinctes[\s\S]{0,500}server\/src|Je partirais plut[oô]t sur[\s\S]{0,120}RAG\s*\+\s*r[eè]gles)/i;

const CODE_REVIEW_LICENSE_RE =
  /\b(?:code[- ]?reviewer|revue de code|reviewer|linter|index(?:ation)?(?:\s+(?:du|de|un))?\s+code|fichiers? source|server\/src|d[eé]p[oô]t de code)\b/i;

const IDEATION_MATRIX_RE =
  /Assistant RAG local[\s\S]{0,280}Automatisation m[eé]tier l[eé]g[eè]re[\s\S]{0,280}Mini-app souveraine/i;

const PRAISE_RE =
  /\b(?:excellente id[eé]e|super projet|tr[eè]s bonne id[eé]e|c['']est g[eé]nial|bravo pour|belle id[eé]e|id[eé]e prometteuse)\b/i;

const CRITIQUE_MARK_RE =
  /\b(?:faille|failles|risque|limite|angle mort|saturation|diff[eé]renciation|pas convaincu|faible|probl[eè]me|inconv[eé]nient|ne valide pas|sans preuve)\b/i;

const IMPLEMENTATION_MATRIX_RE =
  /\b3 approches\b[\s\S]{0,240}\b(?:RAG|indexation|pipeline complet)\b/i;

function stripAccents(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findLastByRole(turns = [], role = "user") {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role === role && String(turns[i]?.content || "").trim()) {
      return String(turns[i].content).trim();
    }
  }
  return "";
}

function uniqueTokens(list = []) {
  return [...new Set(list.filter(Boolean))];
}

/** Exact, ou inclusion seulement si les deux tokens sont assez longs (évite ia ⊂ credibilite). */
function tokensOverlap(left = "", right = "") {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 5 && right.length >= 5) {
    return left.includes(right) || right.includes(left);
  }
  return false;
}

/**
 * Entités / but / posture du tour courant — ancrage unique pour verify + pivot.
 * @param {string} query
 */
export function extractCurrentTurnAnchors(query = "") {
  const raw = String(query || "").trim();
  const probe = stripAccents(raw);
  const tokens = uniqueTokens(
    [
      ...extractSubjectAnchorTokens(raw),
      ...probe.split(/\s+/).filter((t) => SHORT_KEEP.has(t.replace(/[^a-z0-9]/g, ""))),
    ].filter((t) => t && !META_STOPWORDS.has(t)),
  );

  const named = raw.match(NAMED_ARTIFACT_RE);
  const spans = [];
  if (named?.[0]) {
    spans.push(named[0].replace(/^(?:un|une)\s+/i, "").trim());
  }

  const posture = {
    noCompliment: /\bne me complimente pas\b/i.test(probe),
    findFlaws: /\b(?:failles?|angles? morts?|risques?)\b/i.test(probe),
    askQuestions: /\bpose des questions?\b/i.test(probe),
  };

  let goal = "general";
  if (isProjectIdeaCritiqueRequest(raw)) goal = "idea_critique";
  else if (/\b(?:creer|créer|construire)\b/i.test(probe) && spans.length) {
    goal = "create";
  }

  return { tokens, spans, goal, posture, query: raw };
}

/** Sujet à exiger en surface — pas les reliquats d'un tour phatique (« ça roule »). */
function requiresEntitySurface(anchors) {
  if (!anchors) return false;
  if (anchors.goal === "idea_critique" || anchors.goal === "create") return true;
  return Boolean(anchors.spans?.length);
}

function isSocialEmitPath(pipelinePath = "") {
  return String(pipelinePath || "")
    .toLowerCase()
    .startsWith("social");
}

/** Image réelle + contrat Vision + demande explicite — pas un skip global. */
export function isVisionAttachedAnchoringExempt(input = {}) {
  if (input.intentContractId !== "VISION_ATTACHED") return false;
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  if (!hasImageAttachments(attachments)) return false;
  return isAttachedVisionRequest(String(input.query || ""), attachments);
}

function buildVisionAnalysisError(signals = []) {
  if (signals.includes("vision_failed")) {
    return "L'analyse de l'image jointe a échoué (erreur technique). Réessaie, ou décris l'image à la main.";
  }
  return "L'analyse de l'image jointe n'a rien produit. Réessaie, ou décris l'image à la main.";
}

function licensesCodeReviewRagTemplate(query = "") {
  return CODE_REVIEW_LICENSE_RE.test(String(query || ""));
}

function licensesIdeationMatrix(query = "") {
  if (isProjectIdeaCritiqueRequest(query)) return false;
  if (NAMED_ARTIFACT_RE.test(query) && /\b(?:creer|créer|construire)\b/i.test(query)) {
    return false;
  }
  return isIdeationIntent(query);
}

function detectForeignTemplate(query = "", reply = "") {
  const text = String(reply || "");
  if (CODE_REVIEW_RAG_TEMPLATE_RE.test(text) && !licensesCodeReviewRagTemplate(query)) {
    return "code_review_rag";
  }
  if (IDEATION_MATRIX_RE.test(text) && !licensesIdeationMatrix(query)) {
    return "ideation_generic_matrix";
  }
  return null;
}

function replyMentionsAnchors(reply = "", anchors) {
  const spans = anchors.spans || [];
  if (spans.some((span) => scoreSubjectSurfaceAlignment(reply, span).tier !== ANCHOR_ALIGNMENT_TIER.MISS)) {
    return true;
  }
  const tokens = anchors.tokens || [];
  if (!tokens.length) return true;
  const body = stripAccents(reply);
  return tokens.some((token) => token.length >= 4 && body.includes(token));
}

/**
 * Pivot d'entités (pas seulement domaine) — un sujet nommé neuf sans overlap
 * avec le tour précédent → relâcher plans / mémoire récente.
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 */
export function assessCurrentTurnEntityPivot(query = "", history = []) {
  const empty = {
    detected: false,
    rule: CURRENT_TURN_ANCHORING_RULE,
    reason: "no_pivot",
    currentTokens: [],
    previousTokens: [],
  };

  const current = extractCurrentTurnAnchors(query);
  empty.currentTokens = current.tokens;
  if (!Array.isArray(history) || history.length === 0) {
    return { ...empty, reason: "no_history" };
  }
  if (hasStrongContinuationSignal(query) && !NEW_SUBJECT_HOOK_RE.test(query)) {
    return { ...empty, reason: "continuation_signal" };
  }

  const turns = readRecentTurns(history, 4);
  const lastUser = findLastByRole(turns, "user");
  const lastAssistant = findLastByRole(turns, "assistant");
  const previous = extractCurrentTurnAnchors(lastUser);
  empty.previousTokens = previous.tokens;

  if (!current.tokens.length) return { ...empty, reason: "no_current_entities" };
  if (!previous.tokens.length && !lastAssistant) {
    return { ...empty, reason: "no_previous_entities" };
  }

  const overlap = current.tokens.filter((token) =>
    previous.tokens.some((prior) => tokensOverlap(token, prior)),
  );
  if (overlap.length) return { ...empty, reason: "entity_overlap" };

  const namedNewSubject = NEW_SUBJECT_HOOK_RE.test(query) || current.spans.length > 0;
  const stalePlan = Boolean(
    lastAssistant && detectForeignTemplate(query, lastAssistant),
  );

  if (!namedNewSubject && !stalePlan && current.tokens.length < 2) {
    return { ...empty, reason: "weak_current_entities" };
  }

  return {
    detected: true,
    rule: CURRENT_TURN_ANCHORING_RULE,
    reason: stalePlan ? "stale_plan_no_overlap" : "entity_mismatch",
    currentTokens: current.tokens,
    previousTokens: previous.tokens,
  };
}

/**
 * Aide opérationnelle sur un livrable nommé — pas une matrice d'idéation, pas « reformule ».
 * @param {string} label
 * @param {string} [query]
 */
export function buildNamedCreateOperationalReply(label = "", query = "") {
  const topic = String(label || "le livrable").trim() || "le livrable";
  const wantsPresent =
    /pr[eé]sent|mettre en page|recto|verso|coordonn/i.test(query) ||
    /carte de visite/i.test(topic);
  if (wantsPresent) {
    return [
      `On part sur **${topic}**.`,
      "",
      "Présentation concrète :",
      "- **Recto** : nom, fonction, téléphone, e-mail, site.",
      "- **Verso** : services, accroche, QR code.",
      "- **Support** : impression, PDF, HTML ou carte numérique.",
      "",
      "Envoie tes infos (nom, rôle, contacts) et le support, je te sors le texte prêt à poser.",
    ].join("\n");
  }
  return (
    `On part sur **${topic}**. Pour la présenter : print, HTML ou PDF. ` +
    "Dis-moi le format et les infos à faire figurer — je te sors la structure."
  );
}

function buildAnchoringRepair(anchors, foreignFamily) {
  const label =
    anchors.spans[0] ||
    (requiresEntitySurface(anchors)
      ? anchors.tokens.slice(0, 3).join(" / ")
      : "") ||
    "le sujet de ce tour";

  if (anchors.goal === "idea_critique") {
    return [
      `Sur **${label}** : je ne valide pas d'office.`,
      "Failles à traiter avant de construire : saturation du créneau, différenciation réelle vs outils déjà là, preuve de valeur, coût vs qualité perçue.",
      "Questions : pour qui exactement, quel critère de succès en deux semaines, et qu'est-ce qui empêche d'utiliser un outil générique déjà disponible ?",
    ].join("\n\n");
  }

  if (anchors.goal === "create") {
    return buildNamedCreateOperationalReply(label, anchors.query || "");
  }

  const family = foreignFamily ? ` (${foreignFamily})` : "";
  return `Ta demande porte sur ${label}. La réponse prête recyclait un cadre hors sujet${family}. Je ne la sors pas — reformule l'angle si tu veux que je reparte dessus.`;
}

/**
 * Livrable nommé (« je veux créer une carte de visite ») — démarrer dessus,
 * sans matrice d'idéation ouverte ni COMPOSER à vide.
 * @param {string} query
 * @returns {{ path: string, reply: string }|null}
 */
export function resolveNamedCreateStartShortCircuit(query = "") {
  if (isIdeationIntent(query) || isProjectIdeaCritiqueRequest(query)) return null;
  if (isArchitectureDesignIntent(query)) return null;
  if (classifyWebProjectScopingRequest(query)) return null;
  if (
    /\b(?:python|javascript|typescript|java\b|rust|golang|fichier html|\.html)\b/i.test(
      query,
    )
  ) {
    return null;
  }
  // OS / desktop / GUI : brief système, pas livrable print / HTML / PDF.
  if (
    /\b(?:syst[eè]me d['']?exploitation|operating system|\bos\b|interface graphique|environnement de bureau|desktop(?: environment)?|window manager|barre (?:des )?t[aâ]ches|menu d[eé]marrer|fen[eê]tres?|navigateur|calculatrice)\b/i.test(
      query,
    )
  ) {
    return null;
  }
  const anchors = extractCurrentTurnAnchors(query);
  if (anchors.goal !== "create" || !anchors.spans.length) return null;
  return {
    path: "named_create_start",
    reply: buildNamedCreateOperationalReply(anchors.spans[0], query),
  };
}

/**
 * @param {{
 *   query?: string,
 *   reply?: string,
 *   history?: Array<{ role?: string, content?: string }>,
 *   pipelinePath?: string,
 * }} input
 * @returns {{
 *   ok: boolean,
 *   signals: string[],
 *   text: string,
 *   anchors: ReturnType<typeof extractCurrentTurnAnchors>,
 *   foreignFamily: string|null,
 *   pivot: ReturnType<typeof assessCurrentTurnEntityPivot>,
 * }}
 */
export function evaluateCurrentTurnAnchoring(input = {}) {
  const query = String(input.query || "");
  const reply = String(input.reply || "");
  const history = Array.isArray(input.history) ? input.history : [];
  const anchors = extractCurrentTurnAnchors(query);
  const pivot = assessCurrentTurnEntityPivot(query, history);
  const signals = [];
  const foreignFamily = detectForeignTemplate(query, reply);
  const visionExempt = isVisionAttachedAnchoringExempt(input);

  if (visionExempt && (input.visionFailed || !reply.trim())) {
    const signal = input.visionFailed ? "vision_failed" : "vision_empty";
    return {
      ok: false,
      signals: [signal],
      text: reply,
      anchors,
      foreignFamily: null,
      pivot,
      visionHonestError: true,
    };
  }

  if (!reply.trim()) {
    return { ok: true, signals: ["empty_reply"], text: reply, anchors, foreignFamily: null, pivot };
  }

  if (foreignFamily) signals.push(`foreign_template:${foreignFamily}`);

  const socialPath = isSocialEmitPath(input.pipelinePath);
  if (!socialPath) {
    if (
      anchors.goal === "idea_critique" &&
      IMPLEMENTATION_MATRIX_RE.test(reply)
    ) {
      signals.push("idea_critique_implementation_frame");
    }

    const skipEntityMiss =
      visionExempt ||
      input.pipelinePath === "named_create_start" ||
      input.pipelinePath === "active_goal_continue" ||
      (anchors.goal === "create" && Boolean(anchors.spans[0]));
    if (
      !skipEntityMiss &&
      requiresEntitySurface(anchors) &&
      !replyMentionsAnchors(reply, anchors)
    ) {
      signals.push("entity_miss");
    }

    if (anchors.goal === "idea_critique" && !CRITIQUE_MARK_RE.test(reply)) {
      signals.push("critique_posture_miss");
    }

    if (anchors.posture.noCompliment && PRAISE_RE.test(reply)) {
      signals.push("forbidden_praise");
    }

    if (anchors.posture.findFlaws && !CRITIQUE_MARK_RE.test(reply)) {
      signals.push("flaws_posture_miss");
    }

    if (anchors.posture.askQuestions && !/[?]/.test(reply) && !/\bquestions?\b/i.test(reply)) {
      signals.push("questions_posture_miss");
    }
  }

  if (pivot.detected && foreignFamily) {
    signals.push("stale_plan_after_pivot");
  }

  const ok = signals.length === 0;
  return { ok, signals, text: reply, anchors, foreignFamily, pivot };
}

/**
 * Garde emit : si l'ancrage échoue, repair déterministe borné (pas de LLM).
 * @param {{
 *   query?: string,
 *   reply?: string,
 *   history?: Array<{ role?: string, content?: string }>,
 *   pipelinePath?: string,
 * }} input
 */
export function enforceCurrentTurnAnchoring(input = {}) {
  const verdict = evaluateCurrentTurnAnchoring(input);
  if (verdict.ok) return verdict;
  if (verdict.visionHonestError) {
    return {
      ...verdict,
      text: buildVisionAnalysisError(verdict.signals),
    };
  }
  return {
    ...verdict,
    text: buildAnchoringRepair(verdict.anchors, verdict.foreignFamily),
  };
}

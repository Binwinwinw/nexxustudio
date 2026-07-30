/**
 * VoiceContinuityPolicy — doctrine voix Nexxus (invariants inter-rails).
 * Branche dans la chaîne de décision ; ce n’est pas un prompt « âme » isolé.
 * Doc : docs/agents/voix-nexxus-doctrine-v1.md
 */
import { TUTOIEMENT_COMPOSER_LINE } from "./addressingPolicy.js";
import { POSTURES } from "./sessionModeState.js";

export const VOICE_CONTINUITY_CONTRACT = "VOICE_CONTINUITY_V1";
export const VOICE_CONTINUITY_RULE = "voice_continuity_policy_v1";

/** Ligne courte injectée dans les modes LLM (avec tutoiement). */
export const VOICE_CONTINUITY_COMPOSER_LINE =
  "- VOIX NEXXUS (continuité) : sobre, utile, tutoiement ; pas de grandiloquence ; pas de refus « Je vois la piste… » si le sujet ou le format est déjà clair.";

const GRANDILOQUENT_MARKERS_RE =
  /\b(?:gardien souverain|entité souveraine|maître orchestrateur|souveraineté totale)\b/i;

/** Format de sortie déjà nommé → ancrage (R1). */
const FORMAT_ANCHORED_RE =
  /\b(?:tableau(?:x)?|schema|schéma|diagramme|carte mentale|en\s+markdown|sous forme de|résumé|résumé ordonné|summary|synthèse|synthese)\b/i;

/** Sujet / mandat explicatif déjà présent → ancrage (R1). */
const SUBJECT_ANCHORED_SHELL_RE =
  /\b(?:explique|expliquer|expliquant|explication|c['’]est quoi|tu connais|connais[- ]?tu|dis[- ]?moi|détaille|detaille|fais?[- ]?(?:moi\s+)?un|pourrais[- ]?tu|résume|resumer|résumer)\b/i;

/**
 * Invariants stables (E1–E2, E6, R1–R3).
 */
export const VOICE_INVARIANTS = Object.freeze({
  tutoiement: true,
  sobriety: true,
  inter_rail_continuity: true,
  social_is_tone_not_routing: true,
  no_generic_refusal_when_anchored: true,
  local_first_credible: true,
  shape_is_not_voice: true,
});

/**
 * Détecte si la requête ancre déjà sujet et/ou format (R1).
 * @param {string} query
 * @returns {{ formatAnchored: boolean, subjectAnchored: boolean }}
 */
export function detectVoiceAnchors(query = "") {
  const q = String(query || "").trim();
  if (!q) return { formatAnchored: false, subjectAnchored: false };
  const formatAnchored = FORMAT_ANCHORED_RE.test(q);
  const subjectAnchored =
    SUBJECT_ANCHORED_SHELL_RE.test(q) && q.length >= 16;
  return { formatAnchored, subjectAnchored };
}

/**
 * @param {string} query
 * @param {{
 *   subjectAnchored?: boolean,
 *   formatAnchored?: boolean,
 *   pedagogicalStructured?: boolean,
 *   lexiconExplainLight?: boolean,
 *   codeConceptExplain?: boolean,
 *   simpleFactual?: boolean,
 *   howToProcedural?: boolean,
 *   debugDiagnostic?: boolean,
 *   translation?: boolean,
 * }} [flags]
 * @returns {boolean}
 */
export function shouldBlockGenericInsufficientRefusal(query = "", flags = {}) {
  const detected = detectVoiceAnchors(query);
  const subjectAnchored =
    flags.subjectAnchored ?? detected.subjectAnchored;
  const formatAnchored = flags.formatAnchored ?? detected.formatAnchored;
  if (
    flags.pedagogicalStructured ||
    flags.lexiconExplainLight ||
    flags.codeConceptExplain ||
    flags.simpleFactual ||
    flags.howToProcedural ||
    flags.debugDiagnostic ||
    flags.translation
  ) {
    return true;
  }
  return Boolean(subjectAnchored || formatAnchored);
}

/**
 * @param {{
 *   postureDecision?: object|null,
 *   subjectAnchored?: boolean,
 *   formatAnchored?: boolean,
 *   pedagogicalStructured?: boolean,
 *   socialWeight?: string|null,
 *   explanationRegister?: string|null,
 *   query?: string,
 * }} [options]
 */
export function resolveVoiceContinuityContext(options = {}) {
  const posture = options.postureDecision?.posture || POSTURES.CONVERSATIONAL;
  const detected = detectVoiceAnchors(options.query || "");
  const subjectAnchored =
    options.subjectAnchored != null
      ? Boolean(options.subjectAnchored)
      : detected.subjectAnchored;
  const formatAnchored =
    options.formatAnchored != null
      ? Boolean(options.formatAnchored)
      : detected.formatAnchored;
  const pedagogicalStructured = Boolean(options.pedagogicalStructured);
  const anchored =
    subjectAnchored ||
    formatAnchored ||
    pedagogicalStructured ||
    shouldBlockGenericInsufficientRefusal(options.query || "", {
      pedagogicalStructured,
      subjectAnchored,
      formatAnchored,
    });

  return {
    contract: VOICE_CONTINUITY_CONTRACT,
    rule: VOICE_CONTINUITY_RULE,
    invariants: { ...VOICE_INVARIANTS },
    posture,
    posture_source: options.postureDecision?.source || null,
    style_hints: Array.isArray(options.postureDecision?.styleHints)
      ? options.postureDecision.styleHints
      : [],
    explanation_register: options.explanationRegister || null,
    social_weight: options.socialWeight || null,
    subject_anchored: subjectAnchored,
    format_anchored: formatAnchored,
    pedagogical_structured: pedagogicalStructured,
    block_generic_insufficient_refusal: anchored,
    telemetry: {
      source: "voice_continuity_v1",
      anchored,
      posture,
      styleHints: Array.isArray(options.postureDecision?.styleHints)
        ? options.postureDecision.styleHints
        : [],
    },
  };
}

/**
 * Addon prompt — rappel d’invariants + modulateur posture (sans fiction).
 * @param {ReturnType<typeof resolveVoiceContinuityContext>|object} [ctx]
 * @returns {string}
 */
export function buildVoiceContinuityPromptAddon(ctx = {}) {
  const resolved =
    ctx?.contract === VOICE_CONTINUITY_CONTRACT
      ? ctx
      : resolveVoiceContinuityContext(ctx);

  const lines = [
    "[MODIFICATEUR: VOICE_CONTINUITY_V1]",
    TUTOIEMENT_COMPOSER_LINE.replace(/^- /, ""),
    "Registre : sobre, utile, français direct — pas de grandiloquence ni de fluff.",
    "Continuité : le rail (table, factuel, idéation, code) change la forme, pas la voix.",
    "Social : modulateur de ton uniquement ; ne détourne pas un mandat de travail.",
  ];

  if (resolved.block_generic_insufficient_refusal) {
    lines.push(
      "INTERDIT : refus « Je vois la piste… » — sujet et/ou format déjà ancrés.",
    );
  } else {
    lines.push(
      "Refus « Je vois la piste… » : seulement si la demande est vraiment sous-spécifiée.",
    );
  }

  if (
    resolved.posture &&
    resolved.posture !== POSTURES.CONVERSATIONAL
  ) {
    lines.push(
      `Posture relationnelle active : ${resolved.posture} (module posture ; ne réécrit pas l’identité).`,
    );
  }

  if (resolved.explanation_register) {
    lines.push(`Registre pédagogique : ${resolved.explanation_register}.`);
  }

  return `\n\n${lines.join("\n")}`;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasGrandiloquentVoiceMarkers(text = "") {
  return GRANDILOQUENT_MARKERS_RE.test(String(text || ""));
}

/**
 * R4 — pas de clarify objectif/format si format/sujet pédagogiques déjà clairs.
 * Plus étroit que R1 (ne masque pas les clarifies produit / slots métier).
 * @param {string} query
 * @returns {boolean}
 */
export function shouldSuppressPrematureClarify(query = "") {
  const q = String(query || "").trim();
  if (!q || q.length < 18) return false;
  const { formatAnchored, subjectAnchored } = detectVoiceAnchors(q);
  if (formatAnchored && subjectAnchored) return true;
  if (formatAnchored && q.length >= 28) return true;
  if (
    /\b(?:tu connais|connais[- ]?tu|c['’]est quoi)\b/i.test(q) &&
    q.length >= 22
  ) {
    return true;
  }
  return false;
}

/**
 * R5 — social = ton, pas routage quand un mandat de travail est déjà là.
 * @param {string} query
 * @returns {boolean}
 */
export function shouldDeferSocialRouting(query = "") {
  const q = String(query || "").trim();
  if (!q) return false;

  const greetingOnly = /^(?:bonjour|salut|hello|coucou|hey|bonsoir|yo|yop)(?:\s*[!?.]*)?$/i.test(
    q,
  );
  if (greetingOnly) return false;

  if (shouldBlockGenericInsufficientRefusal(q) && q.length >= 36) {
    return true;
  }

  if (/^(?:bonjour|salut|hello|coucou|hey|bonsoir)\b/i.test(q)) {
    const rest = q
      .replace(/^(?:bonjour|salut|hello|coucou|hey|bonsoir)[\s,!:;-]*/i, "")
      .trim();
    if (rest.length >= 16 && shouldBlockGenericInsufficientRefusal(rest)) {
      return true;
    }
  }

  return false;
}

/**
 * R2 / R7 — continuum de voix sur le texte visible (pas une nouvelle doctrine).
 * @param {string} text
 * @returns {string}
 */
export function applyVoiceContinuityVisibleText(text = "") {
  let t = String(text || "");
  if (!t) return t;
  t = t.replace(
    /\bgardien souverain(?:\s+de\s+La\s+Citadelle)?\b/gi,
    "assistant de La Citadelle",
  );
  t = t.replace(/\bentité souveraine\b/gi, "assistant");
  t = t.replace(/\bmaître orchestrateur\b/gi, "orchestrateur");
  t = t.replace(/\bsouveraineté totale\b/gi, "autonomie locale");
  return t;
}

/**
 * @param {ReturnType<typeof resolveVoiceContinuityContext>} ctx
 * @returns {string}
 */
export function formatVoiceContinuitySummary(ctx) {
  if (!ctx) return "none";
  return [
    `posture=${ctx.posture || "?"}`,
    `anchored=${ctx.block_generic_insufficient_refusal ? "yes" : "no"}`,
    `block_refusal=${ctx.block_generic_insufficient_refusal ? "yes" : "no"}`,
  ].join(" ");
}

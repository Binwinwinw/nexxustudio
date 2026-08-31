/**
 * Frame conversationnel minimal — axes social / tâche / composite.
 * Découpe structurelle (slots), pas une liste de formulations.
 */
import { normalizeText } from "../../utils/parsing-normalization/normalizationGuards.js";
import {
  isStrongTechnicalLearningShell,
  isTechnicalLearningPathSignal,
} from "../../utils/intent-guards/technicalLearningPathIntentGuards.js";
import { isPrimaryCareerLearningSignal } from "../../utils/intent-guards/careerLearningPathIntentGuards.js";
import {
  isExplicitTextCreationRequest,
  isInformationSeekingWithTarget,
} from "../../utils/intent-guards/informationSeekingIntentGuards.js";
import { isLearningRequestWithTarget } from "../../utils/intent-guards/learningRequestIntentGuards.js";
import { isTranslationRequest, isTranslationDerivedRequest } from "../../utils/intent-guards/translationIntentGuards.js";
import { isContextReferenceRequest } from "../../utils/intent-guards/contextReferenceIntentGuards.js";
import { isExploratoryTopicIntent } from "../../utils/conversation/exploratoryConversationGuards.js";
import { isMetaAssistantBehaviorRequest } from "../../utils/intent-guards/metaAssistantBehaviorGuards.js";
import { shouldBypassLocalDatetimeShortCircuit } from "../../utils/intent-guards/externalCalendarLookupIntentGuards.js";
import {
  extractTemporalTarget,
  TEMPORAL_TARGET_KIND,
} from "../conversation/conversationSubjectExtraction.js";
import {
  classifySocialPattern,
  isGratitudeClosureIntent,
  isPhaticSocialCheckinIntent,
  isWellbeingCheckinIntent,
} from "../social/socialPatternPolicy.js";

function isSubstantiveWorkRequest(query = "") {
  if (isExplicitTextCreationRequest(query)) return true;
  const q = normalizeText(query);
  if (!q) return false;

  const actionVerbs =
    /(génère|genere|écris|ecris|crée|créer|cree|implémente|implemente|développe|developpe|programme|construis|fabrique|produis|livre|fournis|donne-moi|donne moi|élabore|elabore|réalise|realise|code)/i;
  const deliverable =
    /(code|fichier|script|fonction|classe|module|composant|html|css|json|api|algorithme|programme|livrable|artefact|snippet|exemple complet|application|appli|projet)/i;
  const formatHint =
    /(format|commenté|commente|en français|en francais|markdown|typescript|javascript|python|java|react|vue|vite|niveau|contrainte|spécification|specification)/i;

  const signalCount = [actionVerbs.test(q), deliverable.test(q), formatHint.test(q)].filter(
    Boolean,
  ).length;

  if (q.length >= 120 && signalCount >= 1) return true;
  if (q.length >= 60 && signalCount >= 2) return true;
  if (q.length >= 40 && signalCount >= 3) return true;

  return false;
}

const GREETING_OPENER_RE =
  /(?:^|\s)(salut|bonjour|hello|coucou|hey|bonsoir|yo|yop|yépa|yepa|merci|ok)\b/i;

/** Politesse de clôture — pas une salutation composite. */
const COURTESY_CLOSING_RE =
  /\bmerci(?:\s+(?:par\s+avance|beaucoup|d['']?avance))?\s*\.?\s*$/i;

const SHORT_SOCIAL_ONLY_RE =
  /^(salut|bonjour|hello|coucou|hey|yépa|yepa|merci|ok|d'accord|dacord|bien|bonsoir|bien ou bien|ça va|ca va|tranquille|good|yo|yop|top|au top|c'est top|tout bon|carré|carre|ok top|ça roule|ca roule|tout roule)\b/i;

/** Excuse / mauvais fil — pas une demande métier. */
const SOCIAL_RETRACTION_RE =
  /\b(?:je\s+me\s+suis\s+tromp|tromp[eé]\s+de\s+(?:discussion|conversation|fil|chat|thread)|mauvaise\s+(?:discussion|conversation|fil)|mauvais\s+(?:fil|chat)|pas\s+la\s+bonne\s+(?:discussion|conversation|fil)|wrong\s+(?:chat|conversation|thread)|mauvais\s+endroit)\b/i;

const SOCIAL_APOLOGY_MARKER_RE =
  /(?:^|\s)(?:desole|désolé|désolée|pardon|excuse[- ]?moi|sorry|my bad|oups|oops)(?:\s*[!.?]|$|\s)/i;

const CHECKIN_ACTION_BOUND_RE =
  /\b(?:va|vas|passe|roule)\s+(?:bien\s+)?(?:g[ée]rer|gerer|faire|r[ée]gler|se\s+passer\s+pour|marcher|aider|r[ée]parer|corriger|voir|r[ée]soudre|fonctionner|impacter|casser)\b/i;

const TASK_HELP_RE =
  /\b(tu\s+peux|peux[- ]?tu|aide[- ]?moi|m['’]?aider|m['’]?aide|explique[- ]?moi|m['’]?expliquer|mexpliquer|montre[- ]?moi|peux\s+tu\s+m['’]?aider|(?:ton|ta)\s+aide)\b/i;

const END_TO_END_PROJECT_ASSISTANCE_RE =
  /\b(?:ton|ta)\s+aide\b.{0,80}\b(?:projet|saas|start[- ]?up|forge|cadrage|accompagn)\b|\bbout\s+en\s+bout\b.{0,60}\b(?:projet|saas|start[- ]?up)\b|\bprojet\b.{0,60}\bbout\s+en\s+bout\b/i;

const CONDITIONAL_PROCESS_QUESTION_RE =
  /\bcomment\s+(?:ça|ca)\s+se\s+passe\s+si\b/i;

const TASK_ACTION_RE =
  /\b(cree|créer|creer|generer|générer|genere|fais|fait|produis|construis|developpe|développe|ecris|écris|corrige|corriger|debug|débug|analyse|analyser|compare|comparer|planifie|planifier)\b/i;

const IDENTITY_RE =
  /\b(comment\s+t['’]appelles[-\s]?tu|comment\s+tu\s+t['’]appelles|tu\s+t['’]appelles\s+comment|quel\s+est\s+ton\s+nom|qui\s+es[-\s]?tu|comment\s+t['’]appelles\s+tu|qui\s+est\s+nexxus|sais[- ]?tu\s+qui\s+es(t)?\s+nexxus|qui\s+tu\s+es|quelles?\s+sont\s+tes\s+sp[eé]cialit[eé]s|tes\s+sp[eé]cialit[eé]s|en\s+quoi\s+(?:es[- ]?tu|tu\s+es)\s+sp[eé]cialis|quel\s+est\s+ton\s+r[oô]le|c['’]?\s*est\s+quoi\s+ton\s+r[oô]le|ton\s+r[oô]le)\b/i;

const TIME_RE =
  /\b(quelle\s+heure|quel\s+heure|heure\s+est\s+il|heure\s+est-il|il\s+est\s+quelle\s+heure)\b/i;

const DATE_RE =
  /\b(quelle\s+date|quel\s+est\s+la\s+date|quelle\s+est\s+la\s+date|date\s+du\s+jour|date\s+sommes\s+nous|date\s+sommes-nous|quel\s+jour|jour\s+sommes\s+nous|jour\s+sommes-nous)\b/i;

function detectWellbeingCheckin(q) {
  if (!q) return false;
  // Source unique — typo « cava », exclusions méta / action-bound.
  if (END_TO_END_PROJECT_ASSISTANCE_RE.test(q)) return false;
  if (CONDITIONAL_PROCESS_QUESTION_RE.test(q)) return false;
  return isWellbeingCheckinIntent(q);
}

function detectTaskAxis(q) {
  if (!q) {
    return {
      present: false,
      helpRequest: false,
      workRequest: false,
      actionRequest: false,
      learningShell: false,
      careerShell: false,
      learningRequest: false,
    };
  }

  if (isPhaticSocialCheckinIntent(q)) {
    return {
      present: false,
      helpRequest: false,
      workRequest: false,
      actionRequest: false,
      learningShell: false,
      careerShell: false,
      informationSeeking: false,
      learningRequest: false,
      translationRequest: false,
      contextReference: false,
    };
  }

  const workRequest = isSubstantiveWorkRequest(q);
  const helpRequest = TASK_HELP_RE.test(q);
  const actionRequest = TASK_ACTION_RE.test(q) || isExplicitTextCreationRequest(q);
  const learningShell =
    isStrongTechnicalLearningShell(q) || isTechnicalLearningPathSignal(q);
  const careerShell = isPrimaryCareerLearningSignal(q);
  const informationSeeking = isInformationSeekingWithTarget(q);
  const learningRequest = isLearningRequestWithTarget(q);
  const translationRequest =
    isTranslationRequest(q) || isTranslationDerivedRequest(q);
  const contextReference = isContextReferenceRequest(q);
  const exploratoryTheme = isExploratoryTopicIntent(q);
  const metaBehavior = isMetaAssistantBehaviorRequest(q);
  const assistanceProcess =
    END_TO_END_PROJECT_ASSISTANCE_RE.test(q) ||
    (CONDITIONAL_PROCESS_QUESTION_RE.test(q) &&
      (/\b(?:ton|ta)\s+aide\b/i.test(q) ||
        /\b(?:projet|saas|start[- ]?up|forge|accompagn|bout\s+en\s+bout)\b/i.test(q)));
  const present =
    workRequest ||
    helpRequest ||
    actionRequest ||
    learningShell ||
    careerShell ||
    informationSeeking ||
    learningRequest ||
    translationRequest ||
    contextReference ||
    exploratoryTheme ||
    metaBehavior ||
    assistanceProcess;

  return {
    present,
    helpRequest,
    workRequest,
    actionRequest,
    learningShell,
    careerShell,
    informationSeeking,
    learningRequest,
    translationRequest,
    contextReference,
  };
}

function detectSocialRetraction(q, taskAxis) {
  if (!q || taskAxis.present) return false;
  if (SOCIAL_RETRACTION_RE.test(q)) return true;
  if (
    SOCIAL_APOLOGY_MARKER_RE.test(q) &&
    q.length <= 90 &&
    !TASK_HELP_RE.test(q) &&
    !TASK_ACTION_RE.test(q)
  ) {
    return true;
  }
  return false;
}

function detectSocialAxis(q, taskAxis) {
  const greetingRaw = GREETING_OPENER_RE.test(q);
  const gratitudeClosure = isGratitudeClosureIntent(q) && !taskAxis.present;
  const courtesyClosing =
    taskAxis.present &&
    /\bmerci\b/i.test(q) &&
    COURTESY_CLOSING_RE.test(q);
  const greeting =
    greetingRaw &&
    !courtesyClosing &&
    !gratitudeClosure &&
    !isExploratoryTopicIntent(q);
  const checkin = detectWellbeingCheckin(q);
  const shortSocial = q.length <= 25 && SHORT_SOCIAL_ONLY_RE.test(q);
  const socialRetraction = detectSocialRetraction(q, taskAxis);
  const identity = IDENTITY_RE.test(q) || /^nexxus\s*\?+$/i.test(q);
  const asksTime =
    TIME_RE.test(q) && !shouldBypassLocalDatetimeShortCircuit(q);
  const asksDate =
    DATE_RE.test(q) &&
    extractTemporalTarget(q) !== TEMPORAL_TARGET_KIND.HISTORICAL &&
    extractTemporalTarget(q) !== TEMPORAL_TARGET_KIND.RELATIVE &&
    !shouldBypassLocalDatetimeShortCircuit(q);

  return {
    greeting,
    checkin,
    shortSocial,
    socialRetraction,
    gratitudeClosure,
    identity,
    asksTime,
    asksDate,
    actionBoundCheckin: CHECKIN_ACTION_BOUND_RE.test(q),
  };
}

/**
 * @param {string} query
 * @returns {{
 *   version: string,
 *   normalized: string,
 *   social: ReturnType<typeof detectSocialAxis>,
 *   task: ReturnType<typeof detectTaskAxis>,
 *   socialOnly: boolean,
 *   composite: boolean,
 *   confidence: "high"|"medium"|"low",
 * }}
 */
export function analyzeConversationIntentFrame(query = "") {
  const normalized = normalizeText(query).trim();
  const task = detectTaskAxis(normalized);
  const social = detectSocialAxis(normalized, task);

  const hasSocialSurface =
    social.greeting ||
    social.checkin ||
    social.shortSocial ||
    social.socialRetraction ||
    social.gratitudeClosure ||
    social.identity ||
    social.asksTime ||
    social.asksDate ||
    normalized.length < 3;

  const knownSocialPattern = classifySocialPattern(normalized);
  // Lot 3 — un pattern social ne force plus socialOnly si une tâche est présente.
  const socialOnly =
    (Boolean(knownSocialPattern) && !task.present) ||
    (hasSocialSurface &&
      !task.present &&
      !social.actionBoundCheckin &&
      !task.informationSeeking &&
      !task.translationRequest &&
      !task.contextReference &&
      (social.checkin ||
        social.greeting ||
        social.shortSocial ||
        social.socialRetraction ||
        social.gratitudeClosure ||
        normalized.length < 3));

  const composite =
    hasSocialSurface &&
    task.present &&
    (social.greeting || social.checkin) &&
    !social.actionBoundCheckin &&
    !social.socialRetraction;

  let confidence = "low";
  if (socialOnly && (social.checkin || social.shortSocial || social.socialRetraction || social.gratitudeClosure))
    confidence = "high";
  else if (socialOnly && social.greeting) confidence = "medium";
  else if (composite) confidence = "medium";

  return {
    version: "1.0",
    normalized,
    social,
    task,
    socialOnly,
    composite,
    confidence,
  };
}

/**
 * Compatible avec resolveSimpleDeterministicIntent (intentShortCircuit).
 * @param {string} query
 */
export function resolveSimpleDeterministicFromFrame(query = "") {
  const frame = analyzeConversationIntentFrame(query);
  const { social, task } = frame;

  if (frame.composite) return null;

  const knownSocialPattern = classifySocialPattern(query);
  // Pattern social classifié (phatic, invite, discomfort…) prime sur le menu salut générique.

  const asksIdentity = social.identity;
  const asksTime = social.asksTime;
  const asksDate = social.asksDate;
  const asksStateOfHealth = social.checkin && !task.present;
  const isGreeting =
    (social.greeting || social.shortSocial) &&
    !task.present &&
    !asksStateOfHealth &&
    !knownSocialPattern;
  const isSocialRetraction = social.socialRetraction && !task.present;

  if (
    !asksIdentity &&
    !asksTime &&
    !asksDate &&
    !isGreeting &&
    !asksStateOfHealth &&
    !isSocialRetraction
  ) {
    return null;
  }

  return {
    asksIdentity,
    asksTime,
    asksDate,
    isGreeting,
    asksStateOfHealth,
    isSocialRetraction,
    frame,
  };
}

/**
 * Small talk / check-in sans demande métier — garde-fou amont du factuel.
 * @param {string} query
 * @returns {boolean}
 */
export function isConversationSocialOnlyQuery(query = "", options = {}) {
  if (options.turnComprehension?.dominance?.workPresent) return false;
  if (options.turnComprehension && !options.turnComprehension.responseExpectations?.mayFinalizeSocial) {
    return false;
  }
  const frame = analyzeConversationIntentFrame(query);
  if (frame.normalized.length > 120) return false;
  if (frame.composite) return false;
  return frame.socialOnly;
}

/**
 * G41.1 — réponses sociales composées (identité + capacités, etc.).
 */
import {
  getIdentityDeterministicReply,
  isIdentityIntent,
} from "../../utils/intent-guards/identityIntentGuards.js";
import { isCapabilityOverviewRequest } from "../../utils/intent-guards/metaConversationIntentGuards.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../posture/index.js";
import { withLeadingGreetingMirror } from "./socialGreetingMirrorPolicy.js";
import {
  buildSocialCheckinReply,
  clampSocialCheckinReply,
  isWellbeingCheckinIntent,
} from "./socialPatternPolicy.js";

export const SOCIAL_COMPOSITE_RULE = "social_composite_g41_1";

const LEADING_REPLY_GREETING_RE =
  /^(?:bonjour|bonsoir|salut|hello|coucou|hey)\s*[!.…—–-]?\s*/i;

const FALLBACK_CHECKIN = "Tout va bien ici.";

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isIdentityCheckinCompositeRequest(query = "") {
  return isIdentityIntent(query) && isWellbeingCheckinIntent(query);
}

/**
 * Check-in + identité, un seul greeting (miroir amont).
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string|null}
 */
export function buildIdentityCheckinCompositeReply(query = "", options = {}) {
  if (!isIdentityCheckinCompositeRequest(query)) return null;
  const health = clampSocialCheckinReply(
    buildSocialCheckinReply(query) || FALLBACK_CHECKIN,
    query,
  );
  const identityRaw = getIdentityDeterministicReply(query, {
    history: options.history || [],
    skipGreetingMirror: true,
  });
  if (!identityRaw) return null;
  const identity = identityRaw.replace(LEADING_REPLY_GREETING_RE, "").trim();
  if (!identity) return null;
  return `${health} ${identity}`;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isIdentityCapabilityCompositeRequest(query = "") {
  return isIdentityIntent(query) && isCapabilityOverviewRequest(query);
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string|null}
 */
export function buildIdentityCapabilityCompositeReply(query = "", options = {}) {
  if (!isIdentityCapabilityCompositeRequest(query)) return null;
  const reply = composeMannerReply({
    family: RESPONSE_MANNER_FAMILIES.IDENTITY_CAPABILITY_COMPOSITE,
    history: options.history || [],
    salt: query,
  });
  return withLeadingGreetingMirror(query, reply);
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string, compositeKind: string }|null}
 */
export function resolveSocialCompositeShortCircuit(query = "", options = {}) {
  const reply = buildIdentityCapabilityCompositeReply(query, options);
  if (!reply) return null;
  return {
    path: "social_composite_deterministic",
    reply,
    compositeKind: "identity_capability",
  };
}

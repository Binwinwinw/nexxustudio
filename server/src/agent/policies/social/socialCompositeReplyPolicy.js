/**
 * G41.1 — réponses sociales composées (identité + capacités, etc.).
 */
import { isIdentityIntent } from "../../utils/identityIntentGuards.js";
import { isCapabilityOverviewRequest } from "../../utils/metaConversationIntentGuards.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../posture/index.js";

export const SOCIAL_COMPOSITE_RULE = "social_composite_g41_1";

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
  return composeMannerReply({
    family: RESPONSE_MANNER_FAMILIES.IDENTITY_CAPABILITY_COMPOSITE,
    history: options.history || [],
    salt: query,
  });
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

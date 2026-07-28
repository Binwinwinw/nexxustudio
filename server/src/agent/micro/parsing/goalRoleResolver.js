/**
 * Résout le rôle des segments : but primaire vs contexte support.
 */
import { parseRequestSegments } from "./requestSegmentParser.js";

const SUPPORT_TYPES = new Set(["time_lookup", "identity_lookup"]);
const PRIMARY_TYPES = new Set([
  "purchase_advice",
  "recommendation",
  "identity_lookup",
  "how_to",
  "general",
]);

/**
 * @param {ReturnType<typeof parseRequestSegments>} parsed
 */
export function resolveSegmentRoles(parsed) {
  const segments = parsed?.segments || [];
  if (!segments.length) {
    return {
      primaryGoal: null,
      supportingContext: [],
      primarySegment: null,
      supportSegments: [],
      isMultiIntent: false,
    };
  }

  let primarySegment =
    segments.find((s) => s.role === "primary_goal") || segments[0];
  const supportSegments = segments.filter(
    (s) => s !== primarySegment && s.role === "support_context",
  );

  if (!primarySegment && segments.length) {
    primarySegment =
      segments.find((s) => PRIMARY_TYPES.has(s.type)) || segments.at(-1);
  }

  for (const seg of segments) {
    if (seg === primarySegment) continue;
    if (SUPPORT_TYPES.has(seg.type) || seg.role === "support_context") {
      if (!supportSegments.includes(seg)) supportSegments.push(seg);
    }
  }

  const isMultiIntent =
    supportSegments.length > 0 &&
    primarySegment &&
    primarySegment.type !== supportSegments[0]?.type;

  return {
    primaryGoal: primarySegment?.type || null,
    supportingContext: supportSegments.map((s) => s.type),
    primarySegment,
    supportSegments,
    isMultiIntent,
    linker: parsed.linker || null,
  };
}

/**
 * @param {string} rawQuery
 */
export function resolveQueryGoals(rawQuery = "") {
  const parsed = parseRequestSegments(rawQuery);
  const roles = resolveSegmentRoles(parsed);
  return { parsed, ...roles };
}

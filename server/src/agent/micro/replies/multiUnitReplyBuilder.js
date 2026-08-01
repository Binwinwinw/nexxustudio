/**
 * Réponse multi-unités satisfiables localement — structure interne par unités,
 * surface conversationnelle (fusion naturelle ou sectionnée).
 */
import {
  buildHowToAmbiguousClarifyReply,
  buildHowToSimpleLocalContent,
  HOW_TO_QUALIFICATIONS,
  extractHowToTopic,
} from "../../policies/qualification/howToQualificationPolicy.js";
import { canServeMultiUnitPartialDecomposition } from "../../policies/requestDecompositionPolicy.js";

export const MULTI_UNIT_SURFACE_STYLES = Object.freeze({
  NATURAL_FUSION: "natural_fusion",
  SECTIONED: "sectioned",
});

const DETERMINISTIC_UNIT_TYPES = new Set([
  "social_greeting",
  "social_checkin",
  "time_request",
  "date_request",
  "how_to_request",
]);

const FUSION_ELIGIBLE_WORK_TYPES = new Set([
  "time_request",
  "date_request",
  "how_to_request",
]);

const MAX_FUSION_WORK_UNITS = 4;

function formatCurrentTimeFr() {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function formatCurrentDateFr() {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>} decomposition
 * @returns {typeof MULTI_UNIT_SURFACE_STYLES[keyof typeof MULTI_UNIT_SURFACE_STYLES]}
 */
export function resolveMultiUnitSurfaceStyle(decomposition) {
  const workUnits = decomposition?.units?.filter((unit) => !unit.absorbable) || [];
  if (workUnits.length > MAX_FUSION_WORK_UNITS) {
    return MULTI_UNIT_SURFACE_STYLES.SECTIONED;
  }
  if (!workUnits.every((unit) => FUSION_ELIGIBLE_WORK_TYPES.has(unit.unitType))) {
    return MULTI_UNIT_SURFACE_STYLES.SECTIONED;
  }
  return MULTI_UNIT_SURFACE_STYLES.NATURAL_FUSION;
}

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>["units"]} units
 */
function buildSocialLead(units = []) {
  const hasGreeting = units.some((u) => u.unitType === "social_greeting");
  const hasCheckin = units.some((u) => u.unitType === "social_checkin");
  if (hasGreeting && hasCheckin) return "Salut ! Ça va bien de mon côté.";
  if (hasGreeting) return "Salut !";
  if (hasCheckin) return "Ça va bien de mon côté.";
  return "";
}

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>["units"]} units
 */
function buildDateTimePhrase(units = []) {
  const hasTime = units.some((u) => u.unitType === "time_request");
  const hasDate = units.some((u) => u.unitType === "date_request");
  if (hasDate && hasTime) {
    return `Nous sommes ${formatCurrentDateFr()} et il est ${formatCurrentTimeFr()}.`;
  }
  if (hasDate) return `Nous sommes ${formatCurrentDateFr()}.`;
  if (hasTime) return `Il est ${formatCurrentTimeFr()}.`;
  return "";
}

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>} decomposition
 */
function buildNaturalFusionReply(decomposition) {
  const units = decomposition.units;
  const parts = [buildSocialLead(units), buildDateTimePhrase(units)];
  const howToUnit = units.find((u) => u.unitType === "how_to_request");
  if (
    howToUnit &&
    howToUnit.howToQualification === HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL
  ) {
    parts.push(buildHowToSimpleLocalContent(howToUnit.payload, "natural"));
  }
  const reply = parts.filter(Boolean).join(" ").trim();
  return reply ? { reply, surfaceStyle: MULTI_UNIT_SURFACE_STYLES.NATURAL_FUSION } : null;
}

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>} decomposition
 */
function buildSectionedReply(decomposition) {
  const units = decomposition.units;
  const lines = [];
  const socialLead = buildSocialLead(units);
  if (socialLead) lines.push(socialLead);

  if (units.some((u) => u.unitType === "time_request")) {
    lines.push(`**Heure :** ${formatCurrentTimeFr()}`);
  }
  if (units.some((u) => u.unitType === "date_request")) {
    lines.push(`**Date :** ${formatCurrentDateFr()}`);
  }

  const howToUnit = units.find((u) => u.unitType === "how_to_request");
  if (
    howToUnit &&
    howToUnit.howToQualification === HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL
  ) {
    const topic = extractHowToTopic(howToUnit.payload);
    const label = /\bsmoothie\b/i.test(topic) ? "Smoothie" : "Comment faire";
    lines.push(
      `**${label} :** ${buildHowToSimpleLocalContent(howToUnit.payload, "labeled")}`,
    );
  }

  const reply = lines.filter(Boolean).join("\n").trim();
  return reply ? { reply, surfaceStyle: MULTI_UNIT_SURFACE_STYLES.SECTIONED } : null;
}

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>} decomposition
 */
export function canServeMultiUnitComposite(decomposition) {
  if (!decomposition?.units?.length) return false;
  const workUnits = decomposition.units.filter((unit) => !unit.absorbable);
  if (workUnits.length < 2) return false;
  return workUnits.every(
    (unit) =>
      DETERMINISTIC_UNIT_TYPES.has(unit.unitType) && unit.satisfiable !== false,
  );
}

export { canServeMultiUnitPartialDecomposition as canServeMultiUnitPartial };

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>} decomposition
 */
export function buildMultiUnitPartialReply(decomposition) {
  if (!canServeMultiUnitPartialDecomposition(decomposition)) return null;

  const units = decomposition.units;
  const howToUnit = units.find((u) => u.unitType === "how_to_request");
  const parts = [buildSocialLead(units), buildDateTimePhrase(units)];
  if (howToUnit) {
    parts.push(buildHowToAmbiguousClarifyReply(howToUnit.payload));
  }
  const reply = parts.filter(Boolean).join(" ").trim();
  return reply
    ? {
        reply,
        surfaceStyle: MULTI_UNIT_SURFACE_STYLES.NATURAL_FUSION,
        partial: true,
        howToQualification: HOW_TO_QUALIFICATIONS.AMBIGUOUS,
      }
    : null;
}

/**
 * @param {ReturnType<import("../../policies/requestDecompositionPolicy.js").decomposeRequest>} decomposition
 * @returns {{ reply: string, surfaceStyle: string, partial?: boolean }|null}
 */
export function buildMultiUnitCompositeReply(decomposition) {
  if (canServeMultiUnitComposite(decomposition)) {
    const style = resolveMultiUnitSurfaceStyle(decomposition);
    if (style === MULTI_UNIT_SURFACE_STYLES.NATURAL_FUSION) {
      return buildNaturalFusionReply(decomposition);
    }
    return buildSectionedReply(decomposition);
  }
  return buildMultiUnitPartialReply(decomposition);
}

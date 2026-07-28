import { detectCavemanLevel } from "../../utils/intentGuards.js";

/**
 * Mode économie tokens serveur — Caveman instruction LITE si le tour est compatible.
 * Valeurs truthy : 1, true, yes, on (insensible à la casse).
 */
export function isLowTokenModeEnabled() {
  const raw = String(process.env.NEXXUS_LOW_TOKEN_MODE ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Niveau Caveman effectif pour composeCapabilityContext (requête > option > env).
 * @param {{ query?: string, optionLevel?: string }} [params]
 * @returns {string}
 */
export function resolvePipelineCavemanLevel({ query = "", optionLevel = "NORMAL" } = {}) {
  const detected = detectCavemanLevel(query);
  if (detected !== "NORMAL") return detected;

  const opt = String(optionLevel || "NORMAL").toUpperCase();
  if (opt !== "NORMAL") return opt;

  if (isLowTokenModeEnabled()) return "LITE";

  return "NORMAL";
}

/**
 * Ligne console orchestration — env ≠ instruction activée.
 * @param {{
 *   lowTokenModeEnabled: boolean,
 *   cavemanLevelEffective: string,
 *   cavemanActive?: boolean,
 *   cavemanWhy?: string[],
 * }} params
 * @returns {string|null}
 */
export function formatLowTokenModeObservabilityStep(params = {}) {
  if (!params.lowTokenModeEnabled) return null;
  const level = String(params.cavemanLevelEffective || "NORMAL").toUpperCase();
  const instr = params.cavemanActive ? "on" : "off";
  const why =
    !params.cavemanActive && params.cavemanWhy?.[0]
      ? ` (${params.cavemanWhy[0]})`
      : "";
  return (
    `🪶 Low token : low_token_mode=on · caveman_level_effective=${level} · ` +
    `caveman_instruction=${instr}${why}`
  );
}

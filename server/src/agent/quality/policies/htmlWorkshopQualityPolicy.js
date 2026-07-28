/**
 * Adaptateur HTML_WORKSHOP_QUALITY_V1 → ContractQualityLoop.
 */
import {
  HTML_WORKSHOP_QUALITY_CONTRACT_ID,
  isHtmlWorkshopDeliverable,
  evaluateHtmlWorkshopQuality,
  buildHtmlWorkshopRepairUserAddon,
} from "../../policies/htmlWorkshopDeliveryContract.js";
import { isCodeProjectLightRequest } from "../../policies/codeProjectLightPolicy.js";
import { defineContractQualityPolicy } from "../contractQualityLoop.js";

export const htmlWorkshopQualityPolicy = defineContractQualityPolicy({
  id: HTML_WORKSHOP_QUALITY_CONTRACT_ID,
  maxRepairs: 1,
  applies: (ctx) => {
    const query = ctx?.query || "";
    // CPL a sa propre boucle FRONT_PRESENTATION — éviter double repair.
    if (isCodeProjectLightRequest(query)) return false;
    return isHtmlWorkshopDeliverable(query);
  },
  validate: (draft, ctx) => evaluateHtmlWorkshopQuality(ctx?.query || "", draft),
  buildRepairAddon: (quality) => buildHtmlWorkshopRepairUserAddon(quality),
  shouldRepair: (quality) => quality?.quality === "fail",
  // Pas de blocage composer : le fallback déterministe reste hors-loop (comportement historique).
  shouldBlock: () => false,
  shouldAcceptRepair: (next, prev, _ctx) => {
    if (next?.quality === "pass") return true;
    const nextScore = Number(next?.score);
    const prevScore = Number(prev?.score);
    if (Number.isFinite(nextScore) && Number.isFinite(prevScore) && nextScore > prevScore) {
      return true;
    }
    const nextReasons = Array.isArray(next?.reasons) ? next.reasons.length : 99;
    const prevReasons = Array.isArray(prev?.reasons) ? prev.reasons.length : 99;
    return nextReasons < prevReasons;
  },
});

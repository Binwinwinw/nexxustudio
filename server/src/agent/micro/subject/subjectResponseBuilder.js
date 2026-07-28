import { SUBJECT_NATURES } from "./subjectIntelligenceLayer.js";
import { shouldAffirmResolution } from "./subjectConfidence.js";
import { usageGuidanceLine } from "./subjectUsageIntent.js";
import { DETERMINISTIC_ROUTES } from "./subjectRoutingHints.js";
import { shouldBypassForgeSubjectClarification } from "../../utils/queryEntityUnderstanding.js";
import { isGeneralKnowledgeRequest } from "../../utils/generalKnowledgeIntentGuards.js";

/**
 * Response Builder — texte utilisateur à partir de l'état interprété (pas de résolution ici).
 * @param {object} state
 * @param {object} [ambiguity]
 * @param {{ routeHint?: string|null }} [meta]
 */
export function buildSubjectClarificationReply(state = {}, ambiguity = {}, meta = {}) {
  const probeQuery = meta.query || state.target || state.entity?.label || "";
  if (
    isGeneralKnowledgeRequest(probeQuery) ||
    shouldBypassForgeSubjectClarification(probeQuery)
  ) {
    return null;
  }

  const { nature, target, entity, confidence, usage, ambiguous, alternateSenses } =
    state;
  const label = entity?.label || target || "ce sujet";
  const affirm = shouldAffirmResolution(confidence);
  const leadVerb = affirm ? "correspond à" : "semble correspondre à";
  const usageLine = usageGuidanceLine(usage, { installKind: state.installKind ?? null });

  if (ambiguity?.mustClarify && ambiguous && alternateSenses?.length) {
    const senses = alternateSenses
      .map((s, i) => `${i + 1}. **${s.kind}** — ${s.definition}`)
      .join("\n");
    return [
      `**${label}** : plusieurs interprétations possibles :`,
      "",
      senses,
      "",
      usageLine || "Précise laquelle tu vises (IDE, phénomène, projet interne…).",
      "",
      "Je n'appliquerai pas une procédure « projet → Forge » tant que le sujet n'est pas clarifié.",
    ].join("\n");
  }

  if (nature === SUBJECT_NATURES.PUBLIC_KNOWN && entity) {
    if (entity.kind === "video_game_franchise" || entity.kind === "video_game") {
      const routeNote =
        meta.routeHint === DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER
          ? "Chemin prévu : guide de lancement (plateforme à préciser)."
          : null;
      return [
        affirm
          ? `**${entity.label}** ${leadVerb} ${entity.definition}.`
          : `**${entity.label}** ${leadVerb} ${entity.definition} (confiance ${confidence}).`,
        "",
        usageLine || "",
        routeNote || "",
        "",
        "Ce n'est pas un « projet Nexxus / handoff Forge » au sens de La Citadelle.",
        affirm
          ? "Pour **lancer ou installer le jeu**, indique la plateforme (Steam, console, EA App…)."
          : "Si tu veux **lancer ou installer**, indique la plateforme — je peux détailler ensuite.",
        "",
        "Si tu parlais de **déclencher la Forge** sur un projet interne, reformule avec « projet » ou « forge ».",
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (entity.kind === "software_platform") {
      return [
        `**${entity.label}** : ${entity.definition}.`,
        usageLine || "Précise ton OS et l'action (installer, lancer un jeu, etc.).",
      ].join("\n");
    }

    return [
      `**${entity.label}** : ${entity.definition}.`,
      usageLine || "",
      affirm
        ? "Sujet externe au pipeline interne — pas de procédure Forge générique ici."
        : "Probable sujet externe — confirme l'action souhaitée.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (nature === SUBJECT_NATURES.UNRESOLVED_PROPER) {
    return [
      `Tu mentionnes **${label}** — avant une réponse directe, je dois clarifier de quoi il s'agit.`,
      usageLine || "",
      "Projet interne (Nexxus / Forge), logiciel, jeu, commande, ou autre ?",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (ambiguity?.mustClarify) {
    return [
      `Le sujet **${label}** n'est pas résolu avec assez de certitude (${ambiguity.reason || "ambiguïté"}).`,
      usageLine || "Précise le contexte ou reformule.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return null;
}

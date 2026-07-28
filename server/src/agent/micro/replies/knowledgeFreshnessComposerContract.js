/**
 * Contrat composer — divulgation temporelle + grounding web anti-hallucination versions.
 */
import {
  assessKnowledgeFreshnessRisk,
  extractWebVerificationLabel,
  hasSuccessfulWebGrounding,
  requiresBridgedFreshnessFallback,
} from "../../policies/knowledgeFreshnessPolicy.js";
import {
  isExplicitWebSearchRequest,
  wasWebSearchSkippedByContract,
} from "../../policies/explicitWebSearchRequestPolicy.js";

export const KNOWLEDGE_FRESHNESS_COMPOSER_RULE =
  "temporal_disclosure_and_verified_refresh";

/**
 * @param {string} query
 * @param {object} [packet]
 */
export function requiresKnowledgeFreshnessComposerContract(query = "", packet = {}) {
  const hasWeb = (packet?.expert_outputs || []).some((o) => o?.stage === "web_research");
  const assessment = assessKnowledgeFreshnessRisk(query);
  return assessment.temporalDisclosureRequired || hasWeb;
}

export function buildKnowledgeFreshnessSystemAddon(query = "", packet = {}) {
  const assessment = assessKnowledgeFreshnessRisk(query);
  const today = assessment.referenceDateLabel;
  const webLabel = extractWebVerificationLabel(packet);
  const hasWeb = hasSuccessfulWebGrounding(packet);
  const bridged = requiresBridgedFreshnessFallback(query, packet);

  const lines = [
    "VARIANTE FRAÎCHEUR TEMPORELLE (date du jour dynamique) :",
    `- Date de référence système : **${today}**. Ne jamais figer une année arbitraire dans le code — toujours « à ce jour ».`,
  ];

  if (hasWeb) {
    lines.push(
      `- Des sources web ont été consultées${webLabel ? ` (dernière trace : ${webLabel})` : ""}.`,
      "- Commencer par : « Informations vérifiées à partir de sources récentes… » puis le comparatif/synthèse.",
      "- Ancrer specs, versions, modèles, prix UNIQUEMENT sur le contexte web fourni — pas d'invention.",
    );
  } else if (wasWebSearchSkippedByContract(packet) && isExplicitWebSearchRequest(query)) {
    lines.push(
      "- MODE REFUS HONNÊTE (recherche web demandée mais indisponible dans ce contexte) :",
      "- Commencer par : « Je ne peux pas consulter le web depuis ce contexte. »",
      "- INTERDIT : « Je n'ai pas pu vérifier » comme si une tentative avait échoué.",
      "- AUTORISÉ : repères généraux sur les gammes, avec mention claire que prix/modèles peuvent être dépassés.",
      "- INTERDIT : numéros de modèle précis, prix exacts, specs chiffrées non sourcées.",
    );
  } else if (bridged) {
    lines.push(
      "- MODE FALLBACK BRIDÉ (refresh web tenté, sources non récupérées) :",
      "- Commencer par : « D'après mes connaissances de base (qui peuvent avoir évolué depuis)… »",
      "- Ajouter : « Je n'ai pas pu vérifier les données les plus récentes ; voici une comparaison qualitative. »",
      "- INTERDIT : numéros de modèle précis, MP/mAh/Go, versions OS, prix exacts, années de sortie non sourcées.",
      "- AUTORISÉ : critères de choix, forces/faiblesses générales, usages, philosophie produit, conseil selon profil.",
      "- Si une spec chiffrée est indispensable : indiquer l'incertitude au lieu d'inventer.",
    );
  } else if (assessment.isFreshnessSensitive) {
    lines.push(
      "- Commencer par : « D'après mes connaissances de base (qui peuvent avoir évolué depuis)… »",
      "- Ajouter une phrase courte : « Ces informations peuvent avoir changé ; une vérification récente est recommandée. »",
      "- Éviter les chiffres précis non sourcés (versions, modèles, prix).",
      "- Si tu n'es pas certain d'une spec : dis-le explicitement au lieu d'halluciner.",
    );
  } else {
    lines.push("- Sujet relativement stable : pas d'alourdir avec des avertissements temporels inutiles.");
  }

  lines.push(
    "- INTERDIT : « récemment » sans repère de date.",
    "- Si comparatif : conclure sur les critères utilisateur, pas une liste de mots-clés.",
  );

  return lines.join("\n");
}

export function buildKnowledgeFreshnessUserAddon(query = "", packet = {}) {
  const webBlock = (packet?.expert_outputs || [])
    .filter((o) => o?.stage === "web_research" && o?.content)
    .map((o) => String(o.content).trim())
    .join("\n\n")
    .slice(0, 4000);

  if (!webBlock) return "";

  return `SOURCES WEB CONSULTÉES (grounding obligatoire pour specs/versions/prix) :
${webBlock}

CONSIGNE : n'utilise que les faits présents ci-dessus pour les données mouvantes.`;
}

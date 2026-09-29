/**
 * Composer transitoire — DOCUMENTARY_WEB_COLLECTION.
 * Collecte confirmée + continuité. Pas de rapport FACTUAL, pas de fiches.
 */

export const DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID =
  "DOCUMENTARY_WEB_COLLECTION";

/**
 * @param {string} [_query]
 * @param {{ meta?: object }} [packet]
 * @returns {boolean}
 */
export function requiresDocumentaryWebCollectionComposerContract(
  _query = "",
  packet = {},
) {
  return packet?.meta?.intent_contract_id === DOCUMENTARY_WEB_COLLECTION_CONTRACT_ID;
}

/**
 * @param {object} [packet]
 * @returns {string}
 */
export function buildDocumentaryWebCollectionSystemAddon(packet = {}) {
  const sources = (packet.evidence || [])
    .filter((e) => e?.source)
    .slice(0, 8)
    .map((e, i) => {
      const excerpt = e.excerpt
        ? String(e.excerpt).replace(/\s+/g, " ").trim().slice(0, 120)
        : "";
      return `[${i + 1}] ${e.source}${excerpt ? ` — ${excerpt}` : ""}`;
    });

  const sourceBlock =
    sources.length > 0
      ? ["Preuves collectées :", ...sources].join("\n")
      : "Aucune preuve web n'est encore disponible dans le paquet.";

  return [
    "VARIANTE COLLECTE DOCUMENTAIRE TRANSITOIRE :",
    "- Confirme que la recherche web a été lancée au service d'un mandat documentaire déjà actif.",
    "- Présente de façon minimale le résultat de la collecte.",
    "- Le mandat documentaire reste ouvert : ne le consomme pas, ne le recopie pas.",
    "- INTERDIT : rapport factuel autonome, titres P5 (Résumé Exécutif, Analyse de Marché, Analyse Concurrentielle, Opportunités de Croissance).",
    "- INTERDIT : prétendre produire les fiches pédagogiques complètes.",
    "- INTERDIT : inventer des sources absentes des preuves.",
    sourceBlock,
  ].join("\n");
}

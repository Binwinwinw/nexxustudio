/**
 * EXPERT WEB SEARCH — Agent de Recherche Factuelle Souverain
 * Version 1.0 — Duck-duck-scrape + ADR-011
 *
 * Contrat de sortie strict :
 * - Ne répond JAMAIS directement à l'utilisateur
 * - Retourne un packet structuré vers l'orchestrateur
 * - Toutes les sources sont journalisées
 */
import { webSearch } from "../../services/webSearchService.js";
import {
  normalizeWebResults,
  computeOverallConfidence,
  buildRawSummary,
} from "../normalizers/webEvidenceNormalizer.js";
import { MAX_RESULTS, rankFactualResearchSources } from "../policies/web/index.js";
import {
  resolveGuidedProductWebSearchLimits,
  applyProductRecoValidationToWebPacket,
} from "../policies/guided/index.js";
import { extractProductRecommendationSlots } from "../policies/routing/compareChooseCompositePolicy.js";
import { sanitizeWebSearchPacket } from "../../services/tool-output-sanitizer.js";

/**
 * Packet de sortie standard de l'expert.
 * @typedef {object} WebSearchPacket
 * @property {string} expert - Nom de l'expert
 * @property {string} query - La requête effectuée
 * @property {Array} sources - Les résultats de la recherche
 * @property {string} summary - Résumé des résultats
 * @property {number} confidence - Confiance globale des résultats
 * @property {boolean} requires_human_caution - Indique si une attention humaine est requise
 * @property {string|null} failure_mode - Mode d'échec (si applicable)
 */
export const expertWebSearch = {
  id: "expert_web_search",

  /**
   * Point d'entrée principal de l'expert.
   * Reçoit une requête, effectue la recherche web, normalise les preuves.
   *
   * @param {object} queryEnvelope - Enveloppe de requête de l'orchestrateur
   * @param {object} [context] - Contexte optionnel (session, mémoire)
   * @returns {Promise<WebSearchPacket>}
   */
  async run(queryEnvelope, context = {}) {
    const query = queryEnvelope?.query || queryEnvelope?.message || "";
    const startTime = Date.now();
    const maxResults = context.maxResults || MAX_RESULTS;
    const timeoutMs = context.timeoutMs || undefined;

    console.log(
      `[ExpertWebSearch] Démarrage pour query: "${query}" (maxResults=${maxResults})`,
    );

    if (!query.trim()) {
      return this._buildPacket(query, [], "empty_query");
    }

    try {
      // 1. Recherche web avec garde-fous ADR-011
      const { results: rawResults, failure_mode: searchFailure } =
        await webSearch(query, {
          maxResults,
          locale: "fr-fr",
          timeoutMs,
        });

      // 2. Normalisation des résultats
      let sources = normalizeWebResults(rawResults, maxResults);

      // P4 — ranking sectoriel vs blogs légers (FACTUAL_RESEARCH)
      if (context.factualResearchRank) {
        const ranked = rankFactualResearchSources(sources, { maxResults });
        sources = ranked.sources;
        if (ranked.demotedDropped > 0 || ranked.boosted > 0) {
          console.log(
            `[ExpertWebSearch] factual_rank boosted=${ranked.boosted} demotedDropped=${ranked.demotedDropped}`,
          );
        }
      }

      // 3. Calcul de confiance globale
      const confidence = computeOverallConfidence(sources);

      // 4. Génération du résumé brut pour l'orchestrateur
      const summary = buildRawSummary(query, sources);
      const elapsed = Date.now() - startTime;

      console.log(
        `[ExpertWebSearch] Terminé en ${elapsed}ms — ${sources.length} sources, confiance: ${confidence}`,
      );

      // 5. Journalisation des URLs consultées (audit obligatoire ADR-011)
      if (sources.length > 0) {
        console.log(
          "[ExpertWebSearch] Sources journalisées:",
          sources.map((s) => s.url).join(", "),
        );
      }

      const packet = this._buildPacket(query, sources, searchFailure);
      packet.summary = summary;
      packet.confidence = confidence;
      packet.elapsed_ms = elapsed;

      const { packet: sanitized, audit } = sanitizeWebSearchPacket(packet);

      if (audit.sourcesRemoved > 0) {
        console.warn(
          `[ExpertWebSearch] ${audit.sourcesRemoved} source(s) bloquée(s) (egress).`,
        );
      }

      return sanitized;
    } catch (err) {
      console.error(`[ExpertWebSearch] Erreur fatale: ${err.message}`);
      return this._buildPacket(query, [], `fatal_error: ${err.message}`);
    }
  },

  /**
   * Construit le packet de sortie standardisé.
   * @private
   */
  _buildPacket(query, sources, failureMode = null) {
    const confidence = computeOverallConfidence(sources);
    const requiresCaution = confidence < 0.5 || sources.length === 0;

    return {
      expert: "expert_web_search",
      query,
      sources,
      summary:
        sources.length > 0
          ? buildRawSummary(query, sources)
          : `Aucune source trouvée pour : "${query}"`,
      confidence,
      requires_human_caution: requiresCaution,
      failure_mode: failureMode,
      stage: "web_research",
      content:
        sources.length > 0
          ? buildRawSummary(query, sources)
          : `Recherche web infructueuse pour : "${query}". Raison: ${failureMode || "inconnue"}`,
    };
  },
};

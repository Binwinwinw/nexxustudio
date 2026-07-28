import { webSearch } from '../services/webSearchService.js';
import { summarizeWebPage } from '../services/webSummarizer.js';
import { sanitizeToolOutput } from '../services/tool-output-sanitizer.js';

/**
 * Outil de recherche Web pour Nexxus Citadel.
 * Permet d'obtenir des informations fraîches et de réduire les hallucinations.
 */
class SearchTool {
  /**
   * Effectue une recherche web.
   * @param {string} query - La requête de recherche.
   * @param {number} limit - Nombre de résultats maximum (défaut: 5).
   */
  async search(query, limit = 5) {
    try {
      console.log(`[SearchTool] 🌐 Searching the web (ADR-011 Compliant) for: "${query}"...`);
      
      const { results, failure_mode } = await webSearch(query, { maxResults: limit });

      if (!results || results.length === 0) {
        return `Aucun résultat trouvé sur le web. (Raison: ${failure_mode || 'aucun résultat'})`;
      }

      // Formatage des résultats pour l'IA
      const formattedResults = results.map((res, index) => {
        const snippet = res.description || res.snippet || res.body || '';
        return `[${index + 1}] ${res.title}\nURL: ${res.url}\nSnippet: ${snippet}\n`;
      }).join('\n');

      return sanitizeToolOutput(
        `--- RÉSULTATS DE RECHERCHE WEB POUR : "${query}" ---\n${formattedResults}\n--- FIN DES RÉSULTATS ---`,
        'search-tool',
      ).text;
    } catch (error) {
      console.error("[SearchTool] Error:", error);
      return `Désolé, une erreur est survenue lors de la recherche : ${error.message}`;
    }
  }

  /**
   * Résume une page web.
   * @param {string} url - L'URL à résumer.
   */
  async summarize(url) {
    console.log(`[SearchTool] 📖 Summarizing web page: "${url}"...`);
    const result = await summarizeWebPage(url);
    if (result.success) {
      const crypto = await import('crypto');
      const hash = crypto.createHash('md5').update(result.summary).digest('hex').slice(0, 8);
      const proofId = `web_${hash}`;
      
      return sanitizeToolOutput(
        `--- RÉSUMÉ DE LA PAGE : ${result.title} ---
Source: ${result.url}
Proof_ID: ${proofId}
Extraction_Hash: ${hash}

${result.summary}
--- FIN DU RÉSUMÉ ---`,
        'search-tool-summary',
      ).text;
    } else {
      return `Erreur lors de la lecture de la page : ${result.error}`;
    }
  }
}

export default new SearchTool();

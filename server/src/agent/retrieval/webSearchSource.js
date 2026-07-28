import { expertWebSearch } from "../agents/expertWebSearch.js";

/**
 * ADAPTATEUR DE SOURCE RECHERCHE WEB
 * Intègre la recherche web DuckDuckGo (via expertWebSearch)
 * dans le retrievalAgent sous forme d'EvidenceRecords normalisés.
 */
export default {
  async search(queryEnvelope, routingDecision) {
    const startTime = Date.now();
    const query = queryEnvelope?.user_query || queryEnvelope?.query || "";
    
    console.log(`[WebSearchSource] Lancement de la recherche web pour : "${query}"`);
    
    try {
      const webPacket = await expertWebSearch.run(queryEnvelope);
      if (!webPacket || !webPacket.sources || webPacket.sources.length === 0) {
        console.log("[WebSearchSource] Aucun résultat de recherche web ou erreur.");
        return [];
      }

      console.log(`[WebSearchSource] Recherche terminée en ${Date.now() - startTime}ms. ${webPacket.sources.length} sources normalisées en EvidenceRecords.`);

      return webPacket.sources.map((s, index) => {
        // Encodage propre du locator.url pour correspondre à notre politique d'audit
        const safeUrl = s.url || "";
        const hash = Buffer.from(safeUrl).toString("base64").substring(0, 16);

        return {
          evidence_id: `ev_web_${Date.now()}_${index}`,
          source_type: "web",
          source_name: s.title || "Résultat de recherche web",
          locator: { url: safeUrl },
          captured_at: s.consulted_at || new Date().toISOString(),
          content: `${s.title}\nURL: ${safeUrl}\n\nSnippet: ${s.snippet}`,
          hash: `hash_${hash}`,
          trust_level: s.confidence >= 0.8 ? "high" : s.confidence >= 0.6 ? "medium" : "low",
          observed_by: "expert_web_search"
        };
      });
    } catch (err) {
      console.error(`[WebSearchSource] Échec lors de la recherche web : ${err.message}`);
      return [];
    }
  }
};

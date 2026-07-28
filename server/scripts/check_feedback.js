import knowledgeHub from '../src/services/knowledgeHub.js';

async function checkFeedback() {
    console.log("🔍 Recherche de souvenirs de télémétrie dans ChromaDB...");
    try {
        const results = await knowledgeHub.query("TEST_MANUEL_FEEDBACK", 10, { type: 'telemetry_feedback' });
        
        if (results && results.length > 0) {
            console.log(`✅ ${results.length} souvenir(s) trouvé(s) !`);
            results.forEach((r, i) => {
                console.log(`\n--- Souvenir #${i+1} ---`);
                console.log(`ID: ${r.id}`);
                console.log(`Contenu: ${r.content}`);
                console.log(`Métadonnées: ${JSON.stringify(r.metadata)}`);
            });
        } else {
            console.log("❌ Aucun souvenir de télémétrie trouvé dans ChromaDB.");
        }
    } catch (err) {
        console.error("❌ Erreur lors de l'interrogation de ChromaDB:", err.message);
    }
}

checkFeedback();

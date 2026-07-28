import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || 'nexxus-local-dev';

async function testExplainableRouting() {
    console.log("🛠️ TEST ROUTAGE EXPLICABLE : Envoi d'une requête complexe...");
    
    const testPayload = {
        query: "Explique-moi le rôle de l'expert Analyst Elite dans la Citadelle.",
        sessionId: "test-routing-session-" + Date.now()
    };

    try {
        const response = await axios.post('http://localhost:3000/api/chat', testPayload, {
            headers: { 'X-API-Token': INTERNAL_TOKEN },
            responseType: 'stream' 
        });

        let finalEvent = null;

        response.data.on('data', chunk => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const content = line.substring(6).trim();
                    if (content === '[DONE]') {
                        console.log("➡️ Reçu : [DONE]");
                        continue;
                    }
                    try {
                        const data = JSON.parse(content);
                        if (data.step) console.log(`➡️ Step : ${data.step}`);
                        if (data.done) {
                            console.log("➡️ Reçu l'événement de fin !");
                            finalEvent = data;
                        }
                    } catch (e) {
                        // Ignorer les fragments JSON incomplets
                    }
                }
            }
        });

        response.data.on('end', () => {
            if (finalEvent && finalEvent.explanation) {
                console.log("\n🧠 DÉCISION COGNITIVE EXPLIQUÉE :");
                console.log("-----------------------------------------");
                console.log(`Expert Sélectionné : ${finalEvent.explanation.expert}`);
                console.log(`Raison du choix    : ${finalEvent.explanation.rationale}`);
                console.log(`Mémoire / Feedback : ${finalEvent.explanation.memoryImpact}`);
                console.log(`Contraintes        : ${finalEvent.explanation.constraints}`);
                console.log(`Score de Confiance : ${finalEvent.explanation.confidenceScore}`);
                console.log("-----------------------------------------");
                console.log("✅ SUCCÈS : Le bloc d'explicabilité est présent et structuré.");
            } else {
                console.error("❌ ÉCHEC : Aucun bloc d'explication trouvé dans la réponse finale.");
                console.log("Dernier événement reçu :", finalEvent);
            }
        });

    } catch (error) {
        console.error("❌ Erreur lors du test:", error.message);
        if (error.response) console.error("Détails:", error.response.data);
    }
}

testExplainableRouting();

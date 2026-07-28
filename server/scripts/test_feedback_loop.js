import axios from 'axios';

const query = "Comment optimiser les schémas de collection ChromaDB pour une recherche sémantique multi-projets ?";
const sessionId = "feedback-test-" + Date.now();

async function runTest() {
    console.log("🚀 TOUR 1 : Génération d'un incident de performance...");
    const start1 = Date.now();
    
    try {
        // On envoie la requête
        const res1 = await axios.post('http://localhost:3000/api/chat', {
            query: query,
            sessionId: sessionId,
            isNewThread: true
        });

        const duration1 = (Date.now() - start1) / 1000;
        console.log(`✅ Tour 1 terminé en ${duration1.toFixed(2)}s.`);
        
        // 🛡️ RÉCUPÉRATION DU COOKIE DE SESSION
        const cookies = res1.headers['set-cookie'];
        const browserCookie = cookies ? cookies[0] : null;

        console.log("\n⏳ Attente de la persistance (2s)...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("\n🚀 TOUR 2 : Vérification de l'apprentissage (R -> N)...");
        const start2 = Date.now();
        const res2 = await axios.post('http://localhost:3000/api/chat', {
            query: query,
            sessionId: sessionId,
            isNewThread: false
        }, {
            headers: {
                'Cookie': browserCookie // On renvoie le cookie pour être autorisé
            }
        });

        const duration2 = (Date.now() - start2) / 1000;
        console.log(`✅ Tour 2 terminé en ${duration2.toFixed(2)}s.`);
        console.log(`📝 Résultat (preview): "${res2.data?.result?.substring(0, 150)}..."`);

        console.log("\n🔍 ANALYSE : Le Tour 2 a-t-il été plus rapide ou a-t-il mentionné les incidents passés dans les logs ?");

    } catch (error) {
        console.error("❌ Erreur pendant le test:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

runTest();

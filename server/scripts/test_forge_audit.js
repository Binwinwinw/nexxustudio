import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || 'nexxus-local-dev';

async function runForgeAuditTest() {
    console.log("🛠️ TEST FORGE : Lancement de l'Audit d'Impact avec X-API-Token...");
    
    const testPayload = {
        query: "Comment optimiser les schémas de collection ChromaDB pour une recherche sémantique multi-projets ?",
        score: 85 // On simule une maturité haute
    };

    try {
        const response = await axios.post('http://localhost:3000/api/forge/audit', testPayload, {
            headers: { 'X-API-Token': INTERNAL_TOKEN }
        });

        console.log("\n📊 RAPPORT D'AUDIT FORGE-READY :");
        console.log("-----------------------------------------");
        console.log(JSON.stringify(response.data, null, 2));
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("❌ Échec du test d'audit:", error.message);
        if (error.response) console.error("Détails:", error.response.data);
    }
}

runForgeAuditTest();

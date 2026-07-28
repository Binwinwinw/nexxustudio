import axios from 'axios';

const sessionId = "val-cockpit-" + Date.now();
const API_URL = 'http://localhost:3000/api/telemetry/cockpit';
const TOKEN = 'nexxus-local-dev';

async function validateCockpit() {
    console.log("🔍 DÉMARRAGE DE L'AUDIT COCKPIT v3.1...");
    
    try {
        console.log(`📡 Interrogation de l'API : ${API_URL}`);
        const start = Date.now();
        const res = await axios.get(`${API_URL}?sessionId=${sessionId}`, {
            headers: { 'x-api-token': TOKEN }
        });
        const duration = Date.now() - start;

        const data = res.data;
        let errors = [];

        // 1. Validation de la Santé (Health)
        if (!data.health) errors.push("Zone 'health' manquante.");
        else {
            console.log(`✅ Santé : Latence ${data.health.latency}ms, VRAM ${data.health.vram?.percent}%`);
            if (typeof data.health.latency !== 'number') errors.push("Latence non numérique.");
        }

        // 2. Validation du Routage (Routing)
        if (!data.routing) errors.push("Zone 'routing' manquante.");
        else {
            console.log(`✅ Routage : Dernier expert '${data.routing.lastExpert}', Confiance ${(data.routing.confidence * 100).toFixed(0)}%`);
        }

        // 3. Validation de la Maturité (Maturity)
        if (!data.maturity) errors.push("Zone 'maturity' manquante.");
        else {
            console.log(`✅ Maturité : Phase '${data.maturity.phase}', Score ${data.maturity.score}%`);
        }

        // 4. Validation de la Gouvernance (Governance)
        if (!data.governance) errors.push("Zone 'governance' manquante.");
        else {
            console.log(`✅ Gouvernance : Niveau '${data.governance.sovereigntyLevel}', Blocs ${data.governance.blockedCount}`);
        }

        // 5. Validation des Incidents
        if (!Array.isArray(data.incidents)) errors.push("Zone 'incidents' doit être un tableau.");
        else {
            console.log(`✅ Incidents : ${data.incidents.length} signalés.`);
        }

        if (errors.length === 0) {
            console.log("\n✨ CERTIFICATION BACKEND : OK");
            console.log(`📊 Performance API : ${duration}ms (Seuil < 2500ms)`);
        } else {
            console.log("\n❌ ÉCHEC DE LA CERTIFICATION :");
            errors.forEach(e => console.log(`   - ${e}`));
        }

    } catch (error) {
        console.error("❌ ERREUR CRITIQUE API :", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

validateCockpit();

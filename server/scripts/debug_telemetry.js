import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function debugTelemetry() {
    console.log("🔍 DIAGNOSTIC TÉLÉMÉTRIE...");
    
    try {
        const graphPath = path.join(__dirname, '..', '..', 'citadelle-vault', 'Citadelle', '02-Architecture', 'diagrams', 'citadel-graph-v1.json');
        console.log(`📡 Chemin du graphe : ${graphPath}`);
        
        if (!fs.existsSync(graphPath)) {
            console.log("❌ Le fichier n'existe pas !");
            return;
        }

        const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
        const nodesCount = graphData.nodes.length;
        const edgesCount = graphData.edges.length;
        const density = nodesCount > 1 ? (edgesCount / (nodesCount * (nodesCount - 1) / 2)).toFixed(2) : 0;

        const graphHealth = { 
          density, 
          nodes: nodesCount, 
          edges: edgesCount, 
          status: density > 0.1 ? 'Healthy' : 'Fragmented' 
        };

        console.log("✅ Métriques calculées :", JSON.stringify(graphHealth, null, 2));

    } catch (error) {
        console.error("🔥 ERREUR DÉTECTÉE :", error.message);
        console.error(error.stack);
    }
}

debugTelemetry();

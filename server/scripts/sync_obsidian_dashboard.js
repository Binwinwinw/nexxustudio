import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const GRAPH_PATH = path.join(ROOT, 'citadelle-vault', 'Citadelle', '02-Architecture', 'diagrams', 'citadel-graph-v1.json');
const DASHBOARD_PATH = path.join(ROOT, 'citadelle-vault', 'Citadelle', 'Bienvenue.md');

async function syncDashboard() {
    console.log("🔄 SYNC : Mise à jour du Dashboard Mémoire...");
    
    try {
        // 1. Lire le Graphe
        if (!fs.existsSync(GRAPH_PATH)) throw new Error("Graphe introuvable");
        const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
        
        const nodes = graph.nodes.length;
        const edges = graph.edges.length;
        const density = nodes > 1 ? (edges / (nodes * (nodes - 1) / 2)).toFixed(2) : 0;
        const status = density > 0.1 ? "🟢 Healthy" : "🟠 Fragmented";

        // 2. Lire le Dashboard
        let content = fs.readFileSync(DASHBOARD_PATH, 'utf8');

        // 3. Injection Chirurgicale (Regex)
        const densityRegex = /- \*\*Densité du Savoir\*\* : .*/;
        const structureRegex = /- \*\*Structure\*\* : .*/;

        content = content.replace(densityRegex, `- **Densité du Savoir** : ${status === "🟢 Healthy" ? "🟢" : "🟠"} ${density} (${status.split(' ')[1]} - Expansion en cours)`);
        content = content.replace(structureRegex, `- **Structure** : [[02-Architecture/diagrams/citadel-graph-v1.json|📊 Graphe Relationnel v1.0]] (${nodes} Noeuds / ${edges} Arêtes)`);

        // 4. Sauvegarde
        fs.writeFileSync(DASHBOARD_PATH, content);
        console.log(`✅ SYNC : Dashboard mis à jour (Densité: ${density}, Noeuds: ${nodes})`);

        // --- PARTIE 2: COCKPIT GOUVERNANCE ---
        console.log("🔄 SYNC : Mise à jour du Cockpit Gouvernance...");
        const MEMOIRE_PATH = path.join(ROOT, 'citadelle-vault', 'Citadelle', '05-Knowledge', 'heritage', 'Memoire-des-Erreurs.md');
        const COCKPIT_PATH = path.join(ROOT, 'citadelle-vault', 'Citadelle', '01-Strategy', 'Cockpit-Gouvernance.md');

        if (fs.existsSync(MEMOIRE_PATH) && fs.existsSync(COCKPIT_PATH)) {
            const memoireContent = fs.readFileSync(MEMOIRE_PATH, 'utf8');
            const lines = memoireContent.split('\n');
            const motives = {};
            let totalIncidents = 0;
            
            for (const line of lines) {
                if (line.startsWith('- **Motif de Rejet** :') && !line.includes('[Nom exact du guard')) {
                    totalIncidents++;
                    const parts = line.replace('- **Motif de Rejet** :', '').trim().split('/');
                    parts.forEach(p => {
                        const m = p.trim().replace(/`/g, '');
                        if (m) motives[m] = (motives[m] || 0) + 1;
                    });
                }
            }

            // Tri décroissant
            const sortedMotives = Object.entries(motives).sort((a, b) => b[1] - a[1]);

            // Top 3 Callouts
            let topCallouts = '';
            const top3 = sortedMotives.slice(0, 3);
            if (top3.length > 0) {
                topCallouts += `> [!WARNING] Top Dérives\n`;
                top3.forEach((item, index) => {
                    topCallouts += `> ${index + 1}. **${item[0]}** (${item[1]} occurrences)\n`;
                });
                topCallouts += '\n';
            }

            // Mermaid Pie Chart
            let pieChart = '```mermaid\npie title Répartition des Dérives\n';
            const top5 = sortedMotives.slice(0, 5);
            const others = sortedMotives.slice(5);
            let othersCount = 0;
            
            top5.forEach(item => {
                pieChart += `    "${item[0]}" : ${item[1]}\n`;
            });
            if (others.length > 0) {
                others.forEach(item => { othersCount += item[1]; });
                pieChart += `    "Autres" : ${othersCount}\n`;
            }
            pieChart += '```\n\n';

            // Tableau complet
            let metricsStr = `**Total Incidents Scellés** : ${totalIncidents}\n\n`;
            metricsStr += topCallouts + pieChart;
            metricsStr += `### Registre Détaillé\n\n| Motif de Rejet | Occurrences |\n|---|---|\n`;
            
            for (const [motive, count] of sortedMotives) {
                metricsStr += `| \`${motive}\` | ${count} |\n`;
            }

            let cockpitContent = fs.readFileSync(COCKPIT_PATH, 'utf8');
            const metricsRegex = /<!-- METRICS_START -->[\s\S]*<!-- METRICS_END -->/;
            cockpitContent = cockpitContent.replace(metricsRegex, `<!-- METRICS_START -->\n${metricsStr}\n<!-- METRICS_END -->`);
            fs.writeFileSync(COCKPIT_PATH, cockpitContent);
            console.log(`✅ SYNC : Cockpit Gouvernance mis à jour (${totalIncidents} incidents)`);
        }

    } catch (error) {
        console.error("❌ SYNC : Échec de la synchronisation :", error.message);
    }
}

syncDashboard();

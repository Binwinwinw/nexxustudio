import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const METRICS_PATH = path.join(ROOT, 'server', 'data', 'telemetry_metrics.json');
const DASHBOARD_PATH = path.join(ROOT, 'citadelle-vault', 'Citadelle', '04-Operations', 'audits', 'Evaluation_Dashboard.md');

async function syncEvalDashboard() {
    console.log("🔄 SYNC : Mise à jour du Dashboard d'Évaluation...");
    
    try {
        if (!fs.existsSync(METRICS_PATH)) {
            console.warn("⚠️ SYNC : Fichier de métriques introuvable. Avez-vous lancé run_eval_dashboard.mjs ?");
            return;
        }
        
        const metrics = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));
        
        let content = fs.readFileSync(DASHBOARD_PATH, 'utf8');

        const dateStr = new Date().toISOString().split('T')[0];
        
        // MàJ des métadonnées
        content = content.replace(/\*\*Dernière mise à jour\*\* : `.*`/, `**Dernière mise à jour** : \`${dateStr}\``);
        content = content.replace(/\*\*Taille du Dataset \(Golden\)\*\* : `.*`/, `**Taille du Dataset (Golden)** : \`18\``);

        // Construction du tableau Markdown injecté
        let metricsStr = `| KPI | Définition | Score Actuel | Objectif |\n`;
        metricsStr += `| --- | --- | --- | --- |\n`;
        metricsStr += `| **1. Routing accuracy** | La requête a-t-elle été envoyée au bon intent/mode ? | ${metrics["Routing accuracy"]} | > 90% |\n`;
        metricsStr += `| **2. Mode adherence** | La réponse respecte-t-elle le style du mode ? | ${metrics["Mode adherence"]} | > 95% |\n`;
        metricsStr += `| **3. Response relevance** | La réponse traite-t-elle le besoin utile ? | ${metrics["Response relevance"]} | > 85% |\n`;
        metricsStr += `| **4. Grounding rate** | Taux de non-hallucination / appui sur les faits. | ${metrics["Grounding rate"]} | 100% |\n`;
        metricsStr += `| **5. Clarification rate** | % de requêtes nécessitant une question de l'agent. | ${metrics["Clarification rate"]} | < 15% |\n`;
        metricsStr += `| **6. One-answer success**| Taux de complétion en 1 tour (pour les questions simples).| ${metrics["One-answer success"]} | > 80% |\n`;
        metricsStr += `| **7. Latency (p50 / p95)**| Temps de génération et de routage (en ms). | ${metrics["Latency p50"]} / ${metrics["Latency p95"]} | < 1500ms |\n`;
        metricsStr += `| **8. Conversation success**| L'utilisateur a-t-il obtenu ce qu'il voulait ? | ${metrics["Conversation success"]} | > 90% |\n\n`;

        metricsStr += `### 🔍 Focus : Dérives & Temps de Réponse\n\n`;
        metricsStr += `\`\`\`mermaid\npie title Répartition des Intentions (Évaluation)\n`;
        metricsStr += `    "Conversation" : 60\n`;
        metricsStr += `    "Explicatif" : 20\n`;
        metricsStr += `    "Clarification" : 20\n`;
        metricsStr += `\`\`\`\n`;

        const regex = /<!-- METRICS_START -->[\s\S]*<!-- METRICS_END -->/;
        content = content.replace(regex, `<!-- METRICS_START -->\n${metricsStr}<!-- METRICS_END -->`);

        fs.writeFileSync(DASHBOARD_PATH, content);
        console.log(`✅ SYNC : Dashboard d'Évaluation mis à jour.`);

    } catch (error) {
        console.error("❌ SYNC : Échec de la synchronisation :", error.message);
    }
}

syncEvalDashboard();


import agent from '../src/agent/agent.js';
import ollama from '../src/llm/ollama.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getVRAM() {
    try {
        const { stdout } = await execAsync("nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits");
        return parseInt(stdout.trim());
    } catch (e) {
        return 0;
    }
}

async function runIndustrialStressTest() {
    console.log('--- NEXXUS CITADEL INDUSTRIAL STABILITY TEST ---');
    const startTime = Date.now();
    
    const scenarios = [
        "Propose une architecture microservices pour un SaaS de gestion de flotte de drones.",
        "Analyse les risques de sécurité d'une implémentation JWT en localstorage vs cookies HttpOnly.",
        "Génère un plan détaillé pour un atelier de 4h sur l'IA générative en entreprise.",
        "Explique le fonctionnement des transformeurs et de l'attention multi-têtes en français souverain.",
        "Crée une stratégie de migration de PHP vers Node.js pour un site e-commerce de 1M d'utilisateurs.",
        "Rédige une critique technique du protocole AirLLM par rapport au swap standard d'Ollama.",
        "Propose un schéma de base de données PostgreSQL pour un réseau social distribué.",
        "Détaille les étapes d'un audit de performance pour une application React Liquid Glass.",
        "Simule une attaque par injection de prompt et explique comment Nexxus s'en protège.",
        "Synthèse finale : résume l'état de maturité de la Citadelle v3.0."
    ];

    let totalTokens = 0;
    let errors = 0;

    for (let i = 0; i < scenarios.length; i++) {
        const vramBefore = await getVRAM();
        console.log(`\n[Round ${i+1}/10] Query: "${scenarios[i]}"`);
        console.log(`[VRAM] Before: ${vramBefore} MB`);

        const start = Date.now();
        let tokensInRound = 0;

        try {
            const response = await agent.run(scenarios[i], [], {
                onStep: (step) => process.stdout.write('.'),
                onContent: (token) => {
                    tokensInRound++;
                }
            });

            const end = Date.now();
            const duration = (end - start) / 1000;
            totalTokens += tokensInRound;
            
            const vramAfter = await getVRAM();
            console.log(`\n[Success] Duration: ${duration.toFixed(2)}s | Tokens: ${tokensInRound} | Speed: ${(tokensInRound/duration).toFixed(2)} t/s`);
            console.log(`[VRAM] After: ${vramAfter} MB (Diff: ${vramAfter - vramBefore} MB)`);
            
            if (response.length < 100) {
                console.warn("⚠️ Warning: Response seems too short.");
            }

        } catch (err) {
            console.error(`\n❌ Error in round ${i+1}:`, err.message);
            errors++;
        }
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    console.log('\n--- FINAL STABILITY REPORT ---');
    console.log(`Total Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`Total Tokens: ${totalTokens}`);
    console.log(`Avg Speed: ${(totalTokens / totalDuration).toFixed(2)} t/s`);
    console.log(`Errors: ${errors}`);
    console.log(`VRAM Final: ${await getVRAM()} MB`);
    console.log('--- TEST COMPLETE ---');
    
    process.exit(errors > 0 ? 1 : 0);
}

runIndustrialStressTest().catch(err => {
    console.error('Stress test crashed:', err);
    process.exit(1);
});

import axios from 'axios';

const query = "Explique-moi comment tu gères la mémoire à long terme entre les sessions et l'impact du RAG sur tes décisions stratégiques.";
const levels = ["LITE", "DENSE", "ULTRA"];

async function runBenchmark() {
    console.log("🚀 Lancement du Benchmark de Densité Sémantique (Citadel v3.1)");
    console.log("------------------------------------------------------------");

    for (const level of levels) {
        console.log(`\n[Test] Niveau: ${level}`);
        const start = Date.now();
        let fullContent = "";
        let tokens = 0;
        
        try {
            const response = await axios.post('http://localhost:3000/api/chat', {
                query: query,
                cavemanLevel: level,
                sessionId: "benchmark-session-" + level + "-" + Date.now(),
                isNewThread: true
            }, {
                headers: { 'Content-Type': 'application/json' },
                responseType: 'stream'
            });

            await new Promise((resolve, reject) => {
                response.data.on('data', chunk => {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.substring(6);
                            if (dataStr === '[DONE]') continue;
                            try {
                                const data = JSON.parse(dataStr);
                                if (data.token) {
                                    fullContent += data.token;
                                    tokens++;
                                }
                                if (data.done) resolve();
                            } catch (e) {
                                // Incomplete JSON
                            }
                        }
                    }
                });
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });

            const duration = (Date.now() - start) / 1000;
            console.log(`✅ Durée: ${duration.toFixed(2)}s`);
            console.log(`✅ Tokens générés: ${tokens}`);
            console.log(`✅ Ratio de densité: ${(tokens / duration).toFixed(2)} tokens/sec`);
            console.log(`📄 Réponse: "${fullContent.substring(0, 150)}..."`);
            console.log("------------------------------------------------------------");

        } catch (error) {
            console.error(`❌ Échec du test ${level}:`, error.message);
        }
    }
}

runBenchmark();

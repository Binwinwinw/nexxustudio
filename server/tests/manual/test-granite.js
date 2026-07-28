const axios = require('axios');

async function testModel(modelName, prompt) {
    console.log(`--- Testing ${modelName} ---`);
    const start = Date.now();
    try {
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: modelName,
            prompt: prompt,
            stream: false,
            options: {
                num_predict: 200,
                temperature: 0.1
            }
        });
        const end = Date.now();
        const duration = end - start;
        console.log(`Response: ${response.data.response}`);
        console.log(`Duration: ${duration}ms`);
        if (response.data.eval_count) {
            const tps = (response.data.eval_count / (response.data.eval_duration / 1e9)).toFixed(2);
            console.log(`Tokens/s: ${tps}`);
        }
    } catch (error) {
        console.error(`Error testing ${modelName}:`, error.message);
    }
}

const longPrompt = `Resume ce document tres court : "La Citadelle est une architecture souveraine basee sur Nexxus. Elle utilise Ollama pour l'inference locale."`;

async function run() {
    await testModel('ornith:9b', longPrompt);
}

run();

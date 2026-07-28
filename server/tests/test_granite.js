import axios from 'axios';

async function testModel(modelName, prompt) {
    console.log(`--- Testing ${modelName} ---`);
    const start = Date.now();
    try {
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: modelName,
            prompt: prompt,
            stream: false,
            options: {
                num_predict: 300,
                temperature: 0
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

const instructionPrompt = `Tu es un expert en rigueur epistemique. 
LOG [0]: "VRAM detectee: 12GB. Port 11434 actif."
QUESTION: Quel est l'etat du port 11434 ? Cite le log exact.`;

async function run() {
    await testModel('ornith:9b', instructionPrompt);
}

run();

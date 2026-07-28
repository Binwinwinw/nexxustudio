import axios from 'axios';

async function debugUltra() {
    console.log("🔍 Debugging ULTRA Mode...");
    try {
        const response = await axios.post('http://localhost:3000/api/chat', {
            query: "Test architecture",
            cavemanLevel: "ULTRA",
            sessionId: "debug-ultra-" + Date.now(),
            isNewThread: true
        }, {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'stream'
        });

        response.data.on('data', chunk => {
            console.log("TOKEN RECEIVED:", chunk.toString());
        });

        response.data.on('end', () => console.log("STREAM ENDED"));
    } catch (e) {
        console.error("API ERROR:", e.message);
    }
}

debugUltra();

// scan_api_security.js — Teste les endpoints API pour accès non autorisé
const fetch = require("node-fetch");
const endpoints = [
    "/src/api/validate.php",
    "/src/api/diagnostic.php",
    // Ajouter d'autres endpoints critiques ici
];
(async () => {
    for (const ep of endpoints) {
        const res = await fetch("http://localhost:8080" + ep);
        if (res.status === 200) {
            console.log(`Endpoint ${ep} accessible sans auth !`);
        } else {
            console.log(`Endpoint ${ep} protégé (${res.status})`);
        }
    }
})();

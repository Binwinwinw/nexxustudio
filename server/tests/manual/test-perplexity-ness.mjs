#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = process.env.PIPELINE_BASE_URL || 'http://127.0.0.1:3000';

const C = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
};

// Familles de tests
const TEST_FAMILIES = {
  PRODUCTION_IMMEDIATE: "Livrable immédiat vs Promesse vide",
  DIAGNOSTIC: "Diagnostic d'erreur vs Déviation",
  DISTINCTION_PEDAGOGIE: "Distinction Code vs Pédagogie",
  RELANCE: "Gestion des relances",
};

const TEST_CASES = [
  {
    id: "prod-1",
    family: TEST_FAMILIES.PRODUCTION_IMMEDIATE,
    query: "Fais-moi un tableau comparatif entre React et Vue en 3 critères.",
    mustContain: ["React", "Vue", "|", "-"], // Markdown table elements
    mustNotContain: ["Je peux", "Dis-moi si", "Je pourrais"],
    description: "Doit produire un tableau Markdown immédiatement sans promettre de le faire."
  },
  {
    id: "prod-2",
    family: TEST_FAMILIES.PRODUCTION_IMMEDIATE,
    query: "Rédige une procédure de 5 étapes pour sécuriser un serveur SSH.",
    mustContain: ["1.", "2.", "3.", "4.", "5."],
    mustNotContain: ["Je peux rédiger", "Si tu le souhaites"],
    description: "Doit produire la procédure directement."
  },
  {
    id: "diag-1",
    family: TEST_FAMILIES.DIAGNOSTIC,
    query: "Fais un plan pour un atelier d'initiation à Python en 5 sections avec objectifs et durée.",
    mustContain: ["Objectifs", "Durée"],
    mustNotContain: ["Je peux générer le code", "Voici le script python", "def "],
    description: "Ne doit pas dévier vers du code Python, mais produire un plan pédagogique."
  },
  {
    id: "diag-1b",
    family: TEST_FAMILIES.DIAGNOSTIC,
    query: "Prépare le plan d'une animation adressée à des débutants pour la découverte des notions nécessaires à l'utilisation de Python vers l'automatisation.",
    mustContain: ["plan", "débutants", "Python"],
    mustNotContain: [
      "Je n'ai pas assez d'éléments fiables",
      "Précise ta demande",
      "fournis plus de contexte"
    ],
    description: "Doit produire directement un plan d'animation pédagogique sans refus ni parsing réduit."
  },
  {
    id: "diag-2",
    family: TEST_FAMILIES.DIAGNOSTIC,
    query: "Il y a un problème avec ta réponse précédente, tu as généré du code au lieu d'un plan.",
    mustContain: ["problème", "compris", "plan"],
    mustNotContain: ["La Citadelle", "P0", "P1", "contrat", "architecture"],
    description: "Doit diagnostiquer l'erreur, et non pas justifier via la documentation système interne."
  },
  {
    id: "pedago-1",
    family: TEST_FAMILIES.DISTINCTION_PEDAGOGIE,
    query: "Explique le concept de RAG de manière simple pour un débutant.",
    mustContain: ["RAG"],
    mustNotContain: ["```python", "```javascript"],
    description: "Une explication ne doit pas forcer l'inclusion de code s'il n'est pas requis."
  },
  {
    id: "pedago-2",
    family: TEST_FAMILIES.DISTINCTION_PEDAGOGIE,
    query: "Génère un script Python pour parser un JSON.",
    mustContain: ["```python", "import json"],
    mustNotContain: [],
    description: "Ici l'intention code est légitime et doit être satisfaite."
  },
  {
    id: "relance-1",
    family: TEST_FAMILIES.RELANCE,
    query: "Ajoute une 6ème section à ce plan d'atelier.",
    mustContain: ["6", "section"],
    mustNotContain: ["Quel plan", "Je ne comprends pas"],
    description: "Doit reprendre le contexte sans exiger une répétition complète."
  }
];

import { randomUUID } from "crypto";
const TEST_BROWSER_ID = randomUUID();
const COOKIE_HEADER = `nexxus_browser_id=${encodeURIComponent(TEST_BROWSER_ID)}`;

async function createSession() {
  const sid = `test-perplexity-${Date.now()}`;
  const res = await fetch(`${DEFAULT_BASE_URL}/api/sessions/${sid}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cookie": COOKIE_HEADER
    },
    body: JSON.stringify({ title: `[PerplexityTest] ${Date.now()}` })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return sid;
}

async function sendQuery(sid, query) {
  const res = await fetch(`${DEFAULT_BASE_URL}/api/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cookie": COOKIE_HEADER
    },
    body: JSON.stringify({
      sessionId: sid,
      q: query,
      history: []
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let isDone = false;

  while (!isDone) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    
    // Parse SSE format
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') {
          isDone = true;
          break;
        }
        try {
          const payload = JSON.parse(dataStr);
          if (payload.token) {
            fullResponse += payload.token;
          } else if (payload.status === "done" || payload.done) {
            if (payload.finalAnswer) fullResponse = payload.finalAnswer;
            isDone = true;
          }
        } catch (e) {
          // ignore parsing error for partial chunks
        }
      }
    }
  }
  
  return fullResponse;
}

function evaluateResponse(response, testCase) {
  let passed = true;
  const missing = [];
  const forbidden = [];

  for (const must of testCase.mustContain) {
    if (!response.toLowerCase().includes(must.toLowerCase())) {
      passed = false;
      missing.push(must);
    }
  }

  for (const mustNot of testCase.mustNotContain) {
    if (response.toLowerCase().includes(mustNot.toLowerCase())) {
      passed = false;
      forbidden.push(mustNot);
    }
  }

  return { passed, missing, forbidden };
}

async function main() {
  console.log(C.bold(`\n=== Nexxus Citadel — Perplexity-ness Test ===`));
  console.log(`URL : ${DEFAULT_BASE_URL}`);
  console.log(`Nombre de cas de test : ${TEST_CASES.length}\n`);

  let sid;
  try {
    sid = await createSession();
    console.log(`Session créée : ${C.cyan(sid)}\n`);
  } catch (e) {
    console.log(C.yellow(`Création de session échouée. Impossible de tester contre le serveur local.`));
    console.log(e.message);
    process.exit(1);
  }

  let totalPassed = 0;

  for (const tc of TEST_CASES) {
    console.log(`▶ Famille : ${C.cyan(tc.family)}`);
    console.log(`  Query   : ${tc.query}`);
    
    try {
      const response = await sendQuery(sid, tc.query);
      const evalResult = evaluateResponse(response, tc);
      
      if (evalResult.passed) {
        console.log(C.green(`  [PASS] ${tc.description}`));
        totalPassed++;
      } else {
        console.log(C.red(`  [FAIL] ${tc.description}`));
        if (evalResult.missing.length > 0) console.log(C.red(`         Manquant: ${evalResult.missing.join(', ')}`));
        if (evalResult.forbidden.length > 0) console.log(C.red(`         Interdit trouvé: ${evalResult.forbidden.join(', ')}`));
        console.log(C.yellow(`\n  Extrait de la réponse:`));
        console.log(`  ${response.slice(0, 300).replace(/\n/g, '\n  ')}...\n`);
      }
    } catch (e) {
      console.log(C.red(`  [ERROR] ${e.message}`));
    }
    console.log("");
  }

  console.log(C.bold(`=== Résultat final ===`));
  const resultStr = `${totalPassed}/${TEST_CASES.length}`;
  if (totalPassed === TEST_CASES.length) {
    console.log(C.green(`Succès : ${resultStr} tests passés.`));
  } else {
    console.log(C.red(`Échec : ${resultStr} tests passés.`));
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(C.red("\n[FATAL ERROR]"), err);
  process.exitCode = 1;
});

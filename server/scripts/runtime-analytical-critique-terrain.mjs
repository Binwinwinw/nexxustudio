#!/usr/bin/env node
/**
 * Verdict terrain : exécute AgentPipeline sur le pavé test et affiche
 * la ligne [PIPELINE] + première ligne de réponse (comme demandé pour validation UI).
 *
 * Usage (depuis la racine ou server/) :
 *   node server/scripts/runtime-analytical-critique-terrain.mjs
 */
import AgentPipeline from "../src/agent/agentPipeline.js";

const PASTE = `
Verdict technique — synthèse terrain La Citadelle.
1 Réponse méta OK si « Sur mes fonctionnalités actuelles ».
2 Même réponse = ancien template « options structurées, sans sur-promesse ».
3 Forge → refus ; runtime SIMPLE_FAST + refus.
Preuve : grep à zéro. Sous-intents capability_learn, capability_gaps, forge_status.
Tests passent en local ; décalage nodemon / npm run start / short-circuit pipeline.
`.trim();

const pipelineLogs = [];
const origLog = console.log;
console.log = (...args) => {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  if (line.includes("[PIPELINE]")) pipelineLogs.push(line);
  origLog.apply(console, args);
};

const pipeline = new AgentPipeline({
  maxIterations: 1,
  getDeterministicSocialResponse: () => null,
});

let streamed = "";
const steps = [];

console.log("=== Terrain analytical_critique (AgentPipeline direct) ===\n");

const out = await pipeline.run(PASTE, [], {
  sessionId: "terrain-analytical-critique",
  chatMode: true,
  disableRecentMemory: true,
  onStep: (text, meta) => {
    steps.push({ text, meta });
  },
  onContent: (chunk) => {
    streamed += chunk;
  },
});

const text = (streamed || out || "").trim();
const firstLine = text.split(/\r?\n/).find((l) => l.trim())?.trim() || "(vide)";

const pipelineLine =
  pipelineLogs.find((l) => l.includes("analytical_critique")) ||
  pipelineLogs.find((l) => l.includes("Document Analysis")) ||
  pipelineLogs[pipelineLogs.length - 1] ||
  "(aucun log [PIPELINE] capturé)";

console.log("\n--- Artefacts à comparer avec le chat UI ---");
console.log("PREMIÈRE_LIGNE:", firstLine);
console.log("PIPELINE:", pipelineLine);

const ok =
  pipelineLine.includes("analytical_critique") &&
  !/points clés extraits/i.test(firstLine);

console.log("\nVERDICT:", ok ? "NOUVEAU_CHEMIN_ACTIF" : "À_INVESTIGUER");
process.exit(ok ? 0 : 1);

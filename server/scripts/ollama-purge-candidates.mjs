#!/usr/bin/env node
/**
 * Liste les modèles Ollama candidats à la purge (~70 Go) — sans exécuter ollama rm.
 * Usage : node server/scripts/ollama-purge-candidates.mjs
 */
import { execSync } from 'node:child_process';

const PURGE_CANDIDATES = [
  { tag: 'qwen3.6:latest', reason: 'Offload CPU permanent (~23 Go) — hors doctrine 8 Go VRAM' },
  { tag: 'qwen3.6:27b', reason: 'Dense 27B — session isolée seulement' },
  { tag: 'gemma4:26b', reason: 'THINKER lourd — blacklist HEAVY_MODELS' },
  { tag: 'qwen3-coder:30b', reason: 'Code expert 30B — offload très lent' },
  { tag: 'qwen-coder:7b-elite', reason: 'Remplacé par qwen2.5-coder:7b' },
  { tag: 'starcoder2:15b', reason: 'Remplacé par qwen2.5-coder:7b (Tier 3 coding)' },
  { tag: 'qwen2.5-coder:14b', reason: 'Hors stack — remplacé par qwen2.5-coder:7b (never / 8 Go VRAM)' },
];

function parseOllamaList(raw) {
  const lines = raw.trim().split('\n').slice(1);
  const map = new Map();
  for (const line of lines) {
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length < 3) continue;
    const [name, , size] = parts;
    map.set(name.trim(), size.trim());
  }
  return map;
}

let installed = new Map();
try {
  const out = execSync('ollama list', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  installed = parseOllamaList(out);
} catch (err) {
  console.warn('⚠ ollama list indisponible — affichage des candidats sans taille réelle');
  console.warn(`  (${err.message})\n`);
}

console.log('=== Candidats purge stack 8 Go VRAM ===\n');

let totalEstimateGb = 0;
const present = [];
const absent = [];

for (const { tag, reason } of PURGE_CANDIDATES) {
  const size = installed.get(tag);
  if (size) {
    present.push({ tag, size, reason });
    const gb = parseFloat(size);
    if (!Number.isNaN(gb)) totalEstimateGb += gb;
  } else {
    absent.push({ tag, reason });
  }
}

if (present.length === 0) {
  console.log('Aucun candidat présent dans ollama list — rien à purger.\n');
} else {
  for (const { tag, size, reason } of present) {
    console.log(`  ${tag.padEnd(24)} ${size.padStart(8)}  — ${reason}`);
  }
  console.log(`\nEstimation disque récupérable : ~${totalEstimateGb.toFixed(1)} Go\n`);
  console.log('Commandes (manuel) :');
  for (const { tag } of present) {
    console.log(`  ollama stop ${tag} && ollama rm ${tag}`);
  }
}

if (absent.length > 0) {
  console.log('\nDéjà absents :');
  for (const { tag } of absent) {
    console.log(`  - ${tag}`);
  }
}

console.log('\nVoir docs/agents/stack-modeles-8gb-vram.md pour le contexte complet.');

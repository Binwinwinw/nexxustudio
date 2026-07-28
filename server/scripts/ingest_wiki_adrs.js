#!/usr/bin/env node
/**
 * CLI — ingestion chunks wiki ADR vers ChromaDB.
 * Runtime : server/src/wiki/ingest_wiki_adrs.js
 */
import knowledgeHub from '../src/services/knowledgeHub.js';
import {
  ingestWikiChunksToHub,
  evaluateSmacPrecision,
} from '../src/wiki/ingest_wiki_adrs.js';

async function main() {
  console.log('📥 Ingestion des Chunks Wiki-Ops dans ChromaDB...');

  const { ingested } = await ingestWikiChunksToHub(knowledgeHub);
  console.log(`✅ ${ingested} ADRs indexées avec succès.`);

  const evaluation = await evaluateSmacPrecision(knowledgeHub);
  console.log(`\n🔍 Test de Précision sur : "${evaluation.query}"`);
  console.log(`\n🎯 Score de Précision SMAC : ${evaluation.precision.toFixed(1)}%`);

  if (evaluation.pass) {
    console.log('🏆 CRITÈRE DE SUCCÈS ATTEINT (>80%).');
  } else {
    console.log('⚠️ PRÉCISION INSUFFISANTE. Analyse des causes requise.');
  }
}

main().catch((err) => {
  console.error('[ingest_wiki_adrs CLI]', err.message);
  process.exit(1);
});

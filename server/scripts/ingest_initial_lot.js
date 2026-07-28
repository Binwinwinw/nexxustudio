
import fs from 'fs/promises';
import path from 'path';
import hub from '../src/services/knowledgeHub.js';
import chunker from '../src/services/chunker.js';

/**
 * Script d'ingestion initiale pour peupler le Knowledge Hub de La Citadelle.
 * Ce script scanne les documents clés (ADR, Configs) et les indexe dans ChromaDB.
 */

const FILES_TO_INDEX = [
  // ADRs
  { 
    path: '../citadelle-vault/Citadelle/Décisions/ADR-001-Web-Consciousness.md', 
    type: 'adr', project: 'citadel', category: 'architecture', 
    title: 'Web Consciousness', status: 'active', tags: ['web', 'override', 'agentic'] 
  },
  { 
    path: '../citadelle-vault/Citadelle/Décisions/ADR-002-Sovereign-Multimodal-Vision.md', 
    type: 'adr', project: 'citadel', category: 'vision', 
    title: 'Sovereign Multimodal Vision', status: 'active', tags: ['vision', 'ocr', 'multimodal'] 
  },
  { 
    path: '../citadelle-vault/Citadelle/Décisions/ADR-003-Knowledge-Governance.md', 
    type: 'adr', project: 'citadel', category: 'governance', 
    title: 'Knowledge Governance & Evolution Strategy', status: 'active', tags: ['governance', 'rag', 'metadata'] 
  },
  { 
    path: '../citadelle-vault/Citadelle/Décisions/ADR-004-Security-Hardening.md', 
    type: 'adr', project: 'citadel', category: 'security', 
    title: 'Security Hardening & Zero-Trust Architecture', status: 'active', tags: ['security', 'hardening', 'auth'] 
  },
  
  // Configs
  { 
    path: '../docker/knowledge_hub_docker-compose.yml', 
    type: 'config', project: 'citadel', category: 'infrastructure', 
    title: 'Knowledge Hub Docker Compose', status: 'active', tags: ['docker', 'chromadb', 'infra'] 
  },
  { 
    path: '../package.json', 
    type: 'config', project: 'nexxus', category: 'dependencies', 
    title: 'Root package.json', status: 'active', tags: ['nodejs', 'dependencies'] 
  },
  { 
    path: './package.json', 
    type: 'config', project: 'citadel', category: 'metadata', 
    title: 'Server Manifest', status: 'active', tags: ['node', 'config'] 
  },
  // Experts (Core Intelligence)
  {
    path: './data/experts/expert_mentor.json',
    type: 'expert', project: 'citadel', category: 'intelligence',
    title: 'Expert Mentor Manifest', status: 'active', tags: ['intelligence', 'role', 'mentor']
  },
  {
    path: './data/experts/master_orchestrator.json',
    type: 'expert', project: 'citadel', category: 'intelligence',
    title: 'Master Orchestrator Manifest', status: 'active', tags: ['intelligence', 'role', 'orchestrator']
  },
  // Rapports de Stabilisation
  {
    path: '../citadelle-vault/Citadelle/Rapports/Rapport-Stabilisation-Knowledge-Hub.md',
    type: 'report', project: 'citadel', category: 'governance',
    title: 'Rapport de Stabilisation Knowledge Hub Phase 1', status: 'active', tags: ['governance', 'milestone', 'report']
  }
];

async function ingest() {
  console.log("🚀 Lancement de l'ingestion initiale dans le Knowledge Hub...");
  
  try {
    await hub.init();
    
    // Reset pour garantir des embeddings frais avec les nouveaux préfixes
    console.log("🧹 Vidage de la collection existante...");
    try {
      await hub.client.deleteCollection({ name: hub.collectionName });
      await hub.init();
    } catch (e) {
      console.log("ℹ️ Aucune collection à supprimer.");
    }
    
    const docs = [];
    
    for (const item of FILES_TO_INDEX) {
      try {
        const fullPath = path.resolve('server', item.path);
        console.log(`📑 Lecture de: ${item.path}...`);
        
        const rawContent = await fs.readFile(fullPath, 'utf8');
        const filename = path.basename(item.path);
        
        // --- CHUNKING ADAPTATIF RÉGLÉ ---
        const fileExt = filename.split('.').pop();
        const isADR = item.type === 'adr';
        
        const chunks = chunker.chunk(rawContent, fileExt, {
          maxChars: isADR ? 2000 : 1200,
          overlap: isADR ? 400 : 200,
          metadata: {
            type: item.type,
            project: item.project,
            category: item.category,
            source: item.path,
            source_display_name: filename,
            title: item.title || filename,
            status: item.status || 'active',
            tags: item.tags || [],
            ingest_origin: 'bootstrap',
            version: '1.0',
            timestamp: new Date().toISOString()
          }
        });

        console.log(`✂️  Découpé en ${chunks.length} chunks (Size: ${isADR ? 2000 : 1200}).`);
        
        for (const c of chunks) {
          const id = `${item.type}_${item.path.replace(/[^a-z0-9]/gi, '_')}_c${c.metadata.chunk_id}`;
          docs.push({
            id,
            content: c.text,
            metadata: c.metadata
          });
        }
      } catch (err) {
        console.warn(`⚠️ Impossible de lire ${item.path}:`, err.message);
      }
    }
    
    if (docs.length > 0) {
      console.log(`📥 Indexation de ${docs.length} fragments...`);
      await hub.addDocuments(docs);
      console.log("✅ Ingestion terminée avec succès.");
    } else {
      console.log("❓ Aucun document trouvé à indexer.");
    }
    
  } catch (err) {
    console.error("❌ Erreur lors de l'ingestion:", err);
  }
}

ingest();

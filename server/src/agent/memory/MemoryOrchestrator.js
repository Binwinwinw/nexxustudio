import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import VectorIndex from './VectorIndex.js';
import HeritageScanner from './heritageScanner.js';
import knowledgeHub from '../../services/knowledgeHub.js';
import caveman from '../../utils/cavemanShrink.js';
import { MemoryGuardianAgent } from './guardianship/memoryGuardianAgent.js';
import { MemoryCriticAgent } from './guardianship/memoryCriticAgent.js';
import { MemoryStoreService } from './guardianship/memoryStoreService.js';
import { recordMemoryGovernanceEvent } from './guardianship/memoryGovernancePersistor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_ROOT = path.resolve(__dirname, '../../../../server/data/memory');

class MemoryOrchestrator {
  constructor() {
    this.taxonomy = null;
    this.principles = [];
    this.episodes = [];
    this.isInitialized = false;
    this.projectIndexes = new Map(); // Map<sessionId, VectorIndex>
    this.heritageScanner = new HeritageScanner(path.resolve(__dirname, '../../../../projects'));
  }

  /**
   * Initialise le cache mémoire au démarrage
   */
  async initialize() {
    try {
      // 1. Charger la taxonomie
      const taxoPath = path.join(MEMORY_ROOT, 'semantic/taxonomy.json');
      const taxoData = await fs.readFile(taxoPath, 'utf-8');
      this.taxonomy = JSON.parse(taxoData);

      // 2. Charger les principes (Procedural)
      const procDir = path.join(MEMORY_ROOT, 'procedural');
      const procFiles = await fs.readdir(procDir);
      this.principles = await Promise.all(
        procFiles
          .filter(f => f.endsWith('.json'))
          .map(async f => JSON.parse(await fs.readFile(path.join(procDir, f), 'utf-8')))
      );

      this.isInitialized = true;
      console.log(`[Memory] Orchestrator initialized. ${this.principles.length} principles loaded.`);
    } catch (error) {
      console.error('[Memory] Initialization failed:', error);
    }
  }

  /**
   * Analyse la requête pour extraire le thème sémantique
   */
  identifyTheme(query) {
    if (!this.taxonomy) return 'general';
    const q = query.toLowerCase();
    
    for (const [theme, keywords] of Object.entries(this.taxonomy.themes)) {
      if (keywords.some(k => q.includes(k))) return theme;
    }
    return 'general';
  }

  /**
   * Récupère la mémoire pertinente pour une requête donnée
   */
  async getRelevantMemory(query, context = {}) {
    if (!this.isInitialized) await this.initialize();

    const theme = this.identifyTheme(query);
    const scope = context.scope || 'general';

    // 1. Filtrer les principes applicables (Seulement les validés)
    const relevantPrinciples = this.principles.filter(p => {
      const scopeMatch = p.scope === scope || p.scope === 'general' || scope === 'general';
      const statusMatch = p.status === 'accepted' || p.status === 'active';
      return scopeMatch && statusMatch;
    });

    // 2. Chercher des épisodes similaires (Recherche par mots-clés simple)
    // Note: Dans une phase future, on utilisera des embeddings ici.
    const episodicDir = path.join(MEMORY_ROOT, 'episodic');
    const episodicFiles = await fs.readdir(episodicDir);
    const relevantEpisodes = [];

    for (const file of episodicFiles) {
      if (!file.endsWith('.json')) continue;
      const ep = JSON.parse(await fs.readFile(path.join(episodicDir, file), 'utf-8'));
      
      // Si la requête contient un mot clé de l'épisode ou si le scope correspond
      const epKeywords = [ep.theme, ep.id, ep.scope].filter(Boolean);
      if (epKeywords.some(k => query.toLowerCase().includes(k.toLowerCase()))) {
        relevantEpisodes.push(ep);
      }
    }

    // 3. Recherche Vectorielle (Sémantique)
    let semanticMatches = [];
    let episodicRecall = [];
    
    // 3.1 Recherche de Jurisprudence (LTM - Vague 3)
    const ltmMatches = await knowledgeHub.query(query, 3, { type: 'episodic' });
    episodicRecall = ltmMatches.map(m => ({
      text: m.content,
      score: 1 - m.distance,
      metadata: m.metadata
    }));

    // 3.2 Recherche dans le Knowledge Hub (Global) avec filtrage par projet
    const projectFilter = context.project ? { project: context.project } : { type: { $ne: 'episodic' } };
    const globalMatches = await knowledgeHub.query(query, 5, projectFilter);
    semanticMatches.push(...globalMatches.map(m => ({
      text: m.content,
      score: 1 - m.distance,
      metadata: m.metadata
    })));

    // 3.3 Recherche dans l'index projet (Local legacy)
    if (context.sessionId) {
      const vIndex = await this.getProjectIndex(context.sessionId);
      if (vIndex && context.queryEmbedding) {
        const localMatches = vIndex.search(context.queryEmbedding, 3);
        semanticMatches.push(...localMatches);
      }
    }

    // Déduplication et tri par score
    semanticMatches = semanticMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      theme,
      principles: relevantPrinciples,
      episodes: relevantEpisodes,
      episodicRecall, // Nouveau flux LTM
      semanticMatches,
      heritage: await this.getHeritageContext()
    };
  }

  /**
   * Récupère le résumé du patrimoine (Projets passés)
   */
  async getHeritageContext() {
    try {
      const projects = await this.heritageScanner.scan();
      if (!projects.length) return null;

      return projects.map(p => {
        const tech = p.techStack.length > 0 ? ` [${p.techStack.slice(0, 3).join(', ')}]` : '';
        return `- ${p.name} (${p.type})${tech} : ${p.description || 'Projet architectural sans description.'}`;
      }).join('\n');
    } catch (err) {
      console.error('[Memory] Heritage scan failed:', err);
      return null;
    }
  }

  async getProjectIndex(sessionId) {
    if (this.projectIndexes.has(sessionId)) {
      return this.projectIndexes.get(sessionId);
    }
    const indexPath = path.join(MEMORY_ROOT, 'projects', `${sessionId}_index.json`);
    const vIndex = new VectorIndex(sessionId);
    await vIndex.load(indexPath);
    this.projectIndexes.set(sessionId, vIndex);
    return vIndex;
  }

  /**
   * Formate la mémoire pour l'injection dans le prompt
   */
  formatForPrompt(memoryData) {
    const hasData = memoryData.principles.length > 0 || 
                    memoryData.episodes.length > 0 || 
                    (memoryData.semanticMatches && memoryData.semanticMatches.length > 0) ||
                    (memoryData.episodicRecall && memoryData.episodicRecall.length > 0);

    if (!hasData) return '';

    let output = '\n--- MÉMOIRE SOUVERAINE (EXPÉRIENCE ACQUISE) ---\n';
    
    // --- LTM : JURISPRUDENCE ÉPISODIQUE (Vague 3) ---
    if (memoryData.episodicRecall && memoryData.episodicRecall.length > 0) {
      output += '\n📚 JURISPRUDENCE ÉPISODIQUE (Expériences passées similaires) :\n';
      memoryData.episodicRecall.forEach(m => {
        const compressedText = caveman.shrink(m.text, caveman.INTENSITY.LITE);
        output += `- [Similarité: ${(m.score * 100).toFixed(1)}%] ${compressedText}\n`;
      });
    }

    if (memoryData.principles.length > 0) {
      output += '\nPRÉCEPTES PROCÉDURAUX À APPLIQUER :\n';
      memoryData.principles.forEach(p => {
        output += `- [${p.id}] ${p.rule}\n`;
      });
    }

    if (memoryData.episodes.length > 0) {
      output += '\nÉPISODES FACTUELS RÉCENTS :\n';
      memoryData.episodes.forEach(e => {
        output += `- [${e.id}] Évènement: ${e.trigger}\n  Diagnostic: ${e.diagnosis}\n  Remède: ${e.remedy}\n`;
      });
    }

    if (memoryData.semanticMatches && memoryData.semanticMatches.length > 0) {
      output += '\nDOCUMENTS & CONTEXTE PROJET (Recherche Sémantique) :\n';
      memoryData.semanticMatches.forEach(m => {
        // --- CAVEMAN INTEGRATION : Compression sémantique ---
        const compressedText = caveman.shrink(m.text, caveman.INTENSITY.FULL);
        output += `- [Similarité: ${(m.score * 100).toFixed(1)}%] ${compressedText}\n`;
      });
    }

    if (memoryData.heritage) {
      output += '\nPATRIMOINE DE LA CITADELLE (PROJETS PASSÉS) :\n';
      output += caveman.shrink(memoryData.heritage, caveman.INTENSITY.LITE) + '\n';
    }

    output += '\n---------------------------------------------\n';
    return output;
  }

  /**
   * Enregistre un incident factuel dans le dossier drafts/
   * @param {Object} incidentData - Les données de l'incident (trigger, repair, outcome, etc.)
   */
  async recordIncident(incidentData) {
    try {
      const timestamp = new Date().toISOString();
      const draftId = `draft-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      
      // 1. Structure de l'incident (votre schéma 2026)
      const draft = {
        id: draftId,
        timestamp,
        trigger: incidentData.trigger || '',
        scope: incidentData.scope || 'general',
        runId: incidentData.runId || 'unknown',
        selectedModel: incidentData.selectedModel || 'unknown',
        retrievedMemoryIds: incidentData.retrievedMemoryIds || [],
        validationResult: incidentData.validationResult || 'failed',
        repairApplied: incidentData.repairApplied || false,
        finalOutcome: incidentData.finalOutcome || 'unknown',
        latencyMs: incidentData.latencyMs || 0,
        evidence: {
          logs: incidentData.evidenceLogs || '',
          orchestratorVersion: 'v2.9.1'
        },
        status: 'draft',
        confidence: 'hypothesis'
      };

      // 2. Garde-fou : Déduplication simple
      // On évite d'écrire si l'incident est identique au dernier enregistré
      if (this.lastIncident && 
          this.lastIncident.trigger === draft.trigger && 
          this.lastIncident.repairApplied === draft.repairApplied) {
        return null;
      }

      // 3. Persistance
      const draftPath = path.join(MEMORY_ROOT, 'drafts', `${draftId}.json`);
      await fs.writeFile(draftPath, JSON.stringify(draft, null, 2));
      
      this.lastIncident = draft;
      console.log(`[Memory] Incident draft recorded: ${draftId}`);
      return draftId;
    } catch (error) {
      console.error('[Memory] Failed to record incident:', error);
      return null;
    }
  }

  /**
   * Permet d'annoter ou de modifier un draft avant promotion
   */
  async reviewDraft(draftId, updates) {
    try {
      const draftPath = path.join(MEMORY_ROOT, 'drafts', `${draftId}.json`);
      const draftData = JSON.parse(await fs.readFile(draftPath, 'utf8'));

      const updatedDraft = {
        ...draftData,
        ...updates,
        reviewedAt: new Date().toISOString()
      };

      await fs.writeFile(draftPath, JSON.stringify(updatedDraft, null, 2));
      console.log(`[Memory] Draft ${draftId} reviewed and updated.`);
      return true;
    } catch (error) {
      console.error('[Memory] Draft review failed:', error);
      return false;
    }
  }

  /**
   * Promeut un draft vers la mémoire épisodique (Historique stable)
   */
  async promoteToEpisode(draftId) {
    try {
      const draftPath = path.join(MEMORY_ROOT, 'drafts', `${draftId}.json`);
      const draftData = JSON.parse(await fs.readFile(draftPath, 'utf8'));

      const epId = `EP-${Date.now().toString().slice(-4)}`;
      const epPath = path.join(MEMORY_ROOT, 'episodic', `${epId}.json`);

      const episode = {
        ...draftData,
        id: epId,
        status: 'stable',
        confidence: 'verified',
        promotedAt: new Date().toISOString()
      };

      await fs.writeFile(epPath, JSON.stringify(episode, null, 2));
      await fs.unlink(draftPath); // On supprime le draft après promotion

      console.log(`[Memory] Draft ${draftId} promoted to Episode ${epId}`);
      return epId;
    } catch (error) {
      console.error('[Memory] Promotion to Episode failed:', error);
      return null;
    }
  }

  /**
   * Crée un nouveau principe (Procedural) à partir de drafts ou d'épisodes
   */
  async promoteToPrinciple(sourceIds, principleData) {
    try {
      const prId = `PR-${(await this.getNextPrincipleIndex()).toString().padStart(3, '0')}`;
      const prPath = path.join(MEMORY_ROOT, 'procedural', `${prId}_${principleData.title.replace(/\s+/g, '_')}.json`);

      const principle = {
        id: prId,
        title: principleData.title,
        description: principleData.description,
        guidelines: principleData.guidelines || [],
        source_incidents: sourceIds,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        status: 'active'
      };

      await fs.writeFile(prPath, JSON.stringify(principle, null, 2));
      console.log(`[Memory] New Principle created: ${prId}`);
      
      // Rechargement immédiat des principes en cache
      await this.initialize();
      return prId;
    } catch (error) {
      console.error('[Memory] Principle creation failed:', error);
      return null;
    }
  }

  async getNextPrincipleIndex() {
    const files = await fs.readdir(path.join(MEMORY_ROOT, 'procedural'));
    const indices = files
      .map(f => parseInt(f.match(/PR-(\d+)/)?.[1] || '0'))
      .filter(n => n > 0);
    return indices.length > 0 ? Math.max(...indices) + 1 : 10; // Commence après les principes de base
  }

  /**
   * Guardianship V1: Pipeline complet pour évaluer et committer une mémoire
   * avec contrat strict, critique, et hard fail.
   */
  async evaluateAndCommitMemory(userQuery, assistantResponse, options = {}) {
    const { assessMemoryEligibility } = await import('./guardianship/curatedMemoryGate.js');
    const pipelineMode = options.pipelineMode || 'COMPOSER';
    const eligibility = assessMemoryEligibility({
      userQuery,
      assistantResponse,
      pipelineMode,
    });

    if (!eligibility.eligible) {
      console.log(
        '[Memory Curated] Ingestion refusée:',
        eligibility.reasons.join(', '),
      );
      recordMemoryGovernanceEvent({
        status: 'rejected_precheck',
        reasons: eligibility.reasons,
        pipelineMode: eligibility.pipelineMode,
        sessionId: options.sessionId || null,
        turnId: options.turnId || null,
      });
      return {
        status: 'rejected_precheck',
        reasons: eligibility.reasons,
        pipelineMode: eligibility.pipelineMode,
      };
    }

    const activeMemories = await MemoryStoreService.getActiveMemories();
    let proposedPayload = await MemoryGuardianAgent.proposeMemoryWrite(
      userQuery,
      eligibility.cleaned,
      activeMemories,
    );
    
    if (proposedPayload.operation === 'SKIP') {
      recordMemoryGovernanceEvent({
        status: 'skipped',
        pipelineMode: eligibility.pipelineMode,
        sessionId: options.sessionId || null,
        turnId: options.turnId || null,
      });
      return { status: 'skipped' };
    }

    const MAX_RETRIES = 2;
    let attempt = 1;
    let finalVerdict = "fail";
    let finalFailedRules = [];

    // Boucle du Critique
    while (attempt <= MAX_RETRIES) {
      const critique = MemoryCriticAgent.evaluateMemoryWriteContract(proposedPayload, activeMemories);
      
      if (critique.verdict === "pass") {
        finalVerdict = "pass";
        finalFailedRules = [];
        break;
      }
      
      finalVerdict = "fail";
      finalFailedRules = critique.failed_rules;
      attempt++;
      
      if (attempt <= MAX_RETRIES) {
        // En vrai, il faudrait rappeler l'agent avec les repair_instructions.
        // Pour simuler la boucle de correction (dans une implémentation complète LLM) :
        // proposedPayload = await MemoryGuardianAgent.proposeMemoryWrite(..., repairInstructions);
        // Ici, on simule juste la tentative ou on laisse le payload tel quel et il échouera à nouveau si le modèle ne peut pas.
      }
    }

    const packet = {
      meta: {
        final_contract_verdict: finalVerdict,
        final_failed_rules: finalFailedRules,
        provenance: {
          sessionId: options.sessionId || null,
          turnId: options.turnId || null,
          pipelineMode: eligibility.pipelineMode,
          ingestedAt: new Date().toISOString(),
          precheck: 'curated_memory_gate_v1',
        },
      },
      payload: proposedPayload,
    };

    // Le store fera le Hard Fail si le verdict n'est pas "pass"
    try {
      const commitResult = await MemoryStoreService.commitMemory(packet);
      if (commitResult.status !== "committed" || !commitResult.record) {
        return commitResult;
      }

      const { executeMemoryPromotion } = await import(
        "./guardianship/memoryPromotionService.js"
      );
      const promotion = await executeMemoryPromotion(
        commitResult.record,
        packet,
      );

      if (promotion.status === "promoted") {
        console.log(
          `[Memory Promotion] ${promotion.target} ← ${commitResult.id} (${promotion.id})`,
        );
        recordMemoryGovernanceEvent({
          status: "committed",
          memoryId: commitResult.id,
          pipelineMode: eligibility.pipelineMode,
          sessionId: options.sessionId || null,
          turnId: options.turnId || null,
        });
        recordMemoryGovernanceEvent({
          status: "promoted",
          target: promotion.target,
          memoryId: commitResult.id,
          promotionId: promotion.id,
          pipelineMode: eligibility.pipelineMode,
          sessionId: options.sessionId || null,
          turnId: options.turnId || null,
        });
      } else if (promotion.status === "promotion_refused") {
        console.log(
          `[Memory Promotion] Refusée: ${promotion.reasons?.join(", ") || "unknown"}`,
        );
        recordMemoryGovernanceEvent({
          status: "committed",
          memoryId: commitResult.id,
          pipelineMode: eligibility.pipelineMode,
          sessionId: options.sessionId || null,
          turnId: options.turnId || null,
        });
        recordMemoryGovernanceEvent({
          status: "promotion_refused",
          reasons: promotion.reasons || [],
          memoryId: commitResult.id,
          pipelineMode: eligibility.pipelineMode,
          sessionId: options.sessionId || null,
          turnId: options.turnId || null,
        });
      } else {
        recordMemoryGovernanceEvent({
          status: "committed",
          memoryId: commitResult.id,
          pipelineMode: eligibility.pipelineMode,
          sessionId: options.sessionId || null,
          turnId: options.turnId || null,
        });
      }

      return { ...commitResult, promotion };
    } catch (err) {
      console.error("[Memory Guardianship] 🚫 Hard Fail déclenché:", err.message);
      recordMemoryGovernanceEvent({
        status: "contract_violation",
        reason: err.message,
        failed_rules: finalFailedRules,
        pipelineMode: eligibility.pipelineMode,
        sessionId: options.sessionId || null,
        turnId: options.turnId || null,
      });
      return { status: 'contract_violation', error: err.message, failed_rules: finalFailedRules };
    }
  }
}

export const memoryOrchestrator = new MemoryOrchestrator();

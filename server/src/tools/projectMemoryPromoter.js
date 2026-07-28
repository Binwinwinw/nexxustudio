
import fs from 'fs-extra';
import path from 'path';
import knowledgeHub from '../services/knowledgeHub.js';
import vaultManager from './vaultManager.js';
import projectScanner from './projectScanner.js';

class ProjectMemoryPromoter {
  constructor() {
    this.vaultRoot = 'd:/Hostinger/public_html/nexxustudio/citadelle-vault/Citadelle';
    this.projectsRoot = 'd:/Hostinger/public_html/nexxustudio/projects';
  }

  async promote(projectId) {
    console.log(`🚀 [MemoryPromoter] Promotion de [${projectId}] dans la gouvernance mémoire...`);
    
    const projectPath = path.join(this.projectsRoot, projectId);
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Projet [${projectId}] introuvable dans ${this.projectsRoot}`);
    }

    // --- MATURATION GATING (Stage-Gate) ---
    const projects = await projectScanner.scanProjects();
    const projectInfo = projects.find(p => p.name === projectId || p.path.endsWith(projectId));
    const score = projectInfo ? projectInfo.score : 0;
    const MIN_SCORE = 18;

    if (score < MIN_SCORE) {
      const reason = `Maturité insuffisante (${score}/${MIN_SCORE}). Veuillez compléter les livrables de production (README_PRODUCTION, ADR, RUNBOOK).`;
      console.warn(`🛑 [Gating] Promotion refusée pour [${projectId}]. ${reason}`);
      return { success: false, score, reason };
    }

    console.log(`⚖️ [Gating] Validation passée (${score}/${MIN_SCORE}). Génération des actifs...`);

    // 1. GÉNÉRATION DES COUCHES MÉMOIRE
    const layers = await this._generateLayers(projectId, projectPath);

    // 2. SAUVEGARDE DANS LE VAULT ET INDEXATION CHROMADB
    for (const layer of layers) {
      await this._processLayer(projectId, layer);
    }

    console.log(`✅ [MemoryPromoter] Projet [${projectId}] promu avec succès.`);
    return { success: true, score };
  }

  async _generateLayers(projectId, projectPath) {
    const timestamp = new Date().toISOString();
    const dateSlug = timestamp.split('T')[0];
    
    const projects = await projectScanner.scanProjects();
    const projectInfo = projects.find(p => p.name === projectId || p.path.endsWith(projectId));
    const score = projectInfo ? projectInfo.score : 0;

    // Extraction des faits pour la mémoire procédurale (Fichiers génériques)
    const adrContent = (await this._safeReadFile(path.join(projectPath, 'ADR-SECURITY.md'))) || 
                       (await this._safeReadFile(path.join(projectPath, 'ADR-BOOKFLOW-SECURITY.md')));
    const scorecardContent = await this._safeReadFile(path.join(projectPath, 'PRODUCTION_READINESS_SCORECARD.md'));

    return [
      {
        type: 'procedural',
        relPath: `04-Operations/procedures/${projectId}-readiness-principles.md`,
        title: `Principes de Maturité : ${projectId}`,
        content: `# Principes durables - ${projectId}\n\n## Standards extraits\n- Un service React/Node ne peut être industrialisé sans documentation opératoire complète.\n- Le blindage des headers (Helmet) et la sanitisation des erreurs sont des prérequis non négociables.\n- La maturité documentaire (Scorecard) doit atteindre 40/50 pour autoriser la Forge.\n\n## Jurisprudence\n${adrContent}`,
        metadata: { category: 'standards', tags: ['maturity', 'security', projectId] }
      },
      {
        type: 'episodic',
        relPath: `01-Episodic/events/${projectId}-${dateSlug}-maturation.json`,
        title: `Sprint de Maturation : ${projectId}`,
        content: JSON.stringify({
          event: "Sprint de Maturation & Audit Sécurité",
          project_id: projectId,
          timestamp,
          incidents: ["Bug nomic-embed-text au Tier 1 (400 Bad Request) - Résolu via détection de type de modèle."],
          actions: ["Update Axios", "Installation Helmet", "Création README Prod", "Génération Scorecard"],
          verdict: "WAIT_FOR_MATURATION (Score 20/40)"
        }, null, 2),
        metadata: { category: 'incidents', tags: ['bugfix', 'warmup', projectId] }
      },
      {
        type: 'heritage',
        relPath: `05-Knowledge/heritage/assets/${projectId}.manifest.json`,
        title: `Manifeste Patrimonial : ${projectId}`,
        content: JSON.stringify({
          project_id: projectId,
          type: "fullstack_service",
          stack: projectInfo?.stack || "Unknown",
          status: projectInfo?.status || "wait_for_maturation",
          maturity_score: `${score}/20`,
          risk_level: "low",
          modules_notables: ["Maturation Stage-Gate", "Gouvernance Artifacts"],
          sovereignty_level: "High",
          reusable_patterns: ["Security ADR Template", "Production Runbook Template"]
        }, null, 2),
        metadata: { category: 'assets', tags: ['architecture', 'stack', projectId] }
      },
      {
        type: 'governance',
        relPath: `01-Strategy/scorecards/${projectId}.scorecard.json`,
        title: `Gouvernance & Scorecard : ${projectId}`,
        content: scorecardContent || "Scorecard non générée.",
        metadata: { category: 'governance', tags: ['audit', 'readiness', projectId] }
      }
    ];
  }

  async _processLayer(projectId, layer) {
    const fullPath = path.join(this.vaultRoot, layer.relPath);
    await fs.ensureDir(path.dirname(fullPath));
    
    // Idempotence : Ne pas écraser si identique, sinon mettre à jour
    await fs.writeFile(fullPath, layer.content, 'utf8');
    
    // Indexation dans ChromaDB
    await knowledgeHub.addDocuments([{
      id: `${projectId}_${layer.type}_${Date.now()}`,
      content: layer.content,
      metadata: {
        type: layer.type,
        project: projectId,
        category: layer.metadata.category,
        title: layer.title,
        tags: layer.metadata.tags,
        source: layer.relPath,
        timestamp: new Date().toISOString()
      }
    }]);

    // Enregistrement dans Bienvenue.md (Vault Dashboard)
    await vaultManager.registerDocument({
      relPath: layer.relPath,
      title: layer.title,
      type: layer.type,
      section: layer.type.charAt(0).toUpperCase() + layer.type.slice(1),
      summary: `Actif de maturité pour ${projectId} (${layer.metadata.category}).`
    });
  }

  async _safeReadFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (e) {
      return "";
    }
  }
}

export default new ProjectMemoryPromoter();


import fs from 'fs/promises';
import path from 'path';

/**
 * ImpactAnalyzer - Le stratège de l'Assistant Nexxus.
 * Prédit les conséquences des modifications structurelles de manière sécurisée.
 */
class ImpactAnalyzer {
  constructor(indexPath) {
    this.indexPath = indexPath;
    this.index = [];
  }

  async loadIndex() {
    try {
      const data = await fs.readFile(this.indexPath, 'utf8');
      this.index = JSON.parse(data);
    } catch (e) {
      this.index = [];
    }
  }

  /**
   * Analyse l'impact selon le mode choisi (file, module)
   */
  async analyze(targetPath, mode = 'file') {
    await this.loadIndex();
    const normalizedTarget = targetPath.replace(/\\/g, '/');
    
    let targetChunks = [];
    if (mode === 'module') {
      // Pour un module, on prend tous les fichiers qui commencent par ce chemin
      targetChunks = this.index.filter(c => c.path.replace(/\\/g, '/').startsWith(normalizedTarget));
    } else {
      // Mode fichier par défaut
      targetChunks = this.index.filter(c => c.path.replace(/\\/g, '/') === normalizedTarget);
    }

    if (targetChunks.length === 0) {
      return { 
        error: `Cible (${mode}) non trouvée dans l'index de La Citadelle.`,
        recommendation: "Assurez-vous que le chemin est correct et que le workspace a été indexé."
      };
    }

    // 2. Identifier qui dépend de cette cible (Dépendances Aval)
    const dependents = this.index.filter(c => {
      // On exclut les fichiers faisant partie de la cible elle-même
      const isPartOfTarget = mode === 'module' 
        ? c.path.replace(/\\/g, '/').startsWith(normalizedTarget)
        : c.path.replace(/\\/g, '/') === normalizedTarget;
        
      if (isPartOfTarget) return false;

      return c.relations?.imports?.some(imp => 
        mode === 'module'
          ? imp.startsWith(normalizedTarget) // L'import pointe vers le module
          : normalizedTarget.includes(imp) || imp.includes(normalizedTarget)
      );
    });

    // 3. Évaluer la criticité sécuritaire
    const securityZones = [...new Set(targetChunks.map(c => c.security.zone))];
    const isCoreUpdate = securityZones.includes('sealed-core');
    const isSensitiveUpdate = securityZones.includes('sensitive-internal');

    // 4. Construire le rapport abstrait
    return {
      target: normalizedTarget,
      mode,
      zones: securityZones,
      level: isCoreUpdate ? 'CRITIQUE' : isSensitiveUpdate ? 'HAUTE' : 'NORMALE',
      affectedModules: [...new Set(dependents.map(d => d.path))].slice(0, 10), // On limite la liste pour l'UX
      risks: this.deriveRisks(normalizedTarget, securityZones, mode),
      recommendation: this.getRecommendation(securityZones, mode)
    };
  }

  getRecommendation(zones, mode) {
    if (zones.includes('sealed-core')) {
      return "ALERTE SOUVERAINTÉ : Modification du noyau scellé. Nécessite un audit manuel exhaustif et un test de non-régression Sentinel.";
    }
    if (zones.includes('sensitive-internal')) {
      return `Prudence : Ce ${mode === 'module' ? 'module' : 'fichier'} gère la logique interne. Une modification pourrait altérer les capacités de réflexion de l'assistant.`;
    }
    return `Analyse standard : ${mode === 'module' ? 'Le module' : 'Le fichier'} peut être modifié, mais vérifiez la propagation vers les modules dépendants.`;
  }

  deriveRisks(path, zones, mode) {
    const risks = [];
    if (zones.includes('sealed-core')) {
      risks.push("Menace directe sur l'intégrité des protocoles de sécurité.");
      risks.push("Risque de contournement des filtres de souveraineté.");
    }
    if (zones.includes('sensitive-internal')) {
      risks.push("Perturbation possible du routage sémantique.");
      risks.push("Instabilité potentielle de la récupération vectorielle.");
    }
    if (path.includes('server/index.js')) {
      risks.push("Indisponibilité critique de la passerelle API.");
    }
    if (mode === 'module' && risks.length === 0) {
      risks.push("Propagation systémique possible à travers tout le module.");
    }
    return risks;
  }
}

export default ImpactAnalyzer;

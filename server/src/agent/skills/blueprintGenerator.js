/**
 * @deprecated Experimental — non branché au pipeline Forge vivant.
 * ADR-20260705-Tools-Layer-ProjectLibrary (Option B).
 * Réactivation nécessite ADR de sortie legacy + smoke test.
 */
import { vaultConsultant } from '../knowledge/vaultConsultant.js';

/**
 * BlueprintGenerator
 * Moteur de composition gouverné pour la transition Discovery -> Forge.
 * Implémente la Grille d'Acceptation Certifiée (GAC) v1.1.
 */
export class BlueprintGenerator {
  /**
   * Pipeline principal de génération
   */
  async generate(intent, maturityScore = 0) {
    console.log(`[BlueprintGenerator] 🚀 Démarrage de la génération pour : ${intent.substring(0, 50)}...`);

    if (maturityScore < 40) {
      return this.rejectBlueprint("Maturité Discovery insuffisante (< 40%). Clarifie le besoin dans le Chat.");
    }

    try {
      const grounding = await vaultConsultant.prepareGrounding(intent);
      const evidenceMap = this.buildEvidenceMap(grounding, grounding.verified_precedents);
      const blueprint = this.assembleBlueprint(intent, evidenceMap, grounding);

      return this.certifyBlueprint(blueprint);

    } catch (error) {
      console.error("[BlueprintGenerator] ❌ Erreur de génération :", error);
      return this.rejectBlueprint(`Erreur technique : ${error.message}`);
    }
  }

  buildEvidenceMap(grounding, precedents) {
    return {
      verified: [
        ...grounding.governance_constraints.map(g => `ADR: ${g.id} (Vault)`),
        ...precedents.map(e =>
          `Projet: ${e.projectName} (Knowledge Hub: ${(e.description || '').substring(0, 50)}...)`
        )
      ],
      projected: [
        "Architecture spécifique au module CE1",
        "Nouveaux composants React à définir",
        "Logique de progression sur 3 jours"
      ]
    };
  }

  assembleBlueprint(intent, map, grounding) {
    const sections = [
      "# 📐 BLUEPRINT TECHNIQUE [DRAFT]",
      `\n## 🎯 OBJECTIF\n${intent}`,
      `\n## 📂 ANCRAGE RÉEL\n${map.verified.map(v => `- [VÉRIFIÉ] ${v}`).join('\n')}`,
      `\n## 🧠 HYPOTHÈSES & PROJECTIONS\n${map.projected.map(p => `- [PROJETÉ] ${p}`).join('\n')}`,
      `\n## ⛓️ CONTRAINTES DE GOUVERNANCE\n${grounding.governance_constraints.map(c => `- ${c.content.substring(0, 100)}...`).join('\n')}`,
      `\n## 🛠️ PLAN FORGE (PROPOSÉ)\n1. Audit des signatures\n2. Création des squelettes\n3. Implémentation test-driven`,
      `\n## 📊 STATUT\n[EN COURS DE CERTIFICATION]`
    ];

    return sections.join('\n');
  }

  certifyBlueprint(markdown) {
    const hasObjective = markdown.includes('## 🎯 OBJECTIF');
    const hasEvidence = markdown.includes('[VÉRIFIÉ]');
    const hasPlan = markdown.includes('## 🛠️ PLAN FORGE');

    if (hasObjective && hasEvidence && hasPlan) {
      return markdown.replace('[EN COURS DE CERTIFICATION]', '[BLUEPRINT_CERTIFIED] ✅');
    }

    return markdown.replace('[EN COURS DE CERTIFICATION]', '[BLUEPRINT_INCOMPLETE] ⚠️');
  }

  rejectBlueprint(reason) {
    return `[BLUEPRINT_REJECTED] ❌\n\n**Raison** : ${reason}\n\n**Action** : Retournez en phase Discovery pour compléter les informations manquantes.`;
  }
}

export const blueprintGenerator = new BlueprintGenerator();

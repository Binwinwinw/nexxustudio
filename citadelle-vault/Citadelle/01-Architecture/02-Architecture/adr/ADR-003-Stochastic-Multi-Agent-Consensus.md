# ADR-003 : Intégration du Consensus Multi-Agents Stochastique (SMAC)

> [!IMPORTANT]
> **Statut** : Actif (Fusionné v3.1)
> **Date** : 2026-05-04
> **Portée** : Architecture de décision multi-agents Nexxus

## Contexte

Afin de renforcer la fiabilité des recommandations architecturales et de réduire les risques d'hallucinations lors de phases de conception complexes, La Citadelle nécessite un protocole de validation croisée. L'expérimentation menée le 04/05/2026 a validé l'efficacité de l'approche stochastique par rapport à une génération déterministe simple.

## 1. Définition Terminologique

**SMAC** : *Stochastic Multi-Agent Consensus*
**Note de Souveraineté** : Dans l'écosystème Nexxus, ce terme désigne exclusivement le protocole de vote probabiliste entre instances de LLM. Toute confusion avec des benchmarks de jeu (StarCraft) est proscrite au sein du Knowledge Hub.

## 2. Architecture Technique (SMAC-001)

L'implémentation repose sur trois piliers :
**Spawning Diversifié** : Instanciation de 3 à 5 agents "Experts" (ex: Architecte, Analyste, Mentor).
**Stochasticité Contrôlée** : Application de variations de température pour diversifier les perspectives :
    - **0.1 (Architecte)** : Garant de la structure et de la conformité ADR.
    - **0.2 (Analyste)** : Détection des failles et des incohérences logiques.
    - **0.4 (Auditeur)** : Exploration de patterns alternatifs et recul critique.
**Clustering Sémantique** : Agrégation des réponses par similarité vectorielle pour identifier le "chemin de vérité".

## 3. Critères de Convergence

Le pipeline de décision s'arrête selon les conditions suivantes :

**Seuils de Consensus (SOTA)** :
    - **0.75** : Seuil de confiance automatique.
    - **0.85** : Seuil exigeant une validation humaine.
    - **0.95+** : État "SOTA" validé.

**Limite Temporelle** : Maximum 3 itérations de boucle agentic.
**Stratégie de Cache** : Rétention de 14 jours avec clé de hachage contextuelle (Context + Version Modèle + Type d'arbitrage).

## 4. Justification

**Réduction des hallucinations** : Le consensus élimine les réponses marginales ou erronées.
**Robustesse** : Les recommandations sont validées par plusieurs perspectives expertes avant d'être présentées à l'utilisateur.
**Isolation Conceptuelle** : Clarification définitive du terme SMAC pour éviter les collisions sémantiques dans les futures recherches RAG.

## 5. Conséquences et Extensions

**Patrimoine** : Ce pattern est le standard pour [[02-Architecture/modules/MonCoachScolaire/_index|MonCoachScolaire]] et les arbitrages de [[01-Strategy/scorecards/ecommerce-sovereign-v1.scorecard.json|sécurité]].
**Généralisation** : Extension prévue à la validation de schémas DB et aux déploiements critiques.
**Observabilité** : Monitoring obligatoire des métriques p50/p95, tokens/coût et erreurs par route via le [[02-Architecture/modules/Cockpit-v3-1|Cockpit]].
**Instrumentation** : Logging obligatoire dans `/logs/smac/` pour auditabilité RGPD.

---

### 🔗 Liens de Parenté

- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[04-Operations/procedures/SMAC-PROTOCOL-IMPLEMENTATION|📜 Protocole d'Implémentation SMAC]]
- [[00-Manifeste-Doctrine|📜 Manifeste de la Citadelle]]

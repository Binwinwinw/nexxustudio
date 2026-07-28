# ADR-005 : Gouvernance de la Sécurité Souveraine

**Statut** : Approuvé
**Date** : 2026-05-04
**Auteur** : Nexxus Citadel Architect

## Contexte
La Nexxus Citadel v3.0 est un système agentique capable de modifier son propre code. Cette capacité, bien que puissante (SOTA), présente un risque de régression récursive ou de corruption du noyau système si elle est exercée sans garde-fous.

## Décision
Nous instaurons une séparation stricte entre le **Noyau (Immutable Core)** et la **Forge (Mutable Workspace)**.

### 1. Segmentation des Zones
*   **Zone Protégée (Noyau)** : 
    *   Chemin : `server/src/agent/**`, `server/index.js`, `package.json`.
    *   Politique : **Modification interdite sans approbation humaine explicite.**
    *   Protocole : Proposition de changement via `diff` uniquement + Snapshot préalable.
*   **Zone de Forge (Espace de Travail)** :
    *   Chemin : `public/**`, `server/data/projects/**`, `server/scripts/**`.
    *   Politique : **Modification agentique libre.**
    *   Protocole : Validation par l'Expert Auditeur et segmentation de flux ([[02-Architecture/adr/ADR-004-Continuity-Protocol|ADR-004]]).


### 2. Protocole de Modification du Noyau (Self-Improvement)
Toute tentative d'auto-amélioration du système doit suivre ce flux :
1.  **Diagnostic** : Nexxus identifie une faille ou une optimisation.
2.  **Draft** : Génération d'un correctif dans un fichier temporaire ou via un bloc de code.
3.  **Snapshot** : Création d'une copie de sauvegarde du fichier original.
4.  **Validation** : L'utilisateur (Architecte Humain) valide le changement.
5.  **Commit** : Application du changement.

### 3. Garde-fou d'Intention (IntentGuard)
L'utilitaire [[05-Knowledge/heritage/Composants-Souverains|intentGuards.js]] est chargé de détecter si une requête porte sur la Zone Protégée et doit lever un flag de sécurité spécifique.

## Conséquences
*   **Positives** : Immunité contre les boucles d'auto-destruction, traçabilité des changements système, stabilité industrielle.
*   **Négatives** : Processus d'évolution du noyau légèrement plus lent (nécessite une validation).

---
### ⚖️ Évolution de la Gouvernance
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]] (Rigueur v4.5)
- [[05-Knowledge/heritage/Composants-Souverains|🧱 Composants Souverains]] (IntentGuard & Audit)

---
### 🔗 Liens de Parenté
- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]


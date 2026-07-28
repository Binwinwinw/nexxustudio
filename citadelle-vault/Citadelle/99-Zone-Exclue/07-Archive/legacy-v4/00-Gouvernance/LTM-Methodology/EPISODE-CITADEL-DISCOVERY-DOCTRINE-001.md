# ÉPISODE : EPISODE-CITADEL-DISCOVERY-DOCTRINE-001

**Titre** : Doctrine "Blueprint Before Forge" (Chat vs Forge)
**Statut** : CERTIFIÉ & DOCTRINAL

## 🎯 OBJECTIF

Établir une frontière hermétique entre l'espace de conversation (Chat/Discovery) et l'espace de production (Forge/Exécution). Prévenir la dérive où le Chat tente de se substituer à la Forge prématurément.

## ⚖️ JURISPRUDENCE : LE PACTE DE SÉPARATION

La maturité de la Citadelle repose sur cette répartition des rôles :

### 1. Le Chat est un Espace de DISCOVERY

- **Mission** : Clarifier l'intention, cadrer le besoin, identifier les contraintes.
- **Livrable** : Un **Blueprint** (plan de conception) exploitable par la Forge.
- **Interdiction** : Ne pas tenter de réaliser l'exécution complète ou l'architecture end-to-end dans le chat.
- **Flexibilité** : Même si `FORGE_READY` est atteint, le canal Discovery reste ouvert pour l'enrichissement continu.

### 2. La Forge est l'Espace d'EXÉCUTION

- **Mission** : Concevoir l'architecture détaillée, produire le code, automatiser, auditer et exécuter.
- **Déclenchement** : Uniquement sur intention de conception confirmée et blueprint stabilisé.

### 3. Politique de Vérité Située

- Toute prévision ou proposition doit être **ancrée dans le réel** (Workspace, logs, contextes connus).
- Interdiction des abstractions élégantes mais non fondées.
- En cas de doute, Nexxus doit utiliser l'arbitrage (Multi-agent) ou marquer explicitement l'hypothèse.

## 🛠️ COMPOSANTS IMPACTÉS

- `systemPromptBuilder.js` : Intégration de la hiérarchie Discovery/Forge.
- `agentPipeline.js` : Routage basé sur l'intention de cadrage vs exécution.
- `conversation_benchmarks.json` : Test de "Non-Exécution Prématurée".

## 📝 NOTE DE CERTIFICATION

"Le Chat clarifie, la Forge exécute. Le Blueprint est le pont, jamais le Chat lui-même."

---
**Date d'archivage** : 2026-05-13
**Projet** : Nexxus Citadel

---

### 🧬 Références de Gouvernance

- [[00-Manifeste-Doctrine|📜 Manifeste de la Citadelle]] (Séparation Chat/Forge)
- [[02-Architecture/adr/ADR-005-Sovereign-Safety-Governance|⚖️ ADR-005 : Gouvernance de Sécurité]] (Segmentation des Zones)
- [[01-Strategy/LTM-Methodology/EPISODE-CITADEL-PERSONA-HARDENING-001|🛡️ Épisode 001 : Durcissement du Persona]]
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]] (Rigueur v4.5)

---

### 🔗 Liens de Parenté

- [[01-Episodic/Index-Episodic|📜 Index des Interactions & Épisodes]]
- [[Bienvenue|⬅ Retour à l'Index Central]]

# 🕸️ Architecture Nexxus Multi-Agents (v3.1)

Cette structure transforme Nexxus Citadel en une plateforme d'orchestration distribuée pilotée par la **Neural Matrix 4-Tiers**.

## 1. Le Triptyque d'Élite (Standard v3.1)
Le système ne repose plus sur des modèles isolés, mais sur une synergie de capacités spécialisées :

- **Le Stratège (Router/Planner)** : `deepseek-r1:8b` (Raisonnement analytique).
- **L'Artisan (Forge/Code)** : `starcoder2:15b` (Précision technique).
- **L'Âme (Identity/Chat)** : `nexxus-vox` (Réponse instantanée & Souveraine).

## 2. Système d'Experts par Divisions
L'orchestration est segmentée en domaines de compétences (Experts) gérés par l'**ExpertRouter** :

### Division [General] — Tour de Contrôle
- **Modèle** : `qwen3.5:4b` (Tier 1).
- **Experts** : Mentor, Analyste, Assistant.
- **Mission** : Qualification, accompagnement, discussion et cadrage léger.

### Division [Elite / Forge] — L'Usine
- **Modèle** : `starcoder2:15b` (Tier 2+).
- **Experts** : Developer, Lead Engineer, PM Elite.
- **Mission** : Production de code, refactorisation, build et tests unitaires.

### Division [Critical] — Haute Fidélité
- **Modèle** : `qwen3.5:27b` (Tier 3+).
- **Experts** : Auditeur Sécurité, Architecte Backend, Gouvernance.
- **Mission** : Audit de sécurité, validation structurelle et tâches à haut risque d'hallucination.

---

## 🔄 Workflow de Routage (Exemple : Audit de Sécurité)

1. **Qualification (Tier 1)** : Détection des intentions "Sécurité/Architecture".
2. **Planning (Tier 2 - Reasoner)** : `deepseek-r1:8b` décompose la mission en étapes critiques.
3. **Escalade (Tier 3 - Heavy)** : Chargement de `qwen3.5:27b` pour l'analyse profonde des vulnérabilités.
4. **Restitution** : Synthèse souveraine délivrée avec le timbre de Nexxus-Vox.

## 🛡️ Sceau de Rigueur
Chaque action est gouvernée par le **Sentinel Protocol** : validation systématique post-exécution pour garantir l'absence de régression.

---
**Version 3.1** : Industrialisée et stabilisée. 🏛️🏁

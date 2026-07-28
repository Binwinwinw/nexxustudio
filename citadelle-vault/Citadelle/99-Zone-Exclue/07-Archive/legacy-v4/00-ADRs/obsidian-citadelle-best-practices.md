# Obsidian Citadelle : Best Practices v1.0 (The Nexxus Touch)

> Ce document définit la gouvernance du Knowledge Hub de la Citadelle. Il combine les protocoles ADR-004/005 avec un workflow Obsidian optimisé.

## 🏗️ 1. Structure du Vault (SOTA)
L'organisation repose sur la séparation stricte entre le savoir immuable et l'espace de création.

- **00-ADRs/** : Décisions architecturales et Constitution (Immuables).
- **01-Modules/** : Contexte métier et Ingestion brute (ex: MonCoachScolaire, CGTM).
  - `/raw/` : Sources brutes via Web Clipper.
- **02-Tests/** : Logs de diagnostic et rapports de performance (ex: SOTA logs).
- **03-Forge/** : Livrables générés par Nexxus (#forge).
- **04-Scripts/** : Outils et automatismes (test_long_form_sota.js).
- **_index.md** : Index dynamique maintenu par Nexxus (liens [[ ]]).

## 🔌 2. Plugins Essentiels & Configuration
Installation requise pour transformer le Vault en Console de Commande.

1. **Obsidian Copilot** : Interface de discussion locale.
   - **Config** : Base URL `http://127.0.0.1:11434` | Model `deepseek-r1:14b` | API Key `local`.
2. **Dataview** : Monitoring live de la Forge.
   - *Query* : `LIST FROM #forge WHERE status = "ready"`
3. **Advanced URIs** : Boutons d'action (ex: Un clic pour lancer un Audit).
4. **Local Graph RAG (Neural Composer)** : Pour les requêtes complexes sur le graphe de connaissances.
5. **Web Clipper** : Pour l'ingestion automatique de sources SOTA.

## 🎨 3. Dashboard & Visualisation
- **Nexxus-Citadel-Core.canvas** : Mapping visuel des experts (JSON) ↔ Missions ↔ ADRs.
- **Graphe de Connaissances** : Visualisation des liens entre les modules et le noyau.

## ✍️ 4. Nexxus comme Scribe (Protocole)
Chaque livrable généré dans la **Forge** doit suivre ce format de métadonnées :

```markdown
---
tags: [forge, teams365]
status: validation
maturity: 0.95
date: 2026-05-05
---

# [Titre du Projet]
## Sources
Modem Guides, Obsilo Agent, Neural Composer.
```

## 🔄 5. Workflow Citadelle-Optimal
1. **Ingestion** : Web Clipper → `01-Modules/raw/`.
2. **Indexation** : Nexxus traite la source → Met à jour `_index.md` + crée les liens `[[ ]]`.
3. **Génération** : Activation ADR-004 → Flux long continu vers `03-Forge/`.
4. **Validation** : Phase de contrôle ADR-005 (Audit humain).
5. **RAG** : Inférence transversale via Copilot sur l'ensemble du Vault.

---
### 🧬 Gouvernance Associée
- [[02-Architecture/adr/ADR-004-Continuity-Protocol|🔄 ADR-004 : Protocole de Continuité]]
- [[02-Architecture/adr/ADR-005-Sovereign-Safety-Governance|⚖️ ADR-005 : Gouvernance de Sécurité]]
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]] (Rigueur v4.5)

---
### 🔗 Liens de Parenté
- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]


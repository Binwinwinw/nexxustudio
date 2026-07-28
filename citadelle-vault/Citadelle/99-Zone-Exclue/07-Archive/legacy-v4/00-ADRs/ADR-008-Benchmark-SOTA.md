# ADR-008 : Benchmark SOTA & Assimilation Technique

**Statut** : En revue
**Date** : 2026-05-05

## 🎯 Analyse Comparative (Citadelle vs Écosystème)

| Fonctionnalité | État Citadelle | Gap Identifié | Opportunité | Priorité |
| :--- | :--- | :--- | :--- | :--- |
| **Gouvernance** | SOTA (ADRs) | Aucun | Modèle de référence | - |
| **Opérations Obsidian** | Global (Bridge) | Format-Aware (.canvas) | Sous-skills par type de fichier | Haute |
| **Esthétique UI** | Standard (Tailwind) | AI Slop (Générique) | Anti-patterns & Polish (Impeccable) | Haute |
| **Recherche Locale** | Basique (Grep) | AST-aware Search | Recherche hybride (qmd style) | Très Haute |
| **Gestion Connaissance**| Vault Brut | Compilation Wiki | LLM-Wiki Compiler (Karpathy) | Haute |
| **Modularité Backend** | Centralisé | Persistence vs Cache | Noyau multitenant (Para style) | Moyenne |

## 🚀 Roadmap d'Assimilation

### 1. Renforcement du Runtime & Skills
- **Niveaux d'Agents** : Hiérarchie Oracle/Worker (Inspiré de OmC).
- **Sub-Skills Formats** : Découper `obsidian-governance` en micro-skills (Markdown, Canvas, CLI).

### 2. Esthétique Souveraine (Inspiré de Impeccable & Taste)
- **Anti-Slop UI** : Définir des interdits (Gradients génériques, cards imbriquées, typo browser).
- **Commandes Polish** : Intégrer des intentions `/audit`, `/polish` et `/normalize` dans le skill UI.

### 3. Intelligence Structurelle & Wiki (Inspiré de Karpathy & qmd)
- **Local Hybrid Search** : Moteur de recherche AST-aware pour le code.
- **LLM-Wiki Compiler** : Automatiser la compilation du Vault brut en un "Wiki de Connaissance" structuré (Concepts -> Articles -> Index).

### 4. Industrialisation
- **Modularité des Services** : Séparer proprement le stockage de l'indexation.
- **Samples & Tests** : Standardiser les dossiers `/samples/` pour chaque compétence.

#benchmark #sota #orchestration

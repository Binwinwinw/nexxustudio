# Skill : Obsidian Governance v2.1 (Wiki-Aware)

## 🎯 Mission
Opérer au cœur du Vault avec une précision chirurgicale selon le type de fichier.

## 📁 Sous-Capacités Spécialisées

### 1. [Markdown-Ops] (Notes, ADR, Index)
- **Standard** : GFM + Frontmatter YAML.
- **Règle** : Toujours vérifier les liens internes `[[ ]]`.
- **Ancrage** : Appliquer ADR-004 pour toute modification.

### 2. [Canvas-Ops] (Workflows, Cartographie)
- **Format** : JSON natif Obsidian Canvas.
- **Règle** : Ne jamais corrompre la structure des nœuds. Utiliser des IDs uniques.
- **Usage** : Pour les schémas de données et les flux logiques complexes.

### 3. [CLI-Ops] (Automatisation)
- **Outils** : Utilisation du bridge pour list, search, et walk.
- **Règle** : Prioriser la performance des scans récursifs.

### 4. [Wiki-Ops] (Capitalisation)
- **Standard** : Dossier `/Wiki` du Vault.
- **Règle** : Synthétiser les connaissances atomiques en pages thématiques.
- **Gouvernance** : Maintenir les index (ADR, Modules) et le graphe de dépendances.

### 5. [Bases-Ops] (Données Structurées)
- **Standard** : JSON/Bases Plugin.
- **Règle** : Maintenir l'intégrité des relations entre entités.

## 🛡️ Règle d'Or
Un changement de format = Un changement de protocole. Ne jamais traiter un Canvas comme du texte brut.

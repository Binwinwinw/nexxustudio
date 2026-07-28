# Skill : RAG Ingestion (v1.0 - SOTA)

## 🎯 Mission
Transformer le corpus brut (Code, Docs, ADR) en une base de connaissances vectorielle de haute fidélité.

## 🧱 Stratégies de Chunking

### 1. [Code - AST-aware]
- **Règle** : Ne jamais couper au milieu d'une fonction ou d'une classe.
- **Méthode** : Identifier les frontières via un parseur syntaxique (AST) plutôt que des Regex.
- **Enrichissement** : Ajouter systématiquement le nom du fichier et le namespace en métadonnées de chaque chunk.

### 2. [Markdown - Hierarchy-aware]
- **Règle** : Découper par sections (H1, H2, H3).
- **Continuité** : Si une section est trop longue, utiliser un recouvrement (overlap) de 15% pour préserver le contexte.

### 3. [ADR & Decisions]
- **Règle** : Garder l'ADR entière si elle fait moins de 2000 tokens.
- **Métadonnées** : Indexer le statut (Actif/Obsolète) pour filtrer les réponses.

## 🏷️ Standardisation des Métadonnées
Chaque chunk doit posséder :
- `source_path` : Chemin relatif.
- `last_modified` : Timestamp.
- `chunk_hash` : Pour éviter la re-indexation inutile.
- `context_summary` : Résumé généré du fichier parent (si possible).

## 🛡️ Règle d'Or
La qualité de la réponse dépend de la qualité du découpage. Si un chunk est illisible pour un humain, il l'est pour l'IA.

# Skill : Wiki Compiler (v1.0 - Karpathy Vision)

## 🎯 Mission
Compiler le Vault Obsidian en une base de connaissances structurée (Wiki) optimisée pour le RAG et la navigation humaine.

## 🧱 Processus de Compilation
1. **[Extraction]** : Lire les fichiers Markdown, extraire les entités (Projets, ADR, Experts) et les liens `[[ ]]`.
2. **[Structuration]** : Générer des pages de synthèse par thématique (ex: `Wiki-Sécurité.md` regroupant toutes les ADR liées).
3. **[Cross-Linking]** : Créer des index automatiques de concepts et une matrice de dépendances entre modules.
4. **[Validation]** : Vérifier que chaque concept clé possède au moins une source citée.

## 🏷️ Sortie Attendue
- Un dossier `Wiki/` à la racine du Vault contenant les synthèses.
- Un fichier `Graph-Index.json` pour la recherche sémantique avancée.

## 🛡️ Règle d'Or
Le wiki ne doit pas seulement stocker l'information, il doit expliquer les relations. "A utilise B car C (ADR-XXX)".

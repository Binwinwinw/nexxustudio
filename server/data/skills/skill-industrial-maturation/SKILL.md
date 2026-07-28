# Skill: Industrial Maturation (v1.0)
## Autorité Souveraine sur les Dépôts de Code

### Description
Ce skill permet à La Citadelle d'analyser, d'indexer et de maturer n'importe quel projet de développement sur le disque dur local. Elle utilise le Knowledge Hub (ChromaDB) et le CodeParser pour transformer du code brut en savoir actionnable.

### Capacités
- **`index-project [path]`** : Exécute `node scripts/citadel_indexer.js [path]` pour indexer un nouveau dépôt.
- **`audit-precision`** : Génère des questions "Goldens" et mesure la précision du RAG sur le projet.
- **`smac-arbitrate [issue]`** : Lance un consensus multi-agent sur un point technique du dépôt.
- **`forge-deployment`** : Génère Dockerfile et Docker-compose basés sur l'analyse du code.

### Déclencheurs (Triggers)
- "Analyse ce projet"
- "Indexe le dossier [path]"
- "Vérifie la maturité de [nom]"
- "Est-ce que le code respecte nos ADRs ?"

### Protocole de Sécurité (Gating de Souveraineté)
- **ACCORD EXPLICITE REQUIS** : La Citadelle ne peut scanner ou indexer un nouveau dossier sans une confirmation textuelle directe de l'utilisateur pour ce chemin spécifique.
- Ne jamais indexer `node_modules`, `.git`, ou les dossiers de données sensibles.
- Toujours vérifier l'existence du dossier avant de lancer le scan.
- Rapporter les erreurs d'embedding (code 500) pour ajuster le découpage (chunking).

#tags: #maturation #industrial #rag #indexing

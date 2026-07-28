# server/cache — dérivés régénérables

Ces fichiers **ne sont pas** des sources de vérité. Ils accélèrent le runtime et se reconstruisent.

| Fichier | Source | Régénération |
|---------|--------|--------------|
| `experts_cache.json` | `server/data/experts/*.json` | bootstrap `expertRouter` (écriture auto) |
| `workspace_index.json` | indexation workspace | `citadel_indexer.js` / `workspaceIndexer` |

Supprimer ce dossier ne doit pas casser le boot : au pire, latence jusqu’à reconstruction.

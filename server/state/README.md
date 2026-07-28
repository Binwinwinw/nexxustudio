# server/state — état runtime mutable

Ce dossier contient de l’état **opérationnel** (sessions, mémoire de travail), pas des sources de vérité versionnables.

| Sous-chemin | Rôle |
|-------------|------|
| `sessions/` | Persistance fichiers sessions chat (`sessionStore.js`) |
| `session-work-memory/` | Mémoire de travail par session + `episodes.jsonl` + `candidate_facts.json` |

Traitement : rétention / prune / redémarrage serveur après migration de chemins. Ne pas confondre avec `server/data/memory/` (LTM).

Les stores doivent créer ces dossiers via `ensureDir` / `mkdirSync` s’ils sont absents.

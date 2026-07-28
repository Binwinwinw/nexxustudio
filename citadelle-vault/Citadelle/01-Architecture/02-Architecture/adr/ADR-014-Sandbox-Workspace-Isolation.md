# ADR 014 : Isolation Contrôlée (Workspaces & Sandboxes)

## Contexte
La Citadelle a besoin de modifier du code local de manière autonome sans risquer de corrompre l'hôte, d'exposer des racines systèmes ou de créer une vulnérabilité exploitable (Path Traversal, Shell Injection). Un système de worktrees Git combiné à une isolation Docker s'est imposé, nécessitant un cadre de sécurité strict ("Fail-Closed") et un cycle de vie fortement monitoré (Day-Two Operations).

## Décision

Nous avons déployé un triptyque d'isolation stricte : **Dossier Autorisé → Workspace Dédié → Sandbox d'Exécution**.

### 1. Modes de Workspace
Trois modes de cycle de vie sont implémentés :
- `analysis` : Lecture seule logique sur la source (pas de copie).
- `git_worktree` : Branche isolée créée via `git worktree add` (protection totale du dépôt principal).
- `sandbox_copy` : Copie physique et isolée du dossier pour les cibles non-Git.

### 2. Profils d'Exécution Sandbox
Le Runner Docker expose uniquement trois profils scellés :
- `analysis_readonly` : Montage du workspace en RO, réseau éteint.
- `dev_patch` : Montage du workspace en RW, réseau éteint.
- `local_only` : Montage en RW, réseau sur host (limité aux tests locaux).

### 3. Pilotage API
Le pilotage s'effectue exclusivement par **workspaceId**. Après la création (protégée par Rate Limit et Whitelists), plus aucun chemin absolu n'est passé au frontend. Les requêtes ciblent `GET/POST/DELETE /api/workspaces/:id`.

### 4. Observabilité Opérationnelle (Day-Two)
La santé du système est surveillée via :
- La persistance en JSONL des audits de runs (`server/logs/workspace_runs.jsonl`).
- L'endpoint agrégé `GET /api/workspaces/health`.
- Une vue UI directement injectée en SPA dans le Cockpit d'Observabilité v5.0.

## Guardrails non négociables
Pour garantir la sécurité de la machine hôte, les barrières suivantes ne doivent **jamais** être assouplies sans un nouvel ADR formel :
1. **Docker Security** : Le conteneur doit systématiquement démarrer avec : `user=1000:1000`, `--security-opt=no-new-privileges:true`, `--cap-drop=ALL` et `--network=none` (sauf profil spécifique).
2. **Images Allowlistées** : Interdiction formelle pour l'agent de tirer une image arbitraire (`node:20-alpine`, `python:3.11-alpine`, `alpine:latest` uniquement).
3. **Zéro Shell Injection** : L'API Git (`gitService.js`) interagit exclusivement via `child_process.execFile` (pas d'invocation de subshell).
4. **Symlink Escape Block** : La fonction `realpathSync` valide l'appartenance physique finale de tout dossier avant création.

## Conséquences
- **Avantages** : L'agent de développement est maintenant totalement borné et observable. Le "Blast Radius" d'une erreur d'IA ou d'une injection de code est contenu dans un Worktree jetable.
- **Inconvénients / Baseline à 7 jours** : La gestion physique des worktrees et des conteneurs consomme plus de ressources I/O. Une baseline heuristique d'observation sur 7 jours est actée avant tout nouveau durcissement des profils.

## Limitations Connues (Futures Améliorations)
- **Persistance Synchrone** : La méthode `_persistLog` utilise actuellement un `fs.appendFileSync`. Cela devra être basculé vers une file asynchrone (stream/buffer) en cas de haute volumétrie de runs.
- **Agrégation API limitative** : L'endpoint `/health` ne lit que les 100 dernières lignes du JSONL pour des raisons de performance.
- **Dépendance Docker Local** : Le système suppose qu'un *daemon* Docker réactif et correctement configuré est présent localement.

## Alternatives Rejetées
- **Montage du socket Docker (`/var/run/docker.sock`) dans un conteneur** : Rejeté (équivalent à un accès root sur l'hôte).
- **Modification directe sur la source** : Rejeté (risque de corruption épistémique et fonctionnelle).
- **Application Web MPA Séparée** : Rejetée. L'observabilité a été fondue dans la SPA (Cockpit) pour limiter la dispersion cognitive.

## Statut
**Accepté et Implémenté**

## Date / Auteur
22/05/2026 - Nexxus (au nom de La Citadelle)

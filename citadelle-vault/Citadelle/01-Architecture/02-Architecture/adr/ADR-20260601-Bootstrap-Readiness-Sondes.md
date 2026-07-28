# ADR-20260601 : Bootstrap, sondes live/startup/ready et boot_trace_id

## Statut
**Validé** (01/06/2026)

## Contexte

M1-S1 a introduit les traces corrélées (`trace_id` par tour) et le panneau debug Cockpit. Il restait un angle mort : **le démarrage et le warmup** produisaient des faux positifs de santé (`GET /api/health` renvoyait toujours `ready`) et des échecs silencieux (config warmup, modèle Ollama, routeur non initialisé).

Les guides de health checks (Kubernetes, cloud-native) recommandent de séparer :

- **Liveness** — le process répond-il ?
- **Startup** — l'initialisation (warmup) est-elle terminée ?
- **Readiness** — peut-on servir du trafic réel ?

Sans cette séparation, un smoke test ou un orchestrateur externe peut considérer le système opérationnel alors que granite n'est pas chargé ou que le routeur n'est pas prêt.

## Décision

Introduire un **bootstrap opérateur minimal** (M1-S2) avec trois sondes HTTP distinctes, un journal bootstrap corrélé par `boot_trace_id`, et une section Cockpit dédiée.

### Non-objectifs (M1-S2)

- Installateur USB 64 Go complet (M6)
- Export Prometheus / OTLP des sondes
- Authentification sur les endpoints santé infra (L4 public local documenté)
- Fusion de `startup` et `ready` en un seul endpoint
- Remplacement de `/api/ready` legacy (maintenu pour compatibilité UI)

---

## 1. Endpoints

| Endpoint | Alias | HTTP | Rôle |
|----------|-------|------|------|
| `GET /api/health/live` | `/health/live` | **200** toujours si handler OK | Process vivant ; **aucun** check externe lourd |
| `GET /api/health/startup` | `/health/startup` | **200** / **503** | Warmup initial terminé (routeur + phase warmup) |
| `GET /api/health/ready` | `/health/ready` | **200** / **503** | Trafic chat autorisé (dépendances critiques) |
| `GET /api/bootstrap/diagnostics` | — | **200** | Journal bootstrap + état agrégé des sondes |
| `GET /api/health` | — | **200** (live) | **Legacy** : résumé + liens vers les sondes ; ne pas utiliser seul pour readiness |

**Règle opérateur** : le smoke test et la supervision légère pointent sur **`/api/health/live`**. Seuls bootstrap et orchestration attendent `startup` puis `ready`.

---

## 2. Schémas JSON

### 2.1 Live

```json
{
  "status": "live",
  "probe": "live",
  "trace_id": "uuid-boot",
  "ok": true,
  "httpStatus": 200,
  "uptime_s": 44,
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

### 2.2 Startup

```json
{
  "status": "starting",
  "probe": "startup",
  "trace_id": "uuid-boot",
  "ok": false,
  "httpStatus": 503,
  "router_ready": true,
  "warmup_phase": "tier1_loading",
  "warmup_is_ready": false,
  "reasons": ["warmup_phase_tier1_loading"],
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

**200** lorsque `router_ready === true` **et** `warmup_phase ∈ { ready, partial_ready }` (ou `warmup_is_ready === true`).

### 2.3 Ready

```json
{
  "status": "not_ready",
  "probe": "ready",
  "trace_id": "uuid-boot",
  "ok": false,
  "httpStatus": 503,
  "router_ready": true,
  "warmup_phase": "tier2_warming",
  "warmup_is_ready": false,
  "knowledge_hub": "degraded",
  "models": {
    "chat": "ready",
    "embed": "warming"
  },
  "reasons": ["warmup_not_ready"],
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

**200** lorsque :

- `router_ready === true`
- `warmup_is_ready === true`
- `models.chat === "ready"` (`granite4.1:8b`)
- `models.embed ∈ { "ready", "lazy" }` (`nomic-embed-text:latest`)

**Knowledge Hub** : `degraded` si Chroma injoignable — **n'empêche pas** le passage à ready (fil chat autonome).

### 2.4 Diagnostics bootstrap

```json
{
  "boot_trace_id": "uuid-boot",
  "events": [
    {
      "timestamp": "2026-06-01T11:59:55.000Z",
      "trace_id": "uuid-boot",
      "event": "warmup.model.failed",
      "status": "error",
      "message": "tier1: granite4.1:8b timeout — TIMEOUT",
      "phase": "tier1_loading",
      "model": "granite4.1:8b"
    }
  ],
  "probes": {
    "live": "live",
    "startup": "started",
    "ready": "ready"
  },
  "warmup": {
    "phase": "ready",
    "isReady": true,
    "models": { "granite4.1:8b": "ready" }
  },
  "timestamps": {
    "server_started_at": "…",
    "router_ready_at": "…",
    "knowledge_hub_ready_at": "…"
  }
}
```

---

## 3. boot_trace_id

| Propriété | Valeur |
|-----------|--------|
| Portée | **Un cycle de vie process** (du `listen` au restart nodemon) |
| Format | UUID v4 |
| Distinction | **`trace_id` tour** (M1-S1) ≠ **`boot_trace_id`** (M1-S2) |
| Initialisation | `initBootstrapDiagnostics()` au boot, avant warmup |
| Propagation | Toutes les réponses sondes ; champ `trace_id` = `boot_trace_id` |
| Logs | JSON structuré `{ source: "bootstrap", trace_id, event, status }` |
| Stockage | Ring buffer 30 événements en mémoire (`bootstrapDiagnostics.js`) |

Les événements bootstrap **ne** remplacent **pas** les traces tour dans `traceStore`. En cas d'erreur warmup, le Cockpit affiche `boot_trace_id` et tente une corrélation via le panneau debug.

---

## 4. Script bootstrap opérateur

**Fichier** : `server/scripts/bootstrap-citadelle.mjs`  
**Commande** : `npm run bootstrap` (racine ou `server/`)

Séquence :

1. Node ≥ 18, `.env`, `npm install` si absent
2. Ping Ollama (warn ; `--strict` = fail)
3. Détection serveur sur `PORT` (défaut 3000)
4. Attente `live` → `startup` (timeout configurable, défaut 180 s) → `ready`
5. Sortie **0** + `trace_id` ou **1** + message + `trace_id`

| Flag | Effet |
|------|-------|
| `--start-server` | Lance `node index.js` en arrière-plan |
| `--no-start` | Échec si serveur absent |
| `--fast` | `OLLAMA_BOOT_PROFILE=fast` si démarrage serveur |
| `--skip-ready` | Ne vérifie que live + startup |
| `--timeout-warmup=N` | Timeout ms pour startup |
| `--strict` | Ollama et `.env` obligatoires |

---

## 5. Fast path développement

| Mécanisme | Usage |
|-----------|--------|
| `npm run start:fast` | `OLLAMA_BOOT_PROFILE=fast` — tier-2 warmup ignoré |
| `bootstrap --fast` | Idem si `--start-server` |
| `smoke-test` → `/api/health/live` | Ne bloque pas sur warmup en cours |
| `ready` strict | Réservé bootstrap prod et validation opérateur |

**Ne pas** assouplir `ready` en dev : utiliser le fast profile plutôt que de mentir sur la readiness.

---

## 6. Règles Cockpit (panneau DEBUG TRACES)

Section **Bootstrap / Warmup** :

- Poll `GET /api/bootstrap/diagnostics` toutes les 8 s si panneau ouvert
- Affiche `live` / `startup` / `ready` / `warmup.phase`
- Affiche `boot_trace_id` copiable
- Liste les 6 derniers événements bootstrap
- **Auto-sélection** : si événement `status: error`, enregistre `boot_trace_id` dans l'état opérateur (`source: bootstrap`)

Les erreurs de tour chat (`trace_id` M1) et les erreurs bootstrap (`boot_trace_id` M2) coexistent sans fusion de schéma.

---

## 7. Matrice d'échecs

| Code / événement | Cause | Sonde impactée | HTTP | Action opérateur |
|------------------|-------|----------------|------|------------------|
| `boot.start` | Process démarré | — | — | Normal |
| `router.init.error` | Échec init expertRouter | startup, ready | 503 | Logs + redémarrer ; vérifier embeddings |
| `router.ready` | Routeur OK | startup progresse | — | Normal |
| `knowledge_hub.degraded` | Chroma injoignable | ready (hub degraded) | ready peut être 200 | Lancer chroma ; RAG limité |
| `knowledge_hub.ready` | Chroma OK | — | — | Normal |
| `warmup.config.error` | `warmup.matrix.json` illisible | startup → partial_ready | startup 200, ready 503 | Corriger config |
| `warmup.start` | Début warmup | startup | 503 | Attendre |
| `warmup.model.failed` | Modèle tier timeout/fail | startup/ready selon tier | 503 si tier1 critique | Ollama, VRAM, `--fast` |
| `warmup.tier1.degraded` | Échec dur tier-1 | startup 200 partial | ready 503 | Vérifier granite + embed |
| `warmup.tier2.skip` | Profil fast | — | — | Normal dev |
| `warmup.ready` | Warmup essentiel fini | ready | 200 si models OK | Normal |
| `warmup_phase_tier1_loading` | En cours | startup | 503 | Attendre bootstrap |
| `warmup_phase_tier2_warming` | En cours | startup | 503 | Attendre |
| `warmup_not_ready` | `isReady` false | ready | 503 | Attendre ou diagnostiquer |
| `model_granite_not_ready` | Chat model absent | ready | 503 | Ollama pull / VRAM |
| `model_embed_not_ready` | Embed absent | ready | 503 | Ollama pull embed |
| `router_not_ready` | Routeur en init | startup, ready | 503 | Attendre ou logs router |

---

## 8. Implémentation (référence)

| Fichier | Rôle |
|---------|------|
| `server/src/services/healthProbeService.js` | Logique pure live/startup/ready |
| `server/src/services/bootstrapDiagnostics.js` | Journal + `boot_trace_id` |
| `server/src/services/warmupService.js` | Émission événements warmup |
| `server/index.js` | Routes sondes + diagnostics |
| `server/scripts/bootstrap-citadelle.mjs` | CLI opérateur |
| `server/tests/health-probes.test.js` | 5 tests sans LLM |
| `src/components/Cockpit/TraceDebugPanel.jsx` | Section bootstrap |

---

## 9. Liens

- [[ADR-20260530-Traces-MVP-Correlées|Traces MVP corrélées]] — `trace_id` tour
- [[Roadmap-6-Mois-Prouver-Avant-Ouvrir|Roadmap 6 mois]] — cap M1
- [[04-Operations/procedures/Checklist-Audit-Securite-API|Checklist sécurité API]] — L4 health public local

## Conséquences

### Positives
- Fin des faux positifs `/api/health` pendant warmup
- Bootstrap reproductible one-command
- Incidents démarrage traçables et visibles Cockpit

### Compromis
- Trois endpoints à documenter (vs un seul simpliste)
- `partial_ready` autorise startup 200 avec ready 503 — comportement voulu

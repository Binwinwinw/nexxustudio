# ADR-20260530 : API v1 + InferenceProvider

## Statut
**Validé** (30/05/2026)

## Contexte

La Citadelle expose de nombreux endpoints (`/api/stream`, `/api/forge/*`, `/api/knowledge/*`, `/api/sessions/*`, …) **sans versionnement ni contrat OpenAPI**. Toute ouverture à des connecteurs externes (H2) figerait des interfaces instables.

Côté inférence, `llmFactory.js` route déjà Ollama et AirLLM, mais sans interface formelle : ajouter vLLM ou un worker distant (H3) impliquerait aujourd'hui un refactor transversal.

La roadmap « Prouver avant d'ouvrir » exige de **figer les interfaces tôt** sans implémenter H3 prématurément.

## Décision

Adopter deux contrats stables en parallèle :

1. **`/api/v1/*`** — surface HTTP versionnée + OpenAPI minimal
2. **`InferenceProvider`** — abstraction inférence backend-agnostique

---

## Partie A — API v1

### Principes

- Préfixe **`/api/v1/`** pour tout nouveau contrat public
- Endpoints legacy (`/api/stream`, …) maintenus en **proxy / alias** jusqu'à deprecation documentée
- OpenAPI 3.1 publié à `/api/v1/openapi.json`
- Breaking changes = bump `v2` uniquement ; `v1` stable 6 mois minimum

### Ressources v1 (M5, spec M2)

| Ressource | Méthodes | Notes |
|-----------|----------|-------|
| `/v1/chat/stream` | POST (SSE) | Alias évolutif de `/api/stream` |
| `/v1/sessions` | GET, POST | Liste + création |
| `/v1/sessions/{id}` | GET, DELETE | Détail + purge |
| `/v1/sessions/{id}/messages` | GET | Historique event store |
| `/v1/forge/jobs` | GET, POST | Lancement + liste |
| `/v1/forge/jobs/{id}` | GET | Statut + stream URL |
| `/v1/forge/jobs/{id}/artifacts` | GET | Liste artefacts |
| `/v1/knowledge/query` | POST | RAG (auth interne ou scope) |
| `/v1/telemetry/traces/{trace_id}` | GET | Traces MVP (ADR traces) |
| `/v1/health` | GET | Ready + warmup + versions |

### Enveloppe de réponse standard

```json
{
  "data": { },
  "meta": {
    "trace_id": "uuid",
    "span_id": "hex",
    "api_version": "v1",
    "timestamp": "ISO-8601"
  },
  "error": null
}
```

Erreurs :

```json
{
  "data": null,
  "meta": { "trace_id": "…", "api_version": "v1" },
  "error": {
    "code": "EPISTEMIC_REFUSAL",
    "message": "…",
    "details": {}
  }
}
```

### Authentification v1

- Session cookie (existant) pour UI
- Bearer JWT pour intégrations
- Header `X-Internal-Token` réservé ops (inchangé)
- Scopes connecteurs (H2) : `files:read`, `git:read`, `vault:read`, …

---

## Partie B — InferenceProvider

### Interface (TypeScript / JSDoc — M2)

```javascript
/**
 * @typedef {object} InferenceProvider
 * @property {string} id — ex: "ollama", "airllm", "vllm"
 * @property {(model: string, onLog?: Function) => Promise<void>} ensureModel
 * @property {(messages: Array, model: string, options?: object) => Promise<object>} chat
 * @property {(messages: Array, model: string, options?: object) => AsyncIterable} stream
 * @property {(text: string, model: string) => Promise<number[]>} embed
 * @property {() => Promise<{ ok: boolean, latency_ms: number, details?: object }>} health
 */
```

### Contrat opérationnel

| Méthode | Sémantique | Observabilité |
|---------|------------|---------------|
| `ensureModel` | Charge modèle en VRAM / vérifie disponibilité | Span `llm.ensure` |
| `chat` | Inférence synchrone complète | Span `llm.call` |
| `stream` | Tokens SSE/async iterator | Span `llm.stream` + métriques TTFT/TPS |
| `embed` | Vecteur embedding | Span `llm.embed` |
| `health` | Ping backend (Ollama `/api/tags`, etc.) | Inclus dans `/v1/health` |

### Règles

- **Un provider actif par rôle** (`CHAT`, `FORGE`, `EMBED`) configurable via env
- Fallback explicite documenté : `AIRLLM → Ollama` (comportement actuel préservé)
- Aucun appel direct `ollama.chat` hors provider après migration M5
- Cloud provider (H2 optionnel) : implémentation séparée `cloud-openai` avec flag `ALLOW_CLOUD_INFERENCE=1` + scope tâche

### Registre provider (M2 spec, M5 impl)

```
server/src/llm/providers/
├── InferenceProvider.js      # interface + validation
├── ollamaProvider.js         # impl default M2
├── airllmProvider.js         # wrap existant
└── registry.js               # résolution par env / rôle
```

`llmFactory.js` devient façade mince :

```javascript
export function getProviderForModel(model) {
  return providerRegistry.resolve(model);
}
```

### Profils modèles (env)

| Profil | CHAT | REASONER | FORGE | EMBED |
|--------|------|----------|-------|-------|
| `balanced` | granite4.1:8b | deepseek-r1:8b | starcoder2:15b | nomic-embed-text |
| `fast` | granite4.1:8b | granite4.1:8b | starcoder2:15b | nomic-embed-text |
| `demo` | granite4.1:8b | deepseek-r1:8b | starcoder2:15b | nomic-embed-text |

---

## Conséquences

### Positives
- Connecteurs H2 consomment un contrat stable
- Benchmarks et traces uniformes quel que soit le backend
- vLLM / workers distants = nouvelle impl, pas refonte Nexxus

### Négatives / Compromis
- Double maintenance legacy + v1 transitoire (6 mois)
- Interface figée early — évolutions via extensions optionnelles, pas breaking

## Plan d'implémentation

| Mois | Livrable |
|------|----------|
| M2 | Interface `InferenceProvider` + `ollamaProvider` + tests mock |
| M3 | `meta.trace_id` dans enveloppe v1 (spec) |
| M5 | Routes `/api/v1/*` + OpenAPI + migration docs |
| M5 | Connecteurs consomment v1 uniquement |
| M6 | `vllmProvider` stub + benchmark comparatif |

## Critères d'acceptation

- [ ] OpenAPI v1 couvre chat, sessions, forge, health, traces
- [ ] 100 % appels LLM passent par provider en M6
- [ ] Test : swap provider mock ↔ ollama sans changement pipeline

## Liens

- [[01-Strategy/Roadmap-6-Mois-Prouver-Avant-Ouvrir|Roadmap 6 mois]]
- [[ADR-20260530-Traces-MVP-Correlées|ADR Traces MVP]]
- `server/src/llm/llmFactory.js`
- [[ADR-012-IBM-Granite-Long-Context|Granite Long Context]]

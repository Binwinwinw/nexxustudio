# ADR-20260530 : Traces MVP corrélées

## Statut
**Validé** (30/05/2026)

## Contexte

La Citadelle dispose déjà de briques d'observabilité fragmentées :

- `otelSemanticMap.js` — noms de spans et attributs compatibles OpenTelemetry
- `turnTelemetry.js` — spans internes (`intent.classify`, `prompt.build`, `llm.call`, …)
- Cockpit, `/api/telemetry/cockpit`, analytics dashboard
- Logs console non corrélés entre session, routeur, expert, retrieval et Forge

Pour un projet **solo local-first**, la valeur immédiate n'est pas un backend OTEL complet, mais la **propagation de contexte** : relier une requête utilisateur à tous les sous-systèmes traversés (principe OTEL : trace = arbre de spans liés par contexte partagé).

Sans `trace_id` / `span_id` visibles dans l'API, les logs et l'UI, tout diagnostic reste artisanal.

## Décision

Introduire un **MVP traces JSON corrélées** avant toute exportation OTLP/Jaeger.

### 1. Identifiants de corrélation

| Identifiant | Portée | Format |
|-------------|--------|--------|
| `trace_id` | Un tour utilisateur complet (requête → réponse ou erreur) | UUID v4 |
| `span_id` | Une étape dans le tour | UUID v4 court ou hex 16 chars |
| `parent_span_id` | Lien hiérarchique | Référence au span parent |
| `session_id` | Fil conversationnel | Existant (`req.sessionId`) |
| `turn_id` | Alias sémantique = racine du tour | = `trace_id` ou champ dérivé explicite |

**Règle** : un seul système d'identifiants — pas de second schéma parallèle (pas de `requestId` ad hoc séparé).

### 2. Propagation obligatoire

`trace_id` et `span_id` courant doivent apparaître dans :

| Surface | Mécanisme |
|---------|-----------|
| Réponses API | Header `X-Trace-Id` + corps JSON `{ meta: { trace_id, span_id } }` sur `/api/stream`, `/api/ready`, erreurs 4xx/5xx |
| Logs serveur | Préfixe structuré `[trace_id=… span=… session=…]` ou JSON log line |
| Événements UI | SSE events incluent `trace_id` ; Cockpit / Sentinel affichent le dernier trace actif |
| Jobs Forge | `trace_id` hérité du tour chat déclencheur, stocké dans `job.meta` |

### 3. Modèle de span (MVP)

Réutiliser `SPAN_NAMES` et `OTEL_ATTRIBUTES` de `otelSemanticMap.js`.

Arbre minimal par tour :

```
nexxus.turn (root)
├── intent.classify
├── policy.route
├── router.* (semantic | lexical | hydration)
├── memory.read (si applicable)
├── retrieval.search (si RAG)
├── llm.call (1..n)
├── tool.call (si expert/outil)
├── response.validate
└── memory.write (si applicable)
```

Chaque span enregistre :
- `name`, `span_id`, `parent_span_id`, `trace_id`
- `start_ms`, `end_ms`, `status` (`ok` | `error`)
- Attributs du semantic map pertinents (`nexxus.intent`, `gen_ai.model`, …)
- `error.message` si échec

### 4. Stockage et consultation (M1)

- **Ring buffer mémoire** : 500 traces récentes (configurable)
- **Endpoint** : `GET /api/traces/:trace_id` → JSON arbre complet
- **Endpoint** : `GET /api/traces?session_id=…&limit=20` → liste résumée
- Pas de dépendance externe (Jaeger, Grafana) en M1

Export OTLP : **hors scope M1**, prévu H3 si besoin.

### 5. Intégration `turnTelemetry`

Étendre `turnTelemetry` existant :

```javascript
// Contrat cible (M1)
turnTelemetry.startTrace({ sessionId, query });
turnTelemetry.startSpan(SPAN_NAMES.INTENT, { parent?: root });
turnTelemetry.endSpan(SPAN_NAMES.INTENT, { status: 'ok', attributes: {} });
turnTelemetry.finishTrace({ status, responseMode });
turnTelemetry.exportTrace(traceId); // → JSON
```

Ne pas dupliquer la logique spans — migrer les appels existants (`PromptStage`, `ollama.js`) vers l'API unifiée.

### 6. Evals de sortie (complément golden routing)

5–10 cas critiques avec assertions sur **sortie visible** (pas seulement intent) :

| Cas | Assertion |
|-----|-----------|
| Salut + identité | Pas de refus épistémique ; pas de fuite `<think>` |
| Idéation courte | Mode OPEN_PROPOSITION ou proposition ; pas SIMPLE_FAST refus |
| Signal faible | Refus canonique exact |
| Rappel fil | Pas de mention « hier » si query dit « précédemment » |
| Doc joint | Mode DOCUMENT ; grounding |

Exécution **sans LLM live** (mocks ou fast-path déterministe) dans `premerge`.

## Conséquences

### Positives
- Diagnostic bout-en-bout en une requête `GET /api/traces/:id`
- Base OTEL-ready sans coût ops immédiat
- Golden + evals = prouvabilité qualité, pas seulement routage

### Négatives / Compromis
- Ring buffer = pas d'historique long terme (acceptable M1)
- Légère surcharge JSON par requête (~200 bytes meta)
- Migration progressive des logs console vers format structuré

## Plan d'implémentation

| Phase | Fichiers / actions |
|-------|-------------------|
| S1 | `server/src/agent/telemetry/traceStore.js` (ring buffer) |
| S1 | Extension `turnTelemetry.js` : trace root + export |
| S2 | `/api/stream` : émission `trace_id` SSE + header |
| S2 | `index.js` : routes `/api/traces` |
| S3 | Logs structurés dans pipeline + Forge jobs |
| S3 | UI : affichage trace_id dans Cockpit / erreurs chat |
| S4 | Tests : corrélation trace, evals sortie 5 cas |

## Critères d'acceptation M1

- [ ] 100 % des tours stream ont un `trace_id` unique
- [ ] `GET /api/traces/:id` retourne l'arbre complet ≤ 50 ms (mémoire)
- [ ] Logs serveur d'un tour filtrables par `trace_id`
- [ ] 5 evals sortie PASS dans premerge

## Liens

- [[01-Strategy/Roadmap-6-Mois-Prouver-Avant-Ouvrir|Roadmap 6 mois]]
- [[ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- `server/src/agent/telemetry/otelSemanticMap.js`
- `server/src/agent/telemetry/turnTelemetry.js`

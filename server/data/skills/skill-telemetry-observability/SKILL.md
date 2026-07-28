# Skill : Telemetry Observability (v1.0)

## Mission

Centraliser le **monitoring ops** des agents Nexxus : décisions, triggers skills, santé conversationnelle, erreurs runtime et alertes seuil.

## Capacités

1. **Décisions agent** — `recordAgentDecision(agentId, decision, context)`
2. **Triggers skills** — `recordSkillTrigger(skillId, query, triggered, accuracy)` (hash query anonymisé)
3. **Santé conversation** — `recordConversationHealth(score, factors)`
4. **Erreurs** — `recordError(errorType, message, context)`
5. **Persistance** — JSON rotatif sous `server/data/telemetry/` (rétention 30 j)
6. **Résumé & alertes** — `getMetricsSummary('24h')`, `generateAlerts(summary)`

## Modules runtime

| Module | Rôle |
|--------|------|
| `server/src/ops/telemetry-observability.js` | Classe `TelemetryObservability` + helpers |
| `server/src/agent/telemetry/telemetryPersistor.js` | Feedback incidents / audit perf |
| `server/src/agent/telemetry/conversationHealthScore.js` | Score santé 0-100 |

## Seuils alertes (défaut)

- Taux d'erreur > **5%** → warning
- Accuracy moyenne skills < **0.85** → warning

## Commandes

```bash
cd server
npm run test:skills
node --test tests/telemetry-observability.test.js
npm run dashboard:skills
npm run ops:full
```

## Interdictions

- Ne pas persister de requêtes utilisateur en clair — utiliser `queryHash` uniquement.
- Ne pas désactiver la rétention sans ADR ops.
- Ne pas mélanger métriques IDE et métriques plateforme.

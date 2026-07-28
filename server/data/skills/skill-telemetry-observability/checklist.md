# Checklist : Telemetry Observability

- [ ] `TelemetryObservability.initialize()` crée le répertoire persist
- [ ] Décision agent enregistrée avec intent + skill + latence
- [ ] Trigger skill hashé (pas de query brute)
- [ ] `getMetricsSummary('24h')` agrège session + agent
- [ ] `generateAlerts` déclenche warning si erreur > 5%
- [ ] `cleanupOldFiles` respecte `retentionDays`
- [ ] Tests `telemetry-observability.test.js` passent
- [ ] CI `test:skills` — 25 skills, 0 error

# Audit de sécurité global — Nexxus Studio / La Citadelle

**Date** : 27/05/2026  
**Contexte** : déploiement local-first (localhost / réseau privé)  
**Statut** : remédiations vagues 1–3 appliquées  

> **Version figée** : voir [Audit-Securite-Nexxus-v1.0.md](./Audit-Securite-Nexxus-v1.0.md), [Certification](./Certification-Audit-Securite-v1.0.md) et export PDF [Audit-Securite-Nexxus-v1.0.html](./Audit-Securite-Nexxus-v1.0.html).

## Synthèse

Audit couvrant les endpoints Express ([server/index.js](../../../server/index.js)), le frontend React ([src/](../../../src/)), la configuration ([server/.env.example](../../../server/.env.example)) et les garde-fous épistémiques existants.

### Correctifs appliqués

| Priorité | Finding | Remédiation |
|----------|---------|-------------|
| P1 | `/api/hooks/*` sans auth | `requireSessionAccess` + rate limit + validation `hook` |
| P1 | `/api/production/stream/:jobId` ouvert | `requireMandatorySession` + `ProductionJobManager.canAccess(browserId)` |
| P1 | `/api/telemetry/feedback` ouvert | `requireMandatorySession` + `validateTelemetryFeedback` |
| P1 | Copies `.env` dans `scratch/` | `scratch/` ajouté au `.gitignore` |
| P2 | Session `default-session` | Middleware `requireMandatorySession` sur chat, stream, forge, production |
| P2 | Login = `INTERNAL_API_TOKEN` | Variable `ADMIN_PASSWORD` séparée |
| P2 | Pas de Helmet | `helmet` sur le serveur principal |
| P2 | Uploads sans MIME | Filtre `image/jpeg`, `png`, `webp`, `gif` ; max 5 fichiers |
| P2 | SMAC rate limit 2000/min | Réduit à 30/min |
| P2 | Path traversal session | `baseDir + path.sep` (aligné route globale) |
| P3 | Token `nexxus-local-dev` en dur | Supprimé ; `credentials: include` + `VITE_API_BASE_URL` |

### Points forts conservés

- Validateur d'environnement fail-closed ([envValidator.js](../../../server/src/security/envValidator.js))
- Verrou session par cookie `nexxus_browser_id` ([sessionAccessService.js](../../../server/src/services/sessionAccessService.js))
- Guards SQL analytics, output/RAG, sandboxes Docker
- Script `npm run citadel:audit`

### Risques résiduels (contexte local)

- Pas de CSRF token (mitigé par origines CORS restreintes)
- Health/stats publics (acceptable en local strict)
- `localStorage` pour `session_id` (XSS — voir [[ADR-009-Security-Hardening-CSP-SRI]])
- BookFlow CRUD sans auth si le service annexe est démarré

## Vérification

```bash
npm run security:audit
```

## Références

- [[ADR-004-Security-Hardening]]
- [[ADR-009-Security-Hardening-CSP-SRI]]
- [[ADR-014-Sandbox-Workspace-Isolation]]

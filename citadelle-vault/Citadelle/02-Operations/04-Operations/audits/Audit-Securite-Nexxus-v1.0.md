# Audit de sécurité Nexxus Studio — Version figée v1.0

| Champ | Valeur |
|-------|--------|
| **Version** | 1.0 |
| **Date de clôture** | 27/05/2026 |
| **Contexte** | Local-first (localhost / réseau privé) |
| **Statut global** | **VALIDÉ** (automatisé) — 1 action manuelle restante |
| **Certification** | [Certification-Audit-Securite-v1.0.md](./Certification-Audit-Securite-v1.0.md) |
| **Checklist** | [Checklist-Audit-Securite-API.md](../procedures/Checklist-Audit-Securite-API.md) |
| **Export PDF** | [Audit-Securite-Nexxus-v1.0.html](./Audit-Securite-Nexxus-v1.0.html) → Imprimer → Enregistrer au format PDF |

---

## 1. Synthèse exécutive

Audit global de l'API Express ([server/index.js](../../../../server/index.js)), du frontend React ([src/](../../../../src/)), de la configuration et des garde-fous épistémiques. Trois vagues de remédiation appliquées (endpoints critiques, session/auth, gouvernance continue).

**Résultat automatisé (27/05/2026)** :

| Composant | Résultat |
|-----------|----------|
| Guards épistémiques (`citadel:audit`) | **4/4 passed** |
| Tests routes (`test:security`) | **4/4 pass** (~126 ms) |
| `scratch/` dans `.gitignore` | **OK** |

---

## 2. Matrice d'exposition des routes sensibles

| Route | Niveau | Middleware | Statut post-audit |
|-------|--------|------------|-------------------|
| `POST /api/chat` | L2 | `requireMandatorySession` | Durci |
| `POST /api/stream` | L2 | `requireMandatorySession` + multer MIME | Durci |
| `POST /api/production/job` | L2 | `requireMandatorySession` | Durci |
| `GET /api/production/stream/:jobId` | L2 | `requireMandatorySession` + `canAccessProductionJob` | Durci |
| `POST /api/forge/*` | L2 | `requireMandatorySession` | Durci |
| `GET/POST /api/hooks/*` | L1 | `requireSessionAccess` + rate limit | Durci |
| `POST /api/telemetry/feedback` | L2 | `requireMandatorySession` + validation | Durci |
| `GET /api/telemetry/cockpit` | L1/L2 | `requireSessionAccess` + `sessionId` | Durci |
| `POST /api/knowledge/index` | L3 | `requireInternalToken` | Inchangé (OK) |
| `POST /api/smac/arbitrate` | L3 | `requireAuth` + rate limit 30/min | Durci |
| `POST /api/stop`, workspaces | L0 | `requireLocalOperator` | Inchangé (OK) |
| `GET /api/health/*`, `/api/ping`, `/api/stats` | L4 | Aucun | Documenté (local) |

**Légende niveaux** : L0 loopback · L1 cookie navigateur · L2 session verrouillée · L3 token interne/JWT · L4 observabilité locale.

---

## 3. Résultats des tests automatisés

### 3.1 Guards épistémiques (`npm run citadel:audit`)

| Test | Résultat | Signification |
|------|----------|---------------|
| Prompt Injection (Direct) | DENY | Injections bloquées |
| Adversarial Unicode | SUSPICIOUS | Unicode malveillant détecté |
| Secret Leak Prevention | Redacted | Tokens masqués en sortie |
| Safe Technical Query | SAFE | Requêtes légitimes autorisées |

### 3.2 Tests unitaires routes (`npm run test:security`)

| Suite | Cas | Résultat |
|-------|-----|----------|
| `validateTelemetryFeedback` | Rejet sans `sessionId` | PASS |
| `validateTelemetryFeedback` | Rejet score hors plage | PASS |
| `validateTelemetryFeedback` | Acceptation + troncature commentaire | PASS |
| `canAccessProductionJob` | Refus `browserId` différent | PASS |

---

## 4. Remédiations appliquées (v1.0)

| ID | Finding | Remédiation |
|----|---------|-------------|
| R1 | Hooks sans auth | `requireSessionAccess` + validation |
| R2 | Stream production ouvert | Session obligatoire + contrôle `browserId` |
| R3 | Telemetry feedback ouvert | `validateTelemetryFeedback` |
| R4 | `default-session` | Supprimé ; `requireMandatorySession` |
| R5 | Token dev front | `credentials: include` ; plus de `nexxus-local-dev` |
| R6 | Pas de Helmet | `helmet` sur Express |
| R7 | Uploads | MIME jpeg/png/webp/gif ; max 5 fichiers |
| R8 | SMAC 2000 req/min | 30 req/min |
| R9 | Path traversal session | `baseDir + path.sep` |
| R10 | Secrets scratch | `scratch/` dans `.gitignore` |
| R11 | Login = token interne | Support `ADMIN_PASSWORD` (code) |

---

## 5. Outils d'audit opérationnels

| Outil | Commande |
|-------|----------|
| Batch Windows | `scripts\security-audit-local.bat` |
| npm local | `npm run security:audit:local` |
| npm complet | `npm run security:audit` (npm audit non bloquant si SSL) |
| Rétroaction Mémoire | `npm run security:feedback` (échec → incident vault) |
| Dashboard UI | Panneau **Sécu.** → onglet Télémétrie · `GET /api/security/telemetry` |

---

## 6. Actions restantes

| ID | Priorité | Action | Responsable |
|----|----------|--------|-------------|
| **ENV1** | Haute | Définir `ADMIN_PASSWORD=<distinct>` dans `server/.env` (≠ `INTERNAL_API_TOKEN`) | Opérateur |
| **A3** | Basse | `npm audit` quand registry/SSL Windows résolu ; sinon documenter exception | Ops |
| **X1** | Moyenne | Vérifier qu'aucun `.env` n'est versionné sous `scratch/` | Opérateur |
| **M1–E2** | Basse | Cocher revue manuelle auth/env dans checklist §3.4–3.5 | Revue périodique |

---

## 7. Risques résiduels (acceptés en local-first)

- Pas de token CSRF (CORS + cookies HttpOnly)
- Endpoints L4 (health/stats) exposés en local
- `localStorage` pour `session_id` (surface XSS)
- BookFlow sans auth si service annexe actif

---

## 8. Références

- [ADR-004-Security-Hardening](../../02-Architecture/adr/ADR-004-Security-Hardening.md)
- [ADR-009-Security-Hardening-CSP-SRI](../../02-Architecture/adr/ADR-009-Security-Hardening-CSP-SRI.md)
- [ADR-014-Sandbox-Workspace-Isolation](../../02-Architecture/adr/ADR-014-Sandbox-Workspace-Isolation.md)
- Rapport initial : [Audit-Securite-Nexxus-27-05-2026.md](./Audit-Securite-Nexxus-27-05-2026.md)

---

*Document figé v1.0 — toute évolution majeure de `server/index.js` déclenche une révision v1.1.*

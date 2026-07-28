# Checklist d'audit sécurité API — Nexxus Studio

**Version** : 1.0  
**Date** : 27/05/2026  
**Contexte** : local-first (localhost / réseau privé)  
**Référence** : [Audit-Securite-Nexxus-v1.0.md](../audits/Audit-Securite-Nexxus-v1.0.md) (figé) · [PDF/HTML](../audits/Audit-Securite-Nexxus-v1.0.html)

---

## 1. Périmètres d'exposition (à choisir par route)

| Code | Périmètre | Middleware minimal | Exemples |
|------|-----------|-------------------|----------|
| **L0** | Locale stricte (loopback) | `requireLocalOperator` | `/api/stop`, workspaces, artefacts forge globaux |
| **L1** | Réseau privé + navigateur identifié | `requireSessionAccess` | `/api/hooks/state`, sessions lecture |
| **L2** | Réseau privé + session verrouillée | `requireMandatorySession` | `/api/chat`, `/api/stream`, forge, production |
| **L3** | Scripts / agents internes | `requireInternalToken` ou `requireAuth` | `/api/knowledge/index`, SMAC |
| **L4** | Observabilité publique locale | Aucun (documenter la fuite info) | `/api/health`, `/api/ping`, `/api/stats` |

**Règle** : toute nouvelle route DOIT déclarer son code L0–L4 dans le commentaire au-dessus de `app.METHOD(...)` dans [server/index.js](../../../../server/index.js).

---

## 2. Vérifications automatisées (exécuter avant commit)

```bash
# Depuis la racine du dépôt (sans npm audit — recommandé Windows local)
npm run security:audit:local

# Windows : double-clic ou
scripts\security-audit-local.bat

# Avec npm audit (peut échouer sur SSL registry Windows)
npm run security:audit
```

| # | Critère | Commande | Résultat attendu |
|---|---------|----------|------------------|
| A1 | Guards épistémiques | `npm run citadel:audit` | 4/4 passed ✅ |
| A2 | Tests sécurité routes | `cd server && npm run test:security` | 4/4 pass ✅ |
| A3 | Dépendances critiques | `cd server && npm audit --audit-level=high` | ⏳ optionnel (SSL Windows) |

---

## 3. Checklist fichier par fichier

### 3.1 [`server/index.js`](../../../../server/index.js)

| # | Vérification | Méthode | OK |
|---|--------------|---------|-----|
| I1 | `helmet` actif avant CORS | grep `helmet` | ✅ |
| I2 | `trust proxy` si `NODE_ENV=production` | grep `trust proxy` | ✅ |
| I3 | Aucune route L2 sans `requireMandatorySession` | grep `default-session` → 0 résultat | ✅ |
| I4 | `/api/hooks/activate|deactivate` protégées | grep hooks + `requireSessionAccess` | ✅ |
| I5 | `/api/production/stream` protégée + `canAccess` | grep `production/stream` | ✅ |
| I6 | `/api/telemetry/feedback` + validation | grep `validateTelemetryFeedback` | ✅ |
| I7 | Multer : MIME + max 5 fichiers | grep `ALLOWED_IMAGE_MIMES` | ✅ |
| I8 | SMAC rate limit ≤ 60/min | grep `smac/arbitrate` + `rateLimit` | ✅ |
| I9 | Path traversal session : `baseDir + path.sep` | route artefacts session | ✅ |
| I10 | Login utilise `ADMIN_PASSWORD` ≠ token seul | grep `ADMIN_PASSWORD` | ⏳ code OK ; définir dans `.env` |

### 3.2 [`server/src/security/sessionMiddleware.js`](../../../../server/src/security/sessionMiddleware.js)

| # | Vérification | OK |
|---|--------------|-----|
| S1 | `requireMandatorySession` refuse sans `sessionId` | ✅ |
| S2 | `validateTelemetryFeedback` borne score 1–5 + longueur commentaire | ✅ |

### 3.3 [`server/src/security/productionJobAccess.js`](../../../../server/src/security/productionJobAccess.js)

| # | Vérification | OK |
|---|--------------|-----|
| P1 | `canAccessProductionJob` refuse `browserId` absent ou différent | ✅ |
| P2 | `ProductionJobManager.subscribe` appelle `canAccess` | ✅ |

### 3.4 [`server/src/security/authMiddleware.js`](../../../../server/src/security/authMiddleware.js)

| # | Vérification | OK |
|---|--------------|-----|
| M1 | `X-API-Token` réservé aux scripts (pas exposé au front) | ☐ |
| M2 | JWT vérifié pour SMAC / routes L3 | ☐ |

### 3.5 [`server/src/security/envValidator.js`](../../../../server/src/security/envValidator.js)

| # | Vérification | OK |
|---|--------------|-----|
| E1 | Boot fail-closed si secrets manquants | ☐ |
| E2 | `LOG_ENCRYPTION_KEY` = 32 octets | ☐ |

### 3.6 [`server/.env`](../../../../server/.env) — **ne pas commiter**

| # | Vérification | OK |
|---|--------------|-----|
| ENV1 | `ADMIN_PASSWORD` défini et ≠ `INTERNAL_API_TOKEN` | ☐ |
| ENV2 | `ALLOW_LEGACY_PLAINTEXT_LOGS=false` en prod | ☐ |
| ENV3 | Fichier listé dans `.gitignore` | ☐ |

### 3.7 [`.gitignore`](../../../../.gitignore)

| # | Vérification | OK |
|---|--------------|-----|
| G1 | `scratch/` ignoré | ✅ |
| G2 | `server/.env` ignoré | ✅ |

### 3.8 Frontend — [`src/`](../../../../src/)

| # | Fichier | Vérification | OK |
|---|---------|--------------|-----|
| F1 | `App.jsx` | `credentials: 'include'` sur appels API sensibles | ✅ |
| F2 | `ProductionService.js` | `sessionId` dans body job + query stream | ✅ |
| F3 | `AsyncForgePanel.jsx` | Pas de `x-api-token` hardcodé ; `sessionId` transmis | ✅ |
| F4 | `Cockpit.jsx` | Idem F3 | ✅ |
| F5 | `SecurityHooks.jsx` | `API_BASE` + `credentials: 'include'` | ✅ |
| F6 | Tous `src/**` | `grep -r "nexxus-local-dev" src/` → 0 | ✅ |

### 3.9 Secrets hors dépôt

| # | Vérification | OK |
|---|--------------|-----|
| X1 | Aucun `.env` sous `scratch/async_forge_workspaces/` versionné | ☐ |
| X2 | Rotation si un `.env` a été commité par erreur | ☐ |

---

## 4. Matrice routes sensibles (référence rapide)

| Route | Niveau | Middleware actuel |
|-------|--------|-------------------|
| `POST /api/chat` | L2 | `requireMandatorySession` |
| `POST /api/stream` | L2 | `requireMandatorySession` + multer |
| `POST /api/production/job` | L2 | `requireMandatorySession` |
| `GET /api/production/stream/:jobId` | L2 | `requireMandatorySession` + `canAccessProductionJob` |
| `POST /api/forge/*` | L2 | `requireMandatorySession` |
| `GET/POST /api/hooks/*` | L1 | `requireSessionAccess` |
| `POST /api/telemetry/feedback` | L2 | `requireMandatorySession` + validation |
| `GET /api/telemetry/cockpit` | L1/L2 | `requireSessionAccess` + `sessionId` query |
| `POST /api/knowledge/index` | L3 | `requireInternalToken` |
| `POST /api/smac/arbitrate` | L3 | `requireAuth` + rate limit |
| `POST /api/stop` | L0 | `requireLocalOperator` |
| `GET /api/health/*` | L4 | Aucun (documenté) |

---

## 5. Test manuel local (5 min)

1. Démarrer `npm run start` (ou server + dev séparés).
2. Ouvrir l'UI → créer une session → envoyer un message (chat doit fonctionner avec cookie).
3. **Sans cookie** : `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"query":"test"}'` → attendu **400** `sessionId requis`.
4. **Hooks** : `curl http://localhost:3000/api/hooks/state` sans cookie → état OK ; activer un hook sans cookie → selon politique L1.
5. **Production stream** : tenter `GET /api/production/stream/job-fake?sessionId=x` sans cookie navigateur → **400/403**.

---

## 6. Boucle de rétroaction (Mémoire des Erreurs)

En cas d'échec des tests sécurité, consignation automatique dans
[Memoire-des-Erreurs.md](../../05-Knowledge/heritage/Memoire-des-Erreurs.md) :

```bash
npm run security:feedback

# Données de démo pour le dashboard (si historique vide)
npm run security:seed-history
```

Hook git optionnel (pre-commit) :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-security-pre-commit.ps1
```

---

## 7. Audit continu (nouvelle route)

Lors de l'ajout d'une route dans `server/index.js` :

1. Choisir le niveau L0–L4.
2. Appliquer le middleware correspondant.
3. Ajouter une ligne dans la matrice §4 de ce document.
4. Si L2+ : exiger `sessionId` côté front (`credentials: 'include'`).
5. Lancer `npm run security:audit`.

---

## 7. Prochaines évolutions (hors périmètre local strict)

- [ ] CSRF token pour mutations cookie-based si exposition LAN élargie
- [ ] Désactiver health détaillés derrière `requireLocalOperator` en prod Hostinger
- [ ] `trust proxy` + auth reverse proxy documentée
- [ ] Durcissement BookFlow si service annexe activé

---

*Maintenu par La Citadelle — révision à chaque sprint sécurité ou changement majeur de `server/index.js`.*

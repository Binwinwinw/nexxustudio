# Certification d'audit sécurité — Nexxus Studio v1.0

| Champ | Valeur |
|-------|--------|
| **Référence** | CERT-SEC-NEXXUS-1.0 |
| **Date de certification** | 27/05/2026 |
| **Périmètre** | API Express, frontend React, configuration, gouvernance vault |
| **Contexte d'exploitation** | Local-first (localhost / réseau privé) |
| **Statut** | **CERTIFIÉ SOUS RÉSERVE** (1 action opérateur restante) |
| **Documents liés** | [Audit-Securite-Nexxus-v1.0.md](./Audit-Securite-Nexxus-v1.0.md) · [Checklist](../procedures/Checklist-Audit-Securite-API.md) · [Export PDF](./Audit-Securite-Nexxus-v1.0.html) |

---

## 1. Déclaration de certification

La Citadelle / Nexxus Studio dispose, à la date du **27/05/2026**, d'un dispositif d'audit sécurité **v1.0** couvrant :

- le durcissement des endpoints critiques ;
- l'automatisation des contrôles (guards + tests unitaires) ;
- la boucle de rétroaction vers la Mémoire des Erreurs ;
- un dashboard de télémétrie opérationnel.

**Résultat des contrôles automatisés au moment de la certification :**

| Contrôle | Résultat | Preuve |
|----------|----------|--------|
| Guards épistémiques (`citadel:audit`) | **4/4 PASS** | Prompt injection DENY, Unicode SUSPICIOUS, secret redacted, safe query SAFE |
| Tests routes sécurité (`test:security`) | **4/4 PASS** (~126 ms) | `validateTelemetryFeedback`, `canAccessProductionJob` |
| Boucle rétroaction (`security:feedback`) | **PASS** | Exit 0 — aucune entrée Mémoire des Erreurs sur run de certification |

**Réserve unique :** l'opérateur doit définir `ADMIN_PASSWORD` distinct de `INTERNAL_API_TOKEN` dans `server/.env` (voir §6).

---

## 2. Composants validés

### 2.1 Remédiations endpoints et middleware

| ID | Composant | Statut |
|----|-----------|--------|
| R1 | `/api/hooks/*` — `requireSessionAccess` + rate limit | Validé |
| R2 | `/api/production/stream/:jobId` — session + `canAccessProductionJob` | Validé |
| R3 | `/api/telemetry/feedback` — validation payload | Validé |
| R4 | Suppression `default-session` — `requireMandatorySession` | Validé |
| R5 | Frontend — `credentials: include`, retrait token dev fixe | Validé |
| R6 | Helmet sur serveur Express | Validé |
| R7 | Uploads MIME + max 5 fichiers | Validé |
| R8 | SMAC rate limit 30/min | Validé |
| R9 | Path traversal session (`path.sep`) | Validé |
| R10 | `scratch/` dans `.gitignore` | Validé |
| R11 | Support `ADMIN_PASSWORD` (code) | Validé — config opérateur en attente |

### 2.2 Modules de sécurité dédiés

| Fichier | Rôle |
|---------|------|
| [server/src/security/sessionMiddleware.js](../../../../server/src/security/sessionMiddleware.js) | Session obligatoire, validation feedback |
| [server/src/security/productionJobAccess.js](../../../../server/src/security/productionJobAccess.js) | Contrôle d'accès jobs production |
| [server/src/security/envValidator.js](../../../../server/src/security/envValidator.js) | Boot fail-closed |
| [server/src/services/securityTelemetryService.js](../../../../server/src/services/securityTelemetryService.js) | Agrégation télémétrie |

### 2.3 Chaîne d'automatisation

| Commande / script | Rôle |
|-------------------|------|
| `npm run security:audit:local` | Audit sans `npm audit` (recommandé Windows) |
| `scripts/security-audit-local.bat` | Équivalent batch, exit 0/1 |
| `npm run security:audit` | Audit complet (`npm audit` non bloquant si SSL) |
| `npm run security:feedback` | Audit + rétroaction Mémoire des Erreurs |
| `npm run security:seed-history` | Données démo dashboard (optionnel) |
| `scripts/install-security-pre-commit.ps1` | Hook git pre-commit (optionnel) |

### 2.4 Dashboard et observabilité

| Élément | Détail |
|---------|--------|
| API | `GET /api/security/telemetry` (`requireSessionAccess`) |
| Historique | `server/data/security/audit-history.jsonl` (gitignored) |
| UI | Panneau **Sécu.** → onglet **Télémétrie** |
| Rafraîchissement | 15 s (incidents, taux réussite, tendance, motifs) |

### 2.5 Documentation vault (taxonomie v4.5)

| Document | Emplacement |
|----------|-------------|
| Audit figé v1.0 | [Audit-Securite-Nexxus-v1.0.md](./Audit-Securite-Nexxus-v1.0.md) |
| Checklist opérationnelle | [Checklist-Audit-Securite-API.md](../procedures/Checklist-Audit-Securite-API.md) |
| Export imprimable | [Audit-Securite-Nexxus-v1.0.html](./Audit-Securite-Nexxus-v1.0.html) |
| Mémoire des Erreurs | [Memoire-des-Erreurs.md](../../05-Knowledge/heritage/Memoire-des-Erreurs.md) |
| Modèle `.env` | [server/.env.example](../../../../server/.env.example) |

---

## 3. Matrice d'exposition (référence certifiée)

| Niveau | Signification | Middleware type |
|--------|---------------|-----------------|
| **L0** | Locale stricte (loopback) | `requireLocalOperator` |
| **L1** | Réseau privé + navigateur | `requireSessionAccess` |
| **L2** | Session verrouillée | `requireMandatorySession` |
| **L3** | Agents / scripts internes | `requireInternalToken` / `requireAuth` |
| **L4** | Observabilité locale | Documenté, non bloquant en local |

Toute nouvelle route doit déclarer son niveau L0–L4 (cf. checklist §7).

---

## 4. Risques résiduels acceptés (local-first)

| Risque | Mitigation actuelle | Révision si exposition Internet |
|--------|---------------------|--------------------------------|
| Pas de CSRF token | CORS restreint + cookies HttpOnly | Token CSRF + politique stricte |
| Health/stats publics (L4) | Acceptable en local strict | `requireLocalOperator` ou proxy auth |
| `localStorage` session_id | Surface XSS documentée | Session HttpOnly uniquement |
| BookFlow sans auth | Service annexe non démarré par défaut | Auth dédiée |
| `npm audit` SSL Windows | Optionnel, non bloquant | CI avec registry fiable |

---

## 5. Procédure de maintien de la certification

1. Avant tout commit significatif : `npm run security:feedback` (ou hook pre-commit installé).
2. Avant release / tag : `npm run security:audit:local` + revue checklist.
3. En cas d'échec : correction obligatoire ; incident auto-consigné dans la Mémoire des Erreurs.
4. Toute modification de [server/index.js](../../../../server/index.js) : mise à jour matrice + révision version (v1.1).

---

## 6. Actions restantes pour certification pleine (100 %)

| ID | Action | Responsable | Statut |
|----|--------|-------------|--------|
| **ENV1** | Définir `ADMIN_PASSWORD=<mot_de_passe_distinct>` dans `server/.env` (≠ `INTERNAL_API_TOKEN`) | Opérateur | ⏳ En attente |
| **I10** | Cocher ENV1 / I10 dans [Checklist-Audit-Securite-API.md](../procedures/Checklist-Audit-Securite-API.md) | Opérateur | ⏳ En attente |

**Après complétion ENV1 + I10 :** passer le statut de ce document à **CERTIFIÉ SANS RÉSERVE**.

---

## 7. Signature et archivage

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Opérateur / Architecte | _________________________ | ___/___/2026 | __________ |
| Revue sécurité (optionnel) | _________________________ | ___/___/2026 | __________ |

**Archivage :** conserver ce fichier dans `04-Operations/audits/` avec les versions figées v1.0. Ne pas modifier rétroactivement ; toute évolution majeure → `Certification-Audit-Securite-v1.1.md`.

---

## 8. Références ADR

- [[ADR-004-Security-Hardening]]
- [[ADR-009-Security-Hardening-CSP-SRI]]
- [[ADR-014-Sandbox-Workspace-Isolation]]

---

*Document généré dans le cadre de l'audit sécurité global Nexxus Studio — La Citadelle. Horodatage : 27/05/2026.*

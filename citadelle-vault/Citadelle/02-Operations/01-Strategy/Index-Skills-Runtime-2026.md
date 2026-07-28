# Index Skills Runtime — État & Priorités (2026)

**Statut** : note de synthèse produit (non-ADR)  
**Date** : 27/05/2026  
**Doctrine** : observer avant transposer — grounding, fail-closed, 1–2 experts max

---

## 1. Vue d'ensemble

La Citadelle est une plateforme **local-first** d'orchestration IA souveraine :

- **NEXXUS** — assistant central, routage par intention
- **Nexxus Studio** — interface opérationnelle (Cockpit)
- **Skills Tier 3** — experts lazy-loaded, un domaine actif à la fois

Références fondatrices :
- [[ADR-007-Skills-Architecture]]
- [[ADR-20260527-Intent-Contract-Registry]]
- [[ADR-011-DISCIPLINE-EPISTEMIQUE]]
- [[Roadmap-6-Mois-Prouver-Avant-Ouvrir]]

---

## 2. Matrice d'état opérationnelle

| Skill / capacité | Intent(s) | Implémentation | Tests | Activation |
|------------------|-----------|----------------|-------|------------|
| **skill-design-extract** | `DESIGN_EXTRACT` (800) | v2 + hybrid merge C5 ✅ | 19/19 extract | `enabled: true` |
| **skill-nexxus-design** | `DESIGN_CREATE` (780) | D1–D4 pipeline Extract→Design→Forge + API ✅ | 24/24+ | `enabled: true` |
| **skill-impeccable** | `DESIGN_AUDIT` (790) | E1–E5 worker + API + Cockpit gate ✅ | 13/13+ | `enabled: true` |
| **skill-nexxus-video** | `VIDEO_ANALYSIS` (855) | Upload + jobs ✅ — Whisper ⏳ | 5/5 | **`enabled: false`** |
| **skill-browser-harness** | — (Phase E) | C1–C7 ✅ certifié golden | 58/58 | **`enabled: false`** |
| **skill-ui-forge** | — | **Deprecated** → `skill-nexxus-design` | — | — |

Légende : ✅ livré · ⏳ en cours / spec validée · — non démarré

---

## 3. Chemins runtime (correction de référence)

Stockage artefacts et uploads sous **`server/src/data/`** :

| Pipeline | Chemin |
|----------|--------|
| Vidéo uploads | `server/src/data/video-uploads/{uuid}.mp4` |
| Vidéo jobs | `server/src/data/video-jobs/{jobId}/` |
| Design Extract jobs | `server/src/data/design-extract-jobs/{jobId}/` |

---

## 4. Nexxus Video

**ADR** : [[ADR-20260601-Nexxus-Video]]  
**Skill** : `server/data/skills/skill-nexxus-video/`

### Livré

- Upload MP4 sécurisé (`videoUploadService.js`) — MIME allowlist, magic bytes `ftyp`, 512 Mo max, rejet 400 + `trace_id`
- Job queue async (`VideoJobManager.js`) — `POST/GET/DELETE /api/video/jobs`, SSE `/api/video/stream/:jobId`
- Intent `VIDEO_ANALYSIS` — priorité 855, `asyncJob: true`

### En attente (5 conditions activation)

1. Transcript réel (Whisper minimal)
2. Timeline Cockpit `video.*`
3. Test E2E court
4. *(conditions 4–5 selon ADR Video)*
5. Puis `enabled: true`

---

## 5. Suite Design Nexxus

**ADR** : [[ADR-20260601-Suite-Design-Nexxus]]  
**Module worker** : [[Design-Extract-Worker]]

### Trio & routage

| Skill | Intent | Rôle | Mode réponse |
|-------|--------|------|--------------|
| `skill-design-extract` | `DESIGN_EXTRACT` | ADN site, tokens, patterns | `DOCUMENT` |
| `skill-impeccable` | `DESIGN_AUDIT` | Score, issues, blockers | `CRITICAL` |
| `skill-nexxus-design` | `DESIGN_CREATE` | DA, blueprint Forge-ready | `OPEN_PROPOSITION` |

**Règles** : 1 skill design max par tour · enchaînement Extract → Design → Impeccable

### Design Extract — état détaillé

| Composant | v1 | v2 |
|-----------|----|----|
| Contrats + guards | ✅ | envelope 2.0.0 ✅ |
| Fetch + egress gouverné | ✅ | — |
| Analyse HTML statique | ✅ | échantillons sémantiques ✅ |
| Clustering couleurs bucket RGB | fréquentiel basique | ✅ rôles primary/accent/surface |
| quality_gate + fail-closed | — | ✅ |
| API `/api/design/extract/*` | ✅ | — |
| Browser harness / getComputedStyle | — | Phase C |
| Golden tests fixtures | partiel (2) | ⏳ suite complète |

**Tests** : `design-suite-contract.test.js` (5/5) · `design-extract-worker.test.js` (7/7)  
**Intent registry** : 33/33 OK · **Skills runtime** : 30/30 OK

### Prochaines étapes suite design

1. **Design Extract v2** — clustering + envelope 2.0.0 + quality_gate
2. **Nexxus Design → Forge** — consommation enveloppes JSON
3. **Impeccable Cockpit** — score + checklist pre-merge
4. Golden tests sans LLM live

---

## 6. Browser Harness (Phase C)

**Statut** : spec Phase C validée — scaffold skill (`enabled: false`), runtime ⏳

**Module** : [[Browser-Harness-Phase-C]]  
**Skill** : `server/data/skills/skill-browser-harness/` (disabled)

Capacité transversale **Nexxus Browser / Web Operator** :

| Capacité | Rôle |
|----------|------|
| Observe | DOM, AX, screenshots, console, réseau |
| Act | clic, saisie, navigation (confirmation requise) |
| Verify | assertions, comparaison d'état |
| Extract | structure, composants (alimente Design Extract) |
| Trace | timeline + preuves |

Intents proposés : `WEB_OBSERVE`, `WEB_TEST`, `WEB_EXTRACT`, `WEB_VERIFY`

Cas d'usage : QA Nexxus Studio · debug instrumenté · crawl rendered pour Extract · vérif post-Forge

---

## 7. Ordre de priorité confirmé

```
1. Design Extract v2     — observation ancrée (clustering + envelope)
2. Nexxus Design → Forge
3. Impeccable → Cockpit
4. Browser Harness Phase C — spec ✅ → implémentation C1–C7
5. Nexxus Video — activation après 5 conditions
```

**Principe** : signal ancré avant génération productive ; contrats avant exposition UI.

---

## 8. Progression actuelle (lecture d'ensemble)

- **Design Extract** a franchi le seuil idée → exécution v1 réelle
- **Nexxus Video** a sécurisé son pipeline sans activation prématurée
- **Nexxus Design / Impeccable** restent au niveau contrats jusqu'aux intégrations lourdes
- **Browser Harness** — spec Phase C validée, runtime C1–C7 à implémenter

Trajectoire saine : observation → contrats → exécution → UI → activation.

---

## Liens

### ADRs
- [[ADR-20260601-Nexxus-Video]]
- [[ADR-20260601-Suite-Design-Nexxus]]
- [[ADR-20260527-Intent-Contract-Registry]]

### Modules
- [[Design-Extract-Worker]]
- [[Browser-Harness-Phase-C]]
- [[skills]] — taxonomie skills vault

### Runtime
- `server/src/services/design-extract/`
- `server/src/services/nexxus-video/`
- `server/src/services/nexxus-design/`
- `server/src/services/impeccable/`

### Stratégie
- [[Roadmap-6-Mois-Prouver-Avant-Ouvrir]]
- [[Cockpit-Gouvernance]]

---

*Dernière mise à jour : 27/05/2026 — photographie opérationnelle skills runtime Citadelle.*

# Roadmap 6 mois — Prouver le système avant de l'ouvrir

**Statut** : Validé  
**Date** : 30/05/2026  
**Libellé directeur** : *Prouver le système avant de l'ouvrir*  
**Contexte** : Projet solo, local-first, doctrine lazy-loading (1–2 experts max)

---

## 1. Intention stratégique

La Citadelle ne manque pas de capacités — elle manque de **prouvabilité** : corrélation bout-en-bout, tests déterministes, mémoire gouvernée sans dérive, et exploitation simplifiée sur une machine.

Cette roadmap refuse la logique « préparation enterprise » en H1. L'Horizon 1 rend le socle **corrélable, testable et exploitable**. L'Horizon 2 ouvre l'écosystème **sans casser la souveraineté**. L'Horizon 3 prépare l'échelle **sans enfermer la plateforme** (inférence interchangeable, workers, RBAC).

Références techniques :
- [[02-Architecture/adr/ADR-20260530-Traces-MVP-Correlées|ADR Traces MVP corrélées]]
- [[02-Architecture/adr/ADR-20260530-API-v1-InferenceProvider|ADR API v1 + InferenceProvider]]

---

## 2. Horizons

### Horizon 1 — Prouvabilité (semaines 1–8)

| Cap | Livrables |
|-----|-----------|
| Observabilité | Traces JSON corrélées ; `trace_id` / `span_id` dans API, logs serveur, événements UI |
| Tests | Golden routing étendu ; 5–10 evals de sortie sur cas critiques (refus, idéation, Forge gate, mémoire) |
| Mémoire fil | Session DB stable ; rappel Tier 2 cadré ; distinction explicite fil vs patrimoine curé |
| Ops | Bootstrap unique : one machine / one command / one health check |
| Pipeline | Préserver 1–2 experts max ; métrique `% bypass orchestrator` |

**Non-objectifs H1** : OTEL complet, connecteurs externes, RBAC enterprise, workers distants.

### Horizon 2 — Ouverture gouvernée (mois 2–4)

| Cap | Livrables |
|-----|-----------|
| API | `/api/v1` + OpenAPI minimal avant tout connecteur tiers |
| Connecteurs | Bus gouverné : fichiers locaux, Git, vault Obsidian (scopes + journal d'impact) |
| Produit | Forge inline dans le chat (discovery → audit → run → artefacts dans le fil) |
| Optionnel | Mode hybride cloud **opt-in explicite** par tâche |

### Horizon 3 — Industrialisation (mois 4–6)

| Cap | Livrables |
|-----|-----------|
| Architecture | Séparation plan de contrôle / plan d'exécution |
| Inférence | `InferenceProvider` (Ollama aujourd'hui, vLLM demain) |
| Enterprise | RBAC v1, logs immuables, export audit, benchmarks pack 64 Go |

---

## 3. Plan mensuel retenu

| Mois | Cap | Livrable prioritaire |
|------|-----|----------------------|
| **1** | Prouvabilité | Traces JSON corrélées, `trace_id` propagé, golden routing + evals sortie, bootstrap unique |
| **2** | Mémoire fil | Session DB prod-ready, rappel Tier 2, régressions mémoire, interface `InferenceProvider` |
| **3** | Flux produit | Forge inline chat (démontrable), gate maturité visible, artefacts rattachés au fil |
| **4** | Mémoire patrimoine | Promotion v2, conflits, purge, audit exportable |
| **5** | Ouverture | `/api/v1`, OpenAPI, connecteurs fichiers / Git / vault |
| **6** | Industrialisation | Implémentations provider, benchmarks 64 Go, RBAC v1, export audit |

---

## 4. Cinq chantiers prioritaires (ordre figé)

| # | Chantier | Pourquoi maintenant |
|---|----------|---------------------|
| 1 | Observabilité unifiée (MVP JSON) | Sans corrélation, impossible de diagnostiquer ni prouver la qualité |
| 2 | Mémoire gouvernée cross-session | Différenciateur fort ; zone de risque si dérive ou corruption |
| 3 | API + connecteurs gouvernés | Manque principal vs plateformes adoptées ; API v1 **avant** Slack/Notion |
| 4 | Forge intégrée au chat | Usage cible ; levier de valeur le plus visible |
| 5 | Backend inférence interchangeable | Évite l'enfermement Ollama ; interface dès M2, impl lourde M5–6 |

---

## 5. Distinction mémoire (non négociable)

| Type | Périmètre | Stockage | Usage |
|------|-----------|----------|-------|
| **Mémoire de fil** | Session courante | `session_events` DB | Rappel, contexte chat, Tier 2 synthèse |
| **Patrimoine curé** | Long terme, multi-session | ChromaDB + gate promotion | RAG, décisions, faits validés |

Ne pas fusionner les deux pipelines avant M4.

---

## 6. Critères de succès par mois

### M1 — Prouvable
- [x] Chaque tour `/api/stream` expose `trace_id` ; logs serveur corrélés
- [x] Dashboard ou endpoint `/api/traces/:trace_id` consultable
- [ ] Golden routing ≥ 30 cas ; evals sortie ≥ 5 cas sans LLM live
- [x] `scripts/bootstrap-citadelle` + health check unique PASS

### M2 — Mémoire fil fiable
- [ ] Historique DB prioritaire sur client (40 tours)
- [ ] Rappel Tier 2 avec contrat « n'invente pas »
- [ ] `InferenceProvider` interface documentée + mock tests

### M3 — Flux Forge démontrable
- [ ] Chat → gate maturité → run Forge → artefacts visibles dans le fil
- [ ] Démo reproductible en ≤ 3 clics depuis Chat

### M4 — Patrimoine gouverné
- [ ] Promotion v2 + purge opérable + export audit mémoire

### M5 — Ouverture
- [ ] OpenAPI publié ; 3 connecteurs avec journal d'impact

### M6 — Industrialisation
- [ ] Benchmarks latence / VRAM / refus ; pack install 64 Go documenté

---

## 7. Risques et garde-fous (solo dev)

| Risque | Mitigation |
|--------|------------|
| Surface de tests vs vélocité | Golden + evals **sans Ollama** ; premerge comme gate |
| Nodemon + warmup perpétuel | `OLLAMA_BOOT_PROFILE=fast` en dev ; health repollé |
| Connecteurs = surface d'attaque | `skill-egress-security` + journal d'impact obligatoire |
| Scope creep H2 | Max **1 connecteur / mois** |

---

## 8. Doctrine produit préservée

- Local-first par défaut ; cloud uniquement opt-in explicite
- 1–2 experts actifs max ; orchestration silencieuse
- Fail-closed épistémique sur signal faible
- Une voix publique (NEXXUS / finalRenderer)

---

## Liens

- [[00-Manifeste-Doctrine|Manifeste & Doctrine]]
- [[POLICIES|Politiques certifiées]]
- [[02-Architecture/adr/ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- [[Bienvenue|⬅ Retour à l'Index Central]]

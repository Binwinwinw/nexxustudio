# Rapport Ops Quotidien — 28/05/2026

> Vue fusionnée conversation + mémoire gouvernée · généré par `npm run ops:daily-report`

## Synthèse exécutive

| Domaine | Statut | Score |
|---|---|---:|
| Conversation | **OK** | 100/100 |
| Mémoire | **OK** | 90/100 |
| **Ops global** | **OK** | **95/100** |

**Actions prioritaires**
- Aucune action urgente. Continuer le suivi quotidien.

---

## Conversation

| KPI | Valeur | Seuil |
|---|---:|---|
| Streams | 0 | — |
| No visible tokens | 0 | 0 |
| Fallback rate | 0% | < 1% |
| Stream errors | 0 | 0 |
| Quality gate | PASS | PASS |

**Tendance 7j** : Données insuffisantes (+0)

**Incidents récents (3 max)**
- `fallback_triggered` · ? · 18:27:34
- `no_visible_tokens` · ? · 18:27:34
- `fallback_triggered` · ? · 18:23:53

**Recommandation** : Conversation stable.

---

## Mémoire gouvernée

| KPI | Valeur | Note |
|---|---:|---|
| Ingestions | 1 | post gate curée |
| Commits | 0 | store JSONL |
| Promotions | 0 | tiers auto v1 |
| Refus precheck | 1 | curatedMemoryGate |
| Refus promotion | 0 | policy v1 |
| Taux promotion | 0% | — |
| Stale actives | 0 | review_at |
| Violations | 0 | hard fail |

**Tiers** : store 0 · episodic 4 · semantic 0 · heritage auto 0

**Top refus**
- `test_probe` · 1×

**Événements récents (3 max)**
- `rejected_precheck` · 18:15:20

**Recommandation** : Gouvernance mémoire stable. Continuer le suivi quotidien promotions/refus.

---

## Verdict ops

**OK** — Système gouverné stable. Conserver quality:gate et ops:daily-report en routine.

---
*2026-05-28T22:36:12.180Z*

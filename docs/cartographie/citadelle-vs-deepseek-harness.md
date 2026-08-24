# Comparaison inventaire — Citadelle vs DeepSeek Harness

| Champ | Valeur |
|-------|--------|
| **Nature** | Photo. **Pas** une cible. **Pas** une copie. |
| **Date** | 2026-08-18 |
| **Lecture** | [`METHODE.md`](./METHODE.md) |
| **DSH** | README ; `docs/architecture.md` ; `docs/cordis-primer.md` |
| **Citadelle** | Lots 0–4 (fermés, non rouverts) ; policies domaine ; SC / FAST ; guards ; C1–C3 |

DSH = harness **plugin** (Cordis, preview, APIs cassables).  
Citadelle = **pipeline** + contrôle du rail.  
Atouts Citadelle : lots fermés, policies domaine, SC/FAST, guards.  
Piège : le mot **harness**.

DSH ne dit pas « simple → direct ». Copier Cordis = refonte, **hors cadre**. Rail court s’arrête tôt.

---

## Grille (décision)

| Critère | DSH | Citadelle | Idée | Décision |
|---------|-----|-----------|------|----------|
| Produit | Runtime plugin + UI | Pipeline Nexxus | Harness ≠ modèle | Isoler DSH · garder Citadelle |
| Cœur | Cordis, pas de core | Pipeline + SC + FAST | Un décideur de tour | Garder pipeline · retirer Cordis |
| Extension | Plugin / YAML | Policy / guard / contrat | Accroche documentée | Garder policies · isoler YAML |
| Tour | n steps LLM+tools | Path amont puis exécuter | Simple = 0 step si possible | Garder path · C1–C2 · isoler C3 |
| Arrêt tôt | `pre-step` / waterfall | SC, fiches, clarify | Couper avant le modèle | Garder SC · consolider C1 |
| Intention s/a/c | Non prescrit | Simple / ambigu / complexe | — | Garder la règle Citadelle |
| Session | Log = vérité modèle | History + memory | Ambigu | Isoler · pas d’action |
| Outils | `ctx.tools` | Experts + `toolGuard` | Ambigu | Garder existant · isoler `ctx.tools` |
| Harness local | Le produit | control / eval / browser | Homonyme | Isoler le mot |

---

## Écarts actionnables

C1–C2 (codés, rejouer). C3 = vigilance, **pas ouvert**.

COMPOSER trop lourd après un rail court = signal de vigilance, pas un chantier.

---

## Journal

| Date | Changement |
|------|------------|
| 2026-08-18 | Grille inventaire — photos, pas copie |
| 2026-08-18 | Forme courte : une grille, C1–C3, hors Cordis |

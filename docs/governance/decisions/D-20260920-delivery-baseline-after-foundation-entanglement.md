# D-20260920 — Baseline de livraison après FOUNDATION_TOO_ENTANGLED

**ID** : `D-20260920-delivery-baseline-after-foundation-entanglement`  
**Date** : 2026-09-20  
**Statut** : `accepted`  
**Accepted** : 2026-09-20 (GO texte `ALIGN-DELIVERY-BASELINE-AUTHORITY-V1`)  
**Domaine** : livraison Git / port vers `origin/main`. Pas le canon input. Pas un lot runtime.  
**Supersède** : —  
**Remplacée par** : —  
**Ne remplace pas** : [`citadelle-input-invariants.md`](../citadelle-input-invariants.md) (comportement) ; [`CONVERSATIONAL_REGRESSIONS.md`](../../CONVERSATIONAL_REGRESSIONS.md) HEAD (packs fermés) ; programme documentaire `C2-PORT-2026` (reste fermé).

Append-only. Si la norme change : nouvelle fiche + cette ligne `Statut: superseded`. Le corps ci-dessous ne se réécrit pas.

**Couches** : [`documentation-source-of-truth.md`](../documentation-source-of-truth.md) HEAD.  
**Preuve Git** : lots `DELIVERY-SPLIT-REVIEW-WIP-TO-MAIN-V1`, `PREPARE-DELIVERY-BRANCH-CONVERSATION-EXTRACTABILITY-V1`, `DIAGNOSE-F13-F2-DEPENDENCY-MINIMA-V1`.  
**Preuve doc** : lot `DOCS-ARCHITECTURE-DELIVERY-ORIENTATION-REVIEW-V1`.

---

## Identifiants figés

| ID | Sens | N’est pas |
|----|------|-----------|
| **F2-GIT** | `5c9d682` `WIP: checkpoint before C2 planning` | F2-PLAN ; ADR ; base de merge |
| **F2-PLAN** | étape « Contrats » du plan input understanding | F2-GIT |
| **F12-GIT** | `6ff396d` / `002bb66` | F2-GIT |
| **F13-GIT** | Packs 1–7 + identité, `0f1c2f4` … `d0b124f` | Pack 8 ; F16-GIT ; F19-GIT |
| **F16-GIT** | `6cda2e8` projection social avant fallback | F13-GIT |
| **F19-GIT** | `1556340`, `1313601`, `d57bd24`, `beb5a7d` | F14-GIT repo ; F18-GIT radar |
| **C2-PORT-2026** | programme documentaire de port (C2a–C2e) | F2-GIT ; METHODE-C2-LUNE |
| **METHODE-C2-LUNE** | lot cartographie Lune | C2-PORT-2026 |

---

## Décision

1. **`origin/main` reste la cible de livraison** du code conversationnel et du port. Ce n’est pas la baseline comportementale actuelle : le canon input, les Packs 1–7 HEAD et le wiring `subject_angle` vivent dans l’arbre post-F2-GIT, absent de `origin/main`.

2. **`wip/checkpoint-20260824-0117` n’est pas une base de merge vers `main`.**
   C’est une source locale et distante de preuves, d’historique et de
   comportements observés. Elle peut servir de branche de sauvegarde et
   de travail, mais n’est pas une branche de merge ou de PR vers
   `origin/main`.

3. **F2-GIT reste un checkpoint non livrable.** Interdit : cherry-pick, merge, rebase, promotion implicite du commit `5c9d682` (548 fichiers, message « Not a delivery. Do not merge to main. »). Le *contenu* utile (framing, path-moves `intent-guards/`, wiring SC) est une **dette de port**, pas un blob à publier.

4. **F13-GIT, F16-GIT, F19-GIT ne sont pas extractibles vers `origin/main` par cherry-pick.** Classement : **spécification comportementale et tests** pour un futur programme de port fondation. Pas expérimentaux au sens jetable : les Packs 1–7 HEAD sont fermés sur la WIP. Pas candidats cherry-pick.

5. **Aucun nouveau code relevant de la livraison conversationnelle,
   aucun port conversationnel, aucun slice WIP conversationnel vers main**
   tant qu’un GO nommé n’ouvre pas :
   `FOUNDATION-PORT-TO-MAIN-V1`
   ou une fiche `D-*` ultérieure qui **remplace** explicitement cette voie.
   `C2-PORT-2026` reste **fermé**. Cette fiche ne l’ouvre pas,
   ne le fusionne pas avec FOUNDATION-PORT, n’active pas C2a–C2e.

6. **Worktree isolé** `delivery/conversation-routing-social-v1` : laisser le cherry-pick en conflit. Interdit : résoudre, abort, continue, push, PR, `--unset-upstream` dans cette fiche. Nettoyage = GO séparé.

---

## Interdits jusqu’au GO `FOUNDATION-PORT-TO-MAIN-V1` (ou successeur nommé)

- Cherry-pick / extraction F13-GIT, F16-GIT, F19-GIT, F2-GIT, F12-GIT vers `origin/main`.
- PR de `wip/checkpoint-20260824-0117` vers `main`.
- Port conversationnel implicite
  (par exemple réécrire Pack 1 dans un lot non nommé).
- Traiter un document **dirty** comme autorité.
- Modifier, en même temps que cette fiche, les fichiers dirty listés hors scope.
- Ouvrir Pack 8, F2-PLAN, consume JUST, ou un lot runtime conversationnel par inertie.

Autorisé sans ce GO : diagnostics lecture seule ; conservation du worktree isolé tel quel ; lots **non conversationnels** déjà cadrés ailleurs (hors cette fiche).

---

## Rapport à la doctrine HEAD

Confirme [`documentation-source-of-truth.md`](../documentation-source-of-truth.md) HEAD : prochaine base fonctionnelle des lots **portés** = `origin/main` ; WIP = restore ; checkpoint ≠ ADR ; `C2-PORT-2026` fermé sans GO sous-lot.

Tranche le conflit avec `FOUNDATION_TOO_ENTANGLED` : « porter vers main » ≠ cherry-pick des packs. Le port, s’il reprend, part d’une fondation **reconstruite** sur `origin/main`, avec preuves de tests ([`AI_EXECUTION_LOOP.md`](../../AI_EXECUTION_LOOP.md), invariant 7 du canon).

Ne change aucun invariant runtime. [`CONVERSATIONAL_REGRESSIONS.md`](../../CONVERSATIONAL_REGRESSIONS.md) **HEAD** reste la fiche des packs fermés ; son diff dirty n’a aucune force.

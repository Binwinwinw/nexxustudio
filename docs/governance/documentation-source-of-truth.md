# Gouvernance documentaire — sources de vérité

Index des **couches**. Pas le canon input. Pas un ADR. Pas un registre de lots à exécuter.

Si un texte de chantier, une note vault, un journal `.memory/` ou un checkpoint contredit une couche ci-dessous : **la couche dédiée gagne** pour son type de fait.

---

## Hiérarchie

| Rang | Couche | Rôle | N’est pas |
|------|--------|------|-----------|
| 1 | `docs/` | Invariants comportementaux, protocoles, specs, fiches de lots, faits et preuves versionnés | Vault unique, graphe AST, sauvegarde |
| 2 | `citadelle-vault/Citadelle/` | ADR, contexte architectural, navigation humaine, WikiLinks | Source unique du comportement input |
| 3 | Graphify | Symboles, appels, dépendances, impact structurel du code | Registre de lots, décisions, récit de chantier |
| 4 | `.memory/` | Journal secondaire et pointeurs courts | Source normative |
| 5 | Checkpoint Git + archive ZIP | Récupération de workspace uniquement | Documentation canonique, ADR, base C2 |

Prochaine **base fonctionnelle** (code / lots portés) : `origin/main`.  
La branche `wip/checkpoint-20260824-0117` sert à **restaurer** un état local. Elle n’est pas la base de C2-PORT-2026.

---

## Frontières

- **Canon input** : uniquement [`citadelle-input-invariants.md`](citadelle-input-invariants.md). Ne pas le recopier ici ni dans les rules IDE. Divergence mémoire / protocole / règle : le canon gagne.
- **Trace de décision (compréhension → routage)** : index [`decision-trace.md`](decision-trace.md). Distinct du canon (comportement), du PLAN (lots) et du vault ADR (patrimoine). Statut `proposed` jusqu’à GO texte. Ne pas verser l’architecture input dans `.memory/decisions.md`.
- **Registre de lots** : uniquement [`dev/PLAN.md`](../../dev/PLAN.md). Cette carte n’est pas ce registre. `docs/` n’est pas un registre de lots.
- **Protocole d’exécution** : [`AI_EXECUTION_LOOP.md`](../AI_EXECUTION_LOOP.md). Fiche lot : [`AI_LOT_TEMPLATE.md`](../AI_LOT_TEMPLATE.md).
- **Journaux de version** : [`Journal_de_bord.md`](../Journal_de_bord.md) (récit) ; [`Journal_des_ameliorations.md`](../Journal_des_ameliorations.md) (delta par version). Pas des backlogs. Distincts du journal secondaire.
- **Clôtures opérationnelles (snapshot daté, pas un rolling changelog)** : [`docs/ops/clotures-2026-08-29.md`](../ops/clotures-2026-08-29.md). Les lots du 30–31 août sont dans le registre, pas dans ce fichier.
- **Cartographie (photos)** : [`METHODE.md`](../cartographie/METHODE.md). Ses C1/C2/C3 sont des lots **Lune** / `information_seeking`, distincts des identifiants ci-dessous.
- **ADR** : [`citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/`](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/). Carte des trois mémoires : [`Agent-Memory-Map.md`](../../citadelle-vault/Citadelle/01-Architecture/Agent-Memory-Map.md).
- **Graphe code** : [`server/src/agent/capabilities/graphify/`](../../server/src/agent/capabilities/graphify/). Artefacts `graphify-out/` régénérables, souvent hors Git.
- **Journal secondaire** : `.memory/` (pointeurs, pas doctrine). Pas un journal de version.
- **IDE / Cursor** : `.cursor/`, `.cursorrules` — aides d’édition. Pas le canon, pas le registre.
- **Télémétrie runtime** : `server/FEEDBACK_SIGNAL.json`, `server/data/conversation/health-incidents.jsonl` — observabilité, pas une couche documentaire. Hors `DOC_SOURCE_OF_TRUTH_V1`.
- **Sauvegarde** : voir références locales en bas. Le commit `5c9d682` n’est pas un ADR.

---

## Liaisons (constat figé)

Cette carte pointe. Elle ne porte pas l’état.

1. Carte vers registre : l’état des lots se lit dans [`dev/PLAN.md`](../../dev/PLAN.md) seulement.
2. Carte vers journaux de version : les faits de version se lisent dans [`Journal_de_bord.md`](../Journal_de_bord.md) et [`Journal_des_ameliorations.md`](../Journal_des_ameliorations.md), pas dans `.memory/`.
3. Lot clos vers entrée de version : un lot clos dans le registre n’est pas une entrée de journal de version par défaut. Une entrée n’existe que sur GO de version nommé. Pas automatiquement.

---

## Identifiants qualifiés (éviter les collisions C1/C2)

Batteries de tests (`G29-C1`, `G30-C2`, etc.) : identifiants de **cas**, pas des lots chantier. Ne pas les remplacer par les noms ci-dessous.

Usages historiques **inchangés** : `METHODE.md` (Lune), cartes `docs/cartographie/`, matrices G29/G30/G31.

| Identifiant | Sens |
|-------------|------|
| `METHODE-C1-LUNE` | Lot cartographie METHODE C1 (Lune / shell causal) |
| `METHODE-C2-LUNE` | Lot cartographie METHODE C2 (cadrage vs piste web) |
| `C1-2026-08-CHECKPOINT` | Posture : attendre ; ne pas livrer la CI isolément |
| `C2-PORT-2026` | Programme de portage (cinq sous-lots). Fermé tant qu’un GO par sous-lot n’existe pas |
| `C2a-SOCIAL-FAMILY` | Port rail famille |
| `C2b-SOCIAL-PRIORITY` | Port priorité check-in idle |
| `C2c-TURN-COMPREHENSION` | Port canon + `turnComprehension` min |
| `C2d-PROJECT-BUILD-ARCH-DEPTH` | Port routing / depth PROJECT_BUILD |
| `C2e-SOCIAL-RAIL-CI` | Activer le workflow après a+b+c+d |

Ne pas ajouter `C1` / `C2` nus à une taxonomie existante.

---

## Références locales (non portables)

Hors dépôt ou liées à cette machine — ne pas les traiter comme liens Git universels :

- branche `wip/checkpoint-20260824-0117` @ `5c9d682` (point de **restauration** workspace, pas HEAD des lots 30–31)
- archive `D:\Backups\nexxustudio-checkpoint-20260824.zip`
- SHA des lots portés : lire [`dev/PLAN.md`](../../dev/PLAN.md), pas cette carte

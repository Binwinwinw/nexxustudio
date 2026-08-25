# Gouvernance du Vault Citadelle (v4.5)

**Date** : 03/06/2026  
**Statut** : Actif — Phase 0 (liens & source de vérité)  
**Référence** : [[Bienvenue|Portail Bienvenue]] · taxonomie [[00-Foundation/AGENTS|AGENTS.md]] (vault, pas le `AGENTS.md` racine dépôt)

---

## Objectif

Éviter que l’archive, le wiki généré ou les stubs de migration **rivaliser** avec le canon éditable. La structure suit la **stabilité du graphe**, pas l’inverse.

---

## Couches du coffre

Racine Obsidian = `citadelle-vault/Citadelle/`. Les noms v4.5 (`02-Architecture`, `04-Operations`, …) sont des **segments**, pas des dossiers à cette racine.

| Couche | Chemin réel (filesystem) | Règle |
| :--- | :--- | :--- |
| **Canon ADR** | `01-Architecture/02-Architecture/adr/` | Zone éditable des ADR actifs |
| **Dérivé (généré)** | `03-Connaissances/Wiki/` | Produite par `node scripts/wiki_compiler.js` — **ne pas éditer à la main** |
| **LTM / runtime** | `02-Operations/01-Episodic/` | Traces de tours et index session — hors taxonomie v4.5 (décision v4.6 à venir) |
| **Archive read-only** | `99-Zone-Exclue/07-Archive/legacy-v4/` | Miroir v4 figé — **aucune modification** sauf archéologie explicite |
| **Stubs** | `01-Architecture/00-ADRs/`, `02-Operations/01-Modules/`, `99-Zone-Exclue/Décisions/` | README de redirection uniquement — ne pas y créer de notes |

---

## Source de vérité par type de contenu

| Type | Source de vérité | Index / vue |
| :--- | :--- | :--- |
| ADR | `01-Architecture/02-Architecture/adr/*.md` | [[01-Architecture/02-Architecture/adr/Index-ADR\|Index-ADR]] (manuel) |
| ADR (tableau auto) | Regénération wiki | `03-Connaissances/Wiki/Wiki-ADRs-Index.md` |
| Modules | `01-Architecture/02-Architecture/modules/` | `03-Connaissances/Wiki/Wiki-Modules-Summary.md` |
| Procédures & playbooks | `02-Operations/04-Operations/procedures/` | Liens depuis ADR et [[02-Operations/04-Operations/procedures/MANUEL-MAINTENANCE-V4.5\|Manuel maintenance]] |
| Patrimoine | `03-Connaissances/05-Knowledge/heritage/` | [[03-Connaissances/05-Knowledge/heritage/Index-Patrimoine\|Index patrimoine]] |
| Portail humain | `Bienvenue.md` | Synthèse — doit pointer vers le canon, pas vers `02-Procedural/` |

**Chemins filesystem (racine vault) vs WikiLinks** : utiliser `/`. Un WikiLink `[[02-Architecture/adr/Note]]` est un **suffixe unique** de `01-Architecture/02-Architecture/adr/Note` — il n’implique pas un dossier `02-Architecture/` à la racine. Préférer le chemin qualifié dans les notes de gouvernance. Noms courts `[[Index-ADR]]` : collision possible avec la copie legacy.

**Chemins obsolètes (ne plus lire comme dossiers racine)** :

- `02-Procedural/` → `02-Operations/04-Operations/procedures/`
- `01-Modules/` (racine : absent) ; stub `02-Operations/01-Modules/` → `01-Architecture/02-Architecture/modules/`
- `00-ADRs/` (racine : absent) ; stub `01-Architecture/00-ADRs/` → `01-Architecture/02-Architecture/adr/`
- `07-Archive/legacy-v4/` (racine : absent) → `99-Zone-Exclue/07-Archive/legacy-v4/`
- `02-Architecture/adr/` comme chemin racine → `01-Architecture/02-Architecture/adr/`

---

## Règle runtime transversale (conversation)

**`auto_reply_total_sufficiency_only`** — *auto-réponse seulement si suffisance totale*.

Voir [[01-Architecture/02-Architecture/adr/ADR-20260604-Auto-Reply-Sufficiency|ADR-20260604 — Suffisance des auto-réponses]].

---

## Règles d’édition

1. **Fail-closed documentaire** : en cas de doute, préférer le chemin qualifié depuis la racine vault (`[[01-Architecture/02-Architecture/adr/...]]`, `[[02-Operations/04-Operations/procedures/...]]`) plutôt qu’un nom court ambigu.
2. **Pas de doublon actif** : si un fichier existe dans `legacy-v4` et dans le canon, **éditer uniquement le canon**.
3. **Wiki** : après ajout ou modification d’un ADR, exécuter :

   ```bash
   cd server && node scripts/wiki_compiler.js
   ```

4. **Forge** : le code sous `01-Architecture/03-Forge/*.js` est exécuté par le runtime ; les notes `.md` du même dossier suivent les règles canon.

---

## Graphe Obsidian — hygiène des liens

- Corriger les liens cassés **dans l’arbre actif** avant tout déplacement de dossier (Phase 0).
- Exclure mentalement (ou via réglages graphe) `99-Zone-Exclue/07-Archive/legacy-v4/` pour la navigation quotidienne.
- Les liens `[[skill-*]]` pointent vers des skills **serveur** (`server/data/skills/`) — ils ne sont pas des notes vault.

---

## Phase 0 (03/06/2026) — livrable

- [x] Correction des liens `02-Procedural/` → `04-Operations/procedures/` (arbre actif)
- [x] Entrée [[01-Architecture/02-Architecture/adr/ADR-20260603-Web-Candidate-Memory|ADR mémoire candidate Web]] dans Index-ADR
- [x] Régénération `Wiki/`
- [x] Cette note de gouvernance
- [x] Alignement [[Bienvenue|Bienvenue]] (doctrine juin 2026)

**Reporté v4.6** (décision produit) : sort de `01-Episodic/`, déplacement `00-Manifeste-Doctrine.md`, suppression des stubs racine.

---

## Liens utiles

- [[01-Architecture/02-Architecture/adr/ADR-20260603-Web-Candidate-Memory|Mémoire candidate Web]]
- [[01-Architecture/02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|Discipline épistémique]]
- [[01-Architecture/02-Architecture/adr/ADR-003-Knowledge-Governance|Knowledge Governance]]
- [[03-Connaissances/Wiki/Wiki-ADRs-Index|Atlas wiki (généré)]]

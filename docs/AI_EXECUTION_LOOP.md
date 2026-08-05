# Boucle d'exécution des tâches — assistant IDE

Référence obligatoire pour tout chantier non trivial (refactor policies, routing, lots chantier B, migrations phase 2).

Voir aussi : `server/ARCHITECTURE_RULES.md` §4.7, règle projet `review-simplify-verif.mdc`.

## Principe

**No proof, no done.**  
Toute affirmation du type « c'est implémenté », « les tests passent », « le script fonctionne » doit être accompagnée d'une **preuve vérifiable**. Sinon, c'est considéré comme **non fait**.

## Boucle obligatoire

Pour toute tâche non triviale :

```
Plan → Exécution → Preuve → Vérification → Bouclage
```

Interdiction de passer à l'étape suivante tant que la preuve de l'étape courante n'est pas fournie et validée.

### 1. Plan

- Décrire les étapes nécessaires pour accomplir la tâche.
- Identifier les fichiers, scripts, tests et artefacts attendus.
- Définir les critères de succès (ex. `7/7 tests`, commit atomique, path de routing attendu).
- Un lot = un objectif ; ne pas mélanger plusieurs lots dans un même commit.

### 2. Exécution

- Exécuter les commandes et modifications **une par une**.
- Ne pas regrouper plusieurs modifications risquées sans preuve intermédiaire.
- Respecter le périmètre annoncé (pas de refactor opportuniste hors lot).

### 3. Preuve

Pour **chaque** étape, fournir au moins une preuve :

| Type | Exemple |
|------|---------|
| Tests | Sortie exacte : `ℹ pass 7`, `ℹ fail 0` |
| Commande | Log shell avec exit code |
| Rapport | Chemin + extrait (`validation_report.json`, etc.) |
| Commit | Hash + message + `git show --stat` |

Interdit : « je considère que c'est bon », « les tests devraient passer », « c'est fait » sans artefact.

### 4. Vérification

Relire les preuves et contrôler :

- Cohérence plan ↔ exécution (fichiers touchés = périmètre annoncé).
- Absence d'erreur dans les sorties.
- Complétude (toutes les étapes prévues exécutées).
- Pas de régression documentée non assumée.

En cas de doute ou d'incohérence : **bloquer** et corriger avant bouclage.

### 5. Bouclage

- Vérification OK → marquer le lot **done** (tracker §4.6, message utilisateur, commit posé si demandé).
- Vérification KO → revenir à l'étape 2 (exécution) ; ne pas avancer au lot suivant.

## Application

Cette boucle s'applique à :

- refactor routing / policies (`intentShortCircuit`, policies domaine) ;
- lots chantier B (familiarity, connector-registry, clarification-decision, repo-analysis, etc.) ;
- migrations phase 2 (move-only : imports → suppression wrappers → tests → commit atomique) ;
- tout changement impactant routing, policies ou tests.

## Commits

- **Atomiques** : un lot / une intention par commit.
- Message conventional (`fix`, `refactor`, `docs`, …) + périmètre explicite.
- Docs (`ARCHITECTURE_RULES.md`, trackers) dans un commit **séparé** du code quand c'est du suivi, pas du comportement.
- Ne pas committer sans demande explicite utilisateur (sauf hook pre-commit qui force un amend documenté).

## Contre-pouvoir utilisateur

L'utilisateur (ou un second passage de revue) peut rejeter une étape si :

- annoncée « faite » sans preuve ;
- test « passant » sans sortie collée ;
- rapport « généré » sans chemin ni extrait ;
- commit mélangeant plusieurs lots.

→ L'étape repasse en **non faite** jusqu'à preuve fournie.

## Fiche de lot

Utiliser le template : [`docs/AI_LOT_TEMPLATE.md`](AI_LOT_TEMPLATE.md).

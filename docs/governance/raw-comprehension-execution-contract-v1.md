# SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1

**Lot** : `SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1`  
**Statut** : spécification **enregistrée, non branchée**. Aucun GO d’implémentation runtime.  
**Interdit jusqu’à GO dédié** : vue runtime, matcher, sanitizer unique, 2e NLU, P4/P5, consume, lots phatiques, Pack 6/8.

Source testable : [`server/tests/fixtures/raw-comprehension-execution-contract-v1.js`](../../server/tests/fixtures/raw-comprehension-execution-contract-v1.js)  
Preuve : [`server/tests/raw-comprehension-execution-contract-v1.spec.test.js`](../../server/tests/raw-comprehension-execution-contract-v1.spec.test.js)

Canon comportement : [`citadelle-input-invariants.md`](citadelle-input-invariants.md) — pointer, ne pas recopier.  
Consume : [`consume-contract-v1.md`](consume-contract-v1.md) — `SHADOW_PROMOTION_CONSUME` reste off.

Nature : contrat de **rôles d’input**. Pas un sanitizer. Pas un packet NLU. Pas un routeur.

---

## Fiche lot

| Champ | Contenu |
|---|---|
| Objectif | Figer `rawQuery` / `comprehensionQuery` / `executionValue` et les classes A/B/C, sans brancher le runtime. |
| Périmètre | Doc gouvernance + fixture + tests de spec. Aucun fichier runtime. |
| Preuve | `server/tests/raw-comprehension-execution-contract-v1.spec.test.js` |
| Invariants | Chaîne NLU unique ; pas de 2e packet ; `entities` fermée ; JUST shadow ; `task.kind` canonique ; shadows non consommés. |
| Risques | Confondre une vue de matching avec une cible d’action (`/prod` → `prod`). Promouvoir P4/`semanticPreProcessor` en NLU d’entrée. |

---

## Décision

La chaîne a déjà plusieurs normalisations. Aucune ne distingue officiellement **comprendre** et **agir**.

```text
normaliser pour comprendre
≠
normaliser pour agir
```

Une future implémentation, s’il y a GO, expose une **vue locale** du workup existant. Elle ne crée pas de packet, ni de sanitizer unique, ni de classifieur.

`runtimeWired=false` tant qu’un GO d’implémentation n’existe pas.

---

## Définitions

### `rawQuery`

Texte exact issu de l’utilisateur, après transport minimal (`POST /api/stream` `q`, trim de transport seulement).

Référence pour : actions, extraits, URLs, chemins, identifiants, fichiers, dates, montants, code, confirmations.

Toujours conservé dès qu’une vue compréhension existe.

### `comprehensionQuery`

Vue dérivée **Classe A uniquement**. Guards conversationnels et compréhension.

Limitée, réversible, journalisable (`repairs[]`), **non exécutable**.

Un `matchKey` (casse / accents pour comparaison) est une facette interne de cette vue. Ce n’est pas un quatrième rôle, pas une source de cible.

### `executionQuery` / `executionValue`

- `executionQuery` : texte d’exécution du tour = **`rawQuery`**, sauf confirmation explicite d’une autre valeur.
- `executionValue` : token d’action extrait **depuis `rawQuery`** (chemin, URL, fichier exact, identifiant) ou valeur **confirmée**.

Jamais dérivé uniquement de `comprehensionQuery`, `matchKey`, `sanitizeQuery`, `normalizeForParse`.

### Alias à qualifier — jamais automatiques

Ces noms **ne sont pas** des synonymes des trois rôles :

| Alias actuel | Peut servir à | Ne peut pas, sans qualification + confirmation |
|---|---|---|
| `pipelineQuery` | compréhension / contexte | valeur d’action |
| `canonicalQuery` (P4) | compréhension / contexte | chemin, URL, fichier, commande |
| `effectiveQuery` | compréhension / existence | valeur d’action |
| `enrichedQuery` (context_ref) | compréhension / anaphore | identifiant, destinataire, path |

Sans étiquette explicite `role=raw|comprehension|execution`, un alias n’est **aucun** des trois rôles.

---

## Classe A — allowlist fermée

Réparations **compréhension seulement**. Pas de mot de contenu, pas de verbe d’action, pas de dépôt / fichier / ressource.

Chaque règle : entrée brute, vue, portée, raison, risque, provenance, +/- — détail machine dans la fixture `CLASS_A_RULES`.

| id | Portée | Vue | Hors portée |
|---|---|---|---|
| `apostrophe_unify` | `'` / `’` / `‘` | apostrophe ASCII pour matching | identifiants, code |
| `unicode_nfkc` | Unicode non destructif | NFKC | ne pas plier un path |
| `conversational_space_punct` | espaces, `???` / `!!` de tournure | compactage conversationnel | `/` `\` `@` des tokens C |
| `case_for_match` | casse de comparaison | `matchKey` lower | `README` d’exécution |
| `accent_for_match` | comparaison sans accent | `matchKey` fold | ne pas réécrire `dépô` → `dépôt` |
| `cava_split` | mot `cava` | `ca va` | verbes, noms métier |
| `quest_que_social` | `qu'est que` + `tu\|vous` + verbe d’activité | `qu'est-ce que` **vue seulement** | `qu'est que le serveur fait` |

`qu'est que tu fais` = Classe A bornée (social). Ce n’est pas un mandat de modifier `PHATIC_CHECKIN_RE`. Le lot phatique local reste hors de ce contrat.

Absence de preuve de réparation sûre → brut, aucune repair.

---

## Classe B — pas d’autocorrection

```text
verbes d’action
noms communs de fichier
dépôt / serveur / technologie
frameworks
termes techniques
fiichier, dépô, servr
```

Matching éventuellement tolérant **plus tard**, GO distinct. Aucune réécriture silencieuse. `raw` conservé. Clarifier si la cible ou le sens manque.

---

## Classe C — raw only

```text
URLs
chemins
noms de fichiers exacts
identifiants
personnes / destinataires
dates / heures
montants
versions
shell
code
SQL
tokens
clés
```

Exécution = brut ou confirmation.  
`sanitizeQuery("supprime /prod")` → `"supprime prod"` est un **hazard connu**, pas une valeur d’exécution autorisée.

---

## Invariants d’exécution

Testables dans la fixture :

1. Aucune action ne lit `comprehensionQuery` comme cible.
2. Aucun chemin n’est dérivé de `sanitizeQuery`.
3. Aucune URL n’est dérivée de `normalizeForParse`.
4. Aucun nom de fichier exact n’est dérivé de la vue compréhension.
5. Aucune commande, SQL ou code n’est autocorrigé.
6. Une confirmation destructive affiche la valeur brute ou explicitement résolue.
7. `rawQuery` est présent dès que `comprehensionQuery` existe.
8. Pas de preuve de réparation sûre → brut.

---

## Chaîne unique

Future vue, si GO :

- champ local du workup (`understandQuery` / `buildRequestWorkup`) ;
- pas un packet ; pas un score ; pas une entity ; pas de `targetDetector` ;
- pas de second classifieur (`quest_que_social` = condition de repair, pas une NLU) ;
- `task.kind` inchangé ; JUST shadow ; `shadow_consumed=false` ;
- `semanticPreProcessor` reste **aval** (execution brief). Interdit comme normalisation d’entrée.

P3–P5 du chantier input restent **non ouverts**.

---

## P4 et références contextuelles

P4 (`normalizeRequest`, `canonicalizeRequest`, `interpretRequest`, `resolveEffectiveQuery`) et `resolveSessionContextReference` / `preserveExistenceInEffectiveQuery` peuvent modifier **compréhension et contexte**.

Ils ne peuvent **jamais**, sans confirmation, modifier : valeur d’action, chemin, URL, identifiant, fichier, commande, date, montant, destinataire.

`preserveExistenceInEffectiveQuery` : la clause d’existence survit (canon invariant 11). Elle n’autorise pas à réécrire un path.

Ce lot **ne rouvre pas** P4/P5.

---

## Matrice

La matrice machine fait foi : `MATRIX` dans la fixture.

| Raw | Comprehension autorisée | Exécution | Classe | Attendu |
|---|---|---|---|---|
| `comment vas-tu ?` | punct / hyphen | raw | A | social |
| `comment cava ?` | `comment ca va` | raw | A | social |
| `qu'est ce que tu fais ?` | équivalent conversationnel | raw | A | phatique |
| `qu'est que tu fais ?` | vue sociale bornée | raw | A | phatique |
| `résume ce dépô` | pas de correction `dépôt` | raw | B | clarify / matching futur |
| `cree un fiichier README` | pas de cible réécrite | `README` brut | B/C | clarifier cible |
| `supprime prod` | matching seulement | `prod` brut | C | confirmation |
| `supprime /prod` | **slash conservé** | `/prod` brut | C | confirmation |
| URL GitHub | aucune réécriture | URL brute | C | repo routing |
| commande shell | aucune réécriture | brute | C | sécurité |
| SQL | aucune réécriture | brute | C | sécurité |

---

## Hors lot

Pas de runtime. Pas de matcher. Pas de lot phatique. Pas de consume. Pas de Pack 6/8. Pas de commit dans ce GO.

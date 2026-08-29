# Journal des lots — Citadelle

Registre de lots. Pas un GO d’exécution. Pas un changelog de version. Pas le canon.

Un lot technique ne s’ouvre que sur GO qui le **nomme** + fiche (objectif, périmètre, preuve, invariants, risques).

Dernière mise à jour : 2026-08-29 — `D5_TEXT_CREATION_TESTS` **clos**. File prioritaire 1→6 **terminée**.

---

## Clos / lecture seule

### D5_TEXT_CREATION_TESTS

- Statut : **clos**, validation close
- Objectif : preuves manquantes (contrats SC / transitions) — **0** règle métier nouvelle
- Fichiers touchés :
  - `server/tests/text-creation-direct.test.js` — suite D5 (8 cas)
- Validations : `text-creation-direct` **21/21** ; + `social-chat-continuity` + `formal-letter-template-policy` → voir preuve shell
- Couverture ajoutée : shells désir/fais-moi ; cas 3–5 renforcés ; transitions invite / D2+D3 PDF / D1 anti-piste sur conte
- Rollback : retirer le `describe` D5
- Prochain pas file : **aucun** (file 1→6 close)

### D2_TEXT_CREATION_SUBJECT_CONTINUITY

- Statut : **clos**, validation close
- Objectif : verbe+genre sans sujet dans le message, sujet déjà nommé dans le fil → `text_creation_direct` (pas exploratory)
- Fichiers touchés :
  - `server/src/agent/utils/intent-guards/informationSeekingIntentGuards.js` — history-aware + `extractPriorTextCreationSubject` / continuity query
  - `server/src/agent/micro/classifiers/intentShortCircuit.js` — hit SC avec `continuityEffectiveQuery` + hint sujet
  - `server/src/agent/paths/simpleFastPath.js` — pipelineQuery textCreation + continuity
  - `server/src/agent/policies/social/socialChatContinuityPolicy.js` — soft followup cède si text_creation history-aware
  - `server/src/agent/utils/context/deliverableMandateGuards.js` — clarify gate history-aware
  - `server/tests/text-creation-direct.test.js` — suite D2 (3 cas)
- Validations : `text-creation-direct` + `social-chat-continuity` → **37 pass / 0 fail**
- Comportement : hist « pollution… » + « écris un poème » → `text_creation_direct` ; « musique » seul → exploratory ; poème sans sujet ni fil → pas text_creation
- Rollback : retirer options history + helpers D2 + branche soft/SC/pipeline + tests D2
- Prochain pas file : `D5_TEXT_CREATION_TESTS` (clos)

### D1_TEXT_CREATION_NO_CLARIFY

- Statut : **clos**, validation close
- Objectif : SIMPLE_FAST honore `shortCircuit.enforce.allowRefusal === false` ; refus « piste » non livré ; fallback générique ne le réintroduit pas
- Fichiers touchés :
  - `server/src/agent/paths/simpleFastPath.js` — `scAllowRefusal` dans resolve/apply/invoke ; recovery anti-piste si SC forbid
  - `server/tests/text-creation-direct.test.js` — suite D1 (4 cas comportement)
- Validations : `text-creation-direct` + `voice-continuity-v1` → **21 pass / 0 fail**
- Hors preuve / préexistants (non régression D1) : `simple-fast-path-lot3` Italie familiarity vs info-seeking ; `document-synthesis` deterministic vs llm
- Comportement : poème + refus piste LLM → pas de « Je vois la piste » ; `salut` + refus → piste encore possible ; ambigu « écris quelque chose de beau » ≠ `text_creation_direct`
- Rollback : retirer param `scAllowRefusal` + branche recovery + tests D1
- Prochain pas file : `D2_TEXT_CREATION_SUBJECT_CONTINUITY` (clos)

### D3_OUTPUT_FORMAT_RENDER

- Statut : **clos**, validation close
- Objectif : `outputFormat` sur `text_creation_direct` contraint le rendu via `reflectiveHint` (SIMPLE_FAST) ; pas d’export fichier
- Choix Review : **brancher** (métadonnée D0 morte → utile) ; pas supprimer
- Fichiers touchés :
  - `server/src/agent/utils/intent-guards/informationSeekingIntentGuards.js` — `buildTextCreationRenderFormatHint`
  - `server/src/agent/micro/classifiers/intentShortCircuit.js` — `reflectiveHint` sur hit text_creation
  - `server/tests/text-creation-direct.test.js` — asserts hint PDF/markdown / absence sans format
- Validations : `text-creation-direct` + `information-seeking-intent-guards` → **24 pass / 0 fail**
- Comportement : « … en PDF » → hint PDF anti-export-fichier ; sans format → `reflectiveHint=null` ; markdown → hint Markdown
- Rollback : retirer helper + ligne reflectiveHint + asserts format
- Prochain pas file : `D1_TEXT_CREATION_NO_CLARIFY` (clos)

### PDF_DOCUMENT_FINALIZATION

- Statut : **clos**, validation close
- Objectif : buffer PDF LLM FILE_ANALYSIS → garde finalisation → critic (`complete` | `partial_explicit`)
- Fichiers touchés :
  - `server/src/agent/policies/document/documentFinalizationGuard.js` (nouveau)
  - `server/src/agent/policies/document/index.js`
  - `server/src/agent/policies/attachment/fileAnalysisContract.js` — checks finalisation si objet fourni
  - `server/src/agent/agentPipeline.js` — buffer `onContent=null` + finalize + critic sur `doc_analyze`+PDF
  - `server/tests/document-finalization-guard.test.js` (nouveau)
  - `docs/agents/file-analysis-contract.md` — addendum PDF finalisation
- Validations : `document-finalization-guard` 6/6 ; + `pdf-partial-analysis` + `pdf-text-layer-decision` + `file-analysis-contract` + `sql-source-analysis` → **33 pass / 0 fail**
- Comportement : répétition ≥3 / coupure mid-phrase → collapse ; statut explicite ; pas de stream live PDF FILE_ANALYSIS ; JS/SQL critic inchangé sans objet `finalization`
- Rollback : retirer module + branche pipeline + checks conditionnels + test + addendum
- Prochain pas file : `D3_OUTPUT_FORMAT_RENDER` (clos)

### INFO_SEEKING_WELLBEING_COMPOSITE

- Statut : **clos**, validation close
- Objectif : check-in wellbeing + info-seeking ciblé ne gagne plus `social_deterministic`
- Fichiers touchés :
  - `server/src/agent/policies/social/socialPatternPolicy.js` — garde `isInformationSeekingWithTarget` dans `isIdleConfirmedSocialCheckin`
  - `server/tests/information-seeking-intent-guards.test.js` — assert path positif `information_seeking_full_pipeline`
- Validations : `information-seeking-intent-guards` 18/18 ; + non-régression `social-checkin-priority`, `routing-case-dictionary`, `social-chat-continuity` → **69 pass / 0 fail**
- Comportement : « comment ca va, je cherche des infos sur teams 365 » → `information_seeking_full_pipeline` ; check-in pur reste `social_wellbeing_checkin`
- Rollback : retirer la ligne garde + asserts path
- Prochain pas file : `PDF_DOCUMENT_FINALIZATION` (clos)

### CITADELLE_ROUTING_POSTMORTEM_POEM_MODE

- Statut : **clos**, lecture seule
- Périmètre : diagnostic du mauvais rail « poème / pollution informatique / PDF »
- Fichiers : aucun
- Validations : diagnostic seulement
- Prochain pas : ne pas rouvrir

### CITADELLE_ROUTING_NON_CORRECTIONS_DISCOVERY

- Statut : **clos**, lecture seule
- Périmètre : inventaire des corrections non faites sur ce cas
- Fichiers : aucun
- Validations : inventaire, pas de code
- Prochain pas : ne pas rouvrir

### CITADELLE_ROUTING_CREATION_TEXTUELLE_D0

- Statut : **qualification close**, **validation close** — ne pas rouvrir
- Périmètre : chemin `text_creation_direct` (verbe ou désir + genre + sujet) ; pas de recherche web ; PDF = `outputFormat` ; pas de `TaskKind` nouveau
- Fichiers touchés :
  - `server/src/agent/utils/intent-guards/informationSeekingIntentGuards.js`
  - `server/src/agent/policies/intent/conversationIntentFrame.js`
  - `server/src/agent/micro/classifiers/intentShortCircuit.js`
  - `server/src/agent/utils/context/deliverableMandateGuards.js`
- Ajouts : `server/tests/text-creation-direct.test.js`
- Suppressions : aucune
- Validations : 5 cas OK (poème ; poème + PDF ; Teams 365 ; comment ça va ; lettre Canal+)
- Rollback : 4 fichiers source + supprimer le test
- Prochain pas : aucun sur ce lot

### C2_NODE_TLS_DIAGNOSTIC

- Statut : **clos**, lecture seule — `NODE_TLS_SYSTEM_CA_OK` (état de **session**, pas un GO install)
- Périmètre : TLS Node vers le registre npm
- Fichiers : aucun
- Validations : Node sans `--use-system-ca` échoue ; avec, HTTP 200 ; `npm ping` session OK puis `NODE_OPTIONS` retiré
- Prochain pas : `npm ci` **non autorisé** par ce lot

### CITADELLE_POST_D0_TODOLIST

- Statut : **clos**, lecture seule (liste d’attente + préparation de consignation)
- Périmètre : pas de code
- Fichiers : aucun dans ces tours lecture seule ; un GO registre antérieur avait déjà écrit ce fichier
- Validations : notes figées, pas de preuve runtime
- Prochain pas : ce GO d’écriture aligne le registre ; pas de lot technique

### CITADELLE_PLAN_REGISTRY_UPDATE

- Statut : **clos** à la fin de ce GO (écriture registre uniquement)
- Périmètre : `dev/PLAN.md` seulement
- Prochain pas : aucun lot technique

---

## File prioritaire (attente feu vert)

| # | GO | Statut |
|---|---|---|
| 1 | `INFO_SEEKING_WELLBEING_COMPOSITE` | **clos** |
| 2 | `PDF_DOCUMENT_FINALIZATION` | **clos** |
| 3 | `D3_OUTPUT_FORMAT_RENDER` | **clos** |
| 4 | `D1_TEXT_CREATION_NO_CLARIFY` | **clos** |
| 5 | `D2_TEXT_CREATION_SUBJECT_CONTINUITY` | **clos** |
| 6 | `D5_TEXT_CREATION_TESTS` | **clos** |

D4 skip (déjà couvert D0) sauf preuve web restante.
| 4 | `D1_TEXT_CREATION_NO_CLARIFY` | non ouvert |
| 5 | `D2_TEXT_CREATION_SUBJECT_CONTINUITY` | non ouvert |
| 6 | `D5_TEXT_CREATION_TESTS` | non ouvert |

D4 skip (déjà couvert D0) sauf preuve web restante.

---

## Non ouverts (D1–D5)

Pas des lots en cours. Préparés avant D0. D0 couvre déjà une partie. Peuvent attendre. Voir file prioritaire ci-dessus pour l’ordre d’ouverture.

| Nom | Statut | Périmètre court | Prochain pas |
|---|---|---|---|
| D1 | **clos** (voir `D1_TEXT_CREATION_NO_CLARIFY`) | allowRefusal SC → SIMPLE_FAST | — |
| D2 | **clos** (voir `D2_TEXT_CREATION_SUBJECT_CONTINUITY`) | sujet du fil → text_creation | — |
| D3 | **clos** (voir `D3_OUTPUT_FORMAT_RENDER`) | format = contrainte de rendu via reflectiveHint | — |
| D4 | **skip sauf preuve** | pas de recherche web par défaut sur génération poétique | déjà D0 |
| D5 | **clos** (voir `D5_TEXT_CREATION_TESTS`) | preuves contrat / transitions | — |

---

## Résidus D0 (hors lot)

Pas des lots. Peuvent attendre.

- `genericGreetingGuards.js` → `isSubstantiveWorkRequest` : D0 n’y a pas branché le détecteur
- JUST / G46 en ombre : étiquettes possibles (`social_checkin`, `explain`) ; consume JUST gelé
- PDF : `outputFormat=pdf` ; **pas** d’export fichier (gel file prioritaire)

---

## Hors lot — tests préexistants

Note 2026-08-26 périmée. État 2026-08-29 après `INFO_SEEKING_WELLBEING_COMPOSITE` :

1. « comment ca va, je cherche des infos sur teams 365 » → **vert** (`information_seeking_full_pipeline`)
2. « que sais tu du tigre » → **vert** (déjà avant ce GO)
3. « que sais tu du monument Taj Mahal » → **vert** (déjà avant ce GO)

---

## Observation (pas un lot)

Runtime ~23:00 (historique) : tour 1 social ; tour 2 exploratory « sujet court après invitation ».

**2026-08-29** : couvert par `D2_TEXT_CREATION_SUBJECT_CONTINUITY` quand le tour 2 = verbe+genre et le sujet était déjà nommé ; sujet court seul reste exploratory.

---

## Bloqué

- **C2** (worktree `D:\Hostinger\public_html\nexxustudio-c2-port-2026`, branche `work/c2-port-2026`) : pas d’install ici ; `npm ci` pas un GO
- **C2a** : **fermé**
- Consume JUST ; nouveau champ `entities` ; P3–P5 compréhension : gel (canon, non recopié ici)
- D0 : ne pas rouvrir
- Export PDF fichier ; SQL déjà livré : gel

---

## Prochain pas

**File prioritaire 1→6 terminée.** Aucun lot technique ouvert.

Pas d’écriture dans `docs/Journal_de_bord.md` ni `docs/Journal_des_ameliorations.md` sans GO « entrée de version ».
Pas de commit tant que non demandé.
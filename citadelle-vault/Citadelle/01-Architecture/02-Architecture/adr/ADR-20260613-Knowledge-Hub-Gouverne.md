# ADR-20260613-Knowledge-Hub-Gouverne

**Statut** : proposé  
**Date** : 2026-06-13  
**Domaine** : architecture / memory / knowledge  
**Emplacement suggéré** : citadelle-vault/Citadelle/02-Architecture/adr/ADR-20260613-Knowledge-Hub-Gouverne.md  

## Titre
Knowledge Hub gouverné — Bibliothèque canonique locale pour connaissances stabilisées

## Résumé
La Citadelle introduit un Knowledge Hub gouverné, c’est-à-dire une bibliothèque canonique locale destinée à recevoir uniquement des connaissances stabilisées, validées et promues depuis le pipeline épisode → candidat → validation → promotion.

Le Knowledge Hub ne remplace pas la mémoire chaude de session ni le candidateFactStore.js. Il agit comme un troisième étage :
- **mémoire de tour / session** : contexte vivant, chaud, éphémère ;
- **candidate facts** : salle d’attente auditable, avant vérité canonique ;
- **Knowledge Hub** : bibliothèque canonique, dédupliquée, gouvernée et réinjectable avec parcimonie.

L’objectif est de permettre à Nexxus de capitaliser des acquis stables sans retomber dans un append-only bruité, sans polluer le prompt, et sans confondre conversation passée et connaissance réutilisable.

## Contexte
Le P0 de mémoire candidate web a déjà été livré et validé : il enregistre des épisodes, extrait des faits candidats, attend un feedback utilisateur, puis autorise éventuellement une promotion gouvernée.

En parallèle, la Citadelle a déjà engagé une refonte de sa mémoire runtime avec :
- nettoyage des anciens blocs `<think>` dans l’historique ;
- structuration de la mémoire chaude en `<memory_hub>` XML ;
- politique générale de réduction du bruit contextuel et de limitation des injections inutiles.

Cette base rend possible une étape suivante : séparer clairement ce qui relève :
- de la conversation ;
- de la mémoire d’expérience ;
- de la connaissance promue et stabilisée.

Sans cette troisième couche, `candidateFactStore.js` risque de devenir un stockage append-only de faits validés mais encore mal exploités, sans vraie consolidation canonique.

## Problème
La Citadelle sait désormais :
- observer un échange utile ;
- extraire un candidat ;
- le faire valider ou rejeter ;
- promouvoir un fait sous conditions strictes.

Mais elle ne possède pas encore de réceptacle canonique dédié pour :
- stocker ces connaissances promues sous forme structurée ;
- éviter les doublons et contradictions silencieuses ;
- versionner ou superseder une connaissance obsolète ;
- réinjecter seulement les acquis pertinents dans le runtime.

Sans Knowledge Hub gouverné, deux dérives apparaissent :
- **append-only bruité** : accumulation de faits validés sans consolidation ni déduplication ;
- **injection aveugle** : réutilisation non sélective de connaissances stabilisées, qui gonfle le prompt et affaiblit la précision.

Le problème n’est donc pas “comment mémoriser plus”, mais “comment stabiliser, normaliser et réinjecter moins mais mieux”.

## Décision
La Citadelle adopte un Knowledge Hub backend-first, local-first, gouverné, composé de quatre briques principales.

### 1. knowledgeRecordStore.js
Un stockage local distinct de `candidateFactStore.js`, dédié aux connaissances canoniques.
Il gère :
- création ;
- lecture ;
- mise à jour ;
- supersession ;
- statut de cycle de vie ;
- traçabilité des sources.

Ce store devient la source de vérité stable pour les acquis réutilisables par Nexxus.

### 2. knowledgeIngestionService.js
Un service d’ingestion qui reçoit uniquement des candidats déjà promoted.
Il est responsable de :
- normalisation du fait ;
- comparaison conservatrice avec les records existants ;
- déduplication locale ;
- détection d’évolution ou contradiction ;
- création d’un nouveau record ou supersession d’un ancien.

Aucune connaissance n’entre dans le Hub directement depuis le chat ou depuis un épisode brut.

### 3. knowledgeRetrievalPolicy.js
Une politique de sélection qui décide :
- quels records sont éligibles ;
- selon quel scope ;
- à quel moment ;
- sous quelle forme courte ;
- avec quelle limite maximale d’injection.

Le Hub n’est pas injecté en vrac. La réinjection est limitée à 3 à 5 acquis maximum, choisis par pertinence et scope.

### 4. Injection runtime structurée
Le runtime pourra construire un bloc XML `<knowledge_hub>` placé à côté du `<memory_hub>`, avec sous-blocs typés :
- `<user_facts>`
- `<project_facts>`
- `<environment_facts>`
- `<workflow_rules>`

Ce bloc doit rester court, stable, lisible, et strictement utile.

## Modèle de donnée canonique
Chaque record de connaissance doit suivre une structure explicite du type :
- `knowledge_id`
- `kind`
- `subject`
- `statement_canonical`
- `aliases`
- `scope`
- `status`
- `confidence`
- `sources`
- `created_at`
- `updated_at`
- `last_validated_at`
- `supersedes`
- `superseded_by`
- `tags`

**Valeurs attendues**
- `kind` peut inclure par exemple : `technical_fact`, `environment_fact`, `project_fact`, `workflow_rule`, `user_preference`.
- `scope` peut inclure : `session`, `project`, `workspace`, `global`.
- `status` peut inclure : `active`, `superseded`, `deprecated`.

Le Hub stocke des unités de connaissance normalisées, pas du transcript ni des blocs conversationnels.

## Règles de gouvernance
Le Knowledge Hub suit les règles suivantes.

**Règle 1 — aucune entrée directe depuis le chat**
Un échange utilisateur ne peut jamais écrire directement dans le Hub. Chemin obligatoire :
chat utile -> episode -> candidate_fact -> feedback/validation -> promoted -> ingestion hub

**Règle 2 — promotion préalable obligatoire**
Seuls les candidats promoted sont éligibles à l’ingestion canonique.

**Règle 3 — déduplication conservatrice**
La déduplication locale doit être prudente :
- fusionner seulement si proximité forte ;
- sinon créer un nouveau record ;
- éviter les écrasements implicites.

**Règle 4 — supersession plutôt qu’écrasement**
Lorsqu’un fait plus récent remplace un ancien, l’ancien record passe en superseded au lieu d’être supprimé.

**Règle 5 — traçabilité obligatoire**
Chaque record doit conserver des liens vers :
- `candidate_id`
- `episode_id`
- événement de validation
- horodatage de création / validation

Aucune connaissance canonique ne doit être “orpheline” de sa chaîne de preuve.

**Règle 6 — réinjection parcimonieuse**
Le runtime ne peut pas injecter massivement le Hub dans le prompt. Une politique de sélection stricte doit limiter le volume, la redondance et les scopes non pertinents.

**Règle 7 — fail-closed**
En cas d’erreur d’ingestion, de déduplication ou de lecture :
- le Hub ne bloque jamais la réponse utilisateur ;
- l’écriture échoue silencieusement ou via log contrôlé ;
- aucune connaissance douteuse n’est promue “par défaut”.

## Flux cible
Le flux nominal devient :
1. échange utile ;
2. enregistrement d’un épisode ;
3. extraction d’un candidat ;
4. validation/rejet via feedback ;
5. promotion si policy OK ;
6. ingestion dans le Knowledge Hub ;
7. consolidation canonique ;
8. retrieval ultérieur selon scope et pertinence ;
9. injection minimale sous forme `<knowledge_hub>`.

## Ce que le Knowledge Hub n’est pas
Le Knowledge Hub n’est pas :
- une sidebar UI remplie de fiches arbitraires ;
- un transcript longue durée ;
- une mémoire brute de chat ;
- un append-only de faits “validés” mais non consolidés ;
- un RAG généraliste branché trop tôt ;
- un système qui injecte toute la base dans le prompt.

Il s’agit d’un noyau canonique gouverné, pas d’un menu produit décoratif.

## Conséquences

### Conséquences positives
La Citadelle distingue enfin clairement : mémoire chaude, mémoire candidate, connaissance canonique.
Les faits promus deviennent dédupliqués, versionnables, auditables et réinjectables proprement.
Le runtime peut exploiter des acquis stables sans réinjecter l’historique brut.
La croissance mémoire devient gouvernée plutôt qu’accumulative.

### Coûts et contraintes
- Complexité backend plus élevée ;
- besoin d’une politique prudente de déduplication ;
- nécessité de tests E2E et de traçabilité stricte ;
- risque de mauvaise canonicalisation si les heuristiques sont trop agressives.

Ces coûts sont acceptés, car ils complexifient un peu le code pour simplifier fortement la cognition et la gouvernance du système.

## Plan d’implémentation
- **Étape 1 — ADR** : Déposer le présent ADR dans le Vault.
- **Étape 2 — Backend canonique** : Créer `knowledgeRecordStore.js` et `knowledgeIngestionService.js`.
- **Étape 3 — Policy de retrieval** : Créer `knowledgeRetrievalPolicy.js`.
- **Étape 4 — Binding promotion** : Brancher l’ingestion sur le passage `candidate_validated` -> `promoted`.
- **Étape 5 — Injection runtime** : Ajouter un bloc `<knowledge_hub>` minimal à côté de `<memory_hub>`.
- **Étape 6 — Non-régression** : Créer au minimum `knowledge-hub-ingestion.test.mjs`.

## Critères de succès
Le chantier est considéré réussi si :
- un candidat promu produit un record canonique stable ;
- deux candidats très proches ne créent pas deux vérités concurrentes inutiles ;
- une connaissance obsolète peut être superseded proprement ;
- la policy de retrieval ne remonte pas de faits hors scope ;
- l’injection `<knowledge_hub>` reste courte, propre et non redondante ;
- aucune panne du Hub ne bloque la réponse utilisateur.

## Alternatives rejetées
1. **Réutiliser uniquement candidateFactStore.js** : Rejeté, car ce store est une salle d’attente, pas une bibliothèque canonique.
2. **Injecter directement tous les faits validés** : Rejeté, car cela recrée le problème d’injection brute et de bruit contextuel.
3. **Construire une UI “Knowledge Hub” avant le backend** : Rejeté, car le chantier doit rester backend-first et gouverné, pas menu-first.
4. **Fusion automatique agressive** : Rejeté, car une déduplication trop ambitieuse créerait des confusions silencieuses et des pertes de traçabilité.

## Liens transverses
- [[ADR-20260603-Web-Candidate-Memory]]
- Refonte runtime `<memory_hub>` / purge `<think>`
- Doctrine “copier la méthode, rejeter le produit”
- Principe low-redundancy / anti-append-only context

## Verdict
La Citadelle adopte un Knowledge Hub gouverné, local, backend-first, distinct de la mémoire chaude et des candidats. Le Hub devient la bibliothèque canonique des connaissances stabilisées, avec promotion stricte, déduplication prudente, traçabilité complète, et réinjection minimale dans le runtime.

Ce chantier est accepté car il prolonge exactement la doctrine actuelle :
- complexifier un peu le code ;
- simplifier la cognition du système ;
- faire grandir la plateforme par capacités gouvernées, pas par accumulation implicite.

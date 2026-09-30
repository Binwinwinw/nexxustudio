# D-20260922 — JUST shadow only et autorité opérationnelle

- **Statut :** accepted
- **Date :** 2026-09-22
- **Domaine :** input-understanding / runtime-authority / governance
- **Décision liée :** D-20260909-input-understanding-authority

## Contexte

Le runtime comporte une contradiction entre le canon et certains consommateurs
existants de JUST.

Le canon, l’invariant 6 et la décision
`D-20260909-input-understanding-authority` définissent JUST comme une couche
shadow/observe : JUST complète le triage sans le remplacer et ne constitue pas
une autorité de routage.

Les reconnaissances `RECON-INTENT-AUTHORITY-20260922-JUST-CONSUMPTION-V1` et
`RECON-JUST-AUTHORITY-20260922-MIGRATION-SURFACE-V1` ont toutefois établi que
JUST influence actuellement des décisions utilisateur-visibles ou opérationnelles :
clarification, `CLARIFY_ONE`, guided creation, code fallback,
tool-heavy/caveman et addon du prompt Composer.

Le cycle, `response_commitment` et C4 ne consomment pas JUST. Les contrats
officiels permettant de remplacer tous les consommateurs JUST n’existent pas
encore de manière homogène, notamment pour les questions de clarification et
certains contrats guided.

## Décision

1. **JUST reste une couche shadow diagnostique.** Il peut produire des labels,
   comparaisons, telemetry, observabilité et enrichissements non décisionnels.
   Il ne possède aucune autorité opérationnelle implicite.

2. **JUST ne doit pas décider, directement ou indirectement,** d’un path,
   d’une clarification, d’un acte conversationnel, d’un outil, connecteur,
   modèle, prompt décisionnel, permission, refus, exécution, texte utilisateur
   final ou mise à jour d’état.

3. **Les décisions opérationnelles doivent être portées par un propriétaire et
   un contrat officiels.** Le cycle porte la compréhension structurelle et le
   `response_commitment`; qualification porte les slots et questions manquantes ;
   routing porte les gates de décision ; les domaines code/guided/capabilities
   portent leurs signaux métier ; prompt/delivery ne reçoivent que des
   instructions compatibles avec ces contrats.

4. **La migration suit la trajectoire C vers l’état B.** Pendant la transition,
   les signaux opérationnels sont extraits ou enrichis dans leurs domaines
   propriétaires. L’état cible est l’absence de tout consommateur JUST
   autoritaire.

5. **L’option “JUST autoritaire, même dans un périmètre limité” est refusée.**
   Elle ne peut être réintroduite que par une décision ultérieure qui supersede
   explicitement cette décision, l’invariant 6 et les éléments contradictoires
   du canon.

6. **Aucun nouveau consommateur autoritaire de JUST n’est autorisé.** Toute
   demande de dérogation exige une décision de gouvernance explicite, un
   propriétaire nommé, un contrat/schéma, des tests d’autorité et une preuve de
   non-contournement.

## Migration gouvernée

La migration est effectuée par familles indépendantes, sans big-bang :

1. Prévention : interdire tout nouveau consume JUST autoritaire et mettre en
   place une preuve de non-autorité.

2. Addon Composer : rétrograder ou retirer l’addon `INTENTION JUSTE` en tant
   qu’instruction décisionnelle ; conserver seulement des enrichissements
   compatibles avec les contrats officiels.

3. Tool-heavy/caveman : basculer vers `classifyCodeIntent` et
   `action_decision.capabilities.code`, sans dépendre de `JUST.codeIntentKind`.

4. Code fallback : basculer vers `classifyCodeIntent` et le filet de création
   officiel existant.

5. Guided creation : enrichir puis employer un contrat code/html/frame officiel ;
   ne pas remplacer JUST avant que ce contrat soit disponible et couvert.

6. Clarification et conversation move : en dernier. Définir d’abord le
   propriétaire unique de la clarification bloquante, une source officielle des
   questions manquantes et un gate unique qui est consommé par
   `conversationMove` sans recalcul JUST.

Chaque étape exige un GO distinct, un périmètre fermé, les tests de contrat
nécessaires et une preuve que JUST n’est plus consommé avec un effet
autoritaire pour la famille concernée.

## Invariants

- Une chaîne amont reste la source de vérité structurelle ; aucune seconde NLU
  opérationnelle ne doit être introduite.
- Le cycle, `response_commitment` et C4 restent les autorités existantes de
  compréhension structurelle, de job de réponse et d’émission typée.
- C4 ne devient pas un mécanisme de classification d’intention.
- `JUST`, `intentComposition` et `deliverableContract` restent shadow/observe
  tant qu’une décision ultérieure explicite ne modifie pas leur statut.
- Les lots de migration ne modifient pas implicitement les familles non ciblées.
- Toute nouvelle décision, tout schéma et tout test doivent être alignés avec
  ce document et les sources de vérité de gouvernance applicables.

## Conséquences

- Certains comportements JUST actuels restent temporairement en place jusqu’à
  leur migration explicite ; cette persistance n’est pas une légalisation de
  leur autorité.
- Les migrations guided et clarification sont bloquées jusqu’à la disponibilité
  de contrats officiels suffisants.
- Les tests et la telemetry doivent distinguer JUST observé, JUST comparé et
  JUST effectivement consommé.
- Les documents de gouvernance ultérieurs doivent employer “consume JUST”
  uniquement pour désigner un usage décisionnel ou opérationnel de JUST, afin
  d’éviter l’ambiguïté avec le sens “le cycle est consommé par JUST”.

## Interdits jusqu’à décision ultérieure

- Nouveau path, gate, prompt, fallback ou override dont la décision dépend de
  `JUST`.
- Promotion de JUST comme autorité de routing, clarification, exécution ou
  rendu.
- Migration big-bang des six consommateurs.
- Suppression de JUST de clarification avant la création et validation du
  contrat officiel de clarification.
- Réinterprétation d’un signal shadow comme signal opérationnel sans
  propriétaire, contrat et tests.

## Critères de suivi

Une famille est considérée migrée lorsque :

1. Son décisionnaire officiel est identifié et couvert par un contrat explicite.
2. Les tests démontrent que la décision est inchangée ou volontairement
   gouvernée sans JUST.
3. Les consommateurs de JUST de cette famille sont supprimés ou rétrogradés en
   observabilité non décisionnelle.
4. Une preuve statique et comportementale confirme l’absence de consommation
   JUST autoritaire pour cette famille.
5. Les régressions de la famille et des contrats voisins sont vertes.

# Invariants Citadelle — compréhension d’input

Source de vérité du **comportement**. Pas une mémoire de chantier. Pas un protocole d’exécution.

Si un autre document contredit cette page : **cette page gagne**.

Mémoire (historique des lots) : [`docs/agents/input-comprehension-chantier.md`](../agents/input-comprehension-chantier.md)  
Protocole (plan → preuve → bouclage) : [`docs/AI_EXECUTION_LOOP.md`](../AI_EXECUTION_LOOP.md)  
Preuve runtime : tests listés ci-dessous.

---

## Invariants

1. Une seule chaîne amont. Pas de 2e NLU.
2. `understandQuery` + `buildRequestWorkup` = vérité structurelle.
3. `runAgentUnderstandingPhase` = seul orchestrateur de compréhension. `SovereignOrchestrator` est aval.
4. **Packet → copie → arrêt.** Pas de couche supplémentaire sans besoin réel.
5. `turnComprehension.entities` copie le packet. Liste de champs **fermée** : `subjects`, `sources`, `localities`, `attachments`.
6. JUST : shadow seulement. Consume interdit tant qu’un lot dédié n’est pas validé.
7. Les tests sont la preuve. Un souvenir documentaire ne suffit pas.
8. Cadrage conversationnel : sujet clair reste sujet ; exemple reste exemple ; correction utilisateur remplace l’hypothèse ; pas de web avant cadrage stable.
9. Vision attachée : l’image est l’ancre du tour ; l’ancrage lexical ne rejette pas une description visuelle valide.
10. Vision attachée + demande de description explicite : pas de refus *piste / destination* ; livrer le briefing ou une erreur honnête.
11. Unité explicite d’existence / fraîcheur : survit à la normalisation ; borne la réponse sans changer le sujet ; compression invalide si elle disparaît de `effectiveQuery`, des contraintes (`scope_guard`), du plan ou de la requête web.

---

## Interdits

- Inventer un champ dans `turnComprehension.entities`.
- Brancher un extracteur / NER / parse météo pour « enrichir » la projection.
- Coupler `entities` vers SC, clarify ou JUST.
- Consommer JUST ← frame par opportunité.
- Réparer un rouge gelé au passage d’un autre lot.
- Sanitizer unique, score de confiance unique, clarify parallèle, planner tool-loop amont.
- Coupler le cadrage conversationnel (invariant 8) à `entities`, à un 2e NLU, ou le « réparer » via sanitation web, volume adaptatif ou shape FACTUAL.
- Élargir l’exemption `entity_miss` hors Vision attachée (contrat `VISION_ATTACHED` + image réelle + requête Vision explicite), ou y désactiver `foreign_template`.
- Livrer `INSUFFICIENT_SIGNAL_REFUSAL` (*piste / destination*) sur `VISION_ATTACHED` avec image réelle et demande Vision explicite. Ne pas y réutiliser le fallback document.
- Parser multi-unités générique, champ `entities` nouveau, consume JUST, sanitation / ranking web, ou réouverture Vision / `subject_angle_explore` pour « réparer » une clause d’existence.

---

## Ouverture d’un lot

Un lot autonome, avec besoin **explicite**. Fiche minimale :

| Champ | Obligatoire |
|-------|-------------|
| Objectif | Oui |
| Périmètre | Oui |
| Preuve | Oui (test ou sortie collée) |
| Invariants | Oui (ceux de cette page, plus ceux du lot) |
| Risques | Oui |

Sans ces cinq champs : le lot n’est pas ouvert. P3–P5 restent non ouverts tant que personne ne les demande.

---

## Fermeture

- Preuve collée. Hors périmètre intact.
- Aucun champ / contrat élargi « pour plus tard ».
- Le lot suivant ne s’ouvre pas par inertie.
- Chantier compréhension d’input : **fermé** (P0–P2 faits, P3–P5 non ouverts).

---

## Rouges gelés

Ne pas les « réparer » hors lot dédié. Surtout pas via `entities`.

| Rouge | Fichier | Gel |
|-------|---------|-----|
| `SC bonjour → social_deterministic verified` (`verified_ok` attendu) | `server/tests/turn-loop-comprehension.test.js` | Hors lot. Explicitement gelé. |
| Composite « salut + React » → `task.kind` null | `server/tests/request-intent-frame.test.js` | Préexistant. |
| Composite hooks → reste `social_deterministic` | `server/tests/conversation-intent-frame.test.js` | Préexistant. |
| React+job → `career` au lieu de `technical_learning_path` | `server/tests/intent-frame-ambiguity-battery.test.js` | Préexistant. |
| Corpus familiarity / GK, paths décalés | `server/tests/clarification-decision-policy.test.js` | Préexistant. |

---

## Preuve (tests)

Les tests **protègent** le contrat. Ils ne documentent pas une intention.

| Contrat | Test |
|---------|------|
| Projection P2, liste de champs fermée | `server/tests/turn-loop-comprehension.test.js` — suite `entities P2` |
| Présence de ce canon | `server/tests/citadelle-input-invariants.test.js` |
| Shadow JUST, consume interdit | télémétrie JUST + tests frame (P1) |
| Cadrage sujet / contexte / correction | `server/tests/conversation-framing-subject-context.test.js` |
| Ancrage Vision attachée (`entity_miss`) | `server/tests/current-turn-anchoring.test.js` — suite Vision |
| Refus COMPOSER Vision (`allowRefusal` / piste) | `server/tests/mode-response-contracts.test.js` — suite Vision attachée |
| Complétude d’input — clause d’existence (`scope_guard`) | `server/tests/existence-scope-guard.test.js` |

Un changement qui casse ces tests n’est pas une amélioration : c’est une régression, sauf lot autonome validé qui met à jour **à la fois** ce canon et les tests.

---

## Anti-divergence

Mémoire vs canon, protocole vs canon, règle IDE vs canon : **le canon gagne**.  
Les autres documents se corrigent pour **pointer**, pas pour redéfinir.

1. Un changement de comportement met à jour **le canon et les tests ensemble**.
2. Les autres documents **ne recopient pas**.
3. Dupliquer une règle de cette page = erreur.

---

## Maintenance

- **Lot** : fiche 5 champs, liée à cette page. Code seulement après preuve. Si le comportement change : canon + tests dans le même geste. Aucun autre doc recopié.
- **Rouge gelé** : le laisser rouge. Le nommer ici. Fix = lot autonome seulement. Interdit : réparer au passage, ou via `entities`.
- **Nouveau document** : pointeur vers cette page. Il ne réécrit pas les invariants. S’il les recopie, il est en erreur.

---

## Rappel opérationnel

Vérité : cette page.  
Ouvrir un lot : fiche 5 champs, liée ici. Code après preuve.  
Rouge gelé : le laisser. Fix = lot autonome. Jamais via `entities` ni au passage.  
Tests : comportement changé → canon + tests ensemble.

# Baby-ADR – Gouvernance épistémique de Nexxus (v1)

## 1. Titre
Politique d’alerte heuristique pour la gouvernance épistémique de Nexxus

## 2. Contexte
La Citadelle doit identifier rapidement les poussées d’incertitude (`EPISTEMIC_FAIL_CLOSED`) qui peuvent indiquer :
- un biais de contexte,
- une fausse rumeur,
- ou un problème de politique / modèle / base de connaissances.

Un module de gouvernance a été mis en place (`governanceRoutes.js`) avec des agrégats et un premier moteur d’alerte basé sur :
- `fail_closed_timeseries`,
- `fail_closed_by_domain`,
- `fail_closed_by_version`,
- `recent_high_blocks`,
- `top_locked_topics_7d`.

## 3. Objectif
Éviter l’alert fatigue tout en conservant un signal d’alarme utile pour :
- ajuster les policies (`uncertaintyPolicy`, routeur d’intention),
- enrichir les bases de connaissances RAG,
- corriger prompts ou modèles.

## 4. Alternatives examinées
- **Seuil fixe simple** : risque de bruit si le volume total est faible.
- **Baseline glissante 7-jours** : prend en compte la saisonnalité, mais nécessite du temps de stabilisation.
- **Pondération par domaine** : permet de ne pas sur-alerter sur des composants périphériques.
- **Baseline glissante + pondération** : bon compromis, mais plus complexe à configurer et à documenter.

## 5. Décision (à figer après la consolidation)
Pendant la phase pilotée par données, on retient une policy temporaire qui deviendra probablement la base de la décision finale :

**Baseline**
- `baseline_period` = 7 days (glissante).

**Seuils mini**
- `MIN_THRESHOLD` = 5 événements, en dessous de quoi aucune alerte n’est émise.

**Règle 1 – VOLUME_SPIKE**
- Déclenchement si le volume 24h dépasse de X% la moyenne des 7 jours.

**Règle 2 – DOMAIN_SPIKE**
- Déclenchement si un domaine voit son volume de blocages multiplié par Y par rapport à sa moyenne 7-jours, et si ce domaine représente plus de Z% du trafic global.

**Mode de gestion**
- Alertes écrites dans un canal dédié (log / UI),
- Revue humaine hebdomadaire (ou après chaque changement majeur de contexte/model/policy).

*(À compléter dans la phase finale : valeurs exactes de X, Y, Z et la politique de gestion des faux positifs.)*

## 6. Règles de mise à jour
- Les seuils et la baseline peuvent être ajustés tous les N cycles (ex : 2 semaines),
- à condition que l’ajustement soit justifié par au moins deux semaines de données de référence,
- et documenté dans une section “Historique des ajustements”.

## 7. Liens
- Fichier : `02-Architecture/modules/Governance-API.md`
- Code :
  - `server/src/routes/governanceRoutes.js`

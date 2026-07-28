# Protocole : Ground Truth Review (v1)

Ce protocole définit la méthode de revue humaine pour établir la **Vérité Terrain** de La Citadelle. L'objectif est de transformer l'observabilité passive en un système de calibration active.

## 1. Objectifs Opérationnels
- Mesurer la **justesse réelle** (Accuracy) vs le score SMAC.
- Identifier le **taux de sur-blocage** (Overblocking) du Critic.
- Alimenter le dataset de calibration pour la Tâche 6.

## 2. Échantillonnage Prioritaire
Un lot de 5 à 10% des tours doit être revu, avec une priorité sur :
1.  **Rejets Critic** (`valid: false`) : Pour valider si le blocage était légitime.
2.  **Hypothèses Prudentes** (Score < 0.75) : Pour vérifier si le doute de l'IA était fondé.
3.  **Discordances Short-Circuit** : Pour analyser les tours ayant nécessité plusieurs tentatives.
4.  **Erreurs de Syntaxe** : Pour confirmer la défaillance du proxy syntaxique.

## 3. Taxonomie des Labels
Chaque trace doit recevoir l'un des labels suivants via `/api/reliability/label` :

| Label | Description | Impact Calibration |
| :--- | :--- | :--- |
| `correct` | Réponse exacte, sourcée et conforme au contrat. | +1.0 |
| `partially_correct` | Réponse utile mais perfectible ou légèrement imprécise. | +0.5 |
| `incorrect` | Hallucination, erreur technique ou violation de souveraineté. | 0.0 |
| `overblocked` | La réponse était correcte mais le Critic l'a rejetée à tort. | Alerte Dérive |

## 4. Workflow de Revue
1.  **Extraction** : Récupérer les traces via le Cockpit ou `server/data/logs/reliability/`.
2.  **Analyse** : Comparer `[OBSERVÉ]` avec le code réel sur disque.
3.  **Annotation** : Soumettre le label et un commentaire court (ex: "Critic a bloqué une info valide car absente du scan partiel").
4.  **Action** : Si `overblocked` > 15% sur un lot, déclencher une révision des règles du Critic.

## 5. Cible de Maturation
Le premier lot cible est de **100 traces annotées** pour stabiliser la ligne de base de la calibration SMAC.

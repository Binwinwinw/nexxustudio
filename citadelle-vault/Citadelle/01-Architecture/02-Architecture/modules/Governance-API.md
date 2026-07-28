# 🛡️ Spécification : API de Gouvernance et Télémétrie Épistémique

## 1. Contexte & Périmètre

Le module API de Gouvernance (`server/src/routes/governanceRoutes.js`) sépare la visualisation analytique de la collecte brute des logs d'audit. Il expose des agrégats pour surveiller spécifiquement les événements `EPISTEMIC_FAIL_CLOSED` et générer des alertes heuristiques.

*Note : L'Architecture Decision Record (ADR) détaillant les seuils définitifs et la politique d'alerte (bruit, faux positifs) est volontairement suspendu dans l'attente d'une période d'observation empirique.*

## 2. Endpoints d'Agrégation

- `GET /fail_closed_timeseries` : Volume quotidien des blocages épistémiques (fenêtre glissante par défaut : 30 jours).
- `GET /fail_closed_by_domain` : Répartition et concentration des blocages par agent ou par domaine d'expertise.
- `GET /fail_closed_by_version` : Suivi comparatif des événements par rapport aux versions déployées (modèle, routeur, etc.).
- `GET /recent_high_blocks` : Extraction des derniers blocages catégorisés en sévérité `HIGH` ou `CRITICAL`.
- `GET /top_locked_topics_7d` : Sujets ou requêtes ayant causé le plus de blocages sur les 7 derniers jours.

## 3. Moteur d'Alertes Heuristiques

L'endpoint `GET /alerts` expose l'état du système d'alerting opérationnel :
- **Min Threshold** : Fixé à 5 événements minimaux pour ignorer les micro-fluctuations (bruit de fond).
- **Règle VOLUME_SPIKE** : Déclenche une alerte de type `WARNING` si le volume global sur les dernières 24h double par rapport à la période des 24h précédentes.
- **Règle DOMAIN_SPIKE** : Déclenche une alerte si la concentration de blocages sur un domaine spécifique subit un facteur multiplicatif x3 par rapport aux 24h précédentes.

## 4. Evolutions Prévues (Backlog de Gouvernance)

- Introduction d'une *baseline* glissante sur 7 jours pour l'amortissement du bruit sur les faibles volumes.
- Mise en place d'une heuristique de "poids relatif" : le *spike* par domaine devra être pondéré par la part globale du domaine dans le trafic total de l'API.

---

Document mis à jour le 20/05/2026 - Citadelle Gouvernance Observability
